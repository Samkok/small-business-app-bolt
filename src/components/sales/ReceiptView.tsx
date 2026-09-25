import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { code128Bars } from '@/src/utils/barcode128';
import { ReceiptModel } from '@/src/utils/receipt';
import { formatReceiptDate } from '@/src/utils/receiptHtml';
import { RECEIPT_BRAND_LABEL, RECEIPT_BRAND_LOGO_DATA_URI } from '@/src/utils/receiptBrand';

interface ReceiptViewProps {
  model: ReceiptModel;
  formatAmount: (amount: number) => string;
  /** formats the second-currency total; without it that line is not shown */
  formatAmountIn?: (amount: number, currencyId: string) => string;
}

export const RECEIPT_VIEW_WIDTH = 340;

/**
 * The receipt as it appears on screen and in the shared image (captured with
 * react-native-view-shot). Always white paper with dark ink, whatever the app
 * theme. A dumb renderer of ReceiptModel, the same model the PDF is built from,
 * so the two cannot disagree on any amount.
 */
export function ReceiptView({ model, formatAmount, formatAmountIn }: ReceiptViewProps) {
  const contact = [model.business.phone, model.business.address, model.business.pageName].filter(Boolean) as string[];
  // A charged delivery fee is added below the goods, so show what the goods came to first
  const showSubtotal = model.itemDiscountTotal > 0 || model.orderDiscountAmount > 0 || model.delivery.kind === 'charged';

  return (
    <View style={styles.paper} collapsable={false}>
      {model.stamp && (
        <View style={styles.stampWrap} pointerEvents="none">
          <Text style={[styles.stamp, model.stamp === 'PROVISIONAL' && styles.stampProvisional]}>{model.stamp}</Text>
        </View>
      )}

      <View style={styles.center}>
        {model.business.logoUrl ? <Image source={{ uri: model.business.logoUrl }} style={styles.logo} resizeMode="contain" /> : null}
        <Text style={styles.biz}>{model.business.name}</Text>
        {contact.map((c, i) => (
          <Text key={i} style={styles.contact}>{c}</Text>
        ))}
      </View>

      <Rule />
      <Row label={`Receipt ${model.numberLabel}`} value={formatReceiptDate(model.date)} labelStyle={styles.bold} />
      {model.meta.map((m, i) => (
        <Row key={i} label={m.label} value={m.value} labelStyle={styles.muted} valueStyle={m.emphasis ? styles.bold : undefined} />
      ))}

      <Rule />
      {model.lines.map((l, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.itemName}>{l.name}</Text>
          <Row
            label={`${l.quantity}${l.unitLabel ? ` ${l.unitLabel}` : ''} x ${formatAmount(l.unitPrice)}`}
            value={formatAmount(l.amount)}
            indent
          />
          {l.discountAmount > 0 && (
            <Row label={l.discountLabel || 'Item discount'} value={`-${formatAmount(l.discountAmount)}`} indent labelStyle={styles.muted} valueStyle={styles.muted} />
          )}
        </View>
      ))}

      <Rule />
      {showSubtotal && <Row label="Subtotal" value={formatAmount(model.subtotal)} />}
      {model.orderDiscountAmount > 0 && (
        <Row label={model.orderDiscountLabel || 'Order discount'} value={`-${formatAmount(model.orderDiscountAmount)}`} />
      )}
      {model.adjustment !== 0 && (
        <Row label="Adjustment" value={`${model.adjustment < 0 ? '-' : ''}${formatAmount(Math.abs(model.adjustment))}`} />
      )}
      {model.delivery.kind === 'charged' && (
        <Row label={model.delivery.label || 'Delivery fee'} value={formatAmount(model.delivery.amount || 0)} />
      )}
      {model.delivery.kind !== 'none' && model.delivery.kind !== 'charged' && (
        <Row
          label={model.delivery.label || 'Delivery'}
          value={model.delivery.value || ''}
          valueStyle={model.delivery.kind === 'free' ? styles.bold : styles.smallMuted}
          wrapValue={model.delivery.kind !== 'free'}
        />
      )}
      <Row label={model.totalLabel} value={formatAmount(model.total)} labelStyle={styles.total} valueStyle={styles.total} />
      {model.secondaryTotal && formatAmountIn && (
        <Text style={styles.savings}>= {formatAmountIn(model.secondaryTotal.amount, model.secondaryTotal.currencyId)}</Text>
      )}
      {model.totalSavings > 0 && <Text style={styles.savings}>You saved {formatAmount(model.totalSavings)}</Text>}

      {model.refund && (
        <>
          <Rule />
          <Text style={styles.sectionTitle}>Returned</Text>
          {model.refund.items.map((r, i) => (
            <Row key={i} label={`${r.quantity > 0 ? `${r.quantity} x ` : ''}${r.name}`} value={formatAmount(r.amount)} indent />
          ))}
          {model.refund.deductions > 0 && <Row label="Deduction kept" value={`-${formatAmount(model.refund.deductions)}`} indent />}
          <Row label="Refunded" value={`-${formatAmount(model.refund.refunded)}`} />
          <Row label="Net paid" value={formatAmount(model.refund.netPaid)} labelStyle={styles.total} valueStyle={styles.total} />
        </>
      )}

      {(model.business.paymentNote || model.business.paymentQrUrl) && (
        <>
          <Rule />
          <Text style={[styles.sectionTitle, styles.centerText]}>Pay to</Text>
          {model.business.paymentQrUrl ? <Image source={{ uri: model.business.paymentQrUrl }} style={styles.payQr} resizeMode="contain" /> : null}
          {model.business.paymentNote ? <Text style={styles.payNote}>{model.business.paymentNote}</Text> : null}
        </>
      )}

      {model.stamp === 'VOID' && (
        <>
          <Rule />
          <Text style={[styles.sectionTitle, styles.centerText]}>This sale was voided</Text>
        </>
      )}
      {model.stamp === 'PROVISIONAL' && (
        <>
          <Rule />
          <Text style={[styles.contact, styles.centerText]}>Made offline. The receipt number is assigned once the sale syncs.</Text>
        </>
      )}
      {model.notes && (
        <>
          <Rule />
          <Text style={styles.notes}>Note: {model.notes}</Text>
        </>
      )}
      {model.footer && (
        <>
          <Rule />
          <Text style={styles.footer}>{model.footer}</Text>
        </>
      )}

      {model.barcodeValue && <ReceiptBarcode value={model.barcodeValue} />}

      <View style={styles.powered}>
        <Image source={{ uri: RECEIPT_BRAND_LOGO_DATA_URI }} style={styles.poweredLogo} />
        <Text style={styles.poweredText}>{RECEIPT_BRAND_LABEL}</Text>
      </View>
    </View>
  );
}

function Rule() {
  return <View style={styles.rule} />;
}

/** Code 128 barcode of the receipt number, so a scan in Sales History opens this sale. */
function ReceiptBarcode({ value }: { value: string }) {
  const { bars, totalWidth } = code128Bars(value);
  if (bars.length === 0) return null;
  const module = Math.min(2, (RECEIPT_VIEW_WIDTH - 36) / totalWidth);
  const height = 44;
  return (
    <View style={styles.barcode}>
      <Svg width={totalWidth * module} height={height}>
        {bars.map((b, i) => (
          <Rect key={i} x={b.x * module} y={0} width={b.width * module} height={height} fill={INK} />
        ))}
      </Svg>
      <Text style={styles.barcodeText}>{value}</Text>
    </View>
  );
}

function Row({
  label,
  value,
  indent,
  labelStyle,
  valueStyle,
  wrapValue,
}: {
  label: string;
  value: string;
  indent?: boolean;
  labelStyle?: any;
  valueStyle?: any;
  wrapValue?: boolean;
}) {
  return (
    <View style={[styles.row, indent && styles.indent]}>
      <Text style={[styles.text, styles.rowLabel, labelStyle]}>{label}</Text>
      <Text style={[styles.text, styles.rowValue, wrapValue && styles.rowValueWrap, valueStyle]} numberOfLines={wrapValue ? 2 : 1}>
        {value}
      </Text>
    </View>
  );
}

const INK = '#111827';
const styles = StyleSheet.create({
  paper: { width: RECEIPT_VIEW_WIDTH, backgroundColor: '#ffffff', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 24, alignSelf: 'center' },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  logo: { width: 64, height: 64, borderRadius: 10, marginBottom: 6 },
  biz: { fontSize: 18, fontWeight: '700', color: INK, textAlign: 'center' },
  contact: { fontSize: 12, color: '#4b5563', textAlign: 'center' },
  rule: { borderTopWidth: 1, borderTopColor: '#9ca3af', borderStyle: 'dashed', marginVertical: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginVertical: 2 },
  indent: { paddingLeft: 8 },
  text: { fontSize: 13, color: INK },
  rowLabel: { flexShrink: 1 },
  rowValue: { textAlign: 'right' },
  rowValueWrap: { flexShrink: 1, maxWidth: 150 },
  bold: { fontWeight: '700' },
  muted: { color: '#6b7280' },
  smallMuted: { color: '#4b5563', fontSize: 12 },
  item: { marginVertical: 5 },
  itemName: { fontSize: 13, fontWeight: '600', color: INK },
  total: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  savings: { textAlign: 'right', color: '#6b7280', fontSize: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 3 },
  notes: { fontSize: 12, color: '#374151' },
  footer: { fontSize: 13, color: '#374151', textAlign: 'center' },
  powered: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  poweredLogo: { width: 16, height: 16, borderRadius: 4 },
  poweredText: { fontSize: 11, color: '#9ca3af' },
  stampWrap: { position: 'absolute', top: 130, left: 0, right: 0, alignItems: 'center', zIndex: 1 },
  stamp: { fontSize: 52, fontWeight: '900', letterSpacing: 4, color: 'rgba(220, 38, 38, 0.2)', transform: [{ rotate: '-18deg' }] },
  stampProvisional: { fontSize: 32, color: 'rgba(217, 119, 6, 0.25)' },
  payQr: { width: 150, height: 150, alignSelf: 'center', marginVertical: 6 },
  payNote: { fontSize: 12, color: '#374151', textAlign: 'center' },
  barcode: { alignItems: 'center', marginTop: 14 },
  barcodeText: { fontSize: 11, letterSpacing: 2, color: '#374151', marginTop: 3 },
});
