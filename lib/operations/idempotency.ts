import type { NextRequest } from "next/server";

type ClaimStore = Map<string, number>;

declare global {
  var __iwrOperationClaims: ClaimStore | undefined;
}

function store(): ClaimStore {
  if (!globalThis.__iwrOperationClaims) {
    globalThis.__iwrOperationClaims = new Map<string, number>();
  }
  return globalThis.__iwrOperationClaims;
}

export function operationKey(request: NextRequest): string | null {
  const value = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(value)) return null;
  return value;
}

/**
 * Best-effort process-local duplicate protection.
 *
 * Durable delivery providers must still receive their own idempotency key;
 * this guard prevents accidental repeat clicks and same-instance cron retries.
 */
export function claimOperation(
  scope: string,
  key: string,
  ttlMs = 24 * 60 * 60 * 1_000,
): boolean {
  const now = Date.now();
  const claims = store();
  for (const [storedKey, expiresAt] of claims) {
    if (expiresAt <= now) claims.delete(storedKey);
  }

  const scoped = `${scope}:${key}`;
  if ((claims.get(scoped) ?? 0) > now) return false;
  claims.set(scoped, now + ttlMs);
  return true;
}

export function releaseOperation(scope: string, key: string): void {
  store().delete(`${scope}:${key}`);
}
