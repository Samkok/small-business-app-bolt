import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { businessService } from '@/src/services/business';
import { useTranslation } from '@/src/locales';

export function useBusinessDeletion() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userProfile, switchBusiness, refreshUserBusinesses } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBusinessDeleted = async () => {
    try {
      setIsDeleting(true);

      await refreshUserBusinesses();

      const remainingBusinesses = await businessService.getUserBusinesses(userProfile!.user_id);

      if (remainingBusinesses.length > 0) {
        const nextBusiness = remainingBusinesses[0];
        await switchBusiness(nextBusiness.id);

        router.replace('/(app)/(tabs)');

        setTimeout(() => {
          Alert.alert(
            t('common.success'),
            t('deleteBusiness.switchedToBusiness', { businessName: nextBusiness.business_name })
          );
        }, 500);
      } else {
        router.replace('/(app)/business-onboarding');

        setTimeout(() => {
          Alert.alert(
            t('common.success'),
            t('deleteBusiness.createNewBusiness')
          );
        }, 500);
      }
    } catch (error) {
      console.error('Error handling business deletion:', error);
      Alert.alert(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteBusiness = async (businessId: string) => {
    if (!userProfile) {
      throw new Error('User profile not found');
    }

    try {
      await businessService.deleteBusiness(businessId, userProfile.user_id);
      await handleBusinessDeleted();
    } catch (error: any) {
      console.error('Error deleting business:', error);
      throw error;
    }
  };

  return {
    deleteBusiness,
    isDeleting,
  };
}
