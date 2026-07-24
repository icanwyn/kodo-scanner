import { getEnv } from "./env";

type Level = "debug" | "info" | "warn" | "error";

const rank: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: Level): boolean {
  try {
    return rank[level] >= rank[getEnv().LOG_LEVEL];
  } catch {
    return true;
  }
}

export function log(
  level: Level,
  message: string,
  meta?: Record<string, unknown>
) {
  if (!shouldLog(level)) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => log("debug", m, meta),
  info: (m: string, meta?: Record<string, unknown>) => log("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log("error", m, meta),
};
