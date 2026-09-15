import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const encodedUser = params.get('user');

    if (!token || !encodedUser) {
      navigate('/login?error=google_failed', { replace: true });
      return;
    }

    try {
      const bytes = Uint8Array.from(atob(encodedUser), c => c.charCodeAt(0));
      const user = JSON.parse(new TextDecoder().decode(bytes)) as { id: number; email: string };
      login(token, user);
      navigate('/dashboard', { replace: true });
    } catch {
      navigate('/login?error=google_failed', { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-sm text-gray-500">Signing you in…</p>
    </div>
  );
}
