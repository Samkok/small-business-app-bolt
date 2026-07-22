import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
  Platform,
  ActivityIndicator,
  Switch,
  Dimensions,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { X, Share2, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useReferral } from '@/src/context/ReferralContext';

export interface ProfitCardData {
  businessName: string;
  period: string;
  profit: number;
  revenue: number;
  salesCount: number;
  topProductName?: string;
  growthPercent?: number;
  currencySymbol?: string;
}

interface ProfitCardProps {
  visible: boolean;
  onClose: () => void;
  data: ProfitCardData;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1080;
const SCALE = Dimensions.get('window').width < 400 ? 0.3 : 0.35;

export function ProfitCard({ visible, onClose, data }: ProfitCardProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { referralCode } = useReferral();
  const viewShotRef = useRef<ViewShot>(null);
  const [showAmounts, setShowAmounts] = useState(true);
  const [sharing, setSharing] = useState(false);

  const currency = data.currencySymbol || '$';
  const isProfitable = data.profit > 0;
  const growth = data.growthPercent;

  const formatAmount = (amount: number) => {
    if (!showAmounts) return '***';
    if (Math.abs(amount) >= 1000000) {
      return `${currency}${(amount / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(amount) >= 1000) {
      return `${currency}${(amount / 1000).toFixed(1)}K`;
    }
    return `${currency}${amount.toFixed(0)}`;
  };

  const handleShare = useCallback(async () => {
    if (!viewShotRef.current?.capture) return;
    setSharing(true);

    try {
      const uri = await viewShotRef.current.capture();

      if (Platform.OS === 'web') {
        await Share.share({ message: t('profitCard.shareMonth') });
      } else {
        const fileUri = `${FileSystem.cacheDirectory}profit-card.png`;
        await FileSystem.copyAsync({ from: uri, to: fileUri });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/png',
            dialogTitle: t('profitCard.shareMonth'),
          });
        }
      }
    } catch (error) {
      console.error('Failed to share profit card:', error);
    } finally {
      setSharing(false);
    }
  }, [t]);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    modalBg: isDark ? '#1f2937' : '#ffffff',
    text: isDark ? '#f9fafb' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    primary: '#2563eb',
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[styles.container, { backgroundColor: colors.modalBg }]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t('profitCard.shareMonth')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.textSecondary }]}>
              {showAmounts ? t('profitCard.showAmounts') : t('profitCard.growthOnly')}
            </Text>
            <Switch
              value={showAmounts}
              onValueChange={setShowAmounts}
              trackColor={{ false: '#374151', true: '#93c5fd' }}
              thumbColor={showAmounts ? '#2563eb' : '#6b7280'}
            />
          </View>

          <View style={styles.cardPreviewContainer}>
            <View style={{ transform: [{ scale: SCALE }], width: CARD_WIDTH * SCALE, height: CARD_HEIGHT * SCALE, overflow: 'hidden' }}>
              <ViewShot
                ref={viewShotRef}
                options={{ format: 'png', quality: 1, width: CARD_WIDTH, height: CARD_HEIGHT }}
                style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: [{ scale: 1 }], transformOrigin: 'top left' }}
              >
                <CardContent
                  data={data}
                  showAmounts={showAmounts}
                  formatAmount={formatAmount}
                  isProfitable={isProfitable}
                  growth={growth}
                  currency={currency}
                  referralCode={referralCode}
                  t={t}
                />
              </ViewShot>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.shareButton, sharing && styles.shareButtonDisabled]}
            onPress={handleShare}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Share2 size={20} color="#ffffff" />
                <Text style={styles.shareButtonText}>{t('profitCard.shareMonth')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CardContent({
  data,
  showAmounts,
  formatAmount,
  isProfitable,
  growth,
  currency,
  referralCode,
  t,
}: {
  data: ProfitCardData;
  showAmounts: boolean;
  formatAmount: (n: number) => string;
  isProfitable: boolean;
  growth?: number;
  currency: string;
  referralCode: string | null;
  t: (key: string, opts?: any) => string;
}) {
  const hasGrowth = growth !== undefined && growth !== null;
  const growthPositive = hasGrowth && growth > 0;
  const growthNegative = hasGrowth && growth < 0;

  return (
    <View style={cardStyles.canvas}>
      <View style={cardStyles.topSection}>
        <Text style={cardStyles.businessName}>{data.businessName}</Text>
        <Text style={cardStyles.period}>{data.period}</Text>
      </View>

      <View style={cardStyles.heroSection}>
        {showAmounts ? (
          <Text style={cardStyles.heroNumber}>{formatAmount(data.profit)}</Text>
        ) : (
          <Text style={cardStyles.heroNumber}>
            {isProfitable ? '\u2705' : '\u26a0\ufe0f'}
          </Text>
        )}
        <Text style={cardStyles.heroLabel}>{t('profitCard.profitLabel')}</Text>

        {hasGrowth && (
          <View style={[
            cardStyles.growthBadge,
            { backgroundColor: growthPositive ? '#dcfce7' : growthNegative ? '#fef2f2' : '#f3f4f6' },
          ]}>
            {growthPositive && <TrendingUp size={18} color="#16a34a" />}
            {growthNegative && <TrendingDown size={18} color="#dc2626" />}
            {!growthPositive && !growthNegative && <Minus size={18} color="#6b7280" />}
            <Text style={[
              cardStyles.growthText,
              { color: growthPositive ? '#16a34a' : growthNegative ? '#dc2626' : '#6b7280' },
            ]}>
              {growthPositive ? '+' : ''}{growth.toFixed(0)}% {t('profitCard.vsLastMonth')}
            </Text>
          </View>
        )}

        {!hasGrowth && isProfitable && (
          <Text style={cardStyles.profitableBadge}>{t('profitCard.profitableBadge')}</Text>
        )}
      </View>

      <View style={cardStyles.statsRow}>
        <View style={cardStyles.statItem}>
          <Text style={cardStyles.statValue}>
            {showAmounts ? formatAmount(data.revenue) : '***'}
          </Text>
          <Text style={cardStyles.statLabel}>{t('profitCard.revenueLabel')}</Text>
        </View>
        <View style={cardStyles.statDivider} />
        <View style={cardStyles.statItem}>
          <Text style={cardStyles.statValue}>{data.salesCount}</Text>
          <Text style={cardStyles.statLabel}>{t('profitCard.salesLabel')}</Text>
        </View>
        {data.topProductName && (
          <>
            <View style={cardStyles.statDivider} />
            <View style={cardStyles.statItem}>
              <Text style={cardStyles.statValue} numberOfLines={1}>
                {data.topProductName}
              </Text>
              <Text style={cardStyles.statLabel}>{t('profitCard.topItem')}</Text>
            </View>
          </>
        )}
      </View>

      <View style={cardStyles.footer}>
        <Text style={cardStyles.madeWith}>{t('profitCard.madeWith')}</Text>
        {referralCode && (
          <Text style={cardStyles.referralCode}>
            {t('profitCard.tryFree', { code: referralCode })}
          </Text>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  canvas: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#0f172a',
    padding: 80,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'flex-start',
  },
  businessName: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  period: {
    fontSize: 32,
    color: '#94a3b8',
    fontWeight: '500',
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  heroNumber: {
    fontSize: 140,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -3,
  },
  heroLabel: {
    fontSize: 36,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 40,
    marginTop: 32,
    gap: 8,
  },
  growthText: {
    fontSize: 28,
    fontWeight: '700',
  },
  profitableBadge: {
    fontSize: 32,
    color: '#4ade80',
    marginTop: 32,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 40,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 24,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
  },
  footer: {
    alignItems: 'center',
    gap: 8,
  },
  madeWith: {
    fontSize: 24,
    color: '#64748b',
    fontWeight: '500',
  },
  referralCode: {
    fontSize: 28,
    color: '#60a5fa',
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardPreviewContainer: {
    alignItems: 'center',
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
