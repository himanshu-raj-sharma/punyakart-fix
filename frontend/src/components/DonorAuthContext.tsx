import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

export interface DonorInfo {
  name: string;
  phone: string;
}

interface DonorAuthContextType {
  donor: DonorInfo | null;
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (phone: string, secretId: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const DonorAuthContext = createContext<DonorAuthContextType | null>(null);

const TOKEN_KEY = 'punyakart_donor_token';
const DONOR_KEY = 'punyakart_donor_info';

// ─── Token Helpers ───────────────────────────────────────────────────

function isTokenExpired(token: string): boolean {
  try {
    const [payloadB64] = token.split('.');
    if (!payloadB64) return true;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

function saveAuth(token: string, donor: DonorInfo): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(DONOR_KEY, JSON.stringify(donor));
}

function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(DONOR_KEY);
}

function loadAuth(): { token: string; donor: DonorInfo } | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const donorStr = localStorage.getItem(DONOR_KEY);
  if (!token || !donorStr) return null;
  if (isTokenExpired(token)) {
    clearAuth();
    return null;
  }
  try {
    return { token, donor: JSON.parse(donorStr) };
  } catch {
    clearAuth();
    return null;
  }
}

// ─── Provider ────────────────────────────────────────────────────────

export function DonorAuthProvider({ children }: { children: React.ReactNode }) {
  const [donor, setDonor] = useState<DonorInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const stored = loadAuth();
    if (stored) {
      setToken(stored.token);
      setDonor(stored.donor);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (phone: string, secretId: string) => {
    const res = await fetch('/api/donor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, secretId }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Login failed' };

    setToken(data.token);
    setDonor(data.donor);
    saveAuth(data.token, data.donor);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setDonor(null);
    clearAuth();
  }, []);

  const value = useMemo(
    () => ({
      donor,
      token,
      isLoggedIn: Boolean(token && donor),
      isLoading,
      login,
      logout,
    }),
    [donor, token, isLoading, login, logout],
  );

  return <DonorAuthContext.Provider value={value}>{children}</DonorAuthContext.Provider>;
}

export function useDonorAuth(): DonorAuthContextType {
  const ctx = useContext(DonorAuthContext);
  if (!ctx) throw new Error('useDonorAuth must be used within DonorAuthProvider');
  return ctx;
}
