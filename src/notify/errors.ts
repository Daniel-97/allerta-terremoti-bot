export type ErrorClass = "transient" | "permanent";

export function classifyTelegramError(err: unknown): ErrorClass {
  if (err instanceof Error) {
    const msg = err.message ?? "";
    if (
      msg.includes("bot was blocked") ||
      msg.includes("user not found") ||
      msg.includes("chat not found") ||
      msg.includes("user is deactivated") ||
      msg.includes("Forbidden")
    ) {
      return "permanent";
    }
    if (
      msg.includes("Too Many Requests") ||
      msg.includes("retry after") ||
      msg.includes("timed out") ||
      msg.includes("timeout") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("ECONNRESET")
    ) {
      return "transient";
    }
  }
  return "transient";
}
