// Signed capability for Raj voice synthesis.
//
// The browser never chooses arbitrary TTS text. /api/brief signs the exact
// server-generated excerpt Voice Mode is allowed to speak; /api/voice verifies
// the capability, binds it to the same client, and consumes its jti once.

import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const GRANT_AUDIENCE = "raj-voice";
const GRANT_LIFETIME_MS = 5 * 60 * 1000;
const MAX_VOICE_TEXT_LENGTH = 600;
const MAX_TOKEN_LENGTH = 8_192;

interface VoiceGrantPayload {
  v: 1;
  aud: typeof GRANT_AUDIENCE;
  exp: number;
  jti: string;
  sub: string;
  text: string;
}

export type VoiceGrantVerification =
  | {
      ok: true;
      text: string;
      jti: string;
      expiresAt: number;
    }
  | {
      ok: false;
      reason: "unconfigured" | "invalid" | "expired";
    };

function signingSecret(): string {
  const value = process.env.AI_ACTION_SIGNING_SECRET || "";
  return Buffer.byteLength(value, "utf8") >= 32 ? value : "";
}

function subjectHash(subject: string): string {
  return createHash("sha256").update(subject).digest("base64url");
}

function signature(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

function validText(text: string): boolean {
  return text.length >= 1 && text.length <= MAX_VOICE_TEXT_LENGTH;
}

export function buildVoiceExcerpt(brief: string): string {
  return brief
    .split(/\n\s*\n/)
    .slice(0, 3)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_VOICE_TEXT_LENGTH);
}

export function voiceGrantsConfigured(): boolean {
  return Boolean(signingSecret());
}

export function issueVoiceGrant(
  text: string,
  subject: string,
  now = Date.now(),
): string | null {
  const secret = signingSecret();
  if (!secret || !subject || subject === "unknown" || !validText(text)) return null;

  const payload: VoiceGrantPayload = {
    v: 1,
    aud: GRANT_AUDIENCE,
    exp: now + GRANT_LIFETIME_MS,
    jti: randomUUID(),
    sub: subjectHash(subject),
    text,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded, secret).toString("base64url")}`;
}

export function verifyVoiceGrant(
  token: string,
  subject: string,
  now = Date.now(),
): VoiceGrantVerification {
  const secret = signingSecret();
  if (!secret) return { ok: false, reason: "unconfigured" };
  if (!token || token.length > MAX_TOKEN_LENGTH || !subject || subject === "unknown") {
    return { ok: false, reason: "invalid" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "invalid" };
  const [encoded, providedSignature] = parts;

  let provided: Buffer;
  try {
    provided = Buffer.from(providedSignature, "base64url");
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const expected = signature(encoded, secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "invalid" };
  }

  let payload: VoiceGrantPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as VoiceGrantPayload;
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (
    payload.v !== 1 ||
    payload.aud !== GRANT_AUDIENCE ||
    !Number.isSafeInteger(payload.exp) ||
    typeof payload.jti !== "string" ||
    payload.jti.length < 16 ||
    typeof payload.sub !== "string" ||
    payload.sub !== subjectHash(subject) ||
    typeof payload.text !== "string" ||
    !validText(payload.text)
  ) {
    return { ok: false, reason: "invalid" };
  }
  if (payload.exp <= now) return { ok: false, reason: "expired" };
  if (payload.exp - now > GRANT_LIFETIME_MS) return { ok: false, reason: "invalid" };

  return {
    ok: true,
    text: payload.text,
    jti: payload.jti,
    expiresAt: payload.exp,
  };
}
