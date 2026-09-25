import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import { supabase } from '@/src/config/supabase';
import { TERMS_VERSION, TERMS_UPDATED_ON, TERMS_CHANGE_SUMMARY } from '@/src/config/terms';

/**
 * Shown once after sign-in when the profile's accepted terms version is behind the version
 * the app ships (src/config/terms.ts). "I agree" records the version on the profile; "Read
 * the terms" opens the full text and the prompt returns when the user comes back. The
 * prompt cannot be dismissed any other way, and never shows twice for the same version.
 */
export function TermsUpdatePrompt() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { user, userProfile, updateUserProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  const acceptedVersion = (userProfile as any)?.terms_accepted_version as string | null | undefined;
  const needsAcceptance = !!user?.id && !!userProfile && acceptedVersion !== TERMS_VERSION;

  // A new sign-in starts over
  useEffect(() => { setHidden(false); }, [user?.id]);

  if (!needsAcceptance || hidden) return null;

  const accept = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const updates = { terms_accepted_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() };
      const { error } = await supabase.from('user_profiles').update(updates as any).eq('user_id', user.id);
      if (error) throw error;
      // keep the in-memory profile in step so the prompt closes without a reload
      await updateUserProfile(updates as any);
    } catch (error) {
      console.error('[TermsUpdatePrompt] could not record acceptance:', error);
    } finally {
      setSaving(false);
    }
  };

  const readTerms = () => {
    setHidden(true);
    router.push('/settings/terms');
    // when the user comes back the prompt shows again until accepted
    setTimeout(() => setHidden(false), 1500);
  };

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <View style={styles.icon}>
            <FileText size={28} color="#2563eb" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Terms updated</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Version {TERMS_VERSION}, {TERMS_UPDATED_ON}. Please review what changed and agree to continue.
          </Text>
          <View style={styles.list}>
            {TERMS_CHANGE_SUMMARY.map((line, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={[styles.dot, { color: colors.subtext }]}>•</Text>
                <Text style={[styles.line, { color: colors.text }]}>{line}</Text>
              </View>
            ))}
          </View>
          <Button title="I agree" onPress={accept} loading={saving} disabled={saving} style={styles.agree} />
          <TouchableOpacity onPress={readTerms} style={styles.readLink} accessibilityRole="link" disabled={saving}>
            <Text style={styles.readText}>Read the full terms</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 16, borderWidth: 1, padding: 22 },
  icon: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb1a', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  list: { marginTop: 16, gap: 8 },
  bullet: { flexDirection: 'row', gap: 8 },
  dot: { fontSize: 14, lineHeight: 20 },
  line: { flex: 1, fontSize: 14, lineHeight: 20 },
  agree: { marginTop: 20 },
  readLink: { alignSelf: 'center', paddingVertical: 12 },
  readText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
});
