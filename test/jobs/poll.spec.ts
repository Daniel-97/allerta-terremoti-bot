import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Bot } from "grammy";
import type { Db } from "@/db/types";

vi.mock("@/services/ingv/client", () => ({
  fetchIngvEvents: vi.fn(),
}));

import { fetchIngvEvents } from "@/services/ingv/client";
import { runMainCron } from "@/jobs/poll";

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
    vi.mocked(fetchIngvEvents).mockReset();
  });

  it("does not notify admins when the INGV fetch fails", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    vi.mocked(fetchIngvEvents).mockRejectedValue(abortError);

    const bot = fakeBot();
    await runMainCron(CONFIG, {} as Db, bot);

    expect(bot.api.sendMessage).not.toHaveBeenCalled();
  });
});
