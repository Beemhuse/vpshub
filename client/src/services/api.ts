import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3800",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Add interceptor for JWT (read token from cookie)
api.interceptors.request.use((config) => {
  const token = document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === 'access_token' ? decodeURIComponent(parts[1]) : r;
  }, '') || null;
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
