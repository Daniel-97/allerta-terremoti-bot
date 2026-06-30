import { describe, it, expect } from "vitest";
import { verifySecretToken } from "../src/webhook";

describe("verifySecretToken", () => {
  const req = (token: string | null) =>
    new Request("https://bot/webhook", {
      headers: token === null ? {} : { "X-Telegram-Bot-Api-Secret-Token": token },
    });

  it("accepts the matching token", () => {
    expect(verifySecretToken(req("s3cr3t"), "s3cr3t")).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(verifySecretToken(req("nope"), "s3cr3t")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifySecretToken(req(null), "s3cr3t")).toBe(false);
  });
});
