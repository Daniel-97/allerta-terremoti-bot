import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/util/html";

describe("escapeHtml", () => {
  it("escapes ampersands, less-than and greater-than", () => {
    expect(escapeHtml("A & B <script> tag")).toBe("A &amp; B &lt;script&gt; tag");
  });

  it("escapes ampersand before other entities to avoid double-escaping", () => {
    expect(escapeHtml("<b>")).toBe("&lt;b&gt;");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("Roma (RM)")).toBe("Roma (RM)");
  });

  it("handles an empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});
