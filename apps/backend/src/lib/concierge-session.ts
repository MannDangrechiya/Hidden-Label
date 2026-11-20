import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Concierge thread ownership (BUG-09).
 *
 * The previous route trusted whatever `session_token` the browser sent, so any caller could
 * append to any thread by id. A client-supplied string is not proof of anything.
 *
 * Guest sessions are now issued **by the backend** as an HMAC-signed token. Only a hash of the
 * token is stored, so a database leak does not yield usable credentials, and a forged or edited
 * token fails signature verification. Signed-in customers are matched on `customer_id` instead;
 * their thread can never be opened by a token.
 *
 * The token is presented by the browser, but it is verified, not trusted.
 */

export const GUEST_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_VERSION = "v1";
const SIGNING_CONTEXT = "thl:concierge-session:v1";

export interface GuestSession {
  token: string;
  hash: string;
  sid: string;
  expiresAt: number;
}

interface TokenPayload {
  sid: string;
  exp: number;
}

function signingKey(secret: string): Buffer {
  return createHmac("sha256", secret).update(SIGNING_CONTEXT).digest();
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return base64url(createHmac("sha256", signingKey(secret)).update(payload).digest());
}

export function hashGuestSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createGuestSession(secret: string, now = Date.now()): GuestSession {
  if (!secret) throw new Error("A signing secret is required to issue a concierge session.");
  const sid = `csid_${randomBytes(16).toString("hex")}`;
  const expiresAt = now + GUEST_SESSION_TTL_MS;
  const payload = base64url(JSON.stringify({ sid, exp: expiresAt } satisfies TokenPayload));
  const token = `${TOKEN_VERSION}.${payload}.${sign(payload, secret)}`;
  return { token, hash: hashGuestSessionToken(token), sid, expiresAt };
}

export function verifyGuestSessionToken(
  token: string | null | undefined,
  secret: string,
  now = Date.now(),
): TokenPayload | null {
  if (!token || !secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [version, payload, signature] = parts;
  if (version !== TOKEN_VERSION || !payload || !signature) return null;

  const expected = sign(payload, secret);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const { sid, exp } = parsed as Partial<TokenPayload>;
  if (typeof sid !== "string" || !sid.startsWith("csid_")) return null;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= now) return null;

  return { sid, exp };
}

export interface ThreadOwnership {
  customer_id: string | null;
  session_token_hash: string | null;
}

export interface OwnershipProof {
  customerId: string | null;
  tokenHash: string | null;
}

export type ThreadAccess = { allowed: true } | { allowed: false; reason: string };

/**
 * Fail-closed ownership rule:
 * - a thread owned by a customer is accessible only to that customer;
 * - a guest thread is accessible only with the exact token whose hash is stored;
 * - a thread with neither owner nor hash (legacy data) is never accessible.
 */
export function decideThreadAccess(thread: ThreadOwnership, proof: OwnershipProof): ThreadAccess {
  if (thread.customer_id) {
    if (proof.customerId && proof.customerId === thread.customer_id) {
      return { allowed: true };
    }
    return { allowed: false, reason: "This conversation belongs to a different account." };
  }

  if (!thread.session_token_hash) {
    return {
      allowed: false,
      reason: "This conversation cannot be verified. Start a new one.",
    };
  }

  if (!proof.tokenHash) {
    return { allowed: false, reason: "A valid session is required to continue this conversation." };
  }

  const a = Buffer.from(proof.tokenHash);
  const b = Buffer.from(thread.session_token_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { allowed: false, reason: "A valid session is required to continue this conversation." };
  }

  return { allowed: true };
}
