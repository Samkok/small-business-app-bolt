import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useNetworkStatus } from '@/src/services/networkMonitor';
import { useTheme } from '@/src/context/ThemeContext';
import { Wifi, WifiOff } from 'lucide-react-native';

export function ConnectionStatusBar() {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const { isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const animatedHeight = React.useRef(new Animated.Value(0)).current;

  // Determine if we should show the status bar
  const shouldShow = Platform.OS !== 'web' && (isConnected === false || isInternetReachable === false);

  useEffect(() => {
    if (shouldShow && !visible) {
      setVisible(true);
      Animated.timing(animatedHeight, {
        toValue: 40,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else if (!shouldShow && visible) {
      Animated.timing(animatedHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setVisible(false);
      });
    }
  }, [shouldShow, visible, animatedHeight]);

  if (!visible && !shouldShow) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          height: animatedHeight,
          backgroundColor: isDark ? '#dc2626' : '#fee2e2',
        }
      ]}
    >
      <View style={styles.content}>
        <WifiOff size={16} color={isDark ? '#ffffff' : '#dc2626'} />
        <Text style={[
          styles.text, 
          { color: isDark ? '#ffffff' : '#dc2626' }
        ]}>
          No internet connection
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
    zIndex: 1000,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    height: 40,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});