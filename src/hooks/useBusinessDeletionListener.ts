import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { businessService } from '@/src/services/business';
import { useTranslation } from '@/src/locales';

export function useBusinessDeletionListener() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userProfile, currentBusiness, setCurrentBusiness } = useAuth();
  const [isDeletionModalVisible, setIsDeletionModalVisible] = useState(false);

  useEffect(() => {
    if (!userProfile || !currentBusiness) return;

    const channel = supabase
      .channel(`business-deletion-${userProfile.user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'businesses',
          filter: `id=eq.${currentBusiness.id}`,
        },
        async (payload) => {
          console.log('Business deleted (realtime):', payload);

          setIsDeletionModalVisible(true);

          const remainingBusinesses = await businessService.getUserBusinesses(userProfile.user_id);

          if (remainingBusinesses.length > 0) {
            const nextBusiness = remainingBusinesses[0];
            await setCurrentBusiness(nextBusiness);

            setTimeout(() => {
              setIsDeletionModalVisible(false);
              router.replace('/(app)/(tabs)');

              setTimeout(() => {
                Alert.alert(
                  t('deleteBusiness.businessDeletedByOwner'),
                  t('deleteBusiness.switchedToBusiness', { businessName: nextBusiness.business_name })
                );
              }, 500);
            }, 2000);
          } else {
            await setCurrentBusiness(null);

            setTimeout(() => {
              setIsDeletionModalVisible(false);
              router.replace('/business-onboarding');

              setTimeout(() => {
                Alert.alert(
                  t('deleteBusiness.businessDeletedByOwner'),
                  t('deleteBusiness.createNewBusiness')
                );
              }, 500);
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile, currentBusiness, setCurrentBusiness, router, t]);

  return {
    isDeletionModalVisible,
  };
}
