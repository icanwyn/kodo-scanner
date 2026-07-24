import { NextResponse } from "next/server";
import {
  GATE_COOKIE,
  GATE_MAX_AGE,
  gateToken,
  isGateEnabled,
} from "@/lib/auth-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const password = process.env.APP_PASSWORD?.trim();

  if (!isGateEnabled(password)) {
    return NextResponse.json({
      ok: true,
      gated: false,
      message: "Gate disabled (APP_PASSWORD not set)",
    });
  }

  const body = await req.json().catch(() => ({}));
  const attempt = String(body.password ?? "");

  if (!attempt || attempt !== password) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PASSWORD",
          message: "Incorrect password",
        },
      },
      { status: 401 }
    );
  }

  const token = await gateToken(password!);
  const res = NextResponse.json({ ok: true, gated: true });
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });
  return res;
}
