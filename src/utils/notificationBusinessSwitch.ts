import { Database } from '../types/database';

type Business = Database['public']['Tables']['businesses']['Row'];
type Notification = Database['public']['Tables']['notifications']['Row'];

export interface BusinessSwitchResult {
  success: boolean;
  switched: boolean;
  error?: {
    type: 'missing_business_id' | 'access_denied' | 'business_not_found' | 'switch_failed';
    message: string;
    businessName?: string;
  };
}

export interface NotificationBusinessContext {
  businessId: string;
  businessName?: string;
}

export function extractBusinessContext(notification: Notification): NotificationBusinessContext | null {
  const data = notification.data as any;

  const businessId = data?.business_id || notification.business_id;
  const businessName = data?.business_name;

  if (!businessId) {
    console.warn('Notification missing business_id:', notification.id);
    return null;
  }

  return {
    businessId,
    businessName,
  };
}

export function validateBusinessAccess(
  businessId: string,
  userBusinesses: Business[]
): boolean {
  return userBusinesses.some(b => b.id === businessId);
}

export function getBusinessById(
  businessId: string,
  userBusinesses: Business[]
): Business | null {
  return userBusinesses.find(b => b.id === businessId) || null;
}

export async function handleBusinessSwitch(
  notification: Notification,
  currentBusiness: Business | null,
  userBusinesses: Business[],
  switchBusiness: (businessId: string) => Promise<void>,
  refreshUserBusinesses: () => Promise<void>
): Promise<BusinessSwitchResult> {
  const context = extractBusinessContext(notification);

  if (!context) {
    return {
      success: true,
      switched: false,
      error: {
        type: 'missing_business_id',
        message: 'Notification does not contain business information',
      },
    };
  }

  if (currentBusiness?.id === context.businessId) {
    console.log('Already on the correct business, skipping switch');
    return {
      success: true,
      switched: false,
    };
  }

  let hasAccess = validateBusinessAccess(context.businessId, userBusinesses);

  if (!hasAccess) {
    console.log('Business not found in current list, refreshing...');
    try {
      await refreshUserBusinesses();

      await new Promise(resolve => setTimeout(resolve, 500));

      hasAccess = validateBusinessAccess(context.businessId, userBusinesses);
    } catch (error) {
      console.error('Error refreshing businesses:', error);
      return {
        success: false,
        switched: false,
        error: {
          type: 'switch_failed',
          message: 'Failed to refresh business list',
        },
      };
    }
  }

  if (!hasAccess) {
    console.warn('User does not have access to business:', context.businessId);
    return {
      success: false,
      switched: false,
      error: {
        type: 'access_denied',
        message: 'You no longer have access to this business',
        businessName: context.businessName,
      },
    };
  }

  try {
    console.log(`Switching to business: ${context.businessName || context.businessId}`);
    await switchBusiness(context.businessId);

    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      success: true,
      switched: true,
    };
  } catch (error) {
    console.error('Error switching business:', error);
    return {
      success: false,
      switched: false,
      error: {
        type: 'switch_failed',
        message: 'Failed to switch to the business',
        businessName: context.businessName,
      },
    };
  }
}
