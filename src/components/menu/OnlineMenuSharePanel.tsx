import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Share, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Link2, QrCode, Printer, Share2 } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { menuLink, menuPosterUrl, menuQrImageUrl } from '@/src/config/menu';

interface OnlineMenuSharePanelProps {
  slug: string;
  businessName?: string | null;
}

/**
 * Everything a shop needs to hand its menu to a customer: the link, the QR code and
 * the printable poster. The QR image is rendered by the menu website, so no QR library
 * is bundled. Used on the dashboard sheet and on the Online menu settings screen.
 */
export function OnlineMenuSharePanel({ slug, businessName }: OnlineMenuSharePanelProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [qrFailed, setQrFailed] = useState(false);
  const [sharingQr, setSharingQr] = useState(false);

  const url = menuLink(slug);
  const text = isDark ? '#f9fafb' : '#111827';
  const subtext = isDark ? '#9ca3af' : '#6b7280';
  const border = isDark ? '#374151' : '#e5e7eb';

  const shareLink = useCallback(async () => {
    try {
      await Share.share({ message: businessName ? `${businessName}\n${url}` : url });
    } catch (error) {
      console.error('Error sharing menu link:', error);
    }
  }, [url, businessName]);

  const shareQr = useCallback(async () => {
    setSharingQr(true);
    try {
      const target = `${FileSystem.cacheDirectory}menu-qr-${slug}.png`;
      const res = await FileSystem.downloadAsync(menuQrImageUrl(slug), target);
      if (res.status !== 200) throw new Error(`QR download failed (${res.status})`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t('onlineMenu.shareQr') });
      } else {
        await Share.share({ message: url });
      }
    } catch (error) {
      console.error('Error sharing menu QR:', error);
      Alert.alert(t('onlineMenu.qrUnavailableTitle'), t('onlineMenu.qrUnavailable'));
    } finally {
      setSharingQr(false);
    }
  }, [slug, url, t]);

  const openPoster = useCallback(async () => {
    try {
      await WebBrowser.openBrowserAsync(menuPosterUrl(slug));
    } catch (error) {
      console.error('Error opening menu poster:', error);
    }
  }, [slug]);

  return (
    <View>
      <View style={styles.qrFrame}>
        {qrFailed ? (
          <View style={styles.qrFallback}>
            <QrCode size={40} color="#9ca3af" />
            <Text style={styles.qrFallbackText}>{t('onlineMenu.qrUnavailable')}</Text>
          </View>
        ) : (
          <Image
            source={{ uri: menuQrImageUrl(slug) }}
            style={styles.qr}
            resizeMode="contain"
            onError={() => setQrFailed(true)}
            accessibilityLabel={t('onlineMenu.qrLabel')}
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.linkRow, { borderColor: border, backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
        onPress={shareLink}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${t('onlineMenu.shareLink')}: ${url}`}
      >
        <Link2 size={16} color="#2563eb" />
        <Text style={[styles.linkText, { color: text }]} numberOfLines={1} ellipsizeMode="middle" selectable>
          {url.replace(/^https?:\/\//, '')}
        </Text>
      </TouchableOpacity>
      <Text style={[styles.hint, { color: subtext }]}>{t('onlineMenu.shareHint')}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.action, styles.actionPrimary]} onPress={shareLink} accessibilityRole="button">
          <Share2 size={18} color="#ffffff" />
          <Text style={[styles.actionText, { color: '#ffffff' }]}>{t('onlineMenu.shareLink')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.action, { borderColor: border, borderWidth: 1 }]}
          onPress={shareQr}
          disabled={sharingQr || qrFailed}
          accessibilityRole="button"
        >
          {sharingQr ? <ActivityIndicator size="small" color="#2563eb" /> : <QrCode size={18} color={qrFailed ? '#9ca3af' : '#2563eb'} />}
          <Text style={[styles.actionText, { color: qrFailed ? '#9ca3af' : text }]}>{t('onlineMenu.shareQr')}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.posterLink} onPress={openPoster} accessibilityRole="link">
        <Printer size={16} color="#2563eb" />
        <Text style={styles.posterText}>{t('onlineMenu.printPoster')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Always white, so the code scans in dark mode too
  qrFrame: { alignSelf: 'center', width: 220, height: 220, borderRadius: 16, backgroundColor: '#ffffff', padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  qr: { width: '100%', height: '100%' },
  qrFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  qrFallbackText: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  linkText: { flex: 1, fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, marginTop: 6, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10 },
  actionPrimary: { backgroundColor: '#2563eb' },
  actionText: { fontSize: 14, fontWeight: '700' },
  posterLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  posterText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
});
