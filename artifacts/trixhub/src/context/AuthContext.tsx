import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

const TOKEN_KEY = "trixhub_token";

export interface UserData {
  id: number;
  displayName: string;
  email: string;
  phone: string;
  country: string;
  referralCode: string;
  referredByCode: string | null;
  isActivated: boolean;
  isAdmin?: boolean;
  preferredCurrency: string;
  themePreference: string;
  canvaRequestedAt?: string | null;
  formationRequestedAt?: string | null;
  formationRequestedTitle?: string | null;
  avatarUrl?: string | null;
  phoneVisible: boolean;
  blockedActivities?: boolean;
  blockedFormations?: boolean;
  blockedCanva?: boolean;
  blockedContacts?: boolean;
  blockedReferral?: boolean;
  isFreeAccount?: boolean;
  activationCredit?: string;
  freeAccountDebt?: string;
  createdAt: string;
}

interface AuthContextType {
  token: string | null;
  user: UserData | null;
  isLoading: boolean;
  login: (token: string, userData?: UserData) => void;
  logout: () => void;
  refreshUser: () => void;
  setUserData: (u: UserData) => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null, user: null, isLoading: true,
  login: () => {}, logout: () => {}, refreshUser: () => {}, setUserData: () => {},
});

export function AuthProvider({ children, onUserLoaded }: { children: ReactNode; onUserLoaded?: (u: UserData) => void }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async (t: string) => {
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${base}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data: UserData = await res.json();
        setUser(data);
        onUserLoaded?.(data);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [onUserLoaded]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetchUser(token);
  }, [token, fetchUser]);

  const login = (newToken: string, userData?: UserData) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    if (userData) {
      setUser(userData);
      onUserLoaded?.(userData);
      setIsLoading(false);
    } else {
      fetchUser(newToken);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (token) await fetchUser(token);
  };

  const setUserData = (u: UserData) => {
    setUser(u);
    onUserLoaded?.(u);
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, refreshUser, setUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

let tokenGetter: (() => string | null) | null = null;
export function setAuthTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}
export function getAuthToken() {
  return tokenGetter?.() ?? null;
}
