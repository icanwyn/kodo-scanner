import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  GATE_COOKIE,
  gateTokenMatches,
  isGateEnabled,
} from "@/lib/auth-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const password = process.env.APP_PASSWORD?.trim();
  const gated = isGateEnabled(password);
  if (!gated) {
    return NextResponse.json({ gated: false, authenticated: true });
  }
  const jar = await cookies();
  const token = jar.get(GATE_COOKIE)?.value;
  const authenticated = await gateTokenMatches(password!, token);
  return NextResponse.json({ gated: true, authenticated });
}
