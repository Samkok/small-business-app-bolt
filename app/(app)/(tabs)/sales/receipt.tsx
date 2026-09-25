import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ArrowLeft, Image as ImageIcon, FileText, Printer, Settings } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ReceiptView } from '@/src/components/sales/ReceiptView';
import { salesService } from '@/src/services/sales';
import { buildReceiptModel, receiptInputFromSale, secondaryCurrencyFor, ReceiptModel } from '@/src/utils/receipt';
import { renderReceiptHtml, estimateReceiptHeightPt, RECEIPT_WIDTH_PT } from '@/src/utils/receiptHtml';
import { receiptDraftStore } from '@/src/utils/receiptDraft';

type Busy = 'image' | 'pdf' | 'print' | null;

/**
 * Receipt for one sale: preview, share as an image, share as a PDF, or print.
 * Opened with ?saleId= from the post-sale prompt and from a sale's details, or
 * with ?draft=1 for a sale made offline that has no server record yet.
 */
export default function ReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const saleId = typeof params.saleId === 'string' ? params.saleId : undefined;
  const isDraft = params.draft === '1';
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { formatPrice, currencies } = useCurrencyContext();

  const [model, setModel] = useState<ReceiptModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const shotRef = useRef<ViewShot>(null);

  const colors = {
    bg: isDark ? '#111827' : '#e5e7eb',
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    bar: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isDraft) {
        const draft = receiptDraftStore.get();
        if (!draft) throw new Error('This receipt is no longer available. Open the sale once it has synced.');
        setModel(buildReceiptModel(draft));
      } else if (saleId) {
        const sale = await salesService.getSale(saleId);
        if (!sale) throw new Error('Sale not found');
        setModel(buildReceiptModel({
          ...receiptInputFromSale(sale, currentBusiness),
          // the total once more in the other currency, at the rate saved on the sale
          secondaryCurrency: secondaryCurrencyFor((sale as any)?.currency_id, currencies),
        }));
      } else {
        throw new Error('No sale selected');
      }
    } catch (e: any) {
      console.error('Error loading receipt:', e);
      setError(e?.message || 'Could not load this receipt');
    } finally {
      setLoading(false);
    }
  }, [saleId, isDraft, currentBusiness, currencies]);

  useEffect(() => { load(); }, [load]);

  const formatAmount = useCallback(
    (amount: number) => formatPrice(amount, model?.currencyId ?? undefined),
    [formatPrice, model?.currencyId]
  );

  const fileStem = useMemo(() => `receipt_${(model?.numberLabel || 'sale').replace(/[^A-Za-z0-9-]/g, '')}`, [model?.numberLabel]);
  const missingContact = !!model && !model.business.phone && !model.business.address && !model.business.pageName;

  /** The logo is inlined so the PDF never renders before a remote image has loaded. */
  const logoDataUri = async (): Promise<string | null> => {
    const url = model?.business.logoUrl;
    if (!url || Platform.OS === 'web') return null;
    try {
      const ext = (url.split('?')[0].split('.').pop() || 'png').toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      const target = `${FileSystem.cacheDirectory}receipt_logo.${ext}`;
      const res = await FileSystem.downloadAsync(url, target);
      const base64 = await FileSystem.readAsStringAsync(res.uri, { encoding: FileSystem.EncodingType?.Base64 || ('base64' as any) });
      return `data:${mime};base64,${base64}`;
    } catch {
      return null; // fall back to the remote URL
    }
  };

  const buildHtml = async () => renderReceiptHtml(model!, formatAmount, { logoDataUri: await logoDataUri(), formatAmountIn: formatPrice });

  const share = async (uri: string, mimeType: string, uti: string, title: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle: title });
    } else {
      Alert.alert('Sharing unavailable', 'This device cannot share files.');
    }
  };

  const handleImage = async () => {
    if (!model || busy || !shotRef.current?.capture) return;
    setBusy('image');
    try {
      const captured = await shotRef.current.capture();
      const target = `${FileSystem.cacheDirectory}${fileStem}.png`;
      await FileSystem.deleteAsync(target, { idempotent: true });
      await FileSystem.copyAsync({ from: captured, to: target });
      await share(target, 'image/png', 'public.png', 'Share receipt');
    } catch (e) {
      console.error('Error sharing receipt image:', e);
      Alert.alert('Error', 'Could not create the receipt image');
    } finally {
      setBusy(null);
    }
  };

  const handlePdf = async () => {
    if (!model || busy) return;
    setBusy('pdf');
    try {
      const html = await buildHtml();
      const { uri } = await Print.printToFileAsync({ html, width: RECEIPT_WIDTH_PT, height: estimateReceiptHeightPt(model) });
      const target = `${FileSystem.cacheDirectory}${fileStem}.pdf`;
      await FileSystem.deleteAsync(target, { idempotent: true });
      await FileSystem.copyAsync({ from: uri, to: target });
      await share(target, 'application/pdf', 'com.adobe.pdf', 'Share receipt');
    } catch (e) {
      console.error('Error sharing receipt PDF:', e);
      Alert.alert('Error', 'Could not create the receipt PDF');
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async () => {
    if (!model || busy) return;
    setBusy('print');
    try {
      await Print.printAsync({ html: await buildHtml() });
    } catch (e: any) {
      // Closing the print dialog rejects on iOS; that is not an error worth showing
      if (!String(e?.message || '').toLowerCase().includes('cancel')) {
        console.error('Error printing receipt:', e);
        Alert.alert('Error', 'Could not open the print dialog');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bar, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{model ? `Receipt ${model.numberLabel}` : 'Receipt'}</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : error || !model ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { color: colors.text }]}>{error || 'Could not load this receipt'}</Text>
          {!isDraft && (
            <TouchableOpacity style={styles.retry} onPress={load}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            {missingContact && (
              <TouchableOpacity
                style={[styles.tip, { backgroundColor: colors.bar, borderColor: colors.border }]}
                onPress={() => router.push('/settings/business')}
                activeOpacity={0.8}
              >
                <Settings size={16} color="#2563eb" />
                <Text style={[styles.tipText, { color: colors.text }]}>
                  Add your phone, address and page name in Business settings to show them on receipts.
                </Text>
              </TouchableOpacity>
            )}
            <View style={styles.paperShadow}>
              <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }}>
                <ReceiptView model={model} formatAmount={formatAmount} formatAmountIn={formatPrice} />
              </ViewShot>
            </View>
          </ScrollView>

          <View style={[styles.actions, { backgroundColor: colors.bar, borderTopColor: colors.border }]}>
            <Action label="Image" busy={busy === 'image'} disabled={!!busy} onPress={handleImage} icon={<ImageIcon size={20} color="#ffffff" />} primary />
            <Action label="PDF" busy={busy === 'pdf'} disabled={!!busy} onPress={handlePdf} icon={<FileText size={20} color="#2563eb" />} textColor="#2563eb" borderColor={colors.border} />
            <Action label="Print" busy={busy === 'print'} disabled={!!busy} onPress={handlePrint} icon={<Printer size={20} color="#2563eb" />} textColor="#2563eb" borderColor={colors.border} />
          </View>
        </>
      )}
    </View>
  );
}

function Action({
  label, icon, onPress, busy, disabled, primary, textColor, borderColor,
}: {
  label: string; icon: React.ReactNode; onPress: () => void; busy: boolean; disabled: boolean; primary?: boolean; textColor?: string; borderColor?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.action, primary ? styles.actionPrimary : { borderWidth: 1, borderColor }, disabled && !busy && styles.actionDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {busy ? <ActivityIndicator size="small" color={primary ? '#ffffff' : '#2563eb'} /> : icon}
      <Text style={[styles.actionText, { color: primary ? '#ffffff' : textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 10, borderBottomWidth: 1 },
  headerButton: { padding: 8, width: 40 },
  title: { flex: 1, fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  scroll: { paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' },
  paperShadow: { shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5, backgroundColor: '#ffffff' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12, alignSelf: 'stretch' },
  tipText: { flex: 1, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 10 },
  actionPrimary: { backgroundColor: '#2563eb' },
  actionDisabled: { opacity: 0.5 },
  actionText: { fontSize: 15, fontWeight: '700' },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText: { fontSize: 14, textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563eb' },
  retryText: { color: '#ffffff', fontWeight: '700' },
});
