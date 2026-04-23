import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useTheme } from '@/src/context/ThemeContext';
import { X, Barcode } from 'lucide-react-native';

interface BarcodeScannerProps {
  onBarcodeScan: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onBarcodeScan, onClose }: BarcodeScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const lockRef = useRef(false);
  const lastRef = useRef<{ data: string; at: number } | null>(null);
  const onScanRef = useRef(onBarcodeScan);
  const { isDark } = useTheme();

  useEffect(() => {
    onScanRef.current = onBarcodeScan;
  }, [onBarcodeScan]);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  // Stable callback — never re-created across renders, so CameraView never
  // re-subscribes. Guards against: (a) native camera emitting the same barcode
  // across multiple frames, (b) React re-renders, (c) same-code re-scans within
  // a short window.
  const handleBarCodeScanned = useCallback(({ data }: { type: string; data: string }) => {
    if (!data || typeof data !== 'string') return;
    if (lockRef.current) return;
    const now = Date.now();
    if (lastRef.current && lastRef.current.data === data && now - lastRef.current.at < 2000) return;

    lockRef.current = true;
    lastRef.current = { data, at: now };
    setScanned(true);
    onScanRef.current(data);
  }, []);

  const handleScanAgain = useCallback(() => {
    lockRef.current = false;
    lastRef.current = null;
    setScanned(false);
  }, []);

  if (hasPermission === null) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <Text style={[styles.message, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Camera Permission Required
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          <Barcode size={64} color={isDark ? '#6b7280' : '#9ca3af'} />
          <Text style={[styles.message, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Camera access is required to scan barcodes
          </Text>
          <Text style={[styles.submessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            Please enable camera permission in your device settings
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: '#ffffff' }]}>
          Scan Barcode
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        {/* CameraView without children */}
        <CameraView
          style={styles.camera}
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'pdf417', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
          }}
        />
        
        {/* Overlay as a sibling to CameraView, not a child */}
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          
          <Text style={styles.instruction}>
            Position the barcode within the frame
          </Text>
          
          {scanned && (
            <TouchableOpacity
              style={styles.scanAgainButton}
              onPress={handleScanAgain}
            >
              <Text style={styles.scanAgainText}>Tap to scan again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  submessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#ffffff',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instruction: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  scanAgainButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  scanAgainText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});