"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message ?? "Login failed");
        return;
      }
      router.replace(from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="glass p-8 w-full max-w-md space-y-5"
      >
        <div className="text-center space-y-2">
          <div
            className="w-12 h-12 mx-auto rounded-xl grid place-items-center text-lg font-bold"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,43,214,0.35), rgba(45,226,230,0.25))",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            高動
          </div>
          <h1 className="text-xl font-semibold tracking-wide">Kōdō Scanner</h1>
          <p className="text-sm text-[var(--kodo-ink-muted)]">
            Private site — enter the access password to continue.
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-xs text-[var(--kodo-ink-muted)]">Password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            className="w-full mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p className="text-sm text-[var(--kodo-danger)]" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Checking…" : "Enter"}
        </button>

        <p className="text-[11px] text-center text-[var(--kodo-ink-muted)]">
          Not financial advice. Single shared workspace behind this gate.
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="glass p-8 max-w-md mx-auto mt-20 text-center text-[var(--kodo-ink-muted)]">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
