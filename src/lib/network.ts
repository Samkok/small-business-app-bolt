const NETWORK_INDICATORS = [
  'network',
  'fetch failed',
  'failed to fetch',
  'timeout',
  'connection',
  'offline',
  'no internet',
  'econnrefused',
  'enotfound',
  'etimedout',
];

export function isNetworkError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';

  return NETWORK_INDICATORS.some(indicator =>
    errorMessage.includes(indicator) || errorCode.includes(indicator)
  );
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  context: string,
  retries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isNetworkError(error) || attempt === retries - 1) {
        throw error;
      }

      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`[Network] Retry ${attempt + 1}/${retries} for ${context} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
