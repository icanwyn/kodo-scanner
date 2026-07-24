import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function err(
  code: string,
  message: string,
  status = 400,
  details?: unknown
) {
  return NextResponse.json(
    { error: { code, message, details } },
    { status }
  );
}

export function isValidSymbol(symbol: string): boolean {
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol.toUpperCase());
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}
