import { Session, User } from '@supabase/supabase-js';
import { Database } from '../types/database';

export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type Business = Database['public']['Tables']['businesses']['Row'];
export type UserBusinessRole = Database['public']['Tables']['user_business_roles']['Row'];

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  userBusinesses: Business[];
  currentBusiness: Business | null;
  currentUserRole: 'admin' | 'staff' | null;
  isAdmin: boolean;
  isStaff: boolean;
  loading: boolean;
  initialDataLoaded: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
  updateBusiness: (businessId: string, updates: Partial<Business>) => Promise<{ error: any }>;
  switchBusiness: (businessId: string) => Promise<void>;
  createBusiness: (businessName: string) => Promise<{ error: any; business?: Business }>;
  getUserRole: (businessId: string) => 'admin' | 'staff' | null;
  hasBusinessAccess: (businessId: string) => boolean;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  refreshUserBusinesses: () => Promise<Business[]>;
  signedOutDueToInactivity: boolean;
  resetInactivitySignOutFlag: () => void;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
}
