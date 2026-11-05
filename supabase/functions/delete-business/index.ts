import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("[delete-business] Function invoked");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[delete-business] Missing environment variables");
      throw new Error("Missing environment variables");
    }

    console.log("[delete-business] Environment variables loaded");

    // Create admin client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log("[delete-business] Admin client created");

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[delete-business] Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("[delete-business] Auth token received, verifying user...");

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error("[delete-business] Auth verification failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: authError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[delete-business] User authenticated: ${user.id}`);

    // Parse request body
    const { businessId, userId } = await req.json();
    console.log(`[delete-business] Request params - businessId: ${businessId}, userId: ${userId}`);

    if (!businessId || !userId) {
      console.error("[delete-business] Missing businessId or userId");
      return new Response(
        JSON.stringify({ error: "Missing businessId or userId parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the authenticated user matches the userId parameter
    if (user.id !== userId) {
      console.error(`[delete-business] User ID mismatch - token: ${user.id}, param: ${userId}`);
      return new Response(
        JSON.stringify({ error: "User ID mismatch" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[delete-business] Checking business ownership...");

    // Check business ownership
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("owner_user_id")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error("[delete-business] Error checking business ownership:", businessError);
      return new Response(
        JSON.stringify({ error: "Failed to verify business ownership", details: businessError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!business) {
      console.error(`[delete-business] Business not found: ${businessId}`);
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[delete-business] Business found - owner: ${business.owner_user_id}`);

    if (business.owner_user_id !== userId) {
      console.error(`[delete-business] Ownership mismatch - owner: ${business.owner_user_id}, requester: ${userId}`);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Only the business owner can delete this business" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[delete-business] Deleting business ${businessId}...`);

    // Notify team members before deletion
    const { data: teamMembers } = await supabaseAdmin
      .from("user_business_roles")
      .select("user_id")
      .eq("business_id", businessId)
      .neq("user_id", userId);

    if (teamMembers && teamMembers.length > 0) {
      const { data: businessInfo } = await supabaseAdmin
        .from("businesses")
        .select("business_name")
        .eq("id", businessId)
        .single();

      const notifications = teamMembers.map((member) => ({
        user_id: member.user_id,
        business_id: businessId,
        type: "business_deleted",
        title: "Business Deleted",
        message: `The business "${businessInfo?.business_name || "Unknown"}" has been deleted by the owner. You no longer have access.`,
        data: { business_id: businessId, deleted_by: userId },
      }));

      await supabaseAdmin.from("notifications").insert(notifications).catch((err: any) => {
        console.error("[delete-business] Non-critical: failed to notify team members:", err);
      });
    }

    // Delete storage files before deleting the business record
    console.log("[delete-business] Cleaning up storage files...");
    
    // Product images: only plain object names under products/, and never an object that a
    // product of another business still points at (image_url is member-writable, so a path
    // in it is not proof that the object belongs to this business).
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, image_url")
      .eq("business_id", businessId);

    const PRODUCT_PATH_RE = /^products\/[A-Za-z0-9._-]+$/;
    const candidatePaths = new Set<string>();
    for (const p of products ?? []) {
      const match = typeof p.image_url === "string" ? p.image_url.match(/\/product-images\/([^?#]+)/) : null;
      const path = match ? decodeURIComponent(match[1]) : null;
      if (path && PRODUCT_PATH_RE.test(path)) candidatePaths.add(path);
    }

    const productImagePaths: string[] = [];
    for (const path of candidatePaths) {
      const { data: otherRefs } = await supabaseAdmin
        .from("products")
        .select("id")
        .neq("business_id", businessId)
        .ilike("image_url", `%/product-images/${path}`)
        .limit(1);
      if (otherRefs && otherRefs.length > 0) {
        console.warn(`[delete-business] Keeping ${path}: referenced by a product of another business`);
        continue;
      }
      productImagePaths.push(path);
    }

    if (productImagePaths.length > 0) {
      const { error: storageErr } = await supabaseAdmin.storage
        .from("product-images")
        .remove(productImagePaths);
      if (storageErr) console.error("[delete-business] Storage cleanup (product-images):", storageErr);
      else console.log(`[delete-business] Removed ${productImagePaths.length} product images`);
    }

    // Business images (logo, payment QR): the app stores them under businesses/<file>, so the
    // exact objects named by the business row are removed, not a listing of a prefix.
    const { data: bizRow } = await supabaseAdmin
      .from("businesses")
      .select("business_image_url, receipt_payment_qr_url")
      .eq("id", businessId)
      .maybeSingle();

    const BUSINESS_PATH_RE = /^businesses\/[A-Za-z0-9._-]+$/;
    const bizPaths: string[] = [];
    for (const url of [bizRow?.business_image_url, bizRow?.receipt_payment_qr_url]) {
      const match = typeof url === "string" ? url.match(/\/business-images\/([^?#]+)/) : null;
      const path = match ? decodeURIComponent(match[1]) : null;
      if (path && BUSINESS_PATH_RE.test(path)) bizPaths.push(path);
    }

    if (bizPaths.length > 0) {
      const { error: bizStorageErr } = await supabaseAdmin.storage
        .from("business-images")
        .remove(bizPaths);
      if (bizStorageErr) console.error("[delete-business] Storage cleanup (business-images):", bizStorageErr);
      else console.log(`[delete-business] Removed ${bizPaths.length} business images`);
    }

    // Delete the business (CASCADE will handle all related records automatically)
    // This is wrapped in a transaction automatically by PostgreSQL
    const { error: deleteError } = await supabaseAdmin
      .from("businesses")
      .delete()
      .eq("id", businessId)
      .eq("owner_user_id", userId); // Double-check ownership in DELETE

    if (deleteError) {
      console.error("[delete-business] Error deleting business:", deleteError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to delete business", 
          details: deleteError.message,
          hint: deleteError.hint || "Check database logs for more details",
          code: deleteError.code
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[delete-business] Business deleted successfully: ${businessId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Business and all related data deleted successfully",
        businessId: businessId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[delete-business] Unhandled error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});