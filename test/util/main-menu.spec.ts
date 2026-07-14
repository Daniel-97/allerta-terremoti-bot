import { describe, it, expect } from "vitest";
import { mainMenuReplyMarkup } from "@/bot/main-menu";
import { STRINGS } from "@/i18n/strings";

describe("mainMenuReplyMarkup", () => {
  it("has one row with the three main-menu labels, in order", () => {
    expect(mainMenuReplyMarkup.keyboard).toEqual([
      [STRINGS.mainMenu.posizioni, STRINGS.mainMenu.impostazioni, STRINGS.mainMenu.aiuto],
    ]);
  });

  it("resizes and persists", () => {
    expect(mainMenuReplyMarkup.resize_keyboard).toBe(true);
    expect(mainMenuReplyMarkup.is_persistent).toBe(true);
  });
});
