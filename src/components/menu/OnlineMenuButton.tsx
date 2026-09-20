import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { QrCode, ChevronRight, X, Settings as SettingsIcon } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { OnlineMenuSharePanel } from '@/src/components/menu/OnlineMenuSharePanel';
import { businessService } from '@/src/services/business';
import { isMenuSiteConfigured } from '@/src/config/menu';

/**
 * Dashboard shortcut to the shop's public menu: one tap shows the QR code and the link
 * to share with customers. When the menu is not set up yet it leads to the settings
 * screen instead. Renders nothing until the menu website has an address.
 */
export function OnlineMenuButton() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness, isAdmin } = useAuth();

  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menu, setMenu] = useState<{ slug: string | null; enabled: boolean; active: boolean } | null>(null);
  // Navigate only after the sheet has gone, so it never lingers over the next screen
  const goToSettings = useRef(false);

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  const open = useCallback(async () => {
    if (!currentBusiness?.id) return;
    setVisible(true);
    setLoading(true);
    try {
      const data = await businessService.getOnlineMenu(currentBusiness.id);
      setMenu({ slug: data?.menu_slug ?? null, enabled: !!data?.menu_enabled, active: (data?.access_state ?? 'active') === 'active' });
    } catch (error) {
      console.error('Error loading online menu:', error);
      setMenu(null);
    } finally {
      setLoading(false);
    }
  }, [currentBusiness?.id]);

  const openSettings = useCallback(() => {
    goToSettings.current = true;
    setVisible(false);
  }, []);

  const handleDismissed = useCallback(() => {
    if (!goToSettings.current) return;
    goToSettings.current = false;
    router.push('/settings/online-menu');
  }, [router]);

  if (!isMenuSiteConfigured || !currentBusiness?.id) return null;

  const ready = !!menu?.enabled && !!menu.slug && menu.active;

  return (
    <>
      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.bg, borderColor: colors.border }]}
        onPress={open}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${t('onlineMenu.title')}. ${t('onlineMenu.homeSubtitle')}`}
      >
        <View style={styles.iconWrap}>
          <QrCode size={22} color="#2563eb" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{t('onlineMenu.title')}</Text>
          <Text style={[styles.rowSubtitle, { color: colors.subtext }]} numberOfLines={1}>{t('onlineMenu.homeSubtitle')}</Text>
        </View>
        <ChevronRight size={20} color={colors.subtext} />
      </TouchableOpacity>

      <BottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        onDismissed={handleDismissed}
        backgroundColor={colors.bg}
        heightPercent={80}
        contentStyle={{ flex: 1 }}
        header={
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>{t('onlineMenu.shareTitle')}</Text>
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.close} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
              <X size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        }
      >
        {loading ? (
          <LoadingSpinner />
        ) : ready && menu?.slug ? (
          <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <OnlineMenuSharePanel slug={menu.slug} businessName={currentBusiness.business_name} />
            <TouchableOpacity style={styles.settingsLink} onPress={openSettings} accessibilityRole="link">
              <SettingsIcon size={16} color={colors.subtext} />
              <Text style={[styles.settingsText, { color: colors.subtext }]}>{t('onlineMenu.openSettings')}</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <View style={styles.sheetBody}>
            <View style={styles.emptyIcon}>
              <QrCode size={36} color="#2563eb" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {menu && !menu.active ? t('onlineMenu.inactiveTitle') : t('onlineMenu.notSetUpTitle')}
            </Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              {menu && !menu.active
                ? t('onlineMenu.inactiveBusiness')
                : isAdmin ? t('onlineMenu.notSetUp') : t('onlineMenu.notSetUpStaff')}
            </Text>
            {isAdmin && (!menu || menu.active) && (
              <Button title={t('onlineMenu.setUp')} onPress={openSettings} style={styles.setUpButton} />
            )}
          </View>
        )}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#2563eb1a', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { fontSize: 12, marginTop: 2 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, borderBottomWidth: 1 },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  close: { padding: 8 },
  sheetBody: { padding: 20 },
  settingsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  settingsText: { fontSize: 13, fontWeight: '500' },
  emptyIcon: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: '#2563eb1a', alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  setUpButton: { marginTop: 20 },
});
