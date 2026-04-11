import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  access_token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

function setCookie(name: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; samesite=lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function clearAntlerSession() {
  deleteCookie("antler_session_id");
  deleteCookie("x-antler-session");

  try {
    localStorage.removeItem("antler_session_id");
  } catch {
    // Ignore storage failures during logout.
  }
}

function getCookie(name: string) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '') || null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      access_token: getCookie('access_token'),
      isAuthenticated: !!getCookie('access_token'),
      setAuth: (user, token) => {
        setCookie('access_token', token);
        set({ user, access_token: token, isAuthenticated: true });
      },
      logout: () => {
        clearAntlerSession();
        deleteCookie('access_token');
        set({ user: null, access_token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'vpshub-auth',
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
