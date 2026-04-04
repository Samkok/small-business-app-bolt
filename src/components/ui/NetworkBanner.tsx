import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { WifiOff, Wifi } from 'lucide-react-native';
import { useNetwork } from '@/src/context/NetworkContext';
import { useTranslation } from '@/src/locales';

export function NetworkBanner() {
  const { isConnected, wasOffline } = useNetwork();
  const { t } = useTranslation();
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const isVisible = !isConnected || wasOffline;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible, slideAnim]);

  if (!isVisible) return null;

  const isBackOnline = isConnected && wasOffline;

  return (
    <Animated.View
      style={[
        styles.container,
        isBackOnline ? styles.onlineContainer : styles.offlineContainer,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        {isBackOnline ? (
          <Wifi size={16} color="#fff" strokeWidth={2.5} />
        ) : (
          <WifiOff size={16} color="#fff" strokeWidth={2.5} />
        )}
        <Text style={styles.text}>
          {isBackOnline
            ? t('network.backOnline')
            : t('network.offlineBanner')}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 44,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  offlineContainer: {
    backgroundColor: '#DC2626',
  },
  onlineContainer: {
    backgroundColor: '#16A34A',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
