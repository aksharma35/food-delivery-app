import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import PhoneOtpForm from "./PhoneOtpForm";

export const metadata: Metadata = {
  title: "Log in — Foodly",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm rounded-3xl border border-black/5 bg-background p-8 shadow-sm ring-1 ring-black/5">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-2xl"
            aria-hidden
          >
            🍔
          </span>
          <h1 className="text-xl font-bold">Log in to order</h1>
          <p className="text-sm text-foreground/60">
            We&apos;ll text you a one-time code to verify your number.
          </p>
        </div>

        <PhoneOtpForm />

        <Link
          href="/"
          className="mt-6 block text-center text-sm text-foreground/50 transition-colors hover:text-foreground"
        >
          ← Back to Foodly
        </Link>
      </div>
    </div>
  );
}
