import { Database } from '../types/database';

type Business = Database['public']['Tables']['businesses']['Row'];

export interface BusinessAccessValidationResult {
  isValid: boolean;
  error?: string;
  errorCode?: 'NO_ACCESS' | 'BUSINESS_MISMATCH' | 'NO_CURRENT_BUSINESS' | 'INVALID_BUSINESS_ID';
}

export const businessAccessGuard = {
  /**
   * Validates if user has access to a specific business
   */
  validateBusinessAccess(
    businessId: string,
    userBusinesses: Business[]
  ): BusinessAccessValidationResult {
    if (!businessId) {
      return {
        isValid: false,
        error: 'Invalid business ID',
        errorCode: 'INVALID_BUSINESS_ID',
      };
    }

    const hasAccess = userBusinesses.some(b => b.id === businessId);

    if (!hasAccess) {
      return {
        isValid: false,
        error: 'You no longer have access to this business',
        errorCode: 'NO_ACCESS',
      };
    }

    return { isValid: true };
  },

  /**
   * Validates if data belongs to the current business
   */
  validateDataBelongsToCurrentBusiness(
    dataBusinessId: string,
    currentBusinessId: string | undefined
  ): BusinessAccessValidationResult {
    if (!currentBusinessId) {
      return {
        isValid: false,
        error: 'No business is currently selected',
        errorCode: 'NO_CURRENT_BUSINESS',
      };
    }

    if (!dataBusinessId) {
      return {
        isValid: false,
        error: 'Invalid data: missing business ID',
        errorCode: 'INVALID_BUSINESS_ID',
      };
    }

    if (dataBusinessId !== currentBusinessId) {
      return {
        isValid: false,
        error: 'This data belongs to a different business',
        errorCode: 'BUSINESS_MISMATCH',
      };
    }

    return { isValid: true };
  },

  /**
   * Comprehensive validation for performing actions on business data
   */
  validateActionOnBusinessData(
    dataBusinessId: string,
    currentBusiness: Business | null,
    userBusinesses: Business[]
  ): BusinessAccessValidationResult {
    // Check if there's a current business
    if (!currentBusiness) {
      return {
        isValid: false,
        error: 'No business is currently selected. Please select a business first.',
        errorCode: 'NO_CURRENT_BUSINESS',
      };
    }

    // Check if data belongs to current business
    const belongsToCurrentBusiness = this.validateDataBelongsToCurrentBusiness(
      dataBusinessId,
      currentBusiness.id
    );

    if (!belongsToCurrentBusiness.isValid) {
      return {
        isValid: false,
        error: `This data belongs to a different business. You're currently viewing "${currentBusiness.business_name}".`,
        errorCode: 'BUSINESS_MISMATCH',
      };
    }

    // Check if user still has access to the business
    const hasAccess = this.validateBusinessAccess(dataBusinessId, userBusinesses);

    if (!hasAccess.isValid) {
      return {
        isValid: false,
        error: 'You no longer have access to this business. The data may be outdated.',
        errorCode: 'NO_ACCESS',
      };
    }

    return { isValid: true };
  },

  /**
   * Filter data array to only include items from accessible businesses
   */
  filterAccessibleData<T extends { business_id: string }>(
    data: T[],
    userBusinesses: Business[]
  ): T[] {
    const accessibleBusinessIds = new Set(userBusinesses.map(b => b.id));
    return data.filter(item => accessibleBusinessIds.has(item.business_id));
  },

  /**
   * Filter data array to only include items from current business
   */
  filterCurrentBusinessData<T extends { business_id: string }>(
    data: T[],
    currentBusinessId: string | undefined
  ): T[] {
    if (!currentBusinessId) return [];
    return data.filter(item => item.business_id === currentBusinessId);
  },
};
