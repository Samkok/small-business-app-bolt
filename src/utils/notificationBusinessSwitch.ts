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

  let hasAccess = validateBusinessAccess(context.businessId, userBusinesses);

  console.log('Initial access check:', {
    businessId: context.businessId,
    businessName: context.businessName,
    hasAccess,
    userBusinessesCount: userBusinesses.length,
    userBusinessIds: userBusinesses.map(b => b.id),
  });

  if (!hasAccess) {
    console.log('Business not found in current list, refreshing...');
    try {
      const updatedBusinesses = await refreshUserBusinesses();

      hasAccess = validateBusinessAccess(context.businessId, updatedBusinesses);

      console.log('After refresh - access validation:', {
        hasAccess,
        businessesCount: updatedBusinesses.length,
        businessIds: updatedBusinesses.map(b => b.id),
        targetBusinessId: context.businessId,
      });
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
    console.warn('User does not have access to business:', {
      businessId: context.businessId,
      businessName: context.businessName,
    });
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
