import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

export default function PrivacyPolicyScreen() {
  const { isDark } = useTheme();

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
        {title}
      </Text>
      {children}
    </View>
  );

  const Paragraph = ({ children }: { children: React.ReactNode }) => (
    <Text style={[styles.paragraph, { color: isDark ? '#d1d5db' : '#374151' }]}>
      {children}
    </Text>
  );

  const BulletPoint = ({ children }: { children: React.ReactNode }) => (
    <View style={styles.bulletContainer}>
      <Text style={[styles.bullet, { color: isDark ? '#d1d5db' : '#374151' }]}>•</Text>
      <Text style={[styles.bulletText, { color: isDark ? '#d1d5db' : '#374151' }]}>
        {children}
      </Text>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Privacy Policy
        </Text>
        <Text style={[styles.lastUpdated, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          Last Updated: November 16, 2025
        </Text>
        <Text style={[styles.version, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          Version 1.0.1
        </Text>
      </View>

      <Section title="1. Introduction">
        <Paragraph>
          Business Manager Pro ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile and web application.
        </Paragraph>
      </Section>

      <Section title="2. Information We Collect">
        <Paragraph>
          2.1. Personal Information:
        </Paragraph>
        <BulletPoint>Full name</BulletPoint>
        <BulletPoint>Email address</BulletPoint>
        <BulletPoint>Phone number</BulletPoint>
        <BulletPoint>Physical address</BulletPoint>
        <BulletPoint>Profile picture/avatar</BulletPoint>
        <Paragraph>
          2.2. Business Information:
        </Paragraph>
        <BulletPoint>Business name and logo</BulletPoint>
        <BulletPoint>Product catalogs and inventory data</BulletPoint>
        <BulletPoint>Customer information and contact details</BulletPoint>
        <BulletPoint>Sales records and transaction history</BulletPoint>
        <BulletPoint>Expense records and categories</BulletPoint>
        <BulletPoint>Team member information and roles</BulletPoint>
        <Paragraph>
          2.3. Technical Information:
        </Paragraph>
        <BulletPoint>Device information and identifiers</BulletPoint>
        <BulletPoint>IP address and location data</BulletPoint>
        <BulletPoint>Usage patterns and analytics</BulletPoint>
        <BulletPoint>Session information and authentication tokens</BulletPoint>
      </Section>

      <Section title="3. How We Collect Information">
        <Paragraph>
          3.1. Direct Collection: Information you provide when creating an account, updating your profile, or using Application features.
        </Paragraph>
        <Paragraph>
          3.2. Automated Collection: Technical data collected automatically through cookies, device sensors, and usage tracking.
        </Paragraph>
        <Paragraph>
          3.3. Camera and File Access: Images captured or selected for products, business logos, and user avatars.
        </Paragraph>
      </Section>

      <Section title="4. How We Use Your Information">
        <Paragraph>
          We use collected information to:
        </Paragraph>
        <BulletPoint>Provide and maintain Application services</BulletPoint>
        <BulletPoint>Process your business transactions and operations</BulletPoint>
        <BulletPoint>Generate reports and analytics for your business</BulletPoint>
        <BulletPoint>Authenticate users and maintain security</BulletPoint>
        <BulletPoint>Improve Application features and user experience</BulletPoint>
        <BulletPoint>Communicate updates and important information</BulletPoint>
        <BulletPoint>Comply with legal obligations</BulletPoint>
      </Section>

      <Section title="5. Data Storage and Security">
        <Paragraph>
          5.1. Storage Infrastructure: Your data is stored securely using Supabase cloud infrastructure with enterprise-grade security measures.
        </Paragraph>
        <Paragraph>
          5.2. Encryption: Data is encrypted in transit using TLS/SSL protocols and at rest using industry-standard encryption.
        </Paragraph>
        <Paragraph>
          5.3. Row Level Security: Database access is controlled through Row Level Security (RLS) ensuring users can only access authorized business data.
        </Paragraph>
        <Paragraph>
          5.4. Session Management: User sessions expire after one week of inactivity to protect unauthorized access.
        </Paragraph>
        <Paragraph>
          5.5. Authentication: We use Supabase Auth with secure password hashing and token-based authentication.
        </Paragraph>
      </Section>

      <Section title="6. Data Isolation and Multi-Tenancy">
        <Paragraph>
          6.1. Business Isolation: Each business operates as a separate tenant with isolated data. Users cannot access data from businesses they are not authorized to view.
        </Paragraph>
        <Paragraph>
          6.2. Role-Based Access: Access to business data is controlled by user roles (Admin, Staff) with different permission levels.
        </Paragraph>
        <Paragraph>
          6.3. Cross-Business Security: Even if you belong to multiple businesses, data from one business cannot be accessed when working in another.
        </Paragraph>
      </Section>

      <Section title="7. Data Sharing and Disclosure">
        <Paragraph>
          7.1. We DO NOT sell your personal or business data to third parties.
        </Paragraph>
        <Paragraph>
          7.2. We may share information with:
        </Paragraph>
        <BulletPoint>Supabase (our infrastructure provider) for hosting and authentication</BulletPoint>
        <BulletPoint>Team members within your authorized businesses</BulletPoint>
        <BulletPoint>Legal authorities when required by law</BulletPoint>
        <Paragraph>
          7.3. Business Transfers: In case of merger, acquisition, or sale, your information may be transferred to the new entity.
        </Paragraph>
      </Section>

      <Section title="8. Your Privacy Rights">
        <Paragraph>
          You have the right to:
        </Paragraph>
        <BulletPoint>Access your personal data</BulletPoint>
        <BulletPoint>Correct inaccurate information</BulletPoint>
        <BulletPoint>Delete your account and data</BulletPoint>
        <BulletPoint>Export your business data</BulletPoint>
        <BulletPoint>Opt-out of non-essential communications</BulletPoint>
        <BulletPoint>Withdraw consent for data processing</BulletPoint>
      </Section>

      <Section title="9. Data Retention">
        <Paragraph>
          9.1. Active Accounts: We retain your data as long as your account is active and you continue using the Application.
        </Paragraph>
        <Paragraph>
          9.2. Deleted Accounts: After account deletion, we may retain certain data for legal compliance, dispute resolution, or legitimate business purposes.
        </Paragraph>
        <Paragraph>
          9.3. Backup Retention: Backups containing your data may persist for a limited period after deletion.
        </Paragraph>
      </Section>

      <Section title="10. Children's Privacy">
        <Paragraph>
          The Application is not intended for users under 18 years of age. We do not knowingly collect information from children. If we discover we have collected data from a child, we will delete it promptly.
        </Paragraph>
      </Section>

      <Section title="11. International Data Transfers">
        <Paragraph>
          Your data may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
        </Paragraph>
      </Section>

      <Section title="12. Cookies and Tracking">
        <Paragraph>
          12.1. Essential Cookies: We use cookies for authentication, session management, and Application functionality.
        </Paragraph>
        <Paragraph>
          12.2. Analytics: We may collect anonymous usage data to improve the Application.
        </Paragraph>
        <Paragraph>
          12.3. Local Storage: The Application stores preferences (theme, language) locally on your device.
        </Paragraph>
      </Section>

      <Section title="13. Third-Party Services">
        <Paragraph>
          13.1. Supabase: Our primary infrastructure provider. Review Supabase's privacy policy at https://supabase.com/privacy
        </Paragraph>
        <Paragraph>
          13.2. Device Permissions: The Application requests camera and file access permissions solely for barcode scanning and image uploads.
        </Paragraph>
      </Section>

      <Section title="14. Data Breach Notification">
        <Paragraph>
          In the event of a data breach affecting your personal information, we will notify you and relevant authorities in accordance with applicable laws and regulations.
        </Paragraph>
      </Section>

      <Section title="15. Your Responsibilities">
        <Paragraph>
          You are responsible for:
        </Paragraph>
        <BulletPoint>Maintaining the confidentiality of your account credentials</BulletPoint>
        <BulletPoint>Ensuring the accuracy of information you provide</BulletPoint>
        <BulletPoint>Protecting customer data collected through the Application</BulletPoint>
        <BulletPoint>Complying with applicable data protection laws in your jurisdiction</BulletPoint>
        <BulletPoint>Creating regular backups of your business data</BulletPoint>
      </Section>

      <Section title="16. GDPR Compliance (EU Users)">
        <Paragraph>
          For users in the European Union:
        </Paragraph>
        <BulletPoint>Legal basis for processing: Consent, contract performance, legitimate interests</BulletPoint>
        <BulletPoint>Right to data portability in machine-readable format</BulletPoint>
        <BulletPoint>Right to object to automated decision-making</BulletPoint>
        <BulletPoint>Right to lodge complaints with supervisory authorities</BulletPoint>
      </Section>

      <Section title="17. CCPA Compliance (California Users)">
        <Paragraph>
          For California residents:
        </Paragraph>
        <BulletPoint>Right to know what personal information is collected</BulletPoint>
        <BulletPoint>Right to delete personal information</BulletPoint>
        <BulletPoint>Right to opt-out of sale (we do not sell data)</BulletPoint>
        <BulletPoint>Right to non-discrimination for exercising privacy rights</BulletPoint>
      </Section>

      <Section title="18. Changes to Privacy Policy">
        <Paragraph>
          We may update this Privacy Policy periodically. We will notify you of significant changes through the Application or via email. Continued use after changes constitutes acceptance of the updated policy.
        </Paragraph>
      </Section>

      <Section title="19. Contact Information">
        <Paragraph>
          For privacy-related questions, concerns, or to exercise your rights, please contact us through the Application's support channels or by creating an issue in our repository.
        </Paragraph>
      </Section>

      <Section title="20. Consent">
        <Paragraph>
          By using Business Manager Pro, you consent to the collection, use, and processing of your information as described in this Privacy Policy.
        </Paragraph>
      </Section>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          Your privacy and data security are our top priorities. We are committed to transparency and protecting your information.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    marginBottom: 4,
  },
  version: {
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 24,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 14,
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
