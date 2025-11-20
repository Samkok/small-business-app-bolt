import { Database } from '../types/database';

type Business = Database['public']['Tables']['businesses']['Row'];
type Notification = Database['public']['Tables']['notifications']['Row'];

export interface BusinessSwitchResult {
  success: boolean;
  switched: boolean;
  loading?: boolean;
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

  console.log('extractBusinessContext:', {
    notificationId: notification.id,
    notificationType: notification.type,
    businessId,
    businessName,
    dataBusinessId: data?.business_id,
    notificationBusinessId: notification.business_id,
  });

  if (!businessId) {
    console.warn('Notification missing business_id:', {
      notificationId: notification.id,
      type: notification.type,
      data: data,
    });
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
  const hasAccess = userBusinesses.some(b => b.id === businessId);

  if (!hasAccess) {
    console.log('validateBusinessAccess: Access denied', {
      searchingFor: businessId,
      availableBusinesses: userBusinesses.map(b => ({ id: b.id, name: b.business_name })),
      totalCount: userBusinesses.length,
    });
  }

  return hasAccess;
}

export function getBusinessById(
  businessId: string,
  userBusinesses: Business[]
): Business | null {
  return userBusinesses.find(b => b.id === businessId) || null;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function handleBusinessSwitch(
  notification: Notification,
  currentBusiness: Business | null,
  userBusinesses: Business[],
  switchBusiness: (businessId: string) => Promise<void>,
  refreshUserBusinesses: () => Promise<Business[]>
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

  // Early validation: Check if business exists in current list
  let hasAccess = validateBusinessAccess(context.businessId, userBusinesses);

  console.log('Early business access check:', {
    businessId: context.businessId,
    businessName: context.businessName,
    hasAccess,
    userBusinessesCount: userBusinesses.length,
    userBusinessIds: userBusinesses.map(b => b.id),
  });

  // If not found initially, try ONE refresh to check for recent changes
  if (!hasAccess) {
    console.log('Business not found in current list, attempting single refresh...');
    try {
      const updatedBusinesses = await refreshUserBusinesses();
      hasAccess = validateBusinessAccess(context.businessId, updatedBusinesses);

      console.log('After refresh - access validation:', {
        hasAccess,
        businessesCount: updatedBusinesses.length,
        businessIds: updatedBusinesses.map(b => b.id),
        targetBusinessId: context.businessId,
      });

      // If still no access after refresh, user was likely removed
      if (!hasAccess) {
        console.warn('Business not accessible after refresh - user likely removed:', {
          businessId: context.businessId,
          businessName: context.businessName,
        });
        return {
          success: false,
          switched: false,
          error: {
            type: 'access_denied',
            message: `You no longer have access to ${context.businessName || 'this business'}. The owner may have removed you from the team.`,
            businessName: context.businessName,
          },
        };
      }
    } catch (error) {
      console.error('Error refreshing businesses:', error);
      return {
        success: false,
        switched: false,
        error: {
          type: 'switch_failed',
          message: 'Failed to verify business access. Please try again.',
        },
      };
    }
  }

  // Retry configuration for the actual switch operation (reduced retries since access is confirmed)
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [0, 500, 1000]; // in milliseconds

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    console.log(`Business switch attempt ${attempt + 1}/${MAX_RETRIES}`);

    // Re-validate access before each switch attempt
    hasAccess = validateBusinessAccess(context.businessId, userBusinesses);

    if (!hasAccess) {
      console.warn('Business access lost between validation and switch');
      return {
        success: false,
        switched: false,
        error: {
          type: 'access_denied',
          message: `Access to ${context.businessName || 'this business'} was revoked.`,
          businessName: context.businessName,
        },
      };
    }

    // If we have access, try to switch
    try {
      console.log(`Switching to business: ${context.businessName || context.businessId}`);
      await switchBusiness(context.businessId);

      // Small delay to ensure the switch completes
      await sleep(300);

      console.log('Business switch successful');
      return {
        success: true,
        switched: true,
      };
    } catch (error) {
      console.error('Error switching business:', error);

      // If this is not the last attempt, wait and retry
      if (attempt < MAX_RETRIES - 1) {
        console.log(`Waiting ${RETRY_DELAYS[attempt + 1]}ms before retry...`);
        await sleep(RETRY_DELAYS[attempt + 1]);
        continue;
      }

      // Last attempt failed
      return {
        success: false,
        switched: false,
        error: {
          type: 'switch_failed',
          message: 'Failed to switch to the business after multiple attempts. Please try again.',
          businessName: context.businessName,
        },
      };
    }
  }

  // All retries exhausted
  console.warn('Failed to switch business after all retries:', {
    businessId: context.businessId,
    businessName: context.businessName,
  });
  return {
    success: false,
    switched: false,
    error: {
      type: 'switch_failed',
      message: 'Unable to switch to the business. Please try again.',
      businessName: context.businessName,
    },
  };
}
