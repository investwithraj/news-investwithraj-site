// Client-side consent state — localStorage-backed.
//
// Used by both the banner UI and the pixel-loader components.

import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from "./types";
import type { ConsentState } from "./types";

/** Read current consent. Returns null if never set / stale version. */
export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CONSENT_VERSION) {
      // Stale policy — force re-prompt
      localStorage.removeItem(CONSENT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Save consent state. */
export function saveConsent(consents: Record<string, boolean>): ConsentState {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
    consents,
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
    // Fire custom event so pixel loaders can react without polling
    window.dispatchEvent(new CustomEvent("iwr-consent-changed", { detail: state }));
  }
  return state;
}

/** Withdraw all consent. */
export function clearConsent(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("iwr-consent-changed", { detail: null }));
  }
}

/** Has the user been prompted for the current policy version? */
export function hasConsented(): boolean {
  return readConsent() !== null;
}

/** Is a specific service allowed? */
export function isAllowed(serviceName: string): boolean {
  const state = readConsent();
  if (!state) return false;
  return state.consents[serviceName] === true;
}

/** Purge cookies for a withdrawn service. */
export function purgeCookies(patterns: Array<string | RegExp>): void {
  if (typeof document === "undefined") return;
  const cookies = document.cookie.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const name = cookie.split("=")[0];
    const match = patterns.some((p) =>
      typeof p === "string" ? name === p : p.test(name)
    );
    if (match) {
      // Clear on multiple domain/path combinations to maximise removal
      const expiry = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = `${name}=; ${expiry}; path=/`;
      document.cookie = `${name}=; ${expiry}; path=/; domain=${location.hostname}`;
      document.cookie = `${name}=; ${expiry}; path=/; domain=.${location.hostname}`;
    }
  }
}
