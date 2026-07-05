import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "grammy";
import { handleCallbackQuery } from "@/bot/inline/router";
import { encodeEventMap } from "@/util/callback-data";
import { STRINGS } from "@/i18n/strings";
import { formatTime } from "@/notify/compose";
import type { Db } from "@/db/types";

vi.mock("@/db/repositories/history", () => ({
  getEvent: vi.fn(),
}));

import { getEvent } from "@/db/repositories/history";

function fakeCtx(data: string) {
  return {
    callbackQuery: {
      data,
      message: { chat: { id: 1 } },
      from: { id: 1, first_name: "U", username: "u" },
    },
    answerCallbackQuery: vi.fn(),
    replyWithVenue: vi.fn(),
  } as unknown as Context;
}

describe("handleCallbackQuery evMap", () => {
  beforeEach(() => {
    vi.mocked(getEvent).mockReset();
  });

  it("replies with a venue including title and address when the event exists", async () => {
    vi.mocked(getEvent).mockResolvedValue({
      id: "ev1", zone: "Roma", date: "2026-06-30T12:00:00Z",
      lat: 41.9, lon: 12.5, depth: 10, stations_count: 5,
      magnitude_type: "ML", magnitude_value: 4.2, magnitude_uncertainty: 0.3,
    } as never);

    const ctx = fakeCtx(encodeEventMap("ev1"));
    await handleCallbackQuery(ctx, {} as Db);

    expect(ctx.replyWithVenue).toHaveBeenCalledWith(
      41.9, 12.5,
      "⚠️ M4.2 - Roma",
      `prof. 10.0 km, ${formatTime("2026-06-30T12:00:00Z")}`,
    );
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("answers with notAvailable text when the event is missing", async () => {
    vi.mocked(getEvent).mockResolvedValue(undefined);

    const ctx = fakeCtx(encodeEventMap("missing"));
    await handleCallbackQuery(ctx, {} as Db);

    expect(ctx.replyWithVenue).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: STRINGS.eventMap.notAvailable });
  });
});
