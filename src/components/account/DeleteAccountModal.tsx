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
import { Button } from '@/src/components/ui/Button';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Check,
  Building
} from 'lucide-react-native';
import { AccountDeletePreview } from '@/src/services/account';

interface DeleteAccountModalProps {
  visible: boolean;
  userEmail: string;
  preview: AccountDeletePreview;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function DeleteAccountModal({
  visible,
  userEmail,
  preview,
  onClose,
  onComplete
}: DeleteAccountModalProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [agreeAllBusinesses, setAgreeAllBusinesses] = useState(false);
  const [agreeAllData, setAgreeAllData] = useState(false);
  const [agreeNoUndo, setAgreeNoUndo] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCurrentStep(1);
      setAgreeAllBusinesses(false);
      setAgreeAllData(false);
      setAgreeNoUndo(false);
      setEmailInput('');
      setEmailError(false);
      setDeletionError(null);
    }
  }, [visible]);

  const handleNextStep = () => {
    if (currentStep === 1 && agreeAllBusinesses && agreeAllData && agreeNoUndo) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setEmailInput('');
      setEmailError(false);
    }
  };

  const handleConfirmDelete = () => {
    if (emailInput.trim() === userEmail) {
      setCurrentStep(3);
      setTimeout(() => {
        onComplete();
      }, 500);
    } else {
      setEmailError(true);
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
          {t('deleteAccount.step1Title')}
        </Text>
        <Text style={[styles.warningText, { color: '#dc2626' }]}>
          {t('deleteAccount.warningHeader')}
        </Text>
      </View>

      <View style={[styles.businessCountBox, { backgroundColor: isDark ? '#374151' : '#fff3cd', borderColor: '#ffc107', borderWidth: 2 }]}>
        <Text style={[styles.businessCountText, { color: isDark ? '#ffc107' : '#856404' }]}>
          {t('deleteAccount.businessesCount', { count: preview.totalBusinessesCount })}
        </Text>
      </View>

      {preview.ownedBusinesses.length > 0 && (
        <View style={styles.businessesSection}>
          <Text style={[styles.businessesHeader, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('deleteAccount.ownedBusinessesHeader')}
          </Text>
          <ScrollView style={styles.businessesList} nestedScrollEnabled>
            {preview.ownedBusinesses.map((business) => (
              <View
                key={business.id}
                style={[styles.businessCard, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
              >
                <Building size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text style={[styles.businessName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {business.business_name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[styles.dataPreviewBox, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
        <Text style={[styles.dataPreviewTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('deleteAccount.allDataWarning')}
        </Text>
        <View style={styles.dataStats}>
          <Text style={[styles.dataStat, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {t('deleteAccount.totalSales')}: {preview.totalSalesCount}
          </Text>
          <Text style={[styles.dataStat, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {t('deleteAccount.totalExpenses')}: {preview.totalExpensesCount}
          </Text>
          <Text style={[styles.dataStat, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {t('deleteAccount.totalCustomers')}: {preview.totalCustomersCount}
          </Text>
          <Text style={[styles.dataStat, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {t('deleteAccount.totalProducts')}: {preview.totalProductsCount}
          </Text>
        </View>
      </View>

      <View style={styles.consequencesContainer}>
        <Text style={[styles.consequencesTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('deleteAccount.consequences')}
        </Text>

        {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
          <View key={num} style={styles.consequenceItem}>
            <View style={styles.bulletPoint}>
              <View style={[styles.bullet, { backgroundColor: '#dc2626' }]} />
            </View>
            <Text style={[styles.consequenceText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {num === 1
                ? t('deleteAccount.consequence1', { count: preview.totalBusinessesCount })
                : t(`deleteAccount.consequence${num}`)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreeAllBusinesses(!agreeAllBusinesses)}
        >
          <View style={[
            styles.checkbox,
            {
              borderColor: isDark ? '#4b5563' : '#d1d5db',
              backgroundColor: agreeAllBusinesses ? '#2563eb' : 'transparent'
            }
          ]}>
            {agreeAllBusinesses && <Check size={16} color="#ffffff" />}
          </View>
          <Text style={[styles.checkboxLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('deleteAccount.agreeAllBusinesses')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreeAllData(!agreeAllData)}
        >
          <View style={[
            styles.checkbox,
            {
              borderColor: isDark ? '#4b5563' : '#d1d5db',
              backgroundColor: agreeAllData ? '#2563eb' : 'transparent'
            }
          ]}>
            {agreeAllData && <Check size={16} color="#ffffff" />}
          </View>
          <Text style={[styles.checkboxLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('deleteAccount.agreeAllData')}
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
            {t('deleteAccount.agreeNoUndo')}
          </Text>
        </TouchableOpacity>
      </View>

      {(!agreeAllBusinesses || !agreeAllData || !agreeNoUndo) && (
        <Text style={[styles.helperText, { color: '#dc2626' }]}>
          {t('deleteAccount.allCheckboxRequired')}
        </Text>
      )}

      <View style={styles.buttonsContainer}>
        <Button
          title={t('common.cancel')}
          variant="outline"
          onPress={onClose}
          style={styles.button}
        />
        <Button
          title={t('deleteAccount.nextStep')}
          onPress={handleNextStep}
          disabled={!agreeAllBusinesses || !agreeAllData || !agreeNoUndo}
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
          {t('deleteAccount.step2Title')}
        </Text>
      </View>

      <Text style={[styles.instructionText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        {t('deleteAccount.typeEmail')}
      </Text>

      <View style={styles.emailSection}>
        <Text style={[styles.currentEmailLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          {t('deleteAccount.currentEmail')}
        </Text>
        <View style={[styles.emailHighlight, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
          <Text style={[styles.emailText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {userEmail}
          </Text>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? '#374151' : '#ffffff',
              borderColor: emailError ? '#dc2626' : (isDark ? '#4b5563' : '#d1d5db'),
              color: isDark ? '#f9fafb' : '#111827',
            }
          ]}
          placeholder={t('deleteAccount.enterEmail')}
          placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
          value={emailInput}
          onChangeText={(text) => {
            setEmailInput(text);
            setEmailError(false);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        {emailError && (
          <Text style={[styles.errorText, { color: '#dc2626' }]}>
            {t('deleteAccount.emailMismatch')}
          </Text>
        )}
      </View>

      <Button
        title={t('deleteAccount.deleteAccountButton')}
        variant="danger"
        onPress={handleConfirmDelete}
        disabled={emailInput.trim() !== userEmail}
        style={styles.deleteButton}
      />

      <View style={styles.buttonsContainer}>
        <Button
          title={t('deleteAccount.back')}
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
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={[styles.stepTitle, { color: isDark ? '#f9fafb' : '#111827', marginTop: 16 }]}>
          {t('deleteAccount.step3Title')}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <Text style={[styles.progressText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {t('deleteAccount.finalizingDeletion')}
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
          {t('deleteAccount.step4Success')}
        </Text>
        <Text style={[styles.successMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {t('deleteAccount.successMessage')}
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
          {t('deleteAccount.step4Error')}
        </Text>
        <Text style={[styles.errorMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {deletionError || t('deleteAccount.errorMessage')}
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
  businessCountBox: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  businessCountText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  businessesSection: {
    marginBottom: 16,
  },
  businessesHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  businessesList: {
    maxHeight: 120,
  },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  businessName: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  dataPreviewBox: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  dataPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  dataStats: {
    gap: 4,
  },
  dataStat: {
    fontSize: 13,
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
  deleteButton: {
    marginTop: 24,
    marginBottom: 12,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
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
  emailSection: {
    marginBottom: 24,
  },
  currentEmailLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  emailHighlight: {
    padding: 16,
    borderRadius: 8,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
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
