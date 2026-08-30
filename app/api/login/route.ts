import crypto from "crypto";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";

export const runtime = "nodejs";

const GENERIC_ERROR = "Invalid phone number or OTP.";

/** Constant-time string compare, safe for unequal lengths (no early exit on length). */
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  const length = Math.max(bufA.length, bufB.length, 1);
  const paddedA = Buffer.concat([bufA], length);
  const paddedB = Buffer.concat([bufB], length);
  return crypto.timingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length;
}

type CustomerRow = { id: number; name: string; phone: string };

export async function POST(request: Request) {
  const expectedOtp = process.env.FOODLY_DEMO_OTP;
  if (!expectedOtp) {
    console.error("Login is not configured: missing FOODLY_DEMO_OTP.");
    return Response.json({ error: "Login is not configured." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const phone = typeof record.phone === "string" ? record.phone.trim() : "";
  const otp = typeof record.otp === "string" ? record.otp.trim() : "";

  // Demo mode: any phone number can log in with this single fixed OTP —
  // there's no real SMS provider wired up. The phone must still match a
  // seeded customer below, so only known demo accounts can sign in.
  if (!phone || !otp || !timingSafeStringEqual(otp, expectedOtp)) {
    return Response.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  let customers: CustomerRow[];
  try {
    customers = await query<CustomerRow>("select id, name, phone from customers where phone = $1", [phone]);
  } catch (error) {
    console.error("Login lookup failed:", error);
    return Response.json({ error: "Login is temporarily unavailable." }, { status: 502 });
  }

  const customer = customers[0];
  if (!customer) {
    return Response.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const token = createSessionToken(customer);
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
