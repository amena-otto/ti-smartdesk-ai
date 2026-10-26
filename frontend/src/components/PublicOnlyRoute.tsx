import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/use-auth';
import { FullScreenLoader } from './FullScreenLoader';

export function PublicOnlyRoute() {
  const { status } = useAuth();

  if (status === 'initializing' || status === 'loading-profile') {
    return <FullScreenLoader message="Comprobando tu sesión…" />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  if (status === 'profile-error') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
