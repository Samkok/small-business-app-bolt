import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { getReceiptUrls } from '@/src/services/expenseReceipts';
import { SheetModal } from '@/src/components/ui/SheetModal';

interface ReceiptViewerProps {
  visible: boolean;
  /** Stored paths (signed on open) or local file URIs (shown as they are). */
  paths?: string[];
  localUris?: string[];
  title?: string;
  initialIndex?: number;
  onClose: () => void;
}

/** Full-screen, swipeable view of an expense's receipt photos. */
export function ReceiptViewer({ visible, paths = [], localUris = [], title, initialIndex = 0, onClose }: ReceiptViewerProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [uris, setUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(initialIndex);

  const key = paths.join('|') + '#' + localUris.join('|');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setIndex(initialIndex);
    setFailed(false);
    if (!paths.length) {
      setUris(localUris);
      return;
    }
    setLoading(true);
    getReceiptUrls(paths)
      .then((map) => {
        if (cancelled) return;
        setUris([...paths.map((p) => map[p]).filter(Boolean), ...localUris]);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, key, initialIndex]);

  return (
    <SheetModal visible={visible} animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen" cornerBackground="#000000">
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.title} numberOfLines={1}>
            {title ?? t('expenses.receipts')}
            {uris.length > 1 ? `  ${index + 1}/${uris.length}` : ''}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Close">
            <X size={26} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#ffffff" style={styles.center} />
        ) : failed ? (
          <Text style={[styles.center, styles.message]}>{t('expenses.receiptsLoadFailed')}</Text>
        ) : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: initialIndex * width, y: 0 }}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {uris.map((uri) => (
              <View key={uri} style={{ width, height: height - 140, justifyContent: 'center' }}>
                <Image source={{ uri }} style={{ width, height: height - 160 }} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { flex: 1, color: '#ffffff', fontSize: 16, fontWeight: '600', marginRight: 12 },
  center: { flex: 1, textAlignVertical: 'center', alignSelf: 'center', marginTop: 200 },
  message: { color: '#e5e7eb', textAlign: 'center', paddingHorizontal: 32 },
});
