import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

interface TabButtonProps {
  title: string;
  icon: React.ReactNode;
  isActive: boolean;
  onPress: () => void;
  count?: number;
  isDark: boolean;
}

const TabButtonComponent = ({
  title,
  icon,
  isActive,
  onPress,
  count,
  isDark
}: TabButtonProps) => {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.tabButton,
        {
          backgroundColor: isActive
            ? '#2563eb'
            : (isDark ? '#374151' : '#f3f4f6'),
          borderColor: isActive ? '#2563eb' : (isDark ? '#4b5563' : '#d1d5db'),
        }
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.tabButtonContent}>
        <View style={styles.tabIcon}>
          {icon}
        </View>
        <Text
          style={[
            styles.tabButtonText,
            { color: isActive ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') }
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {count !== undefined && count > 0 && (
          <View style={[styles.countBadge, { backgroundColor: isActive ? '#ffffff' : '#2563eb' }]}>
            <Text style={[styles.countText, { color: isActive ? '#2563eb' : '#ffffff' }]}>
              {count}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const TabButton = React.memo(TabButtonComponent, (prevProps, nextProps) => {
  return (
    prevProps.isActive === nextProps.isActive &&
    prevProps.count === nextProps.count &&
    prevProps.title === nextProps.title &&
    prevProps.isDark === nextProps.isDark
  );
});

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 48,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  countText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});
