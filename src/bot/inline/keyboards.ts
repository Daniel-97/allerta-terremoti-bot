import { InlineKeyboard } from "grammy";
import * as cb from "@/util/callback-data";
import { STRINGS } from "@/i18n/strings";

export function locationsListKeyboard(
  locs: { id: number; name: string }[],
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const l of locs) {
    kb.text(l.name, cb.encodeLoc(l.id)).row();
  }
  kb.text(STRINGS.posizioni.addBtn, cb.encodeNav("add"));
  return kb;
}

export function locationDetailKeyboard(
  locId: number,
): InlineKeyboard {
  return new InlineKeyboard()
    .text("📏 Raggio", cb.encodeRadiusMenu(locId))
    .text("📊 Magnitudo", cb.encodeMagnitudeMenu(locId))
    .row()
    .text("🗑 Rimuovi", cb.encodeDelete(locId))
    .row()
    .text("↩️ Indietro", cb.encodeNav("back"));
}

export function radiusPresetsKeyboard(
  locId: number,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const r of [25, 50, 75, 100, 150, 200, 300]) {
    kb.text(`${r} km`, cb.encodeRadius(locId, r));
  }
  kb.row().text("↩️ Indietro", cb.encodeLoc(locId));
  return kb;
}

export function magnitudePresetsKeyboard(
  locId: number,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const m of [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]) {
    const val = Math.round(m * 10);
    kb.text(`${m.toFixed(1)}`, cb.encodeMagnitude(locId, val));
  }
  kb.row().text("↩️ Indietro", cb.encodeLoc(locId));
  return kb;
}

export function togglesKeyboard(
  italy: boolean,
  world: boolean,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(STRINGS.impostazioni.italyLabel(italy), cb.encodeToggle("ita", !italy))
    .row()
    .text(STRINGS.impostazioni.worldLabel(world), cb.encodeToggle("wld", !world));
}

export function confirmDeleteKeyboard(
  locId: number,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(STRINGS.delete.confirmBtn, cb.encodeDeleteOk(locId))
    .text(STRINGS.delete.cancelBtn, cb.encodeNav("back"));
}
