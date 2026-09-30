import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiUrl } from '../api/base';

interface User {
  id: number;
  email: string;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isAdmin: boolean;
  login: (token: string, user: User, remember: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'dashboard_token';
const USER_KEY  = 'dashboard_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  });
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch admin status whenever token changes
  useEffect(() => {
    if (!token) { setIsAdmin(false); return; }
    fetch(apiUrl('/api/admin/me'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { isAdmin: false })
      .then((data: { isAdmin?: boolean }) => setIsAdmin(data.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [token]);

  function login(newToken: string, newUser: User, remember: boolean) {
    const store   = remember ? localStorage   : sessionStorage;
    const discard = remember ? sessionStorage : localStorage;
    // Clear the opposite store so a stale token can never be read back on reload.
    discard.removeItem(TOKEN_KEY);
    discard.removeItem(USER_KEY);
    store.setItem(TOKEN_KEY, newToken);
    store.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    setToken(null);
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  return (
    <AuthContext.Provider value={{ token, user, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
