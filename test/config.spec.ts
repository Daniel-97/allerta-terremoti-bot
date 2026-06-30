import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("parses a valid minimal M0 env", () => {
    const cfg = loadConfig({ BOT_TOKEN: "123:abc", WEBHOOK_SECRET: "s3cr3t" });
    expect(cfg.BOT_TOKEN).toBe("123:abc");
    expect(cfg.WEBHOOK_SECRET).toBe("s3cr3t");
    expect(cfg.TURSO_DATABASE_URL).toBeUndefined();
  });

  it("rejects missing BOT_TOKEN", () => {
    expect(() => loadConfig({ WEBHOOK_SECRET: "x" })).toThrow();
  });

  it("rejects missing WEBHOOK_SECRET", () => {
    expect(() => loadConfig({ BOT_TOKEN: "x" })).toThrow();
  });
});
