import { STRINGS } from "@/i18n/strings";

export const mainMenuReplyMarkup = {
  keyboard: [[STRINGS.mainMenu.posizioni, STRINGS.mainMenu.impostazioni, STRINGS.mainMenu.aiuto]],
  resize_keyboard: true,
  is_persistent: true,
} as const;
