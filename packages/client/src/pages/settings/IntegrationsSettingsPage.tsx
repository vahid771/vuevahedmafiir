import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  getGoogleDriveStatus,
  disconnectGoogleDrive,
  getGoogleConnectUrl,
} from '../../api/google';
import {
  getGoogleTasksStatus,
  getGoogleTasksConnectUrl,
  disconnectGoogleTasks,
} from '../../api/googleTasks';
import {
  getGoogleCalendarStatus,
  getGoogleCalendarConnectUrl,
  disconnectGoogleCalendar,
} from '../../api/googleCalendar';

const GOOGLE_LOGO = (
  <svg viewBox="0 0 87.3 78" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
  </svg>
);

const CHECK_ICON = (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

export default function IntegrationsSettingsPage() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  // Google Drive state
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccessBanner, setDriveSuccessBanner] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Google Calendar state
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarSuccessBanner, setCalendarSuccessBanner] = useState(false);
  const [calendarDisconnecting, setCalendarDisconnecting] = useState(false);

  // Google Tasks state
  const [tasksConnected, setTasksConnected] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [tasksSuccessBanner, setTasksSuccessBanner] = useState(false);
  const [tasksDisconnecting, setTasksDisconnecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('drive') === 'connected') setDriveSuccessBanner(true);
    if (params.get('gcal') === 'connected') setCalendarSuccessBanner(true);
  }, [location.search]);

  useEffect(() => {
    if (!token) return;
    getGoogleDriveStatus(token)
      .then(s => setDriveConnected(s.connected))
      .catch(() => setDriveError('Failed to load Drive status'))
      .finally(() => setDriveLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getGoogleCalendarStatus(token)
      .then(s => setCalendarConnected(s.connected))
      .catch(() => setCalendarError('Failed to load Google Calendar status'))
      .finally(() => setCalendarLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getGoogleTasksStatus(token)
      .then(s => setTasksConnected(s.connected))
      .catch(() => setTasksError('Failed to load Google Tasks status'))
      .finally(() => setTasksLoading(false));
  }, [token]);

  function handleDriveConnect() {
    if (!token) return;
    window.location.href = getGoogleConnectUrl(token);
  }

  async function handleDriveDisconnect() {
    if (!token) return;
    setDisconnecting(true);
    setDriveError(null);
    try {
      await disconnectGoogleDrive(token);
      setDriveConnected(false);
      setDriveSuccessBanner(false);
    } catch {
      setDriveError(t('settings.failedDisconnect'));
    } finally {
      setDisconnecting(false);
    }
  }

  function handleCalendarConnect() {
    if (!token) return;
    window.location.href = getGoogleCalendarConnectUrl(token);
  }

  async function handleCalendarDisconnect() {
    if (!token) return;
    setCalendarDisconnecting(true);
    setCalendarError(null);
    try {
      await disconnectGoogleCalendar(token);
      setCalendarConnected(false);
      setCalendarSuccessBanner(false);
    } catch {
      setCalendarError(t('settings.failedDisconnect'));
    } finally {
      setCalendarDisconnecting(false);
    }
  }

  function handleTasksConnect() {
    if (!token) return;
    window.location.href = getGoogleTasksConnectUrl(token);
  }

  async function handleTasksDisconnect() {
    if (!token) return;
    setTasksDisconnecting(true);
    setTasksError(null);
    try {
      await disconnectGoogleTasks(token);
      setTasksConnected(false);
      setTasksSuccessBanner(false);
    } catch {
      setTasksError(t('settings.failedDisconnect'));
    } finally {
      setTasksDisconnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Google Drive */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{t('settings.googleDrive')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.googleDriveDesc')}</p>
        </div>

        {driveSuccessBanner && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{t('settings.driveConnected')}</span>
            <button onClick={() => setDriveSuccessBanner(false)} className="ml-4 font-bold">×</button>
          </div>
        )}
        {driveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{driveError}</span>
            <button onClick={() => setDriveError(null)} className="ml-4 font-bold">×</button>
          </div>
        )}

        {driveLoading ? (
          <p className="text-sm text-gray-400">{t('settings.loading')}</p>
        ) : driveConnected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-700">{CHECK_ICON}{t('settings.connected')}</div>
            <button
              onClick={handleDriveDisconnect}
              disabled={disconnecting}
              className="text-sm px-4 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {disconnecting ? t('settings.disconnecting') : t('settings.disconnect')}
            </button>
          </div>
        ) : (
          <button
            onClick={handleDriveConnect}
            className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 transition-colors"
          >
            {GOOGLE_LOGO}{t('settings.connectGoogleDrive')}
          </button>
        )}
      </div>

      {/* Google Tasks */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{t('settings.googleTasks')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.googleTasksDesc')}</p>
        </div>

        {tasksSuccessBanner && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{t('settings.tasksConnected')}</span>
            <button onClick={() => setTasksSuccessBanner(false)} className="ml-4 font-bold">×</button>
          </div>
        )}
        {tasksError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{tasksError}</span>
            <button onClick={() => setTasksError(null)} className="ml-4 font-bold">×</button>
          </div>
        )}

        {tasksLoading ? (
          <p className="text-sm text-gray-400">{t('settings.loading')}</p>
        ) : tasksConnected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-700">{CHECK_ICON}<span>{t('settings.connected')}</span></div>
            <button
              onClick={handleTasksDisconnect}
              disabled={tasksDisconnecting}
              className="text-sm px-4 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {tasksDisconnecting ? t('settings.disconnecting') : t('settings.disconnect')}
            </button>
          </div>
        ) : (
          <button
            onClick={handleTasksConnect}
            className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 transition-colors"
          >
            {GOOGLE_LOGO}{t('settings.connectGoogleTasks')}
          </button>
        )}
      </div>

      {/* Google Calendar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{t('settings.googleCalendar')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.googleCalendarDesc')}</p>
        </div>

        {calendarSuccessBanner && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{t('settings.calendarConnected')}</span>
            <button onClick={() => setCalendarSuccessBanner(false)} className="ml-4 font-bold">×</button>
          </div>
        )}
        {calendarError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{calendarError}</span>
            <button onClick={() => setCalendarError(null)} className="ml-4 font-bold">×</button>
          </div>
        )}

        {calendarLoading ? (
          <p className="text-sm text-gray-400">{t('settings.loading')}</p>
        ) : calendarConnected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-700">{CHECK_ICON}{t('settings.connected')}</div>
            <button
              onClick={handleCalendarDisconnect}
              disabled={calendarDisconnecting}
              className="text-sm px-4 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {calendarDisconnecting ? t('settings.disconnecting') : t('settings.disconnect')}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCalendarConnect}
            className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 transition-colors"
          >
            {GOOGLE_LOGO}{t('settings.connectGoogleCalendar')}
          </button>
        )}
      </div>
    </div>
  );
}
