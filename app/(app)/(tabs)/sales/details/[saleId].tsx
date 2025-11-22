import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { ArrowLeft } from 'lucide-react-native';
import { salesService } from '@/src/services/sales';
import { useAuth } from '@/src/context/AuthContext';
import SaleDetailsContent from '@/src/components/sales/SaleDetailsContent';

export default function SaleDetailsScreen() {
  const [sale, setSale] = useState<any>(null);
  const [saleDetails, setSaleDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voidingInProgress, setVoidingInProgress] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);

  const router = useRouter();
  const { saleId } = useLocalSearchParams();
  const { isDark } = useTheme();
  const { currentBusiness, userProfile } = useAuth();

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(app)/(tabs)/sales');
    }
  };

  useEffect(() => {
    loadSaleDetails();
  }, []);

  const loadSaleDetails = async () => {
    if (!saleId) return;

    try {
      const [saleData, detailsData] = await Promise.all([
        salesService.getSale(saleId as string),
        salesService.getSaleWithDiscountBreakdown(saleId as string)
      ]);

      setSale(saleData);
      setSaleDetails(detailsData);
    } catch (error) {
      console.error('Error loading sale details:', error);
      Alert.alert('Error', 'Failed to load sale details');
    } finally {
      setLoading(false);
    }
  };

  const handleVoidSale = () => {
    if (!currentBusiness?.id || !sale) return;
    setShowVoidModal(true);
  };

  const handleVoidSaleConfirm = async (options: {
    reason: string;
    includeDeliveryCost: boolean;
    lossAmount?: number;
    lossPercentage?: number;
    lossType?: 'fixed' | 'percentage';
  }) => {
    if (!sale || !userProfile) return;

    setVoidingInProgress(true);
    try {
      await salesService.voidSale(
        sale.id,
        options.reason,
        userProfile.user_id,
        currentBusiness || undefined,
        currentBusiness ? [currentBusiness] : undefined,
        {
          includeDeliveryCost: options.includeDeliveryCost,
          lossAmount: options.lossAmount,
          lossPercentage: options.lossPercentage,
          lossType: options.lossType,
        }
      );
      setShowVoidModal(false);
      Alert.alert('Success', 'Sale voided successfully');
      await loadSaleDetails();
    } catch (error) {
      console.error('Error voiding sale:', error);
      Alert.alert('Error', 'Failed to void sale');
    } finally {
      setVoidingInProgress(false);
    }
  };

  const handleReturnItems = () => {
    setShowReturnForm(true);
  };

  const handleReturnComplete = () => {
    setShowReturnForm(false);
    loadSaleDetails();
  };

  const handleCancelReturn = () => {
    setShowReturnForm(false);
  };

  const handleCancelVoid = () => {
    setShowVoidModal(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
        >
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Sale Details
        </Text>
        <View style={styles.headerRight} />
      </View>

      <SaleDetailsContent
        sale={sale}
        saleDetails={saleDetails}
        loading={loading}
        voidingInProgress={voidingInProgress}
        showReturnForm={showReturnForm}
        showVoidModal={showVoidModal}
        onVoidSale={handleVoidSale}
        onVoidSaleConfirm={handleVoidSaleConfirm}
        onReturnItems={handleReturnItems}
        onReturnComplete={handleReturnComplete}
        onCancelReturn={handleCancelReturn}
        onCancelVoid={handleCancelVoid}
        userProfile={userProfile}
        currentBusiness={currentBusiness}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 40,
  },
});
