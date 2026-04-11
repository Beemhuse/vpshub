import { Antler } from "antler-sdk";
import api from "@/services/api";

const antlerCoreUrl = new URL("./antler-core-shim.js", import.meta.url).href;
const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3800";
const antlerBaseUrl = import.meta.env.VITE_ANTLER_SENTINEL_URL || apiBaseUrl;
const antlerContext = import.meta.env.VITE_ANTLER_CONTEXT || "client_access";
const antlerRegisterSessionUrl = new URL(
  "/auth/register-session",
  `${antlerBaseUrl}/`,
).toString();

const antler = new Antler({
  // The installed SDK still expects verifierUrl; map the documented base URL
  // to this app's Antler registration endpoint.
  verifierUrl: antlerRegisterSessionUrl, 
  autoRefresh: false,
  context: antlerContext,
});

let antlerInitPromise: Promise<void> | null = null;

function supportsAntlerAccess() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.credentials?.create &&
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  );
}

export function isAntlerSupported() {
  return supportsAntlerAccess();
}

async function ensureAntlerInitialized() {
  antlerInitPromise ??= antler.init(antlerCoreUrl);
  await antlerInitPromise;
}

export async function loginWithAntlerSdk() {
  if (!supportsAntlerAccess()) {
    throw new Error(
      "Antler requires WebAuthn support in a secure context such as https or localhost.",
    );
  }

  await ensureAntlerInitialized();
  const session = await antler.verify(antlerContext);

  const { data } = await api.post(
    "/auth/antler/access",
    {},
    {
      headers: {
        "x-antler-session": session.session_id,
      },
    },
  );

  return data;
}

export { antler };
