import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useEffect, useRef } from 'react';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function SkeletonLoader({ 
  width = '100%', 
  height = 20, 
  borderRadius = 4,
  style 
}: SkeletonLoaderProps) {
  const { isDark } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: false,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: isDark 
      ? ['#374151', '#4b5563'] 
      : ['#f3f4f6', '#e5e7eb'],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    />
  );
}

// Skeleton components for different UI elements
export function SkeletonCard({ children, style }: { children?: React.ReactNode; style?: any }) {
  const { isDark } = useTheme();
  
  return (
    <View style={[
      styles.card,
      {
        backgroundColor: isDark ? '#374151' : '#ffffff',
        shadowColor: isDark ? '#000000' : '#000000',
      },
      style
    ]}>
      {children}
    </View>
  );
}

export function SkeletonProductCard() {
  return (
    <SkeletonCard style={styles.productCard}>
      <View style={styles.productCardInnerContainer}>
        {/* Image skeleton */}
        <SkeletonLoader 
          height={80} 
          width={80} 
          borderRadius={8} 
          style={styles.productImageSkeleton} 
        />
        
        {/* Content skeleton */}
        <View style={styles.productContentSkeleton}>
          <SkeletonLoader height={18} width="80%" style={{ marginBottom: 6 }} />
          <SkeletonLoader height={14} width="60%" style={{ marginBottom: 8 }} />
          
          <View style={styles.productPriceStockSkeleton}>
            <SkeletonLoader height={16} width={60} />
            <SkeletonLoader height={12} width={50} />
          </View>
          
          <SkeletonLoader height={10} width="40%" style={{ marginBottom: 8 }} />
          
          <View style={styles.productCardActions}>
            <SkeletonLoader height={32} width="48%" borderRadius={6} />
            <SkeletonLoader height={32} width="48%" borderRadius={6} />
          </View>
        </View>
      </View>
    </SkeletonCard>
  );
}

export function SkeletonCustomerCard() {
  return (
    <SkeletonCard style={styles.customerCard}>
      <View style={styles.customerCardHeader}>
        <View style={{ flex: 1 }}>
          <SkeletonLoader height={18} width="70%" style={{ marginBottom: 8 }} />
          <SkeletonLoader height={14} width="50%" style={{ marginBottom: 8 }} />
          <SkeletonLoader height={14} width="40%" />
        </View>
        <View style={styles.customerCardActions}>
          <SkeletonLoader height={32} width={32} borderRadius={16} style={{ marginRight: 8 }} />
          <SkeletonLoader height={32} width={32} borderRadius={16} />
        </View>
      </View>
    </SkeletonCard>
  );
}

export function SkeletonSaleCard() {
  return (
    <SkeletonCard style={styles.saleCard}>
      <View style={styles.saleCardHeader}>
        <View style={{ flex: 1 }}>
          <SkeletonLoader height={16} width="40%" style={{ marginBottom: 8 }} />
          <SkeletonLoader height={20} width="30%" style={{ marginBottom: 8 }} />
        </View>
        <SkeletonLoader height={24} width={60} borderRadius={12} />
      </View>
      <View style={styles.saleCardDetails}>
        <SkeletonLoader height={14} width="60%" style={{ marginBottom: 6 }} />
        <SkeletonLoader height={14} width="50%" style={{ marginBottom: 6 }} />
        <SkeletonLoader height={14} width="40%" />
      </View>
    </SkeletonCard>
  );
}

export function SkeletonExpenseCard() {
  return (
    <SkeletonCard style={styles.expenseCard}>
      <View style={styles.expenseCardHeader}>
        <View style={{ flex: 1 }}>
          <SkeletonLoader height={18} width="60%" style={{ marginBottom: 8 }} />
          <SkeletonLoader height={16} width="80%" style={{ marginBottom: 8 }} />
        </View>
        <View style={styles.expenseCardActions}>
          <SkeletonLoader height={32} width={32} borderRadius={16} style={{ marginRight: 8 }} />
          <SkeletonLoader height={32} width={32} borderRadius={16} />
        </View>
      </View>
      <View style={styles.expenseCardFooter}>
        <SkeletonLoader height={14} width="40%" />
        <SkeletonLoader height={18} width="25%" />
      </View>
    </SkeletonCard>
  );
}

export function SkeletonDashboardStats() {
  return (
    <View style={styles.statsGrid}>
      {[1, 2, 3, 4].map((index) => (
        <SkeletonCard key={index} style={styles.statCard}>
          <View style={styles.statContent}>
            <SkeletonLoader height={36} width={36} borderRadius={8} />
            <View style={styles.statText}>
              <SkeletonLoader height={18} width="60%" style={{ marginBottom: 4 }} />
              <SkeletonLoader height={12} width="80%" />
            </View>
          </View>
        </SkeletonCard>
      ))}
    </View>
  );
}

export function SkeletonList({ 
  itemComponent: ItemComponent, 
  itemCount = 5,
  style 
}: { 
  itemComponent: React.ComponentType; 
  itemCount?: number;
  style?: any;
}) {
  return (
    <View style={style}>
      {Array.from({ length: itemCount }, (_, index) => (
        <ItemComponent key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  productCard: {
    padding: 12,
  },
  productCardInnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImageSkeleton: {
    marginRight: 12,
  },
  productContentSkeleton: {
    flex: 1,
  },
  productPriceStockSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  productCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  customerCard: {
    padding: 16,
  },
  customerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerCardActions: {
    flexDirection: 'row',
  },
  saleCard: {
    padding: 16,
  },
  saleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  saleCardDetails: {
    marginBottom: 8,
  },
  expenseCard: {
    padding: 16,
  },
  expenseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  expenseCardActions: {
    flexDirection: 'row',
  },
  expenseCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    width: '48%',
    padding: 12,
    minHeight: 100,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 12,
    flex: 1,
  },
  teamMemberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  teamMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teamMemberDetails: {
    flex: 1,
  },
  teamMemberActions: {
    flexDirection: 'row',
  },
  productDetailsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  productDetailsCard: {
    padding: 16,
    marginBottom: 16,
  },
  productDetailsHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  productDetailsInfo: {
    flex: 1,
  },
  productDetailsStock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  productDetailsStockItem: {
    alignItems: 'center',
  },
  productDetailsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  productDetailsFinancialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  productDetailsFinancialItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  productDetailsProfitMargin: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  productDetailsImportItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  productDetailsImportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  productDetailsImportDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productDetailsImportDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  productDetailsImportDetail: {
    width: '50%',
    marginBottom: 8,
  },
  productDetailsFormula: {
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
});

export function SkeletonTeamMemberCard() {
  return (
    <SkeletonCard style={styles.teamMemberCard}>
      <View style={styles.teamMemberInfo}>
        <SkeletonLoader height={48} width={48} borderRadius={24} style={{ marginRight: 12 }} />
        <View style={styles.teamMemberDetails}>
          <SkeletonLoader height={16} width="70%" style={{ marginBottom: 4 }} />
          <SkeletonLoader height={14} width="60%" style={{ marginBottom: 6 }} />
          <SkeletonLoader height={20} width={60} borderRadius={12} />
        </View>
      </View>
      <View style={styles.teamMemberActions}>
        <SkeletonLoader height={36} width={36} borderRadius={18} style={{ marginRight: 8 }} />
        <SkeletonLoader height={36} width={36} borderRadius={18} />
      </View>
    </SkeletonCard>
  );
}

export function SkeletonProductDetails() {
  return (
    <View style={styles.productDetailsContainer}>
      {/* Product Overview Card */}
      <SkeletonCard style={styles.productDetailsCard}>
        <View style={styles.productDetailsHeader}>
          <SkeletonLoader height={100} width={100} borderRadius={8} style={{ marginRight: 16 }} />
          <View style={styles.productDetailsInfo}>
            <SkeletonLoader height={18} width="80%" style={{ marginBottom: 4 }} />
            <SkeletonLoader height={18} width="40%" style={{ marginBottom: 8 }} />
            <SkeletonLoader height={14} width="90%" style={{ marginBottom: 8 }} />
            <SkeletonLoader height={12} width="60%" />
          </View>
        </View>
        
        <View style={styles.productDetailsStock}>
          <View style={styles.productDetailsStockItem}>
            <SkeletonLoader height={12} width="60%" style={{ marginBottom: 4 }} />
            <SkeletonLoader height={16} width="30%" />
          </View>
          <View style={styles.productDetailsStockItem}>
            <SkeletonLoader height={12} width="70%" style={{ marginBottom: 4 }} />
            <SkeletonLoader height={16} width="30%" />
          </View>
          <View style={styles.productDetailsStockItem}>
            <SkeletonLoader height={12} width="60%" style={{ marginBottom: 4 }} />
            <SkeletonLoader height={16} width="40%" />
          </View>
        </View>
        
        <SkeletonLoader height={44} width="100%" borderRadius={8} style={{ marginTop: 16 }} />
      </SkeletonCard>

      {/* Financial Summary Card */}
      <SkeletonCard style={styles.productDetailsCard}>
        <View style={styles.productDetailsSectionHeader}>
          <SkeletonLoader height={20} width={20} borderRadius={10} style={{ marginRight: 8 }} />
          <SkeletonLoader height={16} width="50%" />
        </View>
        
        <View style={styles.productDetailsFinancialGrid}>
          {[1, 2, 3, 4].map((index) => (
            <View key={index} style={styles.productDetailsFinancialItem}>
              <SkeletonLoader height={40} width={40} borderRadius={20} style={{ marginBottom: 8 }} />
              <SkeletonLoader height={18} width="60%" style={{ marginBottom: 4 }} />
              <SkeletonLoader height={12} width="80%" />
            </View>
          ))}
        </View>
        
        <View style={styles.productDetailsProfitMargin}>
          <SkeletonLoader height={14} width="40%" style={{ marginRight: 8 }} />
          <SkeletonLoader height={16} width="30%" />
        </View>
        
        <SkeletonLoader height={12} width="60%" style={{ marginTop: 8 }} />
      </SkeletonCard>

      {/* Import History Card */}
      <SkeletonCard style={styles.productDetailsCard}>
        <View style={styles.productDetailsSectionHeader}>
          <SkeletonLoader height={20} width={20} borderRadius={10} style={{ marginRight: 8 }} />
          <SkeletonLoader height={16} width="40%" />
        </View>
        
        {[1, 2, 3].map((index) => (
          <View key={index} style={styles.productDetailsImportItem}>
            <View style={styles.productDetailsImportHeader}>
              <View style={styles.productDetailsImportDate}>
                <SkeletonLoader height={14} width={14} borderRadius={7} style={{ marginRight: 6 }} />
                <SkeletonLoader height={12} width="40%" />
              </View>
              <SkeletonLoader height={20} width={60} borderRadius={12} />
            </View>
            
            <View style={styles.productDetailsImportDetails}>
              {[1, 2, 3, 4].map((detailIndex) => (
                <View key={detailIndex} style={styles.productDetailsImportDetail}>
                  <SkeletonLoader height={12} width="40%" />
                  <SkeletonLoader height={14} width="30%" />
                </View>
              ))}
            </View>
            
            <SkeletonLoader height={12} width="80%" style={{ marginTop: 8 }} />
          </View>
        ))}
      </SkeletonCard>

      {/* Cost Calculation Card */}
      <SkeletonCard style={styles.productDetailsCard}>
        <View style={styles.productDetailsSectionHeader}>
          <SkeletonLoader height={20} width={20} borderRadius={10} style={{ marginRight: 8 }} />
          <SkeletonLoader height={16} width="60%" />
        </View>
        
        <SkeletonLoader height={14} width="100%" style={{ marginBottom: 16 }} />
        
        <View style={styles.productDetailsFormula}>
          <SkeletonLoader height={14} width="70%" style={{ marginBottom: 8 }} />
          <SkeletonLoader height={14} width="90%" style={{ marginBottom: 4 }} />
          <SkeletonLoader height={14} width="60%" style={{ marginBottom: 4 }} />
          <SkeletonLoader height={14} width="50%" />
        </View>
        
        <SkeletonLoader height={14} width="100%" style={{ marginTop: 16 }} />
      </SkeletonCard>
    </View>
  );
}