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
});
