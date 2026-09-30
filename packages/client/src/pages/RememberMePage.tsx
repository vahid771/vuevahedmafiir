import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

interface LocationState {
  token: string;
  user: { id: number; email: string };
}

export default function RememberMePage() {
  const { t, i18n } = useTranslation();
  const { login, token: existingToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as LocationState | null;

  // If the user already has a valid session (e.g. browser restored a remembered
  // session and reopened this URL), just send them to the dashboard.
  useEffect(() => {
    if (existingToken) {
      navigate('/dashboard', { replace: true });
      return;
    }
    // No existing session and no OAuth state → back to login.
    if (!state?.token || !state?.user) {
      navigate('/login', { replace: true });
    }
  }, []);

  // While the effect runs, render nothing to avoid a flash.
  if (existingToken || !state?.token || !state?.user) {
    return null;
  }

  function handleChoice(remember: boolean) {
    login(state!.token, state!.user, remember);
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4" dir={i18n.dir()}>
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          {t('auth.rememberTitle')}
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          {t('auth.rememberSubtitle')}
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleChoice(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {t('auth.stayLoggedIn')}
          </button>
          <button
            onClick={() => handleChoice(false)}
            className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {t('auth.notNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
