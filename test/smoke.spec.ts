import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs under the Workers pool", () => {
    expect(1 + 1).toBe(2);
  });
});
