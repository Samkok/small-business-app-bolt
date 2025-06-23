import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  User, 
  Palette, 
  Globe, 
  LogOut, 
  ChevronRight 
} from 'lucide-react-native';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { isDark, theme, setTheme } = useTheme();
  const { signOut, profile } = useAuth();

  const handleLanguageChange = async (language: string) => {
    try {
      await i18n.changeLanguage(language);
      await AsyncStorage.setItem('language', language);
      Alert.alert(t('common.success'), `Language changed to ${language}`);
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to change language');
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const handleSignOut = () => {
    Alert.alert(
      t('auth.signOut'),
      'Are you sure you want to sign out?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('auth.signOut'), style: 'destructive', onPress: signOut },
      ]
    );
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress 
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity onPress={onPress}>
      <Card style={styles.settingItem}>
        <View style={styles.settingContent}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}>
              {icon}
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {title}
              </Text>
              {subtitle && (
                <Text style={[styles.settingSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          <ChevronRight size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
        {t('settings.title')}
      </Text>

      <Card style={styles.profileCard}>
        <View style={styles.profileContent}>
          <View style={[styles.avatar, { backgroundColor: '#2563eb' }]}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.charAt(0) || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {profile?.full_name || 'User'}
            </Text>
            <Text style={[styles.profileBusiness, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {profile?.business_name || 'Business'}
            </Text>
            <Text style={[styles.profileRole, { color: '#2563eb' }]}>
              {profile?.role?.charAt(0).toUpperCase() + profile?.role?.slice(1) || 'Admin'}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.section}>
        <SettingItem
          icon={<User size={20} color="#2563eb" />}
          title={t('settings.profile')}
          subtitle="Edit your profile information"
          onPress={() => Alert.alert('Profile', 'Profile editing coming soon')}
        />

        <SettingItem
          icon={<Palette size={20} color="#059669" />}
          title={t('settings.theme')}
          subtitle={`Current: ${theme}`}
          onPress={() => {
            Alert.alert(
              t('settings.theme'),
              'Choose theme',
              [
                { text: t('settings.light'), onPress: () => handleThemeChange('light') },
                { text: t('settings.dark'), onPress: () => handleThemeChange('dark') },
                { text: t('settings.system'), onPress: () => handleThemeChange('system') },
                { text: t('common.cancel'), style: 'cancel' },
              ]
            );
          }}
        />

        <SettingItem
          icon={<Globe size={20} color="#8b5cf6" />}
          title={t('settings.language')}
          subtitle={`Current: ${i18n.language}`}
          onPress={() => {
            Alert.alert(
              t('settings.language'),
              'Choose language',
              [
                { text: t('settings.english'), onPress: () => handleLanguageChange('en') },
                { text: t('settings.khmer'), onPress: () => handleLanguageChange('km') },
                { text: t('settings.chinese'), onPress: () => handleLanguageChange('zh') },
                { text: t('common.cancel'), style: 'cancel' },
              ]
            );
          }}
        />
      </View>

      <View style={styles.section}>
        <Button
          title={t('auth.signOut')}
          variant="danger"
          onPress={handleSignOut}
          style={styles.signOutButton}
        />
      </View>

      <Card style={styles.aboutCard}>
        <Text style={[styles.aboutTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Business Manager Pro
        </Text>
        <Text style={[styles.aboutVersion, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Version 1.0.0
        </Text>
        <Text style={[styles.aboutDescription, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Complete business management solution for small businesses
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  profileCard: {
    marginBottom: 24,
    padding: 20,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileBusiness: {
    fontSize: 14,
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 24,
  },
  settingItem: {
    marginBottom: 8,
    padding: 16,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
  },
  signOutButton: {
    marginTop: 8,
  },
  aboutCard: {
    alignItems: 'center',
    padding: 20,
    marginTop: 16,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 14,
    marginBottom: 8,
  },
  aboutDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});