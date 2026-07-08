import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useTranslation } from '@/src/locales';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { Card } from '@/src/components/ui/Card';
import { OptimizedImage } from '@/src/components/ui/OptimizedImage';
import { Button } from '@/src/components/ui/Button';
import { getLanguageNativeLabel } from '@/src/utils/language';
import {
  User,
  Palette,
  Globe,
  LogOut,
  ChevronRight,
  Building,
  Users,
  FileText,
  Shield,
  Bell,
  Trash2,
  TriangleAlert as AlertTriangle,
  Crown,
  KeyRound,
  Coins,
  Gift
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNotifications } from '@/src/context/NotificationContext';
import { UnauthorizedDeleteModal } from '@/src/components/business/UnauthorizedDeleteModal';
import { DeleteBusinessModal } from '@/src/components/business/DeleteBusinessModal';
import { DeleteAccountModal } from '@/src/components/account/DeleteAccountModal';
import { useBusinessDeletion } from '@/src/hooks/useBusinessDeletion';
import { useAccountDeletion } from '@/src/hooks/useAccountDeletion';
import { businessService } from '@/src/services/business';
import { accountService, AccountDeletePreview } from '@/src/services/account';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { isDark, theme, setTheme } = useTheme();
  const { signOut, userProfile, currentBusiness, userBusinesses } = useAuth();
  const { changeLanguage, currentLanguage } = useLanguage();
  const { unreadCount } = useNotifications();
  const { isSubscribed, salesCountData } = useSubscription();
  const router = useRouter();
  const { deleteBusiness, isDeleting } = useBusinessDeletion();
  const { deleteAccount } = useAccountDeletion();

  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [accountPreview, setAccountPreview] = useState<AccountDeletePreview | null>(null);

  const handleLanguageChange = async (language: string) => {
    try {
      await changeLanguage(language);
      const languageName = getLanguageNativeLabel(language);
      Alert.alert(t('common.success'), t('settings.languageChanged', { language: languageName }));
    } catch (error) {
      Alert.alert(t('common.error'), t('settings.languageChangeFailed'));
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const handleSignOut = () => {
    Alert.alert(
      t('auth.signOut'),
      t('settings.signOutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('auth.signOut'), style: 'destructive', onPress: signOut },
      ]
    );
  };

  const handleDeleteBusiness = async () => {
    if (!userProfile || !currentBusiness) return;

    try {
      const isOwner = await businessService.checkBusinessOwnership(
        currentBusiness.id,
        userProfile.user_id
      );

      if (!isOwner) {
        setShowUnauthorizedModal(true);
        return;
      }

      setShowDeleteModal(true);
    } catch (error) {
      console.error('Error checking business ownership:', error);
      Alert.alert(t('common.error'), t('common.somethingWentWrong'));
    }
  };

  const handleDeleteComplete = async () => {
    if (!currentBusiness) return;

    try {
      await deleteBusiness(currentBusiness.id);
      setShowDeleteModal(false);
    } catch (error: any) {
      console.error('Error in delete complete:', error);
      Alert.alert(t('common.error'), error.message || t('deleteBusiness.errorMessage'));
    }
  };

  const handleDeleteAccount = async () => {
    if (!userProfile) return;

    try {
      const preview = await accountService.getAccountDeletePreview(userProfile.user_id);
      setAccountPreview(preview);
      setShowDeleteAccountModal(true);
    } catch (error) {
      console.error('Error fetching account deletion preview:', error);
      Alert.alert(t('common.error'), t('common.somethingWentWrong'));
    }
  };

  const handleDeleteAccountComplete = async () => {
    try {
      await deleteAccount();
      setShowDeleteAccountModal(false);
    } catch (error: any) {
      console.error('Error in delete account complete:', error);
      Alert.alert(t('common.error'), error.message || t('deleteAccount.errorMessage'));
    }
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
          {userProfile?.avatar_url ? (
            <OptimizedImage
              source={{ uri: userProfile.avatar_url }}
              style={styles.avatarImage}
              resizeMode="cover"
              alt="Profile Avatar"
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: '#2563eb' }]}>
              <Text style={styles.avatarText}>
                {userProfile?.full_name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {userProfile?.full_name || 'User'}
            </Text>
            <Text style={[styles.profileBusiness, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {currentBusiness?.business_name || t('settings.noBusinessSelected')}
            </Text>
            <TouchableOpacity
              style={styles.switchBusinessButton}
              onPress={() => router.push('/business-selection')}
            >
              <Text style={styles.switchBusinessText}>
                {t('settings.manageBusinesses')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>

      <View style={styles.section}>
        <View style={styles.notificationItemWrapper}>
          <SettingItem
            icon={<Bell size={20} color="#f59e0b" />}
            title={t('settings.notifications')}
            subtitle={t('settings.notificationsSubtitle')}
            onPress={() => router.push('/settings/notifications')}
          />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>

        <SettingItem
          icon={<User size={20} color="#2563eb" />}
          title={t('settings.profile')}
          subtitle={t('settings.profileSubtitle')}
          onPress={() => router.push('/settings/profile')}
        />

        <SettingItem
          icon={<Crown size={20} color={isSubscribed ? "#f59e0b" : "#9ca3af"} />}
          title={t('subscription.title')}
          subtitle={isSubscribed ? `${t('subscription.proPlan')} - ${t('subscription.active')}` : `${salesCountData.salesCount}/50 ${t('sales.salesUsed')}`}
          onPress={() => router.push('/settings/subscription')}
        />

        <SettingItem
          icon={<Gift size={20} color="#10b981" />}
          title="Refer & Earn"
          subtitle="Invite friends, earn extra sales"
          onPress={() => router.push('/settings/referrals')}
        />

        <SettingItem
          icon={<Building size={20} color="#8b5cf6" />}
          title={t('settings.businessSettings')}
          subtitle={t('settings.businessSubtitle')}
          onPress={() => router.push('/settings/business')}
        />

        <SettingItem
          icon={<Users size={20} color="#ea580c" />}
          title={t('settings.teamMembers')}
          subtitle={t('settings.teamSubtitle')}
          onPress={() => router.push('/settings/team')}
        />

        <SettingItem
          icon={<Coins size={20} color="#0891b2" />}
          title="Currencies"
          subtitle="Manage currencies and exchange rates"
          onPress={() => router.push('/settings/currencies')}
        />

        <SettingItem
          icon={<Palette size={20} color="#059669" />}
          title={t('settings.theme')}
          subtitle={t('settings.currentTheme', { theme })}
          onPress={() => {
            Alert.alert(
              t('settings.theme'),
              t('settings.chooseTheme'),
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
          subtitle={t('settings.currentLanguage', { language: getLanguageNativeLabel(currentLanguage) })}
          onPress={() => {
            Alert.alert(
              t('settings.language'),
              t('settings.chooseLanguage'),
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

      {__DEV__ && (
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            Developer Tools
          </Text>
          <SettingItem
            icon={<Crown size={20} color="#ef4444" />}
            title="Debug Subscription"
            subtitle="Test subscription states and sales counts"
            onPress={() => router.push('/settings/debug-subscription')}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionHeader, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          {t('settings.legal')}
        </Text>
        <SettingItem
          icon={<FileText size={20} color="#dc2626" />}
          title={t('settings.terms')}
          subtitle={t('settings.termsSubtitle')}
          onPress={() => router.push('/settings/terms')}
        />
        <SettingItem
          icon={<Shield size={20} color="#16a34a" />}
          title={t('settings.privacy')}
          subtitle={t('settings.privacySubtitle')}
          onPress={() => router.push('/settings/privacy')}
        />
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <View style={styles.dangerZoneHeader}>
          <AlertTriangle size={20} color="#dc2626" />
          <Text style={[styles.dangerZoneTitle, { color: '#dc2626' }]}>
            {t('settings.dangerZone')}
          </Text>
        </View>
        <Card style={[styles.dangerZoneCard, { borderColor: '#dc2626', borderWidth: 1 }]}>
          <TouchableOpacity onPress={handleDeleteBusiness}>
            <View style={styles.dangerZoneItem}>
              <View style={styles.dangerZoneContent}>
                <View style={styles.dangerZoneLeft}>
                  <View style={[styles.dangerIconContainer, { backgroundColor: '#fee2e2' }]}>
                    <Trash2 size={20} color="#dc2626" />
                  </View>
                  <View style={styles.dangerZoneText}>
                    <Text style={[styles.dangerZoneItemTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {t('settings.deleteBusiness')}
                    </Text>
                    <Text style={[styles.dangerZoneItemSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {t('settings.deleteBusinessSubtitle')}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#dc2626" />
              </View>
            </View>
          </TouchableOpacity>

          <View style={[styles.dangerZoneDivider, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />

          <TouchableOpacity onPress={handleDeleteAccount}>
            <View style={styles.dangerZoneItem}>
              <View style={styles.dangerZoneContent}>
                <View style={styles.dangerZoneLeft}>
                  <View style={[styles.dangerIconContainer, { backgroundColor: '#fee2e2' }]}>
                    <Trash2 size={20} color="#dc2626" />
                  </View>
                  <View style={styles.dangerZoneText}>
                    <Text style={[styles.dangerZoneItemTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {t('settings.deleteAccount')}
                    </Text>
                    <Text style={[styles.dangerZoneItemSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {t('settings.deleteAccountSubtitle')}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#dc2626" />
              </View>
            </View>
          </TouchableOpacity>
        </Card>
      </View>

      <View style={styles.section}>
        <Button
          title={t('auth.signOut')}
          variant="danger"
          onPress={handleSignOut}
          style={styles.signOutButton}
        />
      </View>

      <UnauthorizedDeleteModal
        visible={showUnauthorizedModal}
        onClose={() => setShowUnauthorizedModal(false)}
      />

      {currentBusiness && (
        <DeleteBusinessModal
          visible={showDeleteModal}
          businessName={currentBusiness.business_name}
          businessId={currentBusiness.id}
          onClose={() => setShowDeleteModal(false)}
          onComplete={handleDeleteComplete}
        />
      )}

      {userProfile && accountPreview && (
        <DeleteAccountModal
          visible={showDeleteAccountModal}
          userEmail={userProfile.email || ''}
          preview={accountPreview}
          onClose={() => setShowDeleteAccountModal(false)}
          onComplete={handleDeleteAccountComplete}
        />
      )}
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
  avatarImage: {
    overflow: 'hidden',
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
  switchBusinessButton: {
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#2563eb20',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  switchBusinessText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
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
  notificationItemWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 40,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  dangerZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 4,
  },
  dangerZoneTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  dangerZoneCard: {
    padding: 0,
    overflow: 'hidden',
  },
  dangerZoneItem: {
    padding: 16,
  },
  dangerZoneContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dangerZoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dangerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dangerZoneText: {
    flex: 1,
  },
  dangerZoneItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  dangerZoneItemSubtitle: {
    fontSize: 12,
  },
  dangerZoneDivider: {
    height: 1,
    marginHorizontal: 16,
  }
});