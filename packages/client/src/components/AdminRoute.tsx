import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a route so only admin users can access it.
 * Non-admins are silently redirected to /dashboard.
 * While the admin status is still loading (isAdmin is false on first render
 * before the /api/admin/me fetch resolves) we render nothing, which prevents
 * a flash-redirect for the admin user themselves.
 */
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { token, isAdmin } = useAuth();

  // Not logged in at all
  if (!token) return <Navigate to="/login" replace />;

  // Not an admin
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
