import { withNetworkRetry } from './networkMonitor';

/**
 * Base service class with network retry functionality
 * This provides a foundation for all API service classes
 */
export class BaseService {
  /**
   * Executes an API operation with network retry logic
   * @param operation Function to execute
   * @param options Retry configuration options
   * @returns Promise resolving to the operation result
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      operationName?: string;
    } = {}
  ): Promise<T> {
    const { 
      maxRetries = 3, 
      retryDelay = 1000,
      operationName = 'API operation'
    } = options;
    
    return withNetworkRetry(operation, {
      maxRetries,
      retryDelay,
      onRetry: (attempt, error) => {
        console.warn(`Retrying ${operationName} (attempt ${attempt}/${maxRetries}) after error:`, error);
      },
      onError: (error) => {
        console.error(`${operationName} failed after ${maxRetries} attempts:`, error);
      }
    });
  }
}