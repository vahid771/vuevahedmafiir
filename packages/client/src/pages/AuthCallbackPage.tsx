import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function AuthCallbackPage() {
  const { t } = useTranslation();
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
      // Hand off to the remember-me prompt page before logging in.
      navigate('/auth/remember', { replace: true, state: { token, user } });
    } catch {
      navigate('/login?error=google_failed', { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-sm text-gray-500">{t('auth.signingIn')}</p>
    </div>
  );
}
