import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from '@/src/locales';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Check
} from 'lucide-react-native';

interface DeleteBusinessModalProps {
  visible: boolean;
  businessName: string;
  businessId: string;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function DeleteBusinessModal({
  visible,
  businessName,
  businessId,
  onClose,
  onComplete
}: DeleteBusinessModalProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeNoUndo, setAgreeNoUndo] = useState(false);
  const [businessNameInput, setBusinessNameInput] = useState('');
  const [businessNameError, setBusinessNameError] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCurrentStep(1);
      setAgreeTerms(false);
      setAgreeNoUndo(false);
      setBusinessNameInput('');
      setBusinessNameError(false);
      setDeletionError(null);
    }
  }, [visible]);

  const handleNextStep = () => {
    if (currentStep === 1 && agreeTerms && agreeNoUndo) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setBusinessNameInput('');
      setBusinessNameError(false);
    }
  };

  const handleConfirmDelete = () => {
    if (businessNameInput.trim() === businessName) {
      setCurrentStep(3);
      setTimeout(() => {
        onComplete();
      }, 500);
    } else {
      setBusinessNameError(true);
    }
  };

  const handleRetry = () => {
    setCurrentStep(1);
    setDeletionError(null);
  };

  const renderStep1 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={[styles.warningIconContainer, { backgroundColor: '#fee2e2' }]}>
          <AlertTriangle size={32} color="#dc2626" />
        </View>
        <Text style={[styles.stepTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('deleteBusiness.step1Title')}
        </Text>
        <Text style={[styles.warningText, { color: '#dc2626' }]}>
          {t('deleteBusiness.warningHeader')}
        </Text>
      </View>

      <View style={[styles.businessNameBox, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
        <Text style={[styles.deletingLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          {t('deleteBusiness.deletingBusiness', { businessName })}
        </Text>
      </View>

      <View style={styles.consequencesContainer}>
        <Text style={[styles.consequencesTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('deleteBusiness.consequences')}
        </Text>

        {[1, 2, 3, 4, 5, 6, 7].map((num) => (
          <View key={num} style={styles.consequenceItem}>
            <View style={styles.bulletPoint}>
              <View style={[styles.bullet, { backgroundColor: '#dc2626' }]} />
            </View>
            <Text style={[styles.consequenceText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {t(`deleteBusiness.consequence${num}`)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreeTerms(!agreeTerms)}
        >
          <View style={[
            styles.checkbox,
            {
              borderColor: isDark ? '#4b5563' : '#d1d5db',
              backgroundColor: agreeTerms ? '#2563eb' : 'transparent'
            }
          ]}>
            {agreeTerms && <Check size={16} color="#ffffff" />}
          </View>
          <Text style={[styles.checkboxLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('deleteBusiness.agreeTerms')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreeNoUndo(!agreeNoUndo)}
        >
          <View style={[
            styles.checkbox,
            {
              borderColor: isDark ? '#4b5563' : '#d1d5db',
              backgroundColor: agreeNoUndo ? '#2563eb' : 'transparent'
            }
          ]}>
            {agreeNoUndo && <Check size={16} color="#ffffff" />}
          </View>
          <Text style={[styles.checkboxLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('deleteBusiness.agreeNoUndo')}
          </Text>
        </TouchableOpacity>
      </View>

      {!agreeTerms || !agreeNoUndo ? (
        <Text style={[styles.helperText, { color: '#dc2626' }]}>
          {t('deleteBusiness.bothCheckboxRequired')}
        </Text>
      ) : null}

      <View style={styles.buttonsContainer}>
        <Button
          title={t('common.cancel')}
          variant="outline"
          onPress={onClose}
          style={styles.button}
        />
        <Button
          title={t('deleteBusiness.nextStep')}
          onPress={handleNextStep}
          disabled={!agreeTerms || !agreeNoUndo}
          style={styles.button}
        />
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={[styles.warningIconContainer, { backgroundColor: '#fee2e2' }]}>
          <Trash2 size={32} color="#dc2626" />
        </View>
        <Text style={[styles.stepTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('deleteBusiness.step2Title')}
        </Text>
      </View>

      <Text style={[styles.instructionText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        {t('deleteBusiness.typeBusinessName')}
      </Text>

      <View style={styles.businessNameSection}>
        <Text style={[styles.currentBusinessLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          {t('deleteBusiness.currentBusinessName')}
        </Text>
        <View style={[styles.businessNameHighlight, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
          <Text style={[styles.businessNameText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {businessName}
          </Text>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? '#374151' : '#ffffff',
              borderColor: businessNameError ? '#dc2626' : (isDark ? '#4b5563' : '#d1d5db'),
              color: isDark ? '#f9fafb' : '#111827',
            }
          ]}
          placeholder={t('deleteBusiness.enterBusinessName')}
          placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
          value={businessNameInput}
          onChangeText={(text) => {
            setBusinessNameInput(text);
            setBusinessNameError(false);
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {businessNameError && (
          <Text style={[styles.errorText, { color: '#dc2626' }]}>
            {t('deleteBusiness.businessNameMismatch')}
          </Text>
        )}
      </View>

      <View style={styles.buttonsContainer}>
        <Button
          title={t('deleteBusiness.back')}
          variant="outline"
          onPress={handleBack}
          style={styles.button}
        />
        <Button
          title={t('common.cancel')}
          variant="outline"
          onPress={onClose}
          style={styles.button}
        />
        <Button
          title={t('deleteBusiness.deleteBusinessButton')}
          variant="danger"
          onPress={handleConfirmDelete}
          disabled={!businessNameInput.trim()}
          style={styles.button}
        />
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={[styles.stepTitle, { color: isDark ? '#f9fafb' : '#111827', marginTop: 16 }]}>
          {t('deleteBusiness.step3Title')}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <Text style={[styles.progressText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {t('deleteBusiness.finalizingDeletion')}
        </Text>
      </View>
    </View>
  );

  const renderStep4Success = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <View style={[styles.successIconContainer, { backgroundColor: '#d1fae5' }]}>
          <CheckCircle2 size={48} color="#10b981" />
        </View>
        <Text style={[styles.stepTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('deleteBusiness.step4Success')}
        </Text>
        <Text style={[styles.successMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {t('deleteBusiness.successMessage')}
        </Text>
      </View>
    </View>
  );

  const renderStep4Error = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <View style={[styles.errorIconContainer, { backgroundColor: '#fee2e2' }]}>
          <XCircle size={48} color="#dc2626" />
        </View>
        <Text style={[styles.stepTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('deleteBusiness.step4Error')}
        </Text>
        <Text style={[styles.errorMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {deletionError || t('deleteBusiness.errorMessage')}
        </Text>
      </View>

      <View style={styles.buttonsContainer}>
        <Button
          title={t('common.cancel')}
          variant="outline"
          onPress={onClose}
          style={styles.button}
        />
        <Button
          title={t('common.retry')}
          onPress={handleRetry}
          style={styles.button}
        />
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    if (deletionError) return renderStep4Error();

    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4Success();
      default:
        return renderStep1();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={currentStep === 3 ? undefined : onClose}
    >
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={[styles.modal, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
          {renderCurrentStep()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  modal: {
    flex: 1,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  stepContainer: {
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  warningIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  businessNameBox: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  deletingLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  consequencesContainer: {
    marginBottom: 24,
  },
  consequencesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  consequenceItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bulletPoint: {
    marginRight: 12,
    marginTop: 4,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  consequenceText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  businessNameSection: {
    marginBottom: 24,
  },
  currentBusinessLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  businessNameHighlight: {
    padding: 16,
    borderRadius: 8,
  },
  businessNameText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    height: 48,
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    marginTop: 8,
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
