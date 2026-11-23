/**
 * Minimal structured JSON logger with recursive redaction of sensitive keys.
 *
 * We intentionally avoid worker-thread based loggers to keep compatibility with serverless
 * runtimes. Output is one JSON object per line, suitable for Vercel log drains / Datadog / etc.
 */

type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|cookie|api[-_]?key|card|cvv|cvc|pan|otp|totp|recovery|credential|signature|session/i;

const MAX_DEPTH = 6;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[depth]";
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    // ObjectId / Date etc. stringify cleanly
    if (typeof (value as { toHexString?: unknown }).toHexString === "function") {
      return (value as { toHexString: () => string }).toHexString();
    }
    if (value instanceof Date) return value.toISOString();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 2000) return value.slice(0, 2000) + "…";
  return value;
}

function currentLevel(): Level {
  const l = process.env.LOG_LEVEL as Level | undefined;
  return l && l in order ? l : process.env.NODE_ENV === "test" ? "warn" : "info";
}

function emit(level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (order[level] < order[currentLevel()]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function make(bindings: Record<string, unknown>): Logger {
  return {
    debug: (m, f) => emit("debug", m, { ...bindings, ...f }),
    info: (m, f) => emit("info", m, { ...bindings, ...f }),
    warn: (m, f) => emit("warn", m, { ...bindings, ...f }),
    error: (m, f) => emit("error", m, { ...bindings, ...f }),
    child: (b) => make({ ...bindings, ...b }),
  };
}

export const logger: Logger = make({ service: "storeforge" });
