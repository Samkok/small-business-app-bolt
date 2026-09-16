import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { encodeCode128, isEncodable } from '@/src/utils/barcode';

interface BarcodeViewProps {
  value: string | null | undefined;
  /** bar height in points */
  height?: number;
  /** maximum width available; the barcode scales down to fit, never up past moduleWidth */
  maxWidth?: number;
  /** points per module at full size */
  moduleWidth?: number;
  showText?: boolean;
  color?: string;
  background?: string;
  textColor?: string;
}

/**
 * Draws a scannable Code 128 barcode for a product or unit barcode value.
 * Always rendered on a light background so a scanner can read it in dark mode too.
 */
export function BarcodeView({
  value,
  height = 56,
  maxWidth = 320,
  moduleWidth = 2,
  showText = true,
  color = '#111827',
  background = '#ffffff',
  textColor = '#374151',
}: BarcodeViewProps) {
  const encoded = useMemo(() => (isEncodable(value) ? encodeCode128(value as string) : null), [value]);

  if (!encoded) {
    return value ? (
      <Text style={[styles.fallback, { color: textColor }]}>{value}</Text>
    ) : null;
  }

  const scale = Math.min(moduleWidth, maxWidth / encoded.width);
  const width = encoded.width * scale;

  return (
    <View style={[styles.wrap, { backgroundColor: background }]}>
      <Svg width={width} height={height}>
        {encoded.bars.map((b, i) => (
          <Rect key={i} x={b.x * scale} y={0} width={b.w * scale} height={height} fill={color} />
        ))}
      </Svg>
      {showText && (
        <Text style={[styles.label, { color: textColor }]} selectable>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  label: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: 1.5,
  },
  fallback: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
