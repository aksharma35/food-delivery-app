"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "phone" | "otp";

export default function PhoneOtpForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setError(null);
    setStep("otp");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Invalid phone number or OTP.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={handleContinue} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-sm font-medium text-foreground/80">
            Phone number
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="rounded-full border border-foreground/15 bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand"
          />
        </div>
        <button
          type="submit"
          className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/30 transition-colors hover:bg-brand-dark"
        >
          Send OTP
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="otp" className="text-sm font-medium text-foreground/80">
          Enter the OTP sent to {phone}
        </label>
        <input
          id="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          disabled={isLoading}
          required
          className="rounded-full border border-foreground/15 bg-background px-4 py-2.5 text-center text-lg tracking-[0.5em] outline-none transition-colors focus:border-brand disabled:opacity-60"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isLoading}
        className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/30 transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Verifying…" : "Verify & continue"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStep("phone");
          setOtp("");
          setError(null);
        }}
        className="text-center text-sm text-foreground/50 transition-colors hover:text-foreground"
      >
        ← Use a different number
      </button>
    </form>
  );
}
