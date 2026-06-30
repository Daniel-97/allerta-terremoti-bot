import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config";

const valid = {
  BOT_TOKEN: "123:abc",
  WEBHOOK_SECRET: "s3cr3t",
  TURSO_DATABASE_URL: "libsql://example.turso.io",
  TURSO_AUTH_TOKEN: "token",
};

describe("loadConfig", () => {
  it("parses a valid env with turso", () => {
    const cfg = loadConfig(valid);
    expect(cfg.BOT_TOKEN).toBe("123:abc");
    expect(cfg.TURSO_DATABASE_URL).toBe("libsql://example.turso.io");
    expect(cfg.GEONAMES_USERNAME).toBeUndefined();
  });

  it("rejects missing BOT_TOKEN", () => {
    expect(() => loadConfig({ ...valid, BOT_TOKEN: undefined })).toThrow();
  });

  it("rejects missing WEBHOOK_SECRET", () => {
    expect(() => loadConfig({ ...valid, WEBHOOK_SECRET: undefined })).toThrow();
  });

  it("rejects missing TURSO_DATABASE_URL", () => {
    expect(() => loadConfig({ ...valid, TURSO_DATABASE_URL: undefined })).toThrow();
  });

  it("rejects missing TURSO_AUTH_TOKEN", () => {
    expect(() => loadConfig({ ...valid, TURSO_AUTH_TOKEN: undefined })).toThrow();
  });
});
