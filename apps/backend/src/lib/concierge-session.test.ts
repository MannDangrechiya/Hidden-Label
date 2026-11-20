import { describe, expect, it } from "vitest";
import {
  createGuestSession,
  decideThreadAccess,
  hashGuestSessionToken,
  verifyGuestSessionToken,
} from "./concierge-session";

const SECRET = "test_secret_0123456789abcdef0123456789abcdef";

describe("Guest concierge sessions (BUG-09)", () => {
  it("issues a verifiable signed session and stores only its hash", () => {
    const session = createGuestSession(SECRET, 1_000_000);
    expect(session.token.startsWith("v1.")).toBe(true);
    expect(session.hash).toBe(hashGuestSessionToken(session.token));
    expect(session.hash).not.toContain(session.token);

    const verified = verifyGuestSessionToken(session.token, SECRET, 1_000_000);
    expect(verified?.sid).toBe(session.sid);
  });

  it("rejects a tampered signature", () => {
    const session = createGuestSession(SECRET, 1_000_000);
    const parts = session.token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].replace(/^./, (c) => (c === "A" ? "B" : "A"))}`;
    expect(verifyGuestSessionToken(tampered, SECRET, 1_000_000)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const session = createGuestSession(SECRET, 1_000_000);
    expect(verifyGuestSessionToken(session.token, `${SECRET}_other`, 1_000_000)).toBeNull();
  });

  it("rejects an expired token", () => {
    const session = createGuestSession(SECRET, 1_000_000);
    expect(verifyGuestSessionToken(session.token, SECRET, session.expiresAt + 1)).toBeNull();
  });

  it("rejects a client-minted token that looks plausible", () => {
    const forged = `v1.${Buffer.from(JSON.stringify({ sid: "csid_attacker", exp: Date.now() + 1000 })).toString(
      "base64url",
    )}.${Buffer.from("not-a-real-signature").toString("base64url")}`;
    expect(verifyGuestSessionToken(forged, SECRET)).toBeNull();
  });

  it("rejects garbage and empty input", () => {
    for (const value of ["", "null", "v1", "v1.a.b.c", "v2.a.b"]) {
      expect(verifyGuestSessionToken(value, SECRET)).toBeNull();
    }
    expect(verifyGuestSessionToken(null, SECRET)).toBeNull();
  });
});

describe("Concierge thread ownership", () => {
  const token = "v1.payload.signature";
  const hash = hashGuestSessionToken(token);

  it("allows the owning customer", () => {
    expect(
      decideThreadAccess(
        { customer_id: "cus_1", session_token_hash: null },
        { customerId: "cus_1", tokenHash: null },
      ).allowed,
    ).toBe(true);
  });

  it("denies a different customer, even with a token", () => {
    expect(
      decideThreadAccess(
        { customer_id: "cus_1", session_token_hash: hash },
        { customerId: "cus_2", tokenHash: hash },
      ).allowed,
    ).toBe(false);
  });

  it("denies an anonymous caller touching a customer thread", () => {
    expect(
      decideThreadAccess(
        { customer_id: "cus_1", session_token_hash: null },
        { customerId: null, tokenHash: hash },
      ).allowed,
    ).toBe(false);
  });

  it("allows a guest thread only with the exact issued token", () => {
    expect(
      decideThreadAccess(
        { customer_id: null, session_token_hash: hash },
        { customerId: null, tokenHash: hash },
      ).allowed,
    ).toBe(true);
  });

  it("denies a guest thread with a different or absent token", () => {
    const otherHash = hashGuestSessionToken("someone-elses-token");
    expect(
      decideThreadAccess(
        { customer_id: null, session_token_hash: hash },
        { customerId: null, tokenHash: otherHash },
      ).allowed,
    ).toBe(false);
    expect(
      decideThreadAccess(
        { customer_id: null, session_token_hash: hash },
        { customerId: null, tokenHash: null },
      ).allowed,
    ).toBe(false);
  });

  it("fails closed for a legacy thread with no owner and no hash", () => {
    expect(
      decideThreadAccess(
        { customer_id: null, session_token_hash: null },
        { customerId: null, tokenHash: hash },
      ).allowed,
    ).toBe(false);
  });
});
