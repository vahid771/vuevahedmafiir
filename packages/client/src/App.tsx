import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CalendarProvider } from './context/CalendarContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { SyncQueueProvider } from './context/SyncQueueContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import BillsPage from './pages/BillsPage';
import RemindersPage from './pages/RemindersPage';
import HabitsPage from './pages/HabitsPage';
import ImportantDatesPage from './pages/ImportantDatesPage';
import DocumentsPage from './pages/DocumentsPage';
import SettingsLayout from './pages/settings/SettingsLayout';
import CalendarSettingsPage from './pages/settings/CalendarSettingsPage';
import LanguageSettingsPage from './pages/settings/LanguageSettingsPage';
import LocationSettingsPage from './pages/settings/LocationSettingsPage';
import HolidaysSettingsPage from './pages/settings/HolidaysSettingsPage';
import IntegrationsSettingsPage from './pages/settings/IntegrationsSettingsPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import AuthCallbackPage from './pages/AuthCallbackPage';

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <CalendarProvider>
      <LanguageProvider>
      <SyncQueueProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/bills" element={<BillsPage />} />
              <Route path="/reminders" element={<RemindersPage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/dates" element={<ImportantDatesPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/calendar" replace />} />
                <Route path="calendar" element={<CalendarSettingsPage />} />
                <Route path="language" element={<LanguageSettingsPage />} />
                <Route path="location" element={<LocationSettingsPage />} />
                <Route path="holidays" element={<HolidaysSettingsPage />} />
                <Route path="integrations" element={<IntegrationsSettingsPage />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </SyncQueueProvider>
      </LanguageProvider>
      </CalendarProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
