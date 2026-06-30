import type { Context } from "grammy";
import type { InlineKeyboard } from "grammy";
import { STRINGS } from "../../i18n/strings";
import * as kb from "./keyboards";

export interface Panel {
  text: string;
  keyboard: InlineKeyboard;
}

export function renderLocationsList(
  locs: { id: number; name: string }[],
): Panel {
  if (locs.length === 0) {
    return { text: STRINGS.posizioni.empty, keyboard: kb.locationsListKeyboard([]) };
  }
  const lines = locs.map((l) => `📍 ${l.name}`);
  const text = `${STRINGS.posizioni.listHeader}\n\n${lines.join("\n")}`;
  return { text, keyboard: kb.locationsListKeyboard(locs) };
}

export function renderLocationDetail(
  name: string,
  radius: number,
  magnitude: number,
  locId: number,
): Panel {
  const text =
    `${STRINGS.posizioni.detailHeader(name)}\n\n` +
    `📏 Raggio: ${radius} km\n` +
    `📊 Magnitudo minima: ${magnitude.toFixed(1)}`;
  return { text, keyboard: kb.locationDetailKeyboard(locId) };
}

export function renderRadiusPresets(locId: number): Panel {
  return {
    text: STRINGS.impostazioni.radiusTitle("Posizione"),
    keyboard: kb.radiusPresetsKeyboard(locId),
  };
}

export function renderMagnitudePresets(locId: number): Panel {
  return {
    text: STRINGS.impostazioni.magnitudeTitle("Posizione"),
    keyboard: kb.magnitudePresetsKeyboard(locId),
  };
}

export function renderSettings(
  italy: boolean,
  world: boolean,
): Panel {
  return {
    text: STRINGS.impostazioni.title,
    keyboard: kb.togglesKeyboard(italy, world),
  };
}

export function renderConfirmDelete(name: string, locId: number): Panel {
  return {
    text: STRINGS.delete.confirm(name),
    keyboard: kb.confirmDeleteKeyboard(locId),
  };
}

export async function editPanel(ctx: Context, panel: Panel): Promise<void> {
  try {
    await ctx.editMessageText(panel.text, {
      reply_markup: panel.keyboard,
      parse_mode: "Markdown",
    });
  } catch {
    // "message is not modified" when same content — silently ignored
  }
}

export async function replyPanel(ctx: Context, panel: Panel): Promise<void> {
  await ctx.reply(panel.text, {
    reply_markup: panel.keyboard,
    parse_mode: "Markdown",
  });
}
