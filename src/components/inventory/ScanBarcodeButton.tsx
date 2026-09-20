import React, { useCallback, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Barcode } from 'lucide-react-native';
import BarcodeScanner from '@/src/components/inventory/BarcodeScanner';
import { productService } from '@/src/services/products';

interface ScanBarcodeButtonProps {
  onScanned: (barcode: string) => void;
  backgroundColor: string;
  borderColor: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Barcode icon button for the end of a search bar. Owns its scanner modal, so it
 * can sit inside another modal (the product picker sheet): iOS presents a modal
 * nested in the visible one, but not a sibling of it.
 */
export function ScanBarcodeButton({ onScanned, backgroundColor, borderColor, size = 40, style }: ScanBarcodeButtonProps) {
  const [scanning, setScanning] = useState(false);

  const handleScan = useCallback((barcode: string) => {
    setScanning(false);
    onScanned(barcode.trim());
  }, [onScanned]);

  return (
    <>
      <TouchableOpacity
        style={[styles.button, { width: size, height: size, backgroundColor, borderColor }, style]}
        onPress={() => setScanning(true)}
        accessibilityRole="button"
        accessibilityLabel="Scan a barcode"
      >
        <Barcode size={20} color="#2563eb" />
      </TouchableOpacity>
      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        {scanning && <BarcodeScanner onBarcodeScan={handleScan} onClose={() => setScanning(false)} />}
      </Modal>
    </>
  );
}

/**
 * The product a scanned code belongs to: first among the products already on
 * screen, then on the server, which also knows unit-variant barcodes (a box and a
 * bottle of the same product can carry different codes).
 */
export async function findScannedProduct(barcode: string, products: any[], businessId: string): Promise<any | null> {
  const local = products.find(p => p.barcode && String(p.barcode) === barcode);
  if (local) return local;
  const remote = await productService.searchByBarcode(barcode, businessId);
  if (!remote) return null;
  return products.find(p => p.id === remote.id) || null;
}

/** What to put in a "name or barcode" search box so the list narrows to that product. */
export const searchTextForProduct = (product: any, barcode: string): string =>
  String(product.barcode || '') === barcode ? barcode : String(product.name || barcode);

const styles = StyleSheet.create({
  button: { borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
