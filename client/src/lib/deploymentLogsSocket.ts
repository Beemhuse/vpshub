import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";

export type DeploymentLogPayload = {
  deploymentId: string;
  message: string;
  source?: "stdout" | "stderr";
  ts?: string;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3800";

let socket: Socket | null = null;
const subscriptions = new Map<
  string,
  Set<(payload: DeploymentLogPayload) => void>
>();

function getTokenFromCookie(name: string) {
  return (
    document.cookie.split("; ").reduce((r, v) => {
      const parts = v.split("=");
      return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, "") || null
  );
}

function getAccessToken() {
  const storeToken = useAuthStore.getState().access_token;
  return storeToken || getTokenFromCookie("access_token");
}

function ensureSocket() {
  if (socket) return socket;

  socket = io(`${API_URL}/deployments`, {
    auth: { token: getAccessToken() },
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2000,
  });

  socket.on("connect", () => {
    subscriptions.forEach((_handlers, deploymentId) => {
      socket?.emit("deployment:subscribe", { deploymentId });
    });
  });

  socket.on("deployment:log", (payload: DeploymentLogPayload) => {
    const handlers = subscriptions.get(payload.deploymentId);
    if (!handlers) return;
    handlers.forEach((handler) => handler(payload));
  });

  socket.on("deployment:error", (payload) => {
    if (import.meta.env.DEV) {
      console.warn("Deployment logs error:", payload);
    }
  });

  socket.io.on("reconnect_attempt", () => {
    if (socket) {
      socket.auth = { token: getAccessToken() };
    }
  });

  return socket;
}

export function subscribeToDeploymentLogs(
  deploymentId: string,
  handler: (payload: DeploymentLogPayload) => void,
) {
  const ws = ensureSocket();

  const handlers =
    subscriptions.get(deploymentId) ||
    new Set<(payload: DeploymentLogPayload) => void>();
  handlers.add(handler);
  subscriptions.set(deploymentId, handlers);

  if (ws.connected) {
    ws.emit("deployment:subscribe", { deploymentId });
  } else {
    ws.auth = { token: getAccessToken() };
    ws.connect();
  }

  return () => {
    const current = subscriptions.get(deploymentId);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) {
      subscriptions.delete(deploymentId);
      if (ws.connected) {
        ws.emit("deployment:unsubscribe", { deploymentId });
      }
    }
  };
}

export function disconnectDeploymentLogsSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
  subscriptions.clear();
}
