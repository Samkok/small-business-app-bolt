import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { referralService } from '@/src/services/referralService';

export default function ReferralRedirect() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    const handleReferral = async () => {
      if (code) {
        const normalizedCode = code.toUpperCase();
        await referralService.storePendingReferralCode(normalizedCode);
        referralService.recordClick(normalizedCode).catch(() => {});
      }
      router.replace('/');
    };

    handleReferral();
  }, [code]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.text}>Processing referral...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
});
