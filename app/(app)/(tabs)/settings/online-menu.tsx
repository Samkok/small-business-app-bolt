import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Store, TriangleAlert as AlertTriangle, Lock } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { OnlineMenuSharePanel } from '@/src/components/menu/OnlineMenuSharePanel';
import { businessService } from '@/src/services/business';
import { isMenuSiteConfigured, MENU_URL } from '@/src/config/menu';
import { MENU_NOTE_MAX, normalizeTelegram, onlineMenuErrorKey, onlineMenuSchema, suggestMenuSlug } from '@/src/utils/onlineMenu';

export default function OnlineMenuScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness, updateBusiness, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState('');
  const [telegram, setTelegram] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  // What is saved on the server: the link and QR only ever show this, never unsaved edits
  const [saved, setSaved] = useState<{ enabled: boolean; slug: string | null }>({ enabled: false, slug: null });
  const [accessState, setAccessState] = useState<string | null>(null);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  const load = useCallback(async () => {
    if (!currentBusiness?.id) return;
    setLoading(true);
    try {
      const menu = await businessService.getOnlineMenu(currentBusiness.id);
      // Someone setting the menu up for the first time came here to switch it on
      setEnabled(menu?.menu_slug ? !!menu.menu_enabled : true);
      // Offer a link name only when none has been saved yet
      setSlug(menu?.menu_slug || suggestMenuSlug(currentBusiness.business_name));
      setTelegram(menu?.menu_telegram || '');
      setNote(menu?.menu_note || '');
      setSaved({ enabled: !!menu?.menu_enabled, slug: menu?.menu_slug ?? null });
      setAccessState(menu?.access_state ?? null);
    } catch (error) {
      console.error('Error loading online menu settings:', error);
    } finally {
      setLoading(false);
    }
  }, [currentBusiness?.id, currentBusiness?.business_name]);

  useEffect(() => { load(); }, [load]);

  const persist = async (payload: { menu_enabled: boolean; menu_slug: string | null; menu_telegram: string | null; menu_note: string | null }) => {
    if (!currentBusiness?.id) return;
    setSaving(true);
    try {
      const { error } = await updateBusiness(currentBusiness.id, payload as any);
      if (error) {
        const key = onlineMenuErrorKey(error as any);
        if (key.startsWith('slug')) setErrors({ menu_slug: t(`onlineMenu.errors.${key}`) });
        else if (key.startsWith('telegram')) setErrors({ menu_telegram: t(`onlineMenu.errors.${key}`) });
        else Alert.alert(t('onlineMenu.title'), t(`onlineMenu.errors.${key}`));
        return;
      }
      setSaved({ enabled: payload.menu_enabled, slug: payload.menu_slug });
      setSlug(payload.menu_slug || '');
      setTelegram(payload.menu_telegram || '');
      if (payload.menu_enabled) {
        Alert.alert(t('onlineMenu.title'), t('onlineMenu.savedOn'));
      } else if (payload.menu_slug) {
        Alert.alert(t('onlineMenu.savedOffTitle'), t('onlineMenu.savedOff'), [
          { text: t('onlineMenu.keepOff'), style: 'cancel' },
          { text: t('onlineMenu.turnOn'), onPress: () => { setEnabled(true); persist({ ...payload, menu_enabled: true }); } },
        ]);
      } else {
        Alert.alert(t('onlineMenu.savedOffTitle'), t('onlineMenu.savedOffNoLink'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const payload = {
      menu_enabled: enabled,
      menu_slug: slug.trim().toLowerCase() || null,
      menu_telegram: normalizeTelegram(telegram) || null,
      menu_note: note.trim() || null,
    };
    const parsed = onlineMenuSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] || 'menu_slug');
        if (!next[field]) next[field] = t(`onlineMenu.errors.${issue.message}`);
      }
      setErrors(next);
      return;
    }
    setErrors({});

    // A new link name kills every link and printed QR the shop already handed out
    if (saved.slug && payload.menu_slug !== saved.slug) {
      Alert.alert(t('onlineMenu.changeLinkTitle'), t('onlineMenu.changeLinkMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('onlineMenu.changeLinkConfirm'), style: 'destructive', onPress: () => persist(payload) },
      ]);
      return;
    }
    persist(payload);
  };

  const showShare = isMenuSiteConfigured && saved.enabled && !!saved.slug;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('onlineMenu.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.intro, { color: colors.subtext }]}>{t('onlineMenu.intro')}</Text>

          {accessState && accessState !== 'active' && (
            <View style={[styles.notice, { backgroundColor: isDark ? '#78350f' : '#fef3c7' }]}>
              <AlertTriangle size={18} color="#d97706" />
              <Text style={[styles.noticeText, { color: isDark ? '#fde68a' : '#92400e' }]}>{t('onlineMenu.inactiveBusiness')}</Text>
            </View>
          )}

          {!isMenuSiteConfigured && (
            <View style={[styles.notice, { backgroundColor: isDark ? '#1f2937' : '#eff6ff' }]}>
              <Store size={18} color="#2563eb" />
              <Text style={[styles.noticeText, { color: colors.text }]}>{t('onlineMenu.siteNotReady')}</Text>
            </View>
          )}

          {showShare && saved.slug && (
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('onlineMenu.shareTitle')}</Text>
              <OnlineMenuSharePanel slug={saved.slug} businessName={currentBusiness?.business_name} />
            </Card>
          )}

          <Card style={styles.card}>
            {!isAdmin && (
              <View style={[styles.notice, { backgroundColor: isDark ? '#1f2937' : '#f3f4f6', marginBottom: 14 }]}>
                <Lock size={16} color={colors.subtext} />
                <Text style={[styles.noticeText, { color: colors.subtext }]}>{t('onlineMenu.adminOnly')}</Text>
              </View>
            )}

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchLabel, { color: enabled ? '#059669' : colors.text }]}>
                  {enabled ? t('onlineMenu.enable') : t('onlineMenu.enableOff')}
                </Text>
                <Text style={[styles.switchHint, { color: colors.subtext }]}>
                  {enabled ? t('onlineMenu.enableHintOn') : t('onlineMenu.enableHint')}
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                disabled={!isAdmin}
                trackColor={{ false: isDark ? '#4b5563' : '#d1d5db', true: '#86efac' }}
                thumbColor={enabled ? '#059669' : '#f3f4f6'}
                accessibilityLabel={t('onlineMenu.switchLabel')}
              />
            </View>

            <Input
              label={t('onlineMenu.linkName')}
              value={slug}
              onChangeText={(v) => { setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '')); setErrors(e => ({ ...e, menu_slug: '' })); }}
              placeholder="my-shop"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={40}
              editable={isAdmin}
              error={errors.menu_slug || undefined}
              hint={isMenuSiteConfigured ? `${MENU_URL.replace(/^https?:\/\//, '')}/${slug || 'my-shop'}` : t('onlineMenu.linkNameHint')}
              required={enabled}
            />

            <Input
              label={t('onlineMenu.telegram')}
              value={telegram}
              onChangeText={(v) => { setTelegram(v); setErrors(e => ({ ...e, menu_telegram: '' })); }}
              placeholder="@myshop"
              autoCapitalize="none"
              autoCorrect={false}
              editable={isAdmin}
              error={errors.menu_telegram || undefined}
              hint={t('onlineMenu.telegramHint')}
            />

            <Input
              label={t('onlineMenu.note')}
              value={note}
              onChangeText={(v) => { setNote(v); setErrors(e => ({ ...e, menu_note: '' })); }}
              placeholder={t('onlineMenu.notePlaceholder')}
              multiline
              numberOfLines={3}
              maxLength={MENU_NOTE_MAX}
              editable={isAdmin}
              error={errors.menu_note || undefined}
              hint={`${note.length}/${MENU_NOTE_MAX}`}
            />

            {isAdmin && (
              <Button title={t('common.save')} onPress={handleSave} loading={saving} disabled={saving} style={styles.saveButton} />
            )}
          </Card>

          <Text style={[styles.footnote, { color: colors.subtext }]}>{t('onlineMenu.howItWorks')}</Text>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold' },
  headerRight: { width: 40 },
  content: { flex: 1, paddingHorizontal: 16 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  card: { padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10, marginBottom: 14 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  switchLabel: { fontSize: 16, fontWeight: '600' },
  switchHint: { fontSize: 12, marginTop: 2 },
  saveButton: { marginTop: 8 },
  footnote: { fontSize: 12, lineHeight: 18, marginBottom: 40, textAlign: 'center' },
});
