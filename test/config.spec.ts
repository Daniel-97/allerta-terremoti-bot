import { describe, it, expect } from "vitest";
import { loadConfig } from "@/config";

const valid = {
  BOT_TOKEN: "123:abc",
  WEBHOOK_SECRET: "s3cr3t",
  TURSO_DATABASE_URL: "libsql://example.turso.io",
  TURSO_AUTH_TOKEN: "token",
  GEONAMES_USERNAME: "testuser",
};

describe("loadConfig", () => {
  it("parses a valid env with all required fields", () => {
    const cfg = loadConfig(valid);
    expect(cfg.BOT_TOKEN).toBe("123:abc");
    expect(cfg.GEONAMES_USERNAME).toBe("testuser");
    expect(cfg.ADMIN_CHAT_IDS).toBeUndefined();
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

  it("rejects missing GEONAMES_USERNAME", () => {
    expect(() => loadConfig({ ...valid, GEONAMES_USERNAME: undefined })).toThrow();
  });

  it("parses ADMIN_CHAT_IDS as empty array when absent", () => {
    const cfg = loadConfig(valid);
    expect(cfg.adminChatIds).toEqual([]);
  });

  it("parses ADMIN_CHAT_IDS as comma-separated numbers", () => {
    const cfg = loadConfig({ ...valid, ADMIN_CHAT_IDS: "123,456,789" });
    expect(cfg.adminChatIds).toEqual([123, 456, 789]);
  });

  it("parses ADMIN_CHAT_IDS with spaces", () => {
    const cfg = loadConfig({ ...valid, ADMIN_CHAT_IDS: " 123 , 456 " });
    expect(cfg.adminChatIds).toEqual([123, 456]);
  });

  it("rejects ADMIN_CHAT_IDS with non-numeric entries", () => {
    expect(() => loadConfig({ ...valid, ADMIN_CHAT_IDS: "123,abc" })).toThrow();
  });
});
