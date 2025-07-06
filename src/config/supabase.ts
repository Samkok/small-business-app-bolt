import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: customFetch
  },
});

// Custom fetch implementation with timeout and retry logic
async function customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 15000; // 15 seconds timeout
  
  let retries = 0;
  let lastError: Error | null = null;
  
  while (retries < MAX_RETRIES) {
    try {
      // Create an AbortController to handle timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      // Add the signal to the fetch options
      const fetchOptions: RequestInit = {
        ...init,
        signal: controller.signal
      };
      
      // Attempt the fetch
      const response = await fetch(input, fetchOptions);
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Return successful response
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a timeout error
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.warn(`Fetch timeout (attempt ${retries + 1}/${MAX_RETRIES})`);
      } else if (error instanceof TypeError && error.message.includes('Network request failed')) {
        console.warn(`Network error (attempt ${retries + 1}/${MAX_RETRIES}): ${error.message}`);
      } else {
        console.error(`Fetch error (attempt ${retries + 1}/${MAX_RETRIES}):`, error);
      }
      
      // Increment retry counter
      retries++;
      
      // Wait before retrying (exponential backoff)
      if (retries < MAX_RETRIES) {
        const backoffTime = Math.min(1000 * Math.pow(2, retries), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError || new Error('Failed to fetch after multiple retries');
}