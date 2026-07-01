import { describe, it, expect } from "vitest";
import { classifyTelegramError } from "../../src/notify/errors";

describe("classifyTelegramError", () => {
  it("returns permanent for bot blocked", () => {
    expect(classifyTelegramError(new Error("bot was blocked by user"))).toBe("permanent");
  });

  it("returns permanent for chat not found", () => {
    expect(classifyTelegramError(new Error("chat not found"))).toBe("permanent");
  });

  it("returns permanent for Forbidden", () => {
    expect(classifyTelegramError(new Error("Forbidden: bot was blocked"))).toBe("permanent");
  });

  it("returns transient for Too Many Requests", () => {
    expect(classifyTelegramError(new Error("Too Many Requests: retry after 30"))).toBe("transient");
  });

  it("returns transient for timeout", () => {
    expect(classifyTelegramError(new Error("timeout"))).toBe("transient");
  });

  it("returns transient for generic error", () => {
    expect(classifyTelegramError(new Error("unknown error"))).toBe("transient");
  });

  it("does not classify permanent error with '5' in text as transient", () => {
    expect(classifyTelegramError(new Error("Forbidden: user blocked 12345"))).toBe("permanent");
  });

  it("classifies 500-like transient errors correctly", () => {
    expect(classifyTelegramError(new Error("Telegram API error 503 Service Unavailable"))).toBe("transient");
  });
});
