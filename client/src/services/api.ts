import axios from "axios";
import { useAuthStore } from "../store/authStore";

const ANTLER_SESSION_KEY = "antler_session_id";

function getCookie(name: string) {
  return (
    document.cookie.split("; ").reduce((result, entry) => {
      const parts = entry.split("=");
      return parts[0] === name ? decodeURIComponent(parts[1]) : result;
    }, "") || null
  );
}

function setCookie(name: string, value: string, expiresAt?: number) {
  const expires = expiresAt
    ? new Date(expiresAt * 1000).toUTCString()
    : new Date(Date.now() + 10 * 60 * 1000).toUTCString();

  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; samesite=lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function getAccessToken() {
  return getCookie("access_token");
}

function getAntlerSessionId() {
  try {
    return (
      localStorage.getItem(ANTLER_SESSION_KEY) ||
      getCookie(ANTLER_SESSION_KEY) ||
      getCookie("x-antler-session")
    );
  } catch {
    return getCookie(ANTLER_SESSION_KEY) || getCookie("x-antler-session");
  }
}

function persistAntlerSession(sessionId: string, expiresAt?: number) {
  try {
    localStorage.setItem(ANTLER_SESSION_KEY, sessionId);
  } catch {
    // Ignore storage failures and fall back to cookies only.
  }

  setCookie(ANTLER_SESSION_KEY, sessionId, expiresAt);
  setCookie("x-antler-session", sessionId, expiresAt);
}

function clearAntlerSession() {
  try {
    localStorage.removeItem(ANTLER_SESSION_KEY);
  } catch {
    // Ignore storage failures and clear cookies only.
  }

  deleteCookie(ANTLER_SESSION_KEY);
  deleteCookie("x-antler-session");
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3800",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  const antlerSessionId = getAntlerSessionId();

  config.headers = config.headers || {};

  if (token) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  }

  if (antlerSessionId) {
    (config.headers as any)["x-antler-session"] = antlerSessionId;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    const sessionId = response?.data?.session_id;
    const expiresAt = response?.data?.expires_at;

    if (typeof sessionId === "string" && sessionId) {
      persistAntlerSession(sessionId, expiresAt);
    }

    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      const antlerSessionId =
        error?.config?.headers?.["x-antler-session"] ||
        error?.config?.headers?.["X-Antler-Session"];

      if (antlerSessionId) {
        clearAntlerSession();
      } else {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  },
);

export default api;
