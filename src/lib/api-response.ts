import { logger } from './logger';
import { handleError, AppError } from './errors';

export type ApiResponse<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: AppError };

export async function wrapApiCall<T>(
  operation: () => Promise<T>,
  errorContext?: string
): Promise<ApiResponse<T>> {
  try {
    const data = await operation();
    return { success: true, data, error: null };
  } catch (error) {
    const appError = handleError(error);

    if (errorContext) {
      logger.error(errorContext, appError);
    }

    return { success: false, data: null, error: appError };
  }
}

export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw response.error;
  }
  return response.data;
}

export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is { success: true; data: T; error: null } {
  return response.success === true;
}

export function isErrorResponse<T>(
  response: ApiResponse<T>
): response is { success: false; data: null; error: AppError } {
  return response.success === false;
}
