import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const APPLE_VERIFY_RECEIPT_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const { receipt, platform, userId } = await req.json();

    if (!receipt || !platform || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: receipt, platform, or userId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Validating receipt:', { platform, userId, receiptLength: receipt.length });

    let isValid = false;
    let expiresDate: string | null = null;
    let productId: string | null = null;

    if (platform === 'ios') {
      const appleSharedSecret = Deno.env.get('APPLE_SHARED_SECRET');

      if (!appleSharedSecret) {
        console.warn('APPLE_SHARED_SECRET not configured, using test mode');
        isValid = true;
        productId = 'bizmanage.pro.month';
        expiresDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        const appleResponse = await fetch(APPLE_VERIFY_RECEIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'receipt-data': receipt,
            'password': appleSharedSecret,
          }),
        });

        const appleData = await appleResponse.json();
        console.log('Apple verification response status:', appleData.status);

        if (appleData.status === 21007) {
          console.log('Sandbox receipt detected, verifying with sandbox');
          const sandboxResponse = await fetch(APPLE_SANDBOX_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              'receipt-data': receipt,
              'password': appleSharedSecret,
            }),
          });
          const sandboxData = await sandboxResponse.json();

          if (sandboxData.status === 0 && sandboxData.latest_receipt_info) {
            const latestReceipt = sandboxData.latest_receipt_info[sandboxData.latest_receipt_info.length - 1];
            isValid = true;
            expiresDate = new Date(parseInt(latestReceipt.expires_date_ms)).toISOString();
            productId = latestReceipt.product_id;
            console.log('Sandbox receipt validated successfully');
          } else {
            console.error('Sandbox receipt validation failed:', sandboxData);
          }
        } else if (appleData.status === 0 && appleData.latest_receipt_info) {
          const latestReceipt = appleData.latest_receipt_info[appleData.latest_receipt_info.length - 1];
          isValid = true;
          expiresDate = new Date(parseInt(latestReceipt.expires_date_ms)).toISOString();
          productId = latestReceipt.product_id;
          console.log('Production receipt validated successfully');
        } else {
          console.error('Apple receipt validation failed:', appleData);
        }
      }
    } else if (platform === 'android') {
      console.log('Android receipt validation - using test mode');
      isValid = true;
      productId = 'bizmanage.pro.month';
      expiresDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    if (isValid) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      console.log('Updating subscription in database:', {
        userId,
        status: 'active',
        productId,
        expiresDate
      });

      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          subscription_status: 'active',
          subscription_product_id: productId,
          subscription_expiration_date: expiresDate,
          receipt_data: receipt,
          last_validated_at: new Date().toISOString(),
          platform: platform,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      console.log('Subscription updated successfully - Realtime will broadcast this change');
    }

    return new Response(
      JSON.stringify({
        isValid,
        expiresDate,
        productId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error validating subscription:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
