import { describe, it, expect } from "vitest";
import { formatNewUserMessage, formatUserStopMessage } from "@/notify/admin";

describe("formatNewUserMessage", () => {
  it("formats first and last name", () => {
    const msg = formatNewUserMessage(
      { id: 1, first_name: "Ada", last_name: "Lovelace", username: "ada" },
      "2026-07-14 10:00",
    );
    expect(msg).toBe(
      "🆕 <b>New user</b>\nID: <code>1</code>\nName: Ada Lovelace\nUser: @ada\nTime: 2026-07-14 10:00",
    );
  });

  it("falls back to '?' for name and 'no username' when absent", () => {
    const msg = formatNewUserMessage(
      { id: 2, first_name: null, last_name: null, username: null },
      "2026-07-14 10:00",
    );
    expect(msg).toContain("Name: ?");
    expect(msg).toContain("User: no username");
  });

  it("escapes HTML-sensitive characters in first_name", () => {
    const msg = formatNewUserMessage(
      { id: 3, first_name: "<script>", last_name: null, username: null },
      "2026-07-14 10:00",
    );
    expect(msg).toContain("Name: &lt;script&gt;");
  });

  it("escapes HTML-sensitive characters in username", () => {
    const msg = formatNewUserMessage(
      { id: 4, first_name: "Bo", last_name: null, username: "a&b" },
      "2026-07-14 10:00",
    );
    expect(msg).toContain("User: @a&amp;b");
  });
});

describe("formatUserStopMessage", () => {
  it("formats the chat id and timestamp", () => {
    expect(formatUserStopMessage(5, "2026-07-14 10:00")).toBe(
      "🚫 <b>User left</b>\nID: <code>5</code>\nTime: 2026-07-14 10:00",
    );
  });
});
