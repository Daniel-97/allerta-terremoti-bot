import { describe, it, expect, vi } from "vitest";
import { GrammyError } from "grammy";
import type { Context } from "grammy";
import { editPanel, type Panel } from "@/bot/inline/panels";
import { InlineKeyboard } from "grammy";

function fakeCtx(editMessageTextImpl: () => Promise<unknown>) {
  const editMessageText = vi.fn(editMessageTextImpl);
  const reply = vi.fn().mockResolvedValue(undefined);
  const ctx = { editMessageText, reply } as unknown as Context;
  return { ctx, editMessageText, reply };
}

const PANEL: Panel = { text: "hello", keyboard: new InlineKeyboard() };

function noTextError(): GrammyError {
  return new GrammyError(
    "Call to 'editMessageText' failed!",
    {
      ok: false,
      error_code: 400,
      description: "Bad Request: there is no text in the message to edit",
    },
    "editMessageText",
    {},
  );
}

function notModifiedError(): GrammyError {
  return new GrammyError(
    "Call to 'editMessageText' failed!",
    { ok: false, error_code: 400, description: "Bad Request: message is not modified" },
    "editMessageText",
    {},
  );
}

describe("editPanel", () => {
  it("edits the message text when editing succeeds", async () => {
    const { ctx, editMessageText, reply } = fakeCtx(() => Promise.resolve(true));
    await editPanel(ctx, PANEL);
    expect(editMessageText).toHaveBeenCalledWith(PANEL.text, {
      reply_markup: PANEL.keyboard,
      parse_mode: "HTML",
    });
    expect(reply).not.toHaveBeenCalled();
  });

  it("falls back to a new reply when the source message has no text to edit (e.g. a photo caption)", async () => {
    const { ctx, reply } = fakeCtx(() => Promise.reject(noTextError()));
    await editPanel(ctx, PANEL);
    expect(reply).toHaveBeenCalledWith(PANEL.text, {
      reply_markup: PANEL.keyboard,
      parse_mode: "HTML",
    });
  });

  it("does not send a duplicate reply when Telegram reports the message is not modified", async () => {
    const { ctx, reply } = fakeCtx(() => Promise.reject(notModifiedError()));
    await editPanel(ctx, PANEL);
    expect(reply).not.toHaveBeenCalled();
  });
});
