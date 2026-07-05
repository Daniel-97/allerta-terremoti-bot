import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Bot } from "grammy";
import type { Db } from "../../src/db/types";

vi.mock("../../src/ingv/client", () => ({
  fetchItalyEvents: vi.fn(),
  fetchWorldEvents: vi.fn(),
}));

import { fetchItalyEvents, fetchWorldEvents } from "../../src/ingv/client";
import { runMainCron } from "../../src/jobs/poll";

function fakeBot() {
  return {
    api: { sendMessage: vi.fn() },
  } as unknown as Bot;
}

const CONFIG = {
  HEALTHCHECKS_URL: undefined,
  adminChatIds: [999],
  italyAlertThreshold: 5,
  worldAlertThreshold: 7,
  lookbackWindowMin: 10,
};

describe("runMainCron INGV failure handling", () => {
  beforeEach(() => {
    vi.mocked(fetchItalyEvents).mockReset();
    vi.mocked(fetchWorldEvents).mockReset();
  });

  it("does not notify admins when the INGV fetch fails", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    vi.mocked(fetchItalyEvents).mockRejectedValue(abortError);
    vi.mocked(fetchWorldEvents).mockResolvedValue([]);

    const bot = fakeBot();
    await runMainCron(CONFIG, {} as Db, bot);

    expect(bot.api.sendMessage).not.toHaveBeenCalled();
  });
});
