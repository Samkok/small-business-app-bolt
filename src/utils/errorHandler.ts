import { Database } from '../types/database';

type Business = Database['public']['Tables']['businesses']['Row'];

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: 'REFRESH' | 'SWITCH_BUSINESS' | 'GO_TO_DASHBOARD' | 'NONE';
  isBusinessAccessError: boolean;
}

export const errorHandler = {
  /**
   * Check if error is related to RLS/business access
   */
  isRLSError(error: any): boolean {
    if (!error) return false;

    const errorCode = error.code || error.statusCode || '';
    const errorMessage = error.message || error.details || '';

    // PostgreSQL RLS errors
    if (errorCode === 'PGRST116') return true; // No rows returned
    if (errorCode === '42501') return true; // Insufficient privilege
    if (errorCode === 'PGRST301') return true; // Permission denied

    // Check error message for RLS indicators
    const rlsKeywords = [
      'row level security',
      'rls policy',
      'permission denied',
      'no rows returned',
      'insufficient privilege',
      'violates row-level security',
    ];

    const messageLower = errorMessage.toLowerCase();
    return rlsKeywords.some(keyword => messageLower.includes(keyword));
  },

  /**
   * Check if error indicates no rows were found (PGRST116)
   */
  isNoRowsError(error: any): boolean {
    if (!error) return false;
    return error.code === 'PGRST116' || error.message?.includes('no rows returned');
  },

  /**
   * Handle business access errors with user-friendly messages
   */
  handleBusinessAccessError(
    error: any,
    context: string,
    currentBusiness?: Business | null,
    dataBusinessName?: string
  ): UserFriendlyError {
    // Check if it's an RLS/access error
    if (!this.isRLSError(error)) {
      return {
        title: 'Error',
        message: error.message || `Failed to ${context}. Please try again.`,
        action: 'NONE',
        isBusinessAccessError: false,
      };
    }

    // Handle PGRST116 specifically (no rows returned)
    if (this.isNoRowsError(error)) {
      if (dataBusinessName && currentBusiness && dataBusinessName !== currentBusiness.business_name) {
        return {
          title: 'Business Access Changed',
          message: `This ${context} belongs to "${dataBusinessName}", but you're currently viewing "${currentBusiness.business_name}". You may have been removed from "${dataBusinessName}".`,
          action: 'REFRESH',
          isBusinessAccessError: true,
        };
      }

      return {
        title: 'Access Denied',
        message: `You no longer have access to perform this action. You may have been removed from this business.`,
        action: 'GO_TO_DASHBOARD',
        isBusinessAccessError: true,
      };
    }

    // General permission denied
    return {
      title: 'Permission Denied',
      message: `You don't have permission to ${context}. This may be because you were removed from the business or your role was changed.`,
      action: 'GO_TO_DASHBOARD',
      isBusinessAccessError: true,
    };
  },

  /**
   * Handle business mismatch errors
   */
  handleBusinessMismatchError(
    context: string,
    dataBusinessName: string,
    currentBusinessName: string
  ): UserFriendlyError {
    return {
      title: 'Business Mismatch',
      message: `Cannot ${context}: This data belongs to "${dataBusinessName}", but you're currently viewing "${currentBusinessName}". Please switch to the correct business first.`,
      action: 'SWITCH_BUSINESS',
      isBusinessAccessError: true,
    };
  },

  /**
   * Handle validation errors from business access guard
   */
  handleValidationError(
    context: string,
    errorCode: 'NO_ACCESS' | 'BUSINESS_MISMATCH' | 'NO_CURRENT_BUSINESS' | 'INVALID_BUSINESS_ID',
    errorMessage: string
  ): UserFriendlyError {
    switch (errorCode) {
      case 'NO_ACCESS':
        return {
          title: 'Access Removed',
          message: `Cannot ${context}: ${errorMessage}. Please refresh or select a different business.`,
          action: 'REFRESH',
          isBusinessAccessError: true,
        };

      case 'BUSINESS_MISMATCH':
        return {
          title: 'Business Mismatch',
          message: `Cannot ${context}: ${errorMessage}. Please refresh the data or switch to the correct business.`,
          action: 'REFRESH',
          isBusinessAccessError: true,
        };

      case 'NO_CURRENT_BUSINESS':
        return {
          title: 'No Business Selected',
          message: `Cannot ${context}: ${errorMessage}`,
          action: 'GO_TO_DASHBOARD',
          isBusinessAccessError: true,
        };

      case 'INVALID_BUSINESS_ID':
        return {
          title: 'Invalid Data',
          message: `Cannot ${context}: ${errorMessage}. Please refresh and try again.`,
          action: 'REFRESH',
          isBusinessAccessError: true,
        };

      default:
        return {
          title: 'Error',
          message: `Cannot ${context}: ${errorMessage}`,
          action: 'NONE',
          isBusinessAccessError: false,
        };
    }
  },

  /**
   * Get a user-friendly action message
   */
  getActionMessage(action: UserFriendlyError['action']): string {
    switch (action) {
      case 'REFRESH':
        return 'Pull down to refresh the data.';
      case 'SWITCH_BUSINESS':
        return 'Please switch to the correct business.';
      case 'GO_TO_DASHBOARD':
        return 'Return to the dashboard to select a business.';
      case 'NONE':
      default:
        return '';
    }
  },

  /**
   * Format complete error message with action
   */
  formatErrorMessage(error: UserFriendlyError): string {
    const actionMessage = this.getActionMessage(error.action);
    return actionMessage ? `${error.message}\n\n${actionMessage}` : error.message;
  },
};
