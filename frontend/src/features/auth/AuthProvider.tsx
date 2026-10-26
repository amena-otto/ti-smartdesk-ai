import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../../domain/profile';
import {
  AuthContext,
  type AuthOutcome,
  type AuthStatus,
  type AuthContextValue,
} from './auth-context';
import {
  fetchOwnProfile,
  getCurrentSession,
  signInWithPassword,
  signOutCurrentUser,
  subscribeToAuthChanges,
} from './auth-service';
import {
  mapProfileLoadError,
  mapSignInError,
  mapSignOutError,
} from './auth-errors';

type ProfileLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; profile: Profile }
  | { status: 'error'; message: string };

type State = {
  sessionReady: boolean;
  session: Session | null;
  profileLoad: ProfileLoadState;
  notice: string | null;
};

type Action =
  | { type: 'SESSION_RESOLVED'; session: Session | null }
  | { type: 'PROFILE_LOADING' }
  | { type: 'PROFILE_LOADED'; profile: Profile }
  | { type: 'PROFILE_ERROR'; message: string }
  | { type: 'NOTICE_SET'; message: string }
  | { type: 'NOTICE_CLEAR' };

const initialState: State = {
  sessionReady: false,
  session: null,
  profileLoad: { status: 'idle' },
  notice: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SESSION_RESOLVED': {
      const sameUser =
        action.session !== null &&
        state.session?.user.id === action.session.user.id;

      return {
        ...state,
        sessionReady: true,
        session: action.session,
        profileLoad:
          action.session === null
            ? { status: 'idle' }
            : sameUser
              ? state.profileLoad
              : { status: 'idle' },
      };
    }

    case 'PROFILE_LOADING':
      return { ...state, profileLoad: { status: 'loading' } };

    case 'PROFILE_LOADED':
      return {
        ...state,
        profileLoad: { status: 'loaded', profile: action.profile },
      };

    case 'PROFILE_ERROR':
      return {
        ...state,
        profileLoad: { status: 'error', message: action.message },
      };

    case 'NOTICE_SET':
      return { ...state, notice: action.message };

    case 'NOTICE_CLEAR':
      return { ...state, notice: null };

    default:
      return state;
  }
}

const NO_PROFILE_NOTICE =
  'Tu cuenta no tiene un perfil autorizado. Solicita al administrador que cree y active tu perfil.';
const INACTIVE_PROFILE_NOTICE =
  'Tu cuenta está inactiva. Solicita al administrador que habilite tu acceso.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [profileAttempt, setProfileAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    const applySession = (session: Session | null) => {
      if (active) {
        dispatch({ type: 'SESSION_RESOLVED', session });
      }
    };

    const unsubscribe = subscribeToAuthChanges(applySession);

    void getCurrentSession()
      .then(applySession)
      .catch(() => {
        if (!active) {
          return;
        }

        dispatch({ type: 'SESSION_RESOLVED', session: null });
        dispatch({
          type: 'NOTICE_SET',
          message:
            'No se pudo comprobar la sesión. Vuelve a iniciar sesión para continuar.',
        });
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const userId = state.session?.user.id ?? null;

  useEffect(() => {
    if (!state.sessionReady || !userId) {
      return;
    }

    let cancelled = false;
    dispatch({ type: 'PROFILE_LOADING' });

    void fetchOwnProfile(userId)
      .then(async (profile) => {
        if (cancelled) {
          return;
        }

        if (!profile) {
          dispatch({ type: 'NOTICE_SET', message: NO_PROFILE_NOTICE });
          await signOutCurrentUser();
          if (!cancelled) {
            dispatch({ type: 'SESSION_RESOLVED', session: null });
          }
          return;
        }

        if (!profile.activo) {
          dispatch({ type: 'NOTICE_SET', message: INACTIVE_PROFILE_NOTICE });
          await signOutCurrentUser();
          if (!cancelled) {
            dispatch({ type: 'SESSION_RESOLVED', session: null });
          }
          return;
        }

        dispatch({ type: 'PROFILE_LOADED', profile });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          dispatch({
            type: 'PROFILE_ERROR',
            message: mapProfileLoadError(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.sessionReady, userId, profileAttempt]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthOutcome> => {
      try {
        const result = await signInWithPassword(email, password);
        return result.ok
          ? { ok: true }
          : { ok: false, message: result.message };
      } catch (error) {
        return { ok: false, message: mapSignInError(error) };
      }
    },
    [],
  );

  const signOut = useCallback(async (): Promise<AuthOutcome> => {
    try {
      await signOutCurrentUser();
      dispatch({ type: 'SESSION_RESOLVED', session: null });
      return { ok: true };
    } catch {
      return { ok: false, message: mapSignOutError() };
    }
  }, []);

  const retryProfile = useCallback(() => {
    setProfileAttempt((attempt) => attempt + 1);
  }, []);

  const clearNotice = useCallback(() => {
    dispatch({ type: 'NOTICE_CLEAR' });
  }, []);

  const status: AuthStatus = !state.sessionReady
    ? 'initializing'
    : !state.session
      ? 'unauthenticated'
      : state.profileLoad.status === 'loaded'
        ? 'authenticated'
        : state.profileLoad.status === 'error'
          ? 'profile-error'
          : 'loading-profile';

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session: state.session,
      profile:
        state.profileLoad.status === 'loaded'
          ? state.profileLoad.profile
          : null,
      userEmail: state.session?.user.email ?? null,
      notice: state.notice,
      profileError:
        state.profileLoad.status === 'error'
          ? state.profileLoad.message
          : null,
      signIn,
      signOut,
      retryProfile,
      clearNotice,
    }),
    [clearNotice, retryProfile, signIn, signOut, state, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
