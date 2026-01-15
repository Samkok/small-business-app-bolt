import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';

export default function TermsAndConditionsScreen() {
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

  const Link = ({ url, children }: { url: string; children: React.ReactNode }) => (
    <TouchableOpacity onPress={() => Linking.openURL(url)}>
      <Text style={[styles.link, { color: isDark ? '#60a5fa' : '#2563eb' }]}>
        {children}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Terms and Conditions',
          headerStyle: {
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
          },
          headerTintColor: isDark ? '#f9fafb' : '#111827',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Terms and Conditions
          </Text>
          <Text style={[styles.lastUpdated, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            Last Updated: January 13, 2026
          </Text>
          <Text style={[styles.version, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            Version 1.3.0
          </Text>
        </View>

        <Section title="1. Acceptance of Terms">
          <Paragraph>
            By accessing and using BizManage (the "Application"), you accept and agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the Application.
          </Paragraph>
        </Section>

        <Section title="2. Description of Service">
          <Paragraph>
            BizManage is a comprehensive business management application that provides:
          </Paragraph>
          <BulletPoint>Inventory management and tracking</BulletPoint>
          <BulletPoint>Customer relationship management</BulletPoint>
          <BulletPoint>Multi-cart sales processing system</BulletPoint>
          <BulletPoint>Expense tracking and categorization</BulletPoint>
          <BulletPoint>Business analytics and reporting</BulletPoint>
          <BulletPoint>Multi-business and team collaboration features</BulletPoint>
          <Paragraph>
            The Application is available in two subscription tiers: Free Tier (with usage limits) and Premium Subscription (with unlimited access). See Section 20 for complete details on subscription plans and limitations.
          </Paragraph>
        </Section>

        <Section title="3. User Accounts and Registration">
          <Paragraph>
            3.1. Account Creation: You must create an account to use the Application. You agree to provide accurate, current, and complete information during registration.
          </Paragraph>
          <Paragraph>
            3.2. Account Security: You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
          </Paragraph>
          <Paragraph>
            3.3. Multi-Business Access: Users may create or be invited to multiple businesses within the Application. Each business operates independently with its own data and access controls.
          </Paragraph>
          <Paragraph>
            3.4. User Roles: The Application supports different user roles (Admin, Staff) with varying permission levels. Business owners assign these roles and are responsible for access management.
          </Paragraph>
          <Paragraph>
            3.5. Business Ownership: Each business has a designated owner who has full control over the business, including the exclusive right to delete the business. Business ownership cannot be transferred. Team members (Admin, Staff) have access permissions but do not have ownership rights. Only the business owner can permanently delete a business and all its associated data.
          </Paragraph>
        </Section>

        <Section title="4. Data Collection and Privacy">
          <Paragraph>
            4.1. Personal Information: We collect personal information including name, email, phone number, and address as provided during account creation and profile updates.
          </Paragraph>
          <Paragraph>
            4.2. Business Data: The Application stores business-related data including:
          </Paragraph>
          <BulletPoint>Product information and inventory levels</BulletPoint>
          <BulletPoint>Customer information and contact details</BulletPoint>
          <BulletPoint>Sales transactions and payment records</BulletPoint>
          <BulletPoint>Expense records and categories</BulletPoint>
          <BulletPoint>Business analytics and reports</BulletPoint>
          <Paragraph>
            4.3. Image Data: Product images, business logos, and user avatars uploaded to the Application are stored securely in our cloud storage system with file size limits (5MB per image) and format restrictions (JPEG, PNG, GIF, WebP).
          </Paragraph>
          <Paragraph>
            4.4. Authentication Data: We use Supabase authentication services to manage user sessions and security. Your password is encrypted and never stored in plain text.
          </Paragraph>
          <Paragraph>
            4.5. Data Isolation: Each business's data is isolated using Row Level Security (RLS). Users can only access data from businesses they are authorized to view.
          </Paragraph>
          <Paragraph>
            4.6. Subscription Data: We collect and store subscription-related data including your subscription status (free tier, premium, trial, expired, cancelled), sales count per business for limit enforcement, and subscription purchase receipts. Payment processing is handled exclusively by Apple App Store or Google Play Store, and we do not store or have access to your payment card information. Subscription status information is cached locally on your device for performance optimization.
          </Paragraph>
        </Section>

        <Section title="5. User Content and Responsibilities">
          <Paragraph>
            5.1. Content Ownership: You retain all rights to the data and content you upload to the Application.
          </Paragraph>
          <Paragraph>
            5.2. Content Accuracy: You are responsible for the accuracy and legality of all data entered into the Application.
          </Paragraph>
          <Paragraph>
            5.3. Prohibited Activities: You agree not to:
          </Paragraph>
          <BulletPoint>Upload malicious code, viruses, or harmful content</BulletPoint>
          <BulletPoint>Attempt to gain unauthorized access to other users' data</BulletPoint>
          <BulletPoint>Use the Application for illegal purposes</BulletPoint>
          <BulletPoint>Share your account credentials with unauthorized parties</BulletPoint>
          <BulletPoint>Reverse engineer or attempt to extract the source code</BulletPoint>
          <BulletPoint>Interfere with the Application's proper functioning</BulletPoint>
        </Section>

        <Section title="6. Business Operations">
          <Paragraph>
            6.1. Inventory Management: The Application tracks inventory levels based on your inputs. You are responsible for reconciling physical inventory with system records.
          </Paragraph>
          <Paragraph>
            6.2. Sales Processing: The Application facilitates sales transaction recording but does not process actual payments. All payment processing occurs outside the Application.
          </Paragraph>
          <Paragraph>
            6.3. Data Export: You may export your business data in supported formats (CSV, Excel). Exported data remains your responsibility.
          </Paragraph>
          <Paragraph>
            6.4. Multi-Cart System: The Application supports simultaneous customer orders. You are responsible for completing or abandoning carts appropriately.
          </Paragraph>
        </Section>

        <Section title="7. Reports and Analytics Disclaimer">
          <Paragraph>
            7.1. Informational Purpose Only: All reports, analytics, financial summaries, income statements, cash flow reports, and any other data generated by the Application are provided for informational and basic business understanding purposes only.
          </Paragraph>
          <Paragraph>
            7.2. Not for Compliance Use: The reports generated by this Application are NOT intended for, and should NOT be used for:
          </Paragraph>
          <BulletPoint>Tax filing or tax compliance purposes</BulletPoint>
          <BulletPoint>Official financial statements for regulatory bodies</BulletPoint>
          <BulletPoint>Audited financial reporting</BulletPoint>
          <BulletPoint>Legal proceedings or court submissions</BulletPoint>
          <BulletPoint>Bank loan applications or credit assessments</BulletPoint>
          <BulletPoint>Government regulatory compliance</BulletPoint>
          <BulletPoint>Certified accounting or bookkeeping requirements</BulletPoint>
          <Paragraph>
            7.3. Professional Consultation Required: For all tax, accounting, legal, and regulatory compliance matters, you must consult with qualified professionals such as:
          </Paragraph>
          <BulletPoint>Certified Public Accountants (CPAs)</BulletPoint>
          <BulletPoint>Licensed tax professionals</BulletPoint>
          <BulletPoint>Financial auditors</BulletPoint>
          <BulletPoint>Legal advisors</BulletPoint>
          <BulletPoint>Certified bookkeepers</BulletPoint>
          <Paragraph>
            7.4. No Guarantee of Accuracy: While we strive to provide accurate calculations and data processing, we make no warranties or guarantees regarding the accuracy, completeness, or reliability of any reports or analytics generated by the Application.
          </Paragraph>
          <Paragraph>
            7.5. Calculation Methodology: The Application uses basic mathematical calculations for revenue, profit, expenses, and other metrics. These calculations may not account for:
          </Paragraph>
          <BulletPoint>Complex tax regulations and deductions</BulletPoint>
          <BulletPoint>Depreciation and amortization</BulletPoint>
          <BulletPoint>Accrual accounting principles</BulletPoint>
          <BulletPoint>Generally Accepted Accounting Principles (GAAP)</BulletPoint>
          <BulletPoint>International Financial Reporting Standards (IFRS)</BulletPoint>
          <BulletPoint>Industry-specific accounting requirements</BulletPoint>
          <Paragraph>
            7.6. User Responsibility: You acknowledge and accept full responsibility for verifying all data, consulting appropriate professionals, and ensuring compliance with all applicable laws, regulations, and accounting standards for your business operations.
          </Paragraph>
        </Section>

        <Section title="8. Third-Party Services">
          <Paragraph>
            8.1. Supabase Integration: The Application uses Supabase for database, authentication, and storage services. Supabase's terms and privacy policy also apply.
          </Paragraph>
          <Paragraph>
            8.2. Camera and File Access: The Application requests device permissions for barcode scanning and image uploads. These permissions are used solely for Application functionality.
          </Paragraph>
          <Paragraph>
            8.3. No Payment Processing: The Application does not integrate with payment processors. All financial transactions occur outside the Application.
          </Paragraph>
        </Section>

        <Section title="9. Intellectual Property Rights">
          <Paragraph>
            9.1. Application Ownership: The Application, including its design, functionality, and code, is owned by BizManage and protected by copyright and intellectual property laws.
          </Paragraph>
          <Paragraph>
            9.2. License Grant: We grant you a limited, non-exclusive, non-transferable license to use the Application for your business purposes.
          </Paragraph>
          <Paragraph>
            9.3. User Data Rights: You retain all rights to your business data. We claim no ownership over your content.
          </Paragraph>
        </Section>

        <Section title="10. Limitation of Liability">
          <Paragraph>
            10.1. Service "As-Is": The Application is provided "as-is" without warranties of any kind, express or implied.
          </Paragraph>
          <Paragraph>
            10.2. Data Loss: While we implement security measures and backups, we are not liable for data loss, corruption, or unauthorized access resulting from:
          </Paragraph>
          <BulletPoint>User error or negligence</BulletPoint>
          <BulletPoint>Device malfunction or loss</BulletPoint>
          <BulletPoint>Network connectivity issues</BulletPoint>
          <BulletPoint>Third-party service failures</BulletPoint>
          <Paragraph>
            10.3. Business Decisions: We are not liable for business decisions made based on Application data or reports. The reports and analytics are provided as general information tools only and should not be relied upon for critical business, legal, tax, or financial decisions without professional verification.
          </Paragraph>
          <Paragraph>
            10.4. Tax and Compliance Liability: We are not responsible for any tax liabilities, penalties, legal issues, or compliance failures that may arise from your use or misuse of the Application's reports and data. You are solely responsible for ensuring your business operations comply with all applicable laws and regulations.
          </Paragraph>
          <Paragraph>
            10.5. Maximum Liability: Our total liability shall not exceed the amount paid by you for the Application in the twelve months preceding the claim.
          </Paragraph>
          <Paragraph>
            10.6. Deletion Liability: We are not liable for any consequences resulting from business or account deletion, including but not limited to: loss of business data, disruption of business operations, inability to fulfill regulatory requirements, loss of customer relationships, financial losses, or any other damages arising from deletion. You acknowledge that deletion is your decision and accept full responsibility for ensuring appropriate data backups and compliance with legal obligations before deletion.
          </Paragraph>
          <Paragraph>
            10.7. Subscription Limits: We are not liable for any business interruptions, lost sales, missed opportunities, or financial losses resulting from reaching free tier limits or subscription expiration. You are responsible for monitoring your usage and maintaining an active subscription if your business requires unlimited access. Subscription enforcement mechanisms are in place for operational sustainability, and we reserve the right to enforce these limits through technical, UI, and database-level restrictions.
          </Paragraph>
          <Paragraph>
            10.8. Payment Processing: We are not liable for any issues with subscription payments, billing disputes, or payment processing errors handled by third-party app store providers (Apple App Store, Google Play Store). All billing inquiries must be directed to the respective app store platform where your subscription was purchased.
          </Paragraph>
        </Section>

        <Section title="11. Data Backup and Security">
          <Paragraph>
            11.1. Security Measures: We implement industry-standard security measures including encryption, Row Level Security, and secure authentication.
          </Paragraph>
          <Paragraph>
            11.2. User Responsibility: You are responsible for maintaining your own data backups using the export functionality.
          </Paragraph>
          <Paragraph>
            11.3. Session Management: User sessions expire after one week of inactivity for security purposes.
          </Paragraph>
          <Paragraph>
            11.4. Pre-Deletion Backup Requirement: Before deleting any business or account, you MUST export and backup all critical data. The Application provides export functionality, but you are solely responsible for ensuring data is backed up before deletion. We do not provide post-deletion data retrieval services, and deleted data cannot be recovered under any circumstances.
          </Paragraph>
        </Section>

        <Section title="12. Account and Business Deletion">
          <Paragraph>
            12.1. Business Deletion - Ownership Requirement: Only the business owner can delete a business. Team members (Admin, Staff) cannot delete a business regardless of their permission level. Business deletion is restricted to owners to prevent unauthorized data loss.
          </Paragraph>
          <Paragraph>
            12.2. Business Deletion - Preview and Confirmation: Before deletion, the Application displays a comprehensive preview of all data that will be permanently deleted, including total counts of sales, expenses, customers, products, carts, and team members. Deletion requires explicit confirmation and cannot be performed accidentally.
          </Paragraph>
          <Paragraph>
            12.3. Business Deletion - Permanent and Irreversible: Business deletion is PERMANENT and IRREVERSIBLE. Once confirmed, all business data is immediately and permanently deleted from our systems using CASCADE deletion. There is no grace period, no undo option, and no recovery service available. Deleted data cannot be restored under any circumstances.
          </Paragraph>
          <Paragraph>
            12.4. Business Deletion - Data Scope: When a business is deleted, ALL associated data is permanently removed, including:
          </Paragraph>
          <BulletPoint>Business information, settings, and configuration</BulletPoint>
          <BulletPoint>Complete sales history and transaction records</BulletPoint>
          <BulletPoint>All customer information and contact details</BulletPoint>
          <BulletPoint>Product catalog, inventory records, and stock levels</BulletPoint>
          <BulletPoint>Expense records, categories, and financial data</BulletPoint>
          <BulletPoint>Financial reports, analytics, and business insights</BulletPoint>
          <BulletPoint>Team member associations and access permissions</BulletPoint>
          <BulletPoint>Cart data, pending orders, and shopping sessions</BulletPoint>
          <BulletPoint>All uploaded images, business logos, and product photos</BulletPoint>
          <BulletPoint>Notifications and alert history</BulletPoint>
          <BulletPoint>Audit logs and activity records</BulletPoint>
          <Paragraph>
            12.5. Business Deletion - Automatic CASCADE Deletion: The Application uses database CASCADE constraints to ensure complete and automatic deletion of all related data. When a business is deleted, PostgreSQL automatically deletes all child records that reference the business. This ensures no orphaned data remains in the system and guarantees complete data removal for privacy and security.
          </Paragraph>
          <Paragraph>
            12.6. Business Deletion - Team Member Impact: When a business is deleted, all team members immediately lose access to the business and its data. Team members receive a notification informing them of the business deletion and removal from the team. Team members' personal accounts and data remain intact; only their association with the deleted business is removed.
          </Paragraph>
          <Paragraph>
            12.7. Business Deletion - Post-Deletion Behavior: After deleting a business, if you own other businesses, you will be automatically switched to another available business. If the deleted business was your only business, you will be redirected to the business onboarding screen to create a new business or join an existing one.
          </Paragraph>
          <Paragraph>
            12.8. Account Deletion - Process: You may permanently delete your entire account from the Privacy Settings. Account deletion is a multi-step process that first requires deletion of all businesses you own. You cannot delete your account if you are the sole owner of any active businesses; you must first delete those businesses or transfer data appropriately.
          </Paragraph>
          <Paragraph>
            12.9. Account Deletion - Comprehensive Removal: Account deletion permanently removes:
          </Paragraph>
          <BulletPoint>Your user profile and personal information</BulletPoint>
          <BulletPoint>All businesses you own (and their associated data)</BulletPoint>
          <BulletPoint>Your membership in all businesses (as team member)</BulletPoint>
          <BulletPoint>Your authentication credentials and login access</BulletPoint>
          <BulletPoint>All uploaded personal files and avatars</BulletPoint>
          <BulletPoint>Your application preferences and settings</BulletPoint>
          <BulletPoint>Your notification history and alert preferences</BulletPoint>
          <Paragraph>
            12.10. Account Deletion - Irreversible Action: Account deletion is PERMANENT and IRREVERSIBLE. Once your account is deleted, you cannot log in, recover your data, or reactivate your account. You must create a new account if you wish to use the Application again. Your email address will be released and can be used to create a new account, but no previous data will be associated with it.
          </Paragraph>
          <Paragraph>
            12.11. Data Export Recommendation: We STRONGLY RECOMMEND exporting all critical business data before deleting any business or account. The Application provides data export functionality (CSV, Excel formats) for sales, expenses, customers, and products. Once deletion is complete, no data retrieval or recovery service is available. You are solely responsible for maintaining backups of your data.
          </Paragraph>
          <Paragraph>
            12.12. Legal and Regulatory Compliance: Before deleting business data, ensure you comply with all applicable legal and regulatory data retention requirements in your jurisdiction. Some industries and jurisdictions require businesses to retain financial records, transaction data, and customer information for specific periods (e.g., 7 years for tax purposes). Consult with legal, tax, and accounting professionals to understand your obligations before deleting data.
          </Paragraph>
          <Paragraph>
            12.13. No Recovery or Backup Service: BizManage does not provide data recovery services, backup restoration, or any means to retrieve deleted data. While our infrastructure maintains automated backups for disaster recovery purposes, these backups are not accessible to users or staff and are automatically purged according to our retention schedule. Do not rely on backups for data recovery after deletion.
          </Paragraph>
          <Paragraph>
            12.14. Deletion by BizManage: We reserve the right to terminate or delete accounts that violate these Terms, engage in fraudulent activity, or for other legitimate business or legal reasons. In such cases, we may provide notice before deletion when possible, but reserve the right to delete immediately if necessary to protect our systems, other users, or comply with legal requirements.
          </Paragraph>
        </Section>

        <Section title="13. Modifications to Service">
          <Paragraph>
            13.1. Updates: We may update, modify, or discontinue features of the Application at any time.
          </Paragraph>
          <Paragraph>
            13.2. Terms Updates: We reserve the right to modify these Terms. Continued use after changes constitutes acceptance of updated Terms.
          </Paragraph>
          <Paragraph>
            13.3. Notification: We will notify users of significant changes through the Application or via email.
          </Paragraph>
          <Paragraph>
            13.4. Subscription Plan Changes: We reserve the right to modify subscription plans, pricing, features, and free tier limits at any time. Changes to subscription benefits or limits will apply to new subscriptions immediately and to existing subscriptions upon renewal. We will provide advance notice of material changes to subscription terms when reasonably possible.
          </Paragraph>
        </Section>

        <Section title="14. Multi-Language Support">
          <Paragraph>
            The Application supports multiple languages (English, Khmer, Chinese). In case of translation discrepancies, the English version of these Terms prevails.
          </Paragraph>
        </Section>

        <Section title="15. Dispute Resolution">
          <Paragraph>
            15.1. Informal Resolution: We encourage users to contact us first to resolve disputes informally.
          </Paragraph>
          <Paragraph>
            15.2. Arbitration: Any disputes shall be resolved through binding arbitration rather than in court, except where prohibited by law.
          </Paragraph>
          <Paragraph>
            15.3. Class Action Waiver: You agree to resolve disputes individually and waive the right to participate in class actions.
          </Paragraph>
        </Section>

        <Section title="16. Governing Law">
          <Paragraph>
            These Terms shall be governed by and construed in accordance with the laws applicable in your jurisdiction, without regard to conflict of law provisions.
          </Paragraph>
        </Section>

        <Section title="17. Severability">
          <Paragraph>
            If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.
          </Paragraph>
        </Section>

        <Section title="18. Contact Information">
          <Paragraph>
            For questions about these Terms, please contact us through the Application's support channels or by creating an issue in our repository.
          </Paragraph>
        </Section>

        <Section title="19. Subscription Plans and Billing">
          <Paragraph>
            19.1. Subscription Tiers: BizManage offers two subscription tiers:
          </Paragraph>
          <BulletPoint>Free Tier: Limited to 50 completed sales transactions per business with access to all core features</BulletPoint>
          <BulletPoint>Premium Subscription: Unlimited sales transactions and full access to all features without restrictions</BulletPoint>
          <Paragraph>
            19.2. Free Tier Sales Limit: Each business created in the Application has an independent sales count that increments with each completed sale transaction. The free tier allows up to 50 completed sales per business. Once this limit is reached, you must upgrade to a Premium Subscription to continue processing new sales for that business. The sales limit applies to completed sales only; voided sales, returned sales, and abandoned carts count toward the limit based on their original transaction status.
          </Paragraph>
          <Paragraph>
            19.3. Multi-Business Sales Counting: If you own or participate in multiple businesses, each business maintains its own independent sales count. A business with 50 sales will be restricted, while other businesses under the limit remain unrestricted. However, your subscription status applies globally across all businesses you own. If you have a Premium Subscription, all businesses you own have unlimited sales access.
          </Paragraph>
          <Paragraph>
            19.4. Sales Count Enforcement: Sales counts are enforced at multiple levels for accuracy and system integrity:
          </Paragraph>
          <BulletPoint>Frontend validation prevents sale creation when limit is reached</BulletPoint>
          <BulletPoint>Backend API validation verifies subscription status before processing</BulletPoint>
          <BulletPoint>Database triggers update sales counts in real-time after transactions</BulletPoint>
          <BulletPoint>Database-level CHECK constraints prevent unauthorized sales creation</BulletPoint>
          <Paragraph>
            19.5. Subscription Status Types: Your subscription can have one of the following statuses:
          </Paragraph>
          <BulletPoint>Trial: Default status for new users, subject to free tier limits</BulletPoint>
          <BulletPoint>Active: Premium subscription is active, unlimited access granted</BulletPoint>
          <BulletPoint>Expired: Premium subscription has expired, reverts to free tier limits</BulletPoint>
          <BulletPoint>Cancelled: Premium subscription was cancelled, may have grace period before reverting to free tier</BulletPoint>
          <Paragraph>
            19.6. Upgrade Process: When you reach the 50-sale limit on the free tier, the Application will display an upgrade prompt with options to subscribe to Premium through your device's app store (Apple App Store for iOS, Google Play Store for Android). You can also proactively upgrade before reaching the limit through the Subscription Settings screen.
          </Paragraph>
          <Paragraph>
            19.7. Subscription Benefits: Premium Subscription includes:
          </Paragraph>
          <BulletPoint>Unlimited sales transactions across all businesses you own</BulletPoint>
          <BulletPoint>No restrictions on business operations or feature access</BulletPoint>
          <BulletPoint>Priority support for technical issues</BulletPoint>
          <BulletPoint>Access to premium features as they become available</BulletPoint>
          <Paragraph>
            19.8. Billing and Payment: All subscription purchases, billing, and payment processing are handled exclusively by Apple App Store or Google Play Store depending on your device platform. We do not process payments directly. Subscription pricing, billing cycles (monthly or annual), and payment methods are managed by the respective app store. All billing inquiries, refund requests, and payment disputes must be directed to Apple or Google support.
          </Paragraph>
          <Paragraph>
            19.9. Auto-Renewal: Premium Subscriptions purchased through app stores automatically renew at the end of each billing period unless you cancel before the renewal date. You can manage your subscription, including cancellation, through your device's app store subscription settings. Cancellation takes effect at the end of the current billing period.
          </Paragraph>
          <Paragraph>
            19.10. Subscription Validation: The Application validates your subscription status with the app store at regular intervals and when performing restricted actions (such as creating sales after reaching the free tier limit). Subscription status is cached locally for performance but periodically refreshed from the app store servers to ensure accuracy.
          </Paragraph>
          <Paragraph>
            19.11. Grace Period and Expiration: When a Premium Subscription expires (due to payment failure, cancellation, or non-renewal), your account immediately reverts to free tier status. If any of your businesses have exceeded the 50-sale limit, you will be unable to create new sales for those businesses until you renew your Premium Subscription. All existing data remains accessible regardless of subscription status.
          </Paragraph>
          <Paragraph>
            19.12. Team Member Subscriptions: Subscription status is individual and applies to the user account, not to businesses or teams. As a business owner, your subscription status determines sales limits for businesses you own. Team members (Admin, Staff) invited to your business are not affected by your subscription status; their access is governed by their own subscription status for businesses they own. If you are a team member in someone else's business, that business's limits are determined by the business owner's subscription status, not yours.
          </Paragraph>
          <Paragraph>
            19.13. Refund Policy: Refunds for subscription purchases are governed by the app store's refund policies (Apple App Store or Google Play Store). We do not control or process refunds. If you believe you are entitled to a refund, contact the app store where you made the purchase. Refund eligibility, processing time, and approval are determined solely by the app store provider.
          </Paragraph>
          <Paragraph>
            19.14. Fair Use and Anti-Abuse: You agree not to attempt to circumvent or bypass subscription limits or enforcement mechanisms. Prohibited activities include but are not limited to:
          </Paragraph>
          <BulletPoint>Creating multiple accounts to exploit free tier limits</BulletPoint>
          <BulletPoint>Manipulating sales data to reset or artificially lower sales counts</BulletPoint>
          <BulletPoint>Using technical means to bypass subscription validation</BulletPoint>
          <BulletPoint>Sharing accounts to avoid subscription fees</BulletPoint>
          <BulletPoint>Exploiting bugs or vulnerabilities to bypass limits</BulletPoint>
          <Paragraph>
            Violation of these anti-abuse policies may result in immediate account suspension or termination without refund.
          </Paragraph>
          <Paragraph>
            19.15. Historical Data Access: Regardless of your subscription status (free tier or premium, active or expired), you retain full access to all historical data including past sales, customers, products, expenses, and reports. Subscription limits only restrict the creation of new sales transactions; they do not limit your ability to view, export, or analyze existing data.
          </Paragraph>
          <Paragraph>
            19.16. Free Tier Justification: The free tier with a 50-sale limit is provided to allow new users to evaluate the Application and for small-scale businesses with minimal transaction volumes. For businesses requiring unlimited transaction processing, the Premium Subscription is designed to support operational sustainability and continued development of the Application.
          </Paragraph>
          <Paragraph>
            19.17. Price Changes: We reserve the right to change subscription pricing at any time. Price changes will apply to new subscriptions immediately and to existing subscriptions at their next renewal date. We will make reasonable efforts to notify you of price changes in advance through the Application or via email.
          </Paragraph>
          <Paragraph>
            19.18. Subscription Data Portability: Subscription status and purchase information are tied to your app store account (Apple ID or Google Account). If you switch devices or platforms (e.g., from iOS to Android), subscriptions do not transfer between app stores. You would need to purchase a new subscription on the new platform. Your business data is platform-independent and will remain accessible when you sign in on any supported device.
          </Paragraph>
        </Section>

        <Section title="20. App Store Subscription Terms">
          <Paragraph>
            20.1. Apple App Store Subscriptions: For subscriptions purchased through the Apple App Store, the following terms apply:
          </Paragraph>
          <BulletPoint>Payment will be charged to your Apple ID account at the confirmation of purchase.</BulletPoint>
          <BulletPoint>Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period.</BulletPoint>
          <BulletPoint>Your account will be charged for renewal within 24 hours prior to the end of the current period.</BulletPoint>
          <BulletPoint>You can manage or cancel your subscription in your App Store account settings.</BulletPoint>
          <Paragraph>
            20.2. Google Play Store Subscriptions: For subscriptions purchased through the Google Play Store, similar terms apply as governed by Google's subscription policies. You can manage subscriptions through your Google Play account settings.
          </Paragraph>
          <Paragraph>
            20.3. Important Links:
          </Paragraph>
          <View style={styles.linkContainer}>
            <Paragraph>
              Privacy Policy: <Link url="https://bizmanage-landing-page.web.app/privacy">View Privacy Policy</Link>
            </Paragraph>
            <Paragraph>
              Apple Terms of Use (EULA): <Link url="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">View Standard EULA</Link>
            </Paragraph>
          </View>
          <Paragraph>
            20.4. Subscription Management: To manage your subscription, including viewing your subscription status, changing plans, or canceling:
          </Paragraph>
          <BulletPoint>iOS Users: Open Settings app → tap your name → Subscriptions → select BizManage</BulletPoint>
          <BulletPoint>Android Users: Open Google Play Store → Menu → Subscriptions → select BizManage</BulletPoint>
          <Paragraph>
            20.5. Cancellation Policy: You may cancel your subscription at any time. Cancellation takes effect at the end of your current billing period. You will retain access to premium features until the end of the paid period.
          </Paragraph>
          <Paragraph>
            20.6. No Partial Refunds: If you cancel your subscription before the end of the current billing period, you will not receive a refund for the remaining time in that period unless required by applicable law or app store policy.
          </Paragraph>
          <Paragraph>
            20.7. Free Trial Terms: If we offer a free trial period, you will be charged the subscription fee at the end of the trial period unless you cancel before the trial ends. The trial period and its terms will be clearly displayed during the subscription purchase flow.
          </Paragraph>
        </Section>

        <Section title="21. Acknowledgment">
          <Paragraph>
            By using BizManage, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
          </Paragraph>
        </Section>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            BizManage - Empowering small businesses with professional-grade management tools.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
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
  linkContainer: {
    paddingLeft: 8,
    marginBottom: 12,
  },
  link: {
    fontSize: 14,
    lineHeight: 22,
    textDecorationLine: 'underline',
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
