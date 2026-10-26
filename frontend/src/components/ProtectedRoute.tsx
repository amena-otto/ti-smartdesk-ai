import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/use-auth';
import { FullScreenLoader } from './FullScreenLoader';
import { ProfileVerificationError } from './ProfileVerificationError';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'initializing' || status === 'loading-profile') {
    return <FullScreenLoader message="Verificando tu sesión…" />;
  }

  if (status === 'profile-error') {
    return <ProfileVerificationError />;
  }

  if (status === 'unauthenticated') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
