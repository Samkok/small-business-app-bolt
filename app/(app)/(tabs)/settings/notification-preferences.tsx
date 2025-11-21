import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useNotifications } from '@/src/context/NotificationContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ArrowLeft, ShoppingCart, AlertTriangle, UserPlus } from 'lucide-react-native';

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { preferences, loading, updatePreferences } = useNotifications();
  const [saving, setSaving] = useState(false);

  const [salesCreated, setSalesCreated] = useState(true);
  const [salesVoided, setSalesVoided] = useState(true);
  const [roleAssigned, setRoleAssigned] = useState(true);

  useEffect(() => {
    if (preferences) {
      setSalesCreated(preferences.sales_created_enabled);
      setSalesVoided(preferences.sales_voided_enabled);
      setRoleAssigned(preferences.role_assigned_enabled);
    }
  }, [preferences]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePreferences({
        sales_created_enabled: salesCreated,
        sales_voided_enabled: salesVoided,
        role_assigned_enabled: roleAssigned,
      });
      Alert.alert('Success', 'Notification preferences updated successfully');
    } catch (error) {
      console.error('Error updating preferences:', error);
      Alert.alert('Error', 'Failed to update notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    if (!preferences) return false;
    return (
      salesCreated !== preferences.sales_created_enabled ||
      salesVoided !== preferences.sales_voided_enabled ||
      roleAssigned !== preferences.role_assigned_enabled
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Notification Preferences
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Notification Preferences
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.infoCard}>
          <Text style={[styles.infoText, { color: isDark ? '#d1d5db' : '#4b5563' }]}>
            Choose which notifications you want to receive. You can always change these settings
            later.
          </Text>
        </Card>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Sales Notifications
          </Text>

          <Card style={styles.preferenceCard}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: isDark ? '#064e3b' : '#d1fae5' },
                  ]}
                >
                  <ShoppingCart size={20} color="#10b981" />
                </View>
                <View style={styles.preferenceText}>
                  <Text
                    style={[styles.preferenceTitle, { color: isDark ? '#f9fafb' : '#111827' }]}
                  >
                    New Sales
                  </Text>
                  <Text
                    style={[
                      styles.preferenceDescription,
                      { color: isDark ? '#9ca3af' : '#6b7280' },
                    ]}
                  >
                    Get notified when team members create new sales
                  </Text>
                </View>
              </View>
              <Switch
                value={salesCreated}
                onValueChange={setSalesCreated}
                trackColor={{ false: '#d1d5db', true: '#86efac' }}
                thumbColor={salesCreated ? '#10b981' : '#f3f4f6'}
              />
            </View>
          </Card>

          <Card style={styles.preferenceCard}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: isDark ? '#7f1d1d' : '#fee2e2' },
                  ]}
                >
                  <AlertTriangle size={20} color="#ef4444" />
                </View>
                <View style={styles.preferenceText}>
                  <Text
                    style={[styles.preferenceTitle, { color: isDark ? '#f9fafb' : '#111827' }]}
                  >
                    Voided Sales
                  </Text>
                  <Text
                    style={[
                      styles.preferenceDescription,
                      { color: isDark ? '#9ca3af' : '#6b7280' },
                    ]}
                  >
                    Get notified when sales are voided
                  </Text>
                </View>
              </View>
              <Switch
                value={salesVoided}
                onValueChange={setSalesVoided}
                trackColor={{ false: '#d1d5db', true: '#fca5a5' }}
                thumbColor={salesVoided ? '#ef4444' : '#f3f4f6'}
              />
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Team Notifications
          </Text>

          <Card style={styles.preferenceCard}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: isDark ? '#1e3a8a' : '#dbeafe' },
                  ]}
                >
                  <UserPlus size={20} color="#3b82f6" />
                </View>
                <View style={styles.preferenceText}>
                  <Text
                    style={[styles.preferenceTitle, { color: isDark ? '#f9fafb' : '#111827' }]}
                  >
                    Role Assignments
                  </Text>
                  <Text
                    style={[
                      styles.preferenceDescription,
                      { color: isDark ? '#9ca3af' : '#6b7280' },
                    ]}
                  >
                    Get notified when you're assigned to a business
                  </Text>
                </View>
              </View>
              <Switch
                value={roleAssigned}
                onValueChange={setRoleAssigned}
                trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                thumbColor={roleAssigned ? '#3b82f6' : '#f3f4f6'}
              />
            </View>
          </Card>
        </View>

        {hasChanges() && (
          <View style={styles.saveButtonContainer}>
            <Button
              title={saving ? 'Saving...' : 'Save Changes'}
              onPress={handleSave}
              disabled={saving}
              style={styles.saveButton}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  preferenceCard: {
    padding: 16,
    marginBottom: 12,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preferenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  preferenceText: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  saveButtonContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  saveButton: {
    width: '100%',
  },
});
