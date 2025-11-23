import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { accountService } from '@/src/services/account';
import { useTranslation } from '@/src/locales';

export function useAccountDeletion() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userProfile, signOut } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAccountDeleted = async () => {
    try {
      setIsDeleting(true);

      await signOut();

      router.replace('/(auth)/signin');

      setTimeout(() => {
        Alert.alert(
          t('common.success'),
          t('deleteAccount.successMessage')
        );
      }, 500);
    } catch (error) {
      console.error('Error handling account deletion:', error);
      Alert.alert(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteAccount = async () => {
    if (!userProfile) {
      throw new Error('User profile not found');
    }

    try {
      await accountService.deleteAccount(userProfile.user_id);
      await handleAccountDeleted();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      throw error;
    }
  };

  return {
    deleteAccount,
    isDeleting,
  };
}
