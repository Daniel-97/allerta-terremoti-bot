import type { Logger } from "@/util/log";

function extractErrorInfo(err: unknown): {
  name: string;
  message: string;
  stack: string | undefined;
} {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: "non-error", message: String(err), stack: undefined };
}

export function captureError(log: Logger, err: unknown, context?: Record<string, unknown>): void {
  const info = extractErrorInfo(err);
  log.error(
    { ...context, errName: info.name, errMsg: info.message, errStack: info.stack },
    "captured error",
  );
}

export function captureWarning(log: Logger, err: unknown, context?: Record<string, unknown>): void {
  const info = extractErrorInfo(err);
  log.warn({ ...context, errName: info.name, errMsg: info.message }, "captured warning");
}
