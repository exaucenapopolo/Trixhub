import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

const TOKEN_KEY = "trixhub_token";

interface UserData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  referralCode: string;
  isActivated: boolean;
  preferredCurrency: string;
}

interface AuthContextType {
  token: string | null;
  user: UserData | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null, user: null, isLoading: true,
  login: () => {}, logout: () => {}, refreshUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
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
        const data = await res.json();
        setUser(data);
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
  }, []);

  useEffect(() => {
    if (token) {
      fetchUser(token);
    } else {
      setIsLoading(false);
    }
  }, [token, fetchUser]);

  const login = (newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    fetchUser(newToken);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshUser = () => {
    if (token) fetchUser(token);
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
