# UX Review — allerta-terremoti-bot

> Revisione UX del bot basata sulla skill `telegram-bot-ux` (best practice su comandi, reply keyboard e inline keyboard).
> Repo analizzato: https://github.com/Daniel-97/allerta-terremoti-bot
> Ogni intervento indica: priorità, problema, file coinvolti, correzione proposta e principio della skill violato.
> Istruzioni per l'agent: applicare gli interventi in ordine di priorità (P0 → P3). Per ogni intervento, aggiornare anche i test esistenti in `test/` dove pertinente e verificare che `npm test` passi.

---

## Cosa NON toccare (già conforme alla skill)

Questi aspetti sono corretti e non vanno modificati:

- Comandi registrati via `setMyCommands` con descrizioni (`scripts/set-commands.ts`); comandi admin esclusi dal menu pubblico.
- Pannelli inline (`src/bot/inline/`) con navigazione via `editPanel` (edit in place, niente messaggi duplicati).
- `callback_data` come mini-protocollo encode/decode con prefissi (`src/util/callback-data.ts`), con test.
- Conferma di eliminazione posizione (✅/❌) e ritorno alla lista dopo l'azione.
- Toggle Italia/Mondo con feedback via `answerCallbackQuery` + edit del pannello.
- `answerCallbackQuery()` catch-all a fine `handleCallbackQuery` (niente spinner infiniti).
- Gestione callback stale sul dettaglio posizione ("Posizione non trovata").
- Fallback per testo non riconosciuto con hint verso /aiuto.

---

## P0 — Bug funzionale: `/start` non riattiva un utente dopo `/stop`

**Problema.** Il messaggio di `/stop` (`STRINGS.stop.done`) promette: "Per riattivare, invia /start". Ma nessun percorso di codice riporta lo status a `active`:
- `src/bot/commands/stop.ts` imposta `status = "stopped"`.
- `src/bot/commands/start.ts` non chiama mai `setChatStatus`.
- `touchChat` (`src/db/repositories/chats.ts`) in `onConflictDoUpdate` aggiorna solo `last_seen_at` e dati anagrafici, **non** lo status.

Risultato: l'utente crede di essersi riattivato ma resta `stopped` e non riceve più notifiche.

**Correzione.**
1. In `start.handle` (`src/bot/commands/start.ts`): chiamare `setChatStatus(db, ctx.chat!.id, "active")` prima della reply di benvenuto. Nota: l'handler attualmente riceve `_db: unknown` — tipizzarlo come `Db` e usarlo.
2. Decidere il comportamento per status `blocked` (utente che ha bloccato e poi sbloccato il bot): consigliato riattivare anche in quel caso, dato che se l'utente scrive /start il bot è evidentemente sbloccato.
3. Aggiungere un test: chat con status `stopped` → `/start` → status `active`.

**Skill:** sezione 2, regola 2 — "`/start` deve essere idempotente e riparatore: deve sempre ripristinare lo stato iniziale". Qui lo "stato" include lo status di attivazione, non solo la UI.

---

## P1 — Flusso "aggiungi posizione": usare `request_location` invece del solo menu allegati

**Problema.** `STRINGS.posizioni.addPrompt` e `STRINGS.posizioni.empty` istruiscono l'utente a usare "📎 → Posizione" (menu allegati), un percorso poco scopribile. La skill indica che la reply keyboard con `request_location` è **l'unico modo** per richiedere la posizione con un pulsante (solo chat private — vincolo già soddisfatto: il bot ha un middleware private-only in `src/bot/bot.ts`).

**Correzione.**
1. Nel handler della callback `nav:add` (`src/bot/inline/router.ts`, case `"nav"` con `target === "add"`) e nel pannello "posizioni vuote": inviare il prompt con una reply keyboard:
   ```ts
   reply_markup: {
     keyboard: [[{ text: "📍 Invia la mia posizione attuale", request_location: true }]],
     resize_keyboard: true,
     one_time_keyboard: true,
     input_field_placeholder: "Oppure 📎 → Posizione per scegliere sulla mappa",
   }
   ```
2. Mantenere nel testo l'alternativa "📎 → Posizione" spiegando la differenza: il pulsante invia la posizione GPS **attuale**; il menu allegati permette di **scegliere un punto sulla mappa** (es. la casa di un familiare).
3. In `handleLocation` (`src/bot/location-intake.ts`): dopo l'esito (successo o errore), rimuovere la keyboard con `reply_markup: { remove_keyboard: true }` sulla reply — sostituisce l'attuale `remove_keyboard` sparso in `nav:add`.
4. Prevedere una via d'uscita dal flusso: se l'utente invia altro testo mentre la keyboard è visibile, il fallback "testo non riconosciuto" deve comunque rimuovere la keyboard o lasciarla one_time fare il suo lavoro.

**Skill:** sezione 3 ("unico modo per richiedere la posizione"), sezione 6 (albero decisionale: "Serve telefono/posizione? → REPLY KEYBOARD con request_location"), parametri `one_time_keyboard`, `input_field_placeholder`, `ReplyKeyboardRemove`.

---

## P1 — Supportare i comandi standard Telegram `/help` e `/settings` per gli utenti

**Problema.** Telegram richiede a tutti i bot di supportare `/start`, `/help` e `/settings`. In `src/bot/bot.ts`, `/help` è riservato agli admin: un utente normale che digita `/help` riceve "Non ho capito" (`STRINGS.unknownCommand.hint`). `/settings` non esiste affatto.

**Correzione.**
1. `/help`: per i non-admin, invocare lo stesso handler di `/aiuto` (`aiuto.handle`); per gli admin mantenere l'help amministrativo attuale.
2. `/settings`: registrare `bot.command("settings", ...)` come alias che invoca `impostazioni.handle`.
3. NON aggiungere questi alias al menu di `set-commands.ts` (il menu resta in italiano); devono solo rispondere se digitati.
4. Regola generale (skill, sezione 5, principio 4): un handler, più trigger — niente logica duplicata, gli alias richiamano gli handler esistenti.

**Skill:** sezione 2, "Comandi obbligatori (richiesti da Telegram)".

---

## P2 — Notifica di prossimità: aggiungere il pulsante contestuale per le soglie

**Problema.** La keyboard delle notifiche (`buildKeyboard` in `src/notify/compose.ts`) contiene solo il pulsante URL "📡 INGV". Il momento in cui l'utente vuole regolare raggio/magnitudo è esattamente quando riceve una notifica di troppo: oggi deve ricordarsi di `/posizioni` e rinavigare.

**Correzione.**
1. Solo per le notifiche di **prossimità** (`composeProximity`): aggiungere alla keyboard un pulsante `⚙️ Soglie per {locName}` con callback `encodeLoc(locId)` — riusa il pannello dettaglio posizione già esistente e il router attuale senza nuova logica.
2. Serve passare `locId` a `composeProximity` (oggi riceve solo `locName` e `distanceKm`): propagarlo da `src/notify/deliver.ts` / `match.ts`.
3. NON aggiungere il pulsante alle notifiche generali/mondiali (nessuna posizione associata; evitare clutter).
4. Attenzione callback stale: se la posizione è stata rimossa nel frattempo, il router già risponde "Posizione non trovata" — comportamento corretto, nessuna modifica necessaria.

**Skill:** sezione 4, "Quando usarla: azioni su un elemento specifico"; sezione 1, principio dei livelli (l'inline button vive sul messaggio a cui si riferisce).

---

## P2 — Valutare una reply keyboard principale persistente

**Problema.** Il bot non ha alcuna reply keyboard. È una scelta difendibile per un bot notification-driven, ma l'utente tipo configura il bot una volta e ci torna dopo mesi, quando non ricorda più i comandi.

**Correzione (opzionale ma consigliata — decisione finale al maintainer).**
1. In `start.handle`: inviare il benvenuto con reply keyboard `[📍 Posizioni] [⚙️ Impostazioni] [❓ Aiuto]`, `resize_keyboard: true`, `is_persistent: true`.
2. Aggiungere tre `bot.hears("📍 Posizioni", ...)` ecc. in `src/bot/bot.ts` che invocano gli **stessi handler** dei comandi (`posizioni.handle`, `impostazioni.handle`, `aiuto.handle`). Le etichette dei pulsanti sono costanti condivise in `src/i18n/strings.ts` (etichetta = payload: se cambia l'etichetta deve cambiare anche l'`hears`).
3. `/start` re-invia sempre la keyboard (ancora di salvezza se persa).
4. Coordinamento con l'intervento P1 `request_location`: quella keyboard è temporanea (one_time); al termine del flusso posizione, re-inviare la keyboard principale invece del solo `remove_keyboard`.
5. Registrare i nuovi `hears` PRIMA del fallback `message:text`, altrimenti verrebbero intercettati come testo sconosciuto.

**Skill:** sezione 3 ("menu principale con 3–6 azioni frequenti"), sezione 5 (nessuna corrispondenza 1:1 richiesta: niente pulsante Start, /stop e /credits restano solo comandi), sezione 2 regola 2.

---

## P3 — Feedback su `deleteOk` con posizione già rimossa

**Problema.** In `src/bot/inline/router.ts`, case `"deleteOk"`: se la posizione non esiste più (doppio tap, messaggio vecchio), non succede nulla di visibile (solo l'answer vuoto finale).

**Correzione.** Aggiungere il ramo else: `answerCallbackQuery({ text: "Posizione già rimossa" })` e refresh della lista con `editPanel(renderLocationsList(...))`.

**Skill:** sezione 4, regola 4 — gestire le callback su messaggi obsoleti con feedback.

---

## P3 — Parse mode: `**bold**` non è Markdown legacy valido

**Problema.** Il bot usa `parse_mode: "Markdown"` (legacy), ma `STRINGS.start.welcome` contiene `**tutti**` e `**di default**`. Il Markdown legacy di Telegram usa l'asterisco **singolo** per il grassetto: i doppi asterischi producono una resa errata/imprevedibile.

**Correzione.** Opzione minima: sostituire `**testo**` con `*testo*` in `src/i18n/strings.ts`. Opzione robusta (preferita): migrare tutte le reply a `parse_mode: "HTML"` (nessun escaping fragile sui nomi di comuni con caratteri speciali, che oggi finiscono dentro `*${name}*` in più punti — potenziale rottura del parsing con nomi contenenti `*` o `_`).

**Skill:** non è una regola esplicita della skill, ma rientra in "verificare i dettagli API sulle fonti ufficiali, non inventare comportamenti".

---

## P3 — Codice morto: case `evDetail`

**Problema.** Il case `"evDetail"` in `src/bot/inline/router.ts` (e `encodeEvDetail` in `callback-data.ts`) non è referenziato da nessuna keyboard: nessun pulsante lo genera. Inoltre, se riattivato, invia un **nuovo messaggio** invece di editare.

**Correzione.** Due opzioni:
- Rimuovere il case e l'encoder (con relativi test), oppure
- Riattivarlo agganciandolo alla notifica (pulsante "🔎 Dettagli") — in tal caso va bene la reply come nuovo messaggio SOLO se si vuole preservare la notifica originale; altrimenti preferire l'edit. Se riattivato, valutare insieme all'intervento P2 sulla notifica per non superare 2 pulsanti per riga.

**Skill:** sezione 8, anti-pattern "inviare un nuovo messaggio invece di editare"; igiene generale del router.

---

## Ordine di esecuzione consigliato per l'agent

1. **P0** riattivazione `/start` (bug, con test)
2. **P1** alias `/help` e `/settings` (piccolo, indipendente)
3. **P1** `request_location` nel flusso aggiungi posizione
4. **P2** pulsante soglie sulla notifica di prossimità
5. **P2** reply keyboard principale (chiedere conferma al maintainer prima di implementare; se approvata, integrarla col punto 3)
6. **P3** i tre interventi minori

Al termine: eseguire la checklist della skill (sezione 7) sull'intero bot e riportare eventuali punti ancora aperti.