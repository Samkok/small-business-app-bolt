# Business Manager Pro

A comprehensive mobile business management application built with React Native, Expo, and Supabase. Designed for small business owners to efficiently manage inventory, customers, sales, expenses, and generate insightful reports.

## 🚀 Features

### Core Functionality
- **Inventory Management**: Complete product catalog with stock tracking, barcode scanning, and import history
- **Customer Management**: Smart customer profiles with platform tracking and contact details
- **Multi-Cart Sales System**: Handle multiple customer orders simultaneously with flexible discount options
- **Expense Tracking**: Categorized expense management with detailed reporting
- **Business Analytics**: Comprehensive dashboard with revenue, profit, and performance metrics
- **Role-Based Access**: Admin and staff user roles with appropriate permissions

### Technical Features
- **Authentication**: Secure email/password login with Supabase Auth
- **Subscriptions**: Tiered subscription plans with in-app purchases (iOS/Android)
- **Multi-Language Support**: English, Khmer (Cambodian), and Chinese (Simplified)
- **Dark/Light Theme**: Persistent theme preferences with system detection
- **Offline Support**: Optimistic updates and data synchronization
- **Barcode Scanning**: Product identification and inventory management
- **Real-time Updates**: Live data synchronization across devices

## 🛠️ Tech Stack

### Frontend
- **React Native** with Expo SDK 54
- **TypeScript** for type safety
- **Expo Router** for navigation
- **React Native Reanimated** for smooth animations
- **Lucide React Native** for consistent iconography
- **RevenueCat** for subscription management and paywalls

### Backend
- **Supabase** for database, authentication, and real-time features
- **PostgreSQL** with Row Level Security (RLS)
- **Supabase Storage** for product images and assets
- **Supabase Edge Functions** for webhook processing

### Development
- **ESLint** and **Prettier** for code quality
- **Zod** for runtime type validation
- **React Hook Form** for form management
- **i18next** for internationalization

## 📱 Setup Instructions

### Prerequisites
- Node.js 18+ 
- Expo CLI: `npm install -g @expo/cli`
- Supabase account: [supabase.com](https://supabase.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd business-manager-pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   - Create a new Supabase project
   - Run the SQL migrations in `/supabase/migrations/`
   - Enable Row Level Security on all tables
   - Set up authentication policies

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 🏗️ Project Structure

```
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   ├── (app)/             # Main application screens
│   └── _layout.tsx        # Root layout
├── src/
│   ├── components/        # Reusable UI components
│   ├── context/          # React Context providers
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API and business logic
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   └── locales/          # Translation files
├── assets/               # Static assets
└── supabase/
    └── migrations/       # Database migrations
```

## 🗄️ Database Schema

### Core Tables
- **profiles**: User business profiles and roles
- **products**: Product catalog with pricing and stock
- **customers**: Customer information and platform tracking
- **inventory_imports**: Stock import history with cost breakdown
- **carts** & **cart_items**: Multi-cart shopping system
- **sales**: Completed transactions with payment tracking
- **expenses** & **expense_categories**: Business expense management

### Security
- Row Level Security (RLS) enabled on all tables
- User-based data isolation by business_id
- Role-based access control for admin/staff permissions

## 🚀 Deployment

### Expo Application Services (EAS)

1. **Install EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

2. **Configure EAS**
   ```bash
   eas build:configure
   ```

3. **Build for App Stores**
   ```bash
   # iOS
   eas build --platform ios
   
   # Android
   eas build --platform android
   
   # Both platforms
   eas build --platform all
   ```

4. **Submit to Stores**
   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

### Web Deployment
```bash
npm run build:web
# Deploy the dist/ folder to your preferred hosting service
```

## 🔧 Configuration

### Environment Variables
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `EXPO_PUBLIC_ENVIRONMENT`: deployment environment (development/production)

### Customization
- **Branding**: Update colors in theme configuration
- **Features**: Enable/disable features in feature flags
- **Languages**: Add new locales in `/src/locales/`

## 🧪 Testing

```bash
# Run linting
npm run lint

# Type checking
npx tsc --noEmit

# E2E testing setup
# Add Detox or Maestro configuration
```

## 💳 Subscriptions (RevenueCat)

The app uses RevenueCat for powerful, cross-platform subscription management:

### Quick Start
1. **RevenueCat Dashboard**: Configure products and entitlements
2. **Deploy Webhook**: `supabase functions deploy revenuecat-webhook`
3. **Switch Context**: Use `RevenueCatSubscriptionProvider` in your app
4. **Test**: Build with EAS and test with sandbox accounts

### Subscription Tiers
- **Free**: 50 total sales, 1 business
- **Pro** (monthly/yearly): Unlimited sales, 1 owned business
- **Pro Plus** (monthly/yearly): Unlimited sales, 3 owned businesses
- **Max** (monthly/yearly): Unlimited sales & businesses

### Features
- �� **Native Paywall UI**: Beautiful, pre-built paywalls with customization
- 👤 **Customer Center**: Self-service subscription management
- 🔄 **Automatic Sync**: Real-time webhook updates to your database
- 🔐 **Server-Side Validation**: Secure receipt validation via RevenueCat
- 📊 **Analytics Dashboard**: Comprehensive subscription metrics
- 🌍 **Cross-Platform**: Seamless iOS and Android support

### Documentation
- **Setup Guide**: `REVENUECAT_SETUP.md` - Complete RevenueCat configuration
- **Migration Guide**: `REVENUECAT_MIGRATION.md` - Migrate from react-native-iap
- **Integration**: Automatic subscription status sync with Supabase

### How It Works
1. User opens paywall → RevenueCat displays products
2. User purchases → RevenueCat validates and processes
3. Webhook fires → Supabase updates subscription status
4. App checks entitlements → User gets access to features

## 📖 Usage Guide

### Getting Started
1. Register with business information
2. Set up product catalog
3. Add customer database
4. Start processing sales
5. Track expenses and view reports

### Key Workflows
- **Inventory Import**: Add stock with detailed cost breakdown
- **Multi-Cart Sales**: Manage multiple customer orders
- **Sale Processing**: Complete transactions with various payment methods
- **Return/Refund**: Handle sale reversals with inventory updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Check the documentation
- Contact the development team

## 🔄 Version History

- **v1.0.0**: Initial release with core business management features
- Feature roadmap available in GitHub Issues

---

**BizManage** - Empowering small businesses with professional-grade management tools.