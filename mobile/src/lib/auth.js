// Authentication state shared by the whole app (login, register, logout,
// and restoring the session when the app reopens).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get, post, setToken, setUnauthorizedHandler } from './api';

const KEY = 'kicukiro-ehealth-session';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const save = async (token, u) => {
    setToken(token);
    setUser(u);
    try { await AsyncStorage.setItem(KEY, JSON.stringify({ token })); } catch {}
  };

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    try { await AsyncStorage.removeItem(KEY); } catch {}
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { logout(); });
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const { token } = JSON.parse(raw);
          setToken(token);
          setUser(await get('/auth/me'));
        }
      } catch {
        setToken(null);
      } finally {
        setReady(true);
      }
    })();
  }, [logout]);

  const value = useMemo(() => ({
    user,
    ready,
    async login(email, password, portal) {
      const r = await post('/auth/login', { email, password, portal });
      await save(r.token, r.user);
      return r.user;
    },
    async register(form) {
      const r = await post('/auth/register', form);
      await save(r.token, r.user);
      return r.user;
    },
    async refresh() { setUser(await get('/auth/me')); },
    logout,
  }), [user, ready, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const ROLE_LABEL = { admin: 'Administrator', doctor: 'Doctor', reception: 'Reception Staff', patient: 'Patient' };
export const homeFor = (role) => (role === 'patient' ? '/home' : role === 'doctor' ? '/dashboard' : role === 'reception' ? '/queue' : '/dashboard');
