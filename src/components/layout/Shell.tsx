"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/scanner", label: "Scanner" },
  { href: "/apex", label: "APEX" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/journal", label: "Journal" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [gated, setGated] = useState(false);

  useEffect(() => {
    if (isLogin) return;
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((j) => setGated(Boolean(j.gated)))
      .catch(() => null);
  }, [isLogin, pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (isLogin) {
    return (
      <>
        <div className="kodo-bg" aria-hidden />
        <main className="relative z-10">{children}</main>
      </>
    );
  }

  return (
    <>
      <div className="kodo-bg" aria-hidden />
      <header className="relative z-10 sticky top-0 border-b border-white/10 bg-[#0b0c10]/70 backdrop-blur-xl">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center gap-3 justify-between">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <div
              className="w-9 h-9 rounded-xl grid place-items-center text-sm font-bold"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,43,214,0.35), rgba(45,226,230,0.25))",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              高動
            </div>
            <div>
              <div className="font-semibold tracking-wide text-[15px]">
                Kōdō Scanner
              </div>
              <div className="text-[11px] text-[var(--kodo-ink-muted)]">
                high movement · expert confluence
              </div>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-1 items-center">
            {links.map((l) => {
              const active =
                l.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={clsx("nav-link", active && "active")}
                >
                  {l.label}
                </Link>
              );
            })}
            {gated && (
              <button
                type="button"
                className="btn btn-ghost text-xs ml-1"
                onClick={logout}
              >
                Lock
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="page">{children}</main>
      <footer className="relative z-10 max-w-[1280px] mx-auto px-4 md:px-8 pb-10">
        <p className="disclaimer">
          Not financial advice. Educational and journal use only. Market data is
          delayed/free-tier by default. Site password protects this instance;
          journal data is still one shared workspace after login.
        </p>
      </footer>
    </>
  );
}
