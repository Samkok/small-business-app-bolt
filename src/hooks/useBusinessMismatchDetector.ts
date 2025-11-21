import { useEffect, useState } from 'react';
import { Database } from '../types/database';

type Business = Database['public']['Tables']['businesses']['Row'];

interface BusinessMismatchResult {
  hasMismatch: boolean;
  mismatchedItems: number;
  currentBusinessId: string | null;
}

/**
 * Hook to detect when displayed data doesn't match the current business
 *
 * @param data - Array of data items with business_id
 * @param currentBusiness - Current business from AuthContext
 * @returns Object with mismatch detection results
 */
export function useBusinessMismatchDetector<T extends { business_id: string }>(
  data: T[],
  currentBusiness: Business | null
): BusinessMismatchResult {
  const [result, setResult] = useState<BusinessMismatchResult>({
    hasMismatch: false,
    mismatchedItems: 0,
    currentBusinessId: null,
  });

  useEffect(() => {
    if (!currentBusiness) {
      setResult({
        hasMismatch: false,
        mismatchedItems: 0,
        currentBusinessId: null,
      });
      return;
    }

    const currentBusinessId = currentBusiness.id;
    const mismatchedItems = data.filter(item => item.business_id !== currentBusinessId);

    const hasMismatch = mismatchedItems.length > 0;

    if (hasMismatch) {
      console.warn(
        `[BusinessMismatchDetector] Detected ${mismatchedItems.length} items from different business`,
        {
          currentBusinessId,
          currentBusinessName: currentBusiness.business_name,
          totalItems: data.length,
          mismatchedCount: mismatchedItems.length,
        }
      );
    }

    setResult({
      hasMismatch,
      mismatchedItems: mismatchedItems.length,
      currentBusinessId,
    });
  }, [data, currentBusiness]);

  return result;
}

/**
 * Hook to filter data to only show items from current business
 *
 * @param data - Array of data items with business_id
 * @param currentBusiness - Current business from AuthContext
 * @returns Filtered data array
 */
export function useCurrentBusinessData<T extends { business_id: string }>(
  data: T[],
  currentBusiness: Business | null
): T[] {
  const [filteredData, setFilteredData] = useState<T[]>([]);

  useEffect(() => {
    if (!currentBusiness) {
      setFilteredData([]);
      return;
    }

    const filtered = data.filter(item => item.business_id === currentBusiness.id);

    if (filtered.length !== data.length) {
      console.log(
        `[CurrentBusinessData] Filtered out ${data.length - filtered.length} items from other businesses`
      );
    }

    setFilteredData(filtered);
  }, [data, currentBusiness]);

  return filteredData;
}

/**
 * Hook to detect and warn about stale data after business changes
 *
 * @param data - Array of data items with business_id
 * @param currentBusiness - Current business from AuthContext
 * @param onMismatchDetected - Callback to execute when mismatch is detected
 */
export function useBusinessMismatchWarning<T extends { business_id: string }>(
  data: T[],
  currentBusiness: Business | null,
  onMismatchDetected?: (mismatchedCount: number) => void
): void {
  const { hasMismatch, mismatchedItems } = useBusinessMismatchDetector(data, currentBusiness);

  useEffect(() => {
    if (hasMismatch && onMismatchDetected) {
      onMismatchDetected(mismatchedItems);
    }
  }, [hasMismatch, mismatchedItems, onMismatchDetected]);
}
