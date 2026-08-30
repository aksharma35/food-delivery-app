import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "foodly_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 2; // 2 hours

type SessionPayload = {
  customerId: number;
  phone: string;
  name: string;
  exp: number; // unix seconds
};

export type Session = {
  customerId: number;
  phone: string;
  name: string;
};

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET environment variable.");
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

/** Builds a signed session token: base64url(payload) + "." + HMAC signature. */
export function createSessionToken(customer: { id: number; phone: string; name: string }): string {
  const payload: SessionPayload = {
    customerId: customer.id,
    phone: customer.phone,
    name: customer.name,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8")) as SessionPayload;
    if (
      typeof payload.customerId !== "number" ||
      typeof payload.phone !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Reads and verifies the session cookie server-side. Not wired into the chat route yet. */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  return { customerId: payload.customerId, phone: payload.phone, name: payload.name };
}
