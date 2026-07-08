import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "@/util/log";
import { captureError, captureWarning } from "@/util/error-handler";

describe("error-handler", () => {
  let logs: Record<string, unknown>[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      logs.push(JSON.parse(args[0] as string));
    });
    vi.spyOn(console, "warn").mockImplementation((...args) => {
      logs.push(JSON.parse(args[0] as string));
    });
  });

  afterEach(() => vi.restoreAllMocks());

  describe("captureError", () => {
    it("logs error fields for Error instances", () => {
      const log = createLogger("test");
      const err = new Error("something broke");
      captureError(log, err, { chatId: 42 });

      expect(logs).toHaveLength(1);
      const entry = logs[0]!;
      expect(entry.level).toBe("error");
      expect(entry.errName).toBe("Error");
      expect(entry.errMsg).toBe("something broke");
      expect(entry.errStack).toContain("Error: something broke");
      expect(entry.chatId).toBe(42);
    });

    it("logs non-Error values gracefully", () => {
      const log = createLogger("test");
      captureError(log, "just a string");

      expect(logs).toHaveLength(1);
      const entry = logs[0]!;
      expect(entry.errName).toBe("non-error");
      expect(entry.errMsg).toBe("just a string");
      expect(entry.errStack).toBeUndefined();
    });

    it("includes msg field", () => {
      const log = createLogger("test");
      captureError(log, new Error("fail"));

      expect((logs[0] as Record<string, unknown>).msg).toBe("captured error");
    });
  });

  describe("captureWarning", () => {
    it("logs warn level with name and message", () => {
      const log = createLogger("test");
      captureWarning(log, new Error("transient issue"));

      expect(logs).toHaveLength(1);
      const entry = logs[0]!;
      expect(entry.level).toBe("warn");
      expect(entry.errName).toBe("Error");
      expect(entry.errMsg).toBe("transient issue");
    });

    it("does not include errStack", () => {
      const log = createLogger("test");
      captureWarning(log, new Error("transient"));

      expect((logs[0] as Record<string, unknown>).errStack).toBeUndefined();
    });
  });
});
