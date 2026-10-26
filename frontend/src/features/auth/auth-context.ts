import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../../domain/profile';

export type AuthStatus =
  | 'initializing'
  | 'loading-profile'
  | 'authenticated'
  | 'unauthenticated'
  | 'profile-error';

export type AuthOutcome = {
  ok: boolean;
  message?: string;
};

export type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  userEmail: string | null;
  notice: string | null;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<AuthOutcome>;
  signOut: () => Promise<AuthOutcome>;
  retryProfile: () => void;
  clearNotice: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
