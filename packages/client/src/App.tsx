import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CalendarProvider } from './context/CalendarContext';
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
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <AuthProvider>
      <CalendarProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </CalendarProvider>
    </AuthProvider>
  );
}

export default App;
