import crypto from "crypto";
import { cookies } from "next/headers";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";

export const runtime = "nodejs";

const GENERIC_ERROR = "Invalid credentials.";

/** Constant-time string compare, safe for unequal lengths (no early exit on length). */
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  const length = Math.max(bufA.length, bufB.length, 1);
  const paddedA = Buffer.concat([bufA], length);
  const paddedB = Buffer.concat([bufB], length);
  return crypto.timingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length;
}

export async function POST(request: Request) {
  const expectedUsername = process.env.FOODLY_DEMO_USERNAME;
  const expectedPassword = process.env.FOODLY_DEMO_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    console.error("Login is not configured: missing FOODLY_DEMO_USERNAME/FOODLY_DEMO_PASSWORD.");
    return Response.json({ error: "Login is not configured." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const username = typeof record.username === "string" ? record.username : "";
  const password = typeof record.password === "string" ? record.password : "";

  const usernameMatches = timingSafeStringEqual(username, expectedUsername);
  const passwordMatches = timingSafeStringEqual(password, expectedPassword);

  if (!usernameMatches || !passwordMatches) {
    return Response.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const token = createSessionToken(username);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return Response.json({ ok: true });
}
