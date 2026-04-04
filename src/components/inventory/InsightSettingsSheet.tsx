import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { X, RotateCcw } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import { productInsightService } from '@/src/services/productInsight';

interface SettingsValues {
  hot_selling_min_units_per_day: number;
  slow_selling_max_units_per_day: number;
  reorder_warning_days: number;
  overstock_days_threshold: number;
  default_low_stock_level: number;
  lead_time_days: number;
}

interface InsightSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  currentSettings: SettingsValues;
  onApply: (settings: SettingsValues) => void;
  saving: boolean;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function InsightSettingsSheet({
  visible,
  onClose,
  currentSettings,
  onApply,
  saving,
}: InsightSettingsSheetProps) {
  const { isDark } = useTheme();
  const [values, setValues] = useState<SettingsValues>(currentSettings);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setValues(currentSettings);
      setErrors({});
    }
  }, [visible, currentSettings]);

  const colors = {
    bg: isDark ? '#111827' : '#ffffff',
    sectionBg: isDark ? '#1f2937' : '#f9fafb',
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    input: isDark ? '#111827' : '#ffffff',
    inputBorder: isDark ? '#4b5563' : '#d1d5db',
    error: '#dc2626',
    accent: '#2563eb',
    highlight: isDark ? '#1e3a5f' : '#eff6ff',
  };

  const validate = (vals: SettingsValues): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (vals.hot_selling_min_units_per_day <= 0) errs.hot_selling_min_units_per_day = 'Must be > 0';
    if (vals.slow_selling_max_units_per_day < 0) errs.slow_selling_max_units_per_day = 'Must be >= 0';
    if (vals.hot_selling_min_units_per_day <= vals.slow_selling_max_units_per_day) {
      errs.hot_selling_min_units_per_day = 'Must be greater than slow selling rate';
    }
    if (vals.reorder_warning_days <= 0) errs.reorder_warning_days = 'Must be > 0';
    if (vals.overstock_days_threshold <= 0) errs.overstock_days_threshold = 'Must be > 0';
    if (vals.reorder_warning_days >= vals.overstock_days_threshold) {
      errs.reorder_warning_days = 'Must be less than overstock threshold';
    }
    if (vals.default_low_stock_level <= 0) errs.default_low_stock_level = 'Must be > 0';
    if (vals.lead_time_days < 0) errs.lead_time_days = 'Must be >= 0';
    return errs;
  };

  const handleApply = () => {
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      onApply(values);
    }
  };

  const handleReset = () => {
    const defaults = productInsightService.getDefaultSettings();
    setValues({
      hot_selling_min_units_per_day: defaults.hot_selling_min_units_per_day,
      slow_selling_max_units_per_day: defaults.slow_selling_max_units_per_day,
      reorder_warning_days: defaults.reorder_warning_days,
      overstock_days_threshold: defaults.overstock_days_threshold,
      default_low_stock_level: defaults.default_low_stock_level,
      lead_time_days: defaults.lead_time_days,
    });
    setErrors({});
  };

  const updateValue = (key: keyof SettingsValues, text: string) => {
    const num = parseFloat(text);
    setValues((prev) => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
  };

  const renderField = (
    label: string,
    key: keyof SettingsValues,
    unit: string,
    description: string,
    highlighted?: boolean
  ) => (
    <View
      key={key}
      style={[
        styles.fieldGroup,
        highlighted && { backgroundColor: colors.highlight, borderRadius: 10, padding: 12 },
      ]}
    >
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.fieldDesc, { color: colors.subtext }]}>{description}</Text>
      <View
        style={[
          styles.inputRow,
          {
            borderColor: errors[key] ? colors.error : colors.inputBorder,
            backgroundColor: colors.input,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={String(values[key])}
          onChangeText={(t) => updateValue(key, t)}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <View style={[styles.unitBadge, { backgroundColor: colors.sectionBg }]}>
          <Text style={[styles.unitText, { color: colors.subtext }]}>{unit}</Text>
        </View>
      </View>
      {errors[key] && <Text style={[styles.errorText, { color: colors.error }]}>{errors[key]}</Text>}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.sheet, { backgroundColor: colors.bg, maxHeight: SCREEN_HEIGHT * 0.85 }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Insight Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={colors.subtext} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <Text style={[styles.sectionTitle, { color: colors.subtext }]}>CLASSIFICATION THRESHOLDS</Text>

            {renderField(
              'Hot selling rate',
              'hot_selling_min_units_per_day',
              'units/day',
              'Daily sales rate above which a product is "hot selling"'
            )}
            {renderField(
              'Slow selling rate',
              'slow_selling_max_units_per_day',
              'units/day',
              'Daily sales rate below which a product is "slow moving"'
            )}
            {renderField(
              'Overstock threshold',
              'overstock_days_threshold',
              'days',
              'Flag as "do not order" when stock lasts longer than this many days'
            )}
            {renderField(
              'Default low stock level',
              'default_low_stock_level',
              'units',
              'Fallback minimum stock for products without a custom level set'
            )}

            <Text style={[styles.sectionTitle, { color: colors.subtext, marginTop: 8 }]}>REORDER SETTINGS</Text>

            {renderField(
              'Lead time',
              'lead_time_days',
              'days',
              'Estimated days between placing an order and receiving stock. "Must Order" triggers earlier to account for delivery time.',
              true
            )}
            {renderField(
              'Reorder warning buffer',
              'reorder_warning_days',
              'days',
              'Extra buffer days before stock-out to flag as "must order" (added on top of lead time)'
            )}

            <View style={[styles.infoBox, { backgroundColor: colors.sectionBg, borderColor: colors.border }]}>
              <Text style={[styles.infoText, { color: colors.subtext }]}>
                A product is flagged{' '}
                <Text style={{ fontWeight: '700', color: colors.accent }}>"Must Order"</Text>
                {' '}when its stock will run out within{' '}
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {(values.reorder_warning_days || 0) + (values.lead_time_days || 0)} days
                </Text>
                {' '}({values.reorder_warning_days || 0} buffer + {values.lead_time_days || 0} lead time).
              </Text>
            </View>

            <View style={{ height: 8 }} />
          </ScrollView>

          <View style={[styles.sheetFooter, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <RotateCcw size={16} color={colors.subtext} />
              <Text style={[styles.resetText, { color: colors.subtext }]}>Reset defaults</Text>
            </TouchableOpacity>
            <Button title="Apply" onPress={handleApply} loading={saving} style={styles.applyBtn} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    flexGrow: 0,
  },
  sheetBodyContent: {
    padding: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  fieldDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '500',
  },
  unitBadge: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderLeftColor: 'transparent',
  },
  unitText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    marginTop: 2,
  },
  infoBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '500',
  },
  applyBtn: {
    minWidth: 100,
  },
});
