import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('ecoguard_token');

    if (token) {
      api.auth
        .getProfile()
        .then((userData) => { if (!cancelled) setUser(userData); })
        .catch(() => {
          if (cancelled) return;
          localStorage.removeItem('ecoguard_token');
          setUser(null);
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, []);

  const login = async (email, password) => {
    const { user, token } = await api.auth.login(email, password);
    localStorage.setItem('ecoguard_token', token);
    setUser(user);
    return user;
  };

  const register = async (name, email, password) => {
    const { user, token } = await api.auth.register(name, email, password);
    localStorage.setItem('ecoguard_token', token);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('ecoguard_token');
    setUser(null);
  };

  // Replaces the in-memory user (used after profile edits return fresh data).
  const updateUser = (nextUser) => setUser(nextUser);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
