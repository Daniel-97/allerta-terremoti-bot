import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "@/util/log";

describe("createLogger", () => {
  let logs: unknown[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(JSON.parse(args[0] as string));
    });
    vi.spyOn(console, "warn").mockImplementation((...args) => {
      logs.push(JSON.parse(args[0] as string));
    });
    vi.spyOn(console, "error").mockImplementation((...args) => {
      logs.push(JSON.parse(args[0] as string));
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("logs info with required fields", () => {
    const log = createLogger("test");
    log.info({ chatId: 1 }, "hello");
    expect(logs).toHaveLength(1);
    const entry = logs[0] as Record<string, unknown>;
    expect(entry.level).toBe("info");
    expect(entry.msg).toBe("hello");
    expect(entry.logger).toBe("test");
    expect(entry.chatId).toBe(1);
    expect(typeof entry.ts).toBe("string");
  });

  it("logs warn via console.warn", () => {
    const log = createLogger("test");
    log.warn({}, "warning");
    expect(logs).toHaveLength(1);
    expect((logs[0] as Record<string, unknown>).level).toBe("warn");
  });

  it("logs error via console.error", () => {
    const log = createLogger("test");
    log.error({ err: "fail" }, "error");
    expect(logs).toHaveLength(1);
    expect((logs[0] as Record<string, unknown>).level).toBe("error");
  });

  it("child logger binds extra fields", () => {
    const log = createLogger("parent");
    const child = log.child({ chatId: 42 });
    child.info({}, "child log");
    expect(logs).toHaveLength(1);
    const entry = logs[0] as Record<string, unknown>;
    expect(entry.chatId).toBe(42);
    expect(entry.logger).toBe("parent");
  });

  it("child logger merges fields with the parent", () => {
    const log = createLogger("app");
    const child = log.child({ chatId: 10 });
    child.info({ cmd: "/start" }, "merged");
    const entry = logs[0] as Record<string, unknown>;
    expect(entry.chatId).toBe(10);
    expect(entry.cmd).toBe("/start");
  });
});
