# allerta-terremoti-bot

Bot Telegram che invia **allerte sismiche in tempo reale** agli utenti in base alle
posizioni che hanno salvato. I dati sismici arrivano dall'[**INGV**](https://terremoti.ingv.it/)
(Istituto Nazionale di Geofisica e Vulcanologia) ([come funziona](https://terremoti.ingv.it/help)).

<p align="center">
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://t.me/allerta_terremoti_bot" alt="QR Code del bot" />
</p>

<p align="center">👉 <a href="https://t.me/allerta_terremoti_bot">https://t.me/allerta_terremoti_bot</a></p>

---

Il progetto si ispira a [terremotibot](https://github.com/botfactoryit/terremotibot).

> ⚠️ **Disclaimer**: questo è un progetto indipendente, non ufficiale e non affiliato,
> sponsorizzato o approvato dall'INGV (Istituto Nazionale di Geofisica e Vulcanologia). I
> dati sismici sono ricavati dai servizi pubblici INGV, ma il bot non ha alcun legame con
> l'ente.

---

## Come funziona

1. **Avvia** il bot con `/start`.
2. **Aggiungi una posizione** condividendo una posizione Telegram dal menu allegati
   (📎 → Posizione). Il bot la converte in un nome `Comune (PROV)` e la salva.
3. **Configura** le soglie per ogni posizione da `/impostazioni`:
   - **Raggio** — a quanti km dall'epicentro vuoi essere avvisato per quella posizione
     (default 100 km, massimo 300 km).
   - **Magnitudo minima** — magnitudo minima per essere avvisato su quella posizione
     (default 2.0).
   - **Allerte nazionali** (interruttore globale, attivo di default) — ricevi sempre i
     grandi eventi in Italia (≥ M5.0), indipendentemente dalle posizioni salvate.
   - **Allerte mondiali** (interruttore globale, disattivo di default) — ricevi i grandi
     eventi in qualsiasi parte del mondo (≥ M7.0).
4. **Ricevi le allerte.** Quando l'INGV pubblica un nuovo evento, ogni utente con una
   posizione compatibile (entro il raggio e con magnitudo pari o superiore alla propria
   soglia) riceve un messaggio di testo. Se un utente è idoneo per più regole, riceve un
   solo messaggio.

Tutta l'interazione avviene tramite **pulsanti** (tastiere inline). L'unico input libero è
la condivisione della posizione.

### Comandi disponibili

| Comando         | Descrizione                                                                      |
| --------------- | -------------------------------------------------------------------------------- |
| `/start`        | Messaggio di benvenuto, invita a condividere la prima posizione                  |
| `/aiuto`        | Spiega come funziona il bot                                                      |
| `/posizioni`    | Elenca e gestisce le posizioni salvate                                           |
| `/impostazioni` | Apre il pannello impostazioni (raggio, magnitudo, allerte nazionali/mondiali)    |
| `/stop`         | Disattiva le notifiche. I dati e le posizioni salvate **non** vengono cancellati |
| `/credits`      | Fonti dei dati, autore e link utili                                              |

---

## Fonti dei dati

| Fonte                    | Uso                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------- |
| **INGV** (servizio FDSN) | Unica fonte degli eventi sismici, interrogata periodicamente                           |
| **GeoNames**             | Geocoding inverso delle sole posizioni salvate dagli utenti (coordinate → nome comune) |
| **Telegram Bot API**     | Ricezione messaggi e invio delle allerte                                               |

> **Copertura INGV**: magnitudo ≥ 2.5 in Italia, ≥ 5.0 nel Mediterraneo, ≥ 6.0 nel resto del
> mondo. Le allerte mondiali sono quindi affidabili solo da M6.0 in su (la soglia di default
> è M7.0).

---

## Comandi e notifiche amministrative

Riservati agli amministratori (chat ID elencati in `ADMIN_CHAT_IDS`). Non compaiono nel
menu comandi pubblico e vengono ignorati silenziosamente se usati da altri utenti.

| Comando                  | Descrizione                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `/broadcast <messaggio>` | Invia un messaggio di testo a tutti gli utenti attivi                                |
| `/stats`                 | Statistiche operative: utenti, posizioni, ultimo evento processato                   |
| `/events`                | Ultimi ~10 eventi sismici processati con relativo ID                                 |
| `/delivery <event_id>`   | Stato di invio di un evento (consegnati / falliti)                                   |
| `/health`                | Verifica la raggiungibilità dei servizi esterni (Telegram, INGV, GeoNames, database) |

Il bot invia inoltre notifiche push automatiche agli admin per: nuovo utente, riepilogo
invii dopo un evento sismico, utente che disattiva le notifiche con `/stop`.

---

## Variabili d'ambiente

| Variabile                   | Obbligatoria | Default | Descrizione                                                                                    |
| --------------------------- | ------------ | ------- | ---------------------------------------------------------------------------------------------- |
| `BOT_TOKEN`                 | sì           | —       | Token del bot Telegram (rilasciato da [@BotFather](https://t.me/BotFather))                    |
| `WEBHOOK_SECRET`            | sì           | —       | Segreto usato per verificare che le richieste webhook arrivino davvero da Telegram             |
| `TURSO_DATABASE_URL`        | sì           | —       | URL di connessione al database                                                                 |
| `TURSO_AUTH_TOKEN`          | sì           | —       | Token di autenticazione al database                                                            |
| `GEONAMES_USERNAME`         | sì           | —       | Username GeoNames per il geocoding inverso delle posizioni                                     |
| `ADMIN_CHAT_IDS`            | no           | nessuno | Chat ID Telegram (separati da virgola) abilitati ai comandi amministrativi                     |
| `HEALTHCHECKS_URL`          | no           | nessuno | URL di monitoraggio esterno, pingato a ogni ciclo di controllo per segnalare che il bot è vivo |
| `MAX_ATTEMPTS`              | no           | `3`     | Numero massimo di tentativi di invio in caso di errore temporaneo                              |
| `ITALY_ALERT_THRESHOLD`     | no           | `5.0`   | Magnitudo minima per le allerte nazionali                                                      |
| `WORLD_ALERT_THRESHOLD`     | no           | `7.0`   | Magnitudo minima per le allerte mondiali                                                       |
| `MAX_LOCATIONS_PER_USER`    | no           | `10`    | Numero massimo di posizioni salvabili per utente                                               |
| `LOOKBACK_WINDOW_MIN`       | no           | `60`    | Finestra temporale (minuti) usata per interrogare l'INGV alla ricerca di nuovi eventi          |
| `DELIVERIES_RETENTION_DAYS` | no           | `90`    | Giorni di conservazione dello storico invii prima della pulizia automatica                     |
| `EVENTS_RETENTION_DAYS`     | no           | `365`   | Giorni di conservazione degli eventi sismici prima della pulizia automatica                    |

---

## Test in locale

Prerequisiti: Node.js, un account Cloudflare, un database Turso, un token bot Telegram
(da [@BotFather](https://t.me/BotFather)) e uno username GeoNames gratuito.

1. **Installa le dipendenze**
   ```bash
   npm install
   ```
2. **Crea lo schema del database**
   ```bash
   npm run db:apply
   ```
3. **Configura le variabili locali** in `.dev.vars` (vedi `.dev.vars.example`).
4. **Avvia il bot** con una delle due modalità:

   **Opzione A — Polling (Telegram reale, nessun tunnel)**

   Esegue il bot come processo Node in polling, bypassando webhook e Worker.

   ```bash
   npm run start-polling
   ```

   Riceve aggiornamenti reali da Telegram. `Ctrl+C` per fermarlo.

   **Opzione B — Simulazione contro `wrangler dev`**

   Avvia il Worker in locale ed esegue una richiesta `/start` simulata via HTTP.

   ```bash
   npx wrangler dev
   # in un altro terminale
   npm run simulate
   ```

   Telegram non riceve la risposta, ma log e database confermano che la pipeline
   funziona (verifica del secret, database, middleware, handler).

5. **Esegui i controlli**
   ```bash
   npm run lint && npm run typecheck && npm test
   ```

---

## Deploy su Cloudflare

### Deploy automatico (GitHub Actions)

Ogni push su `main` esegue [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
che installa le dipendenze e pubblica il Worker su Cloudflare, sincronizzando anche i
secret `BOT_TOKEN`, `WEBHOOK_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
`GEONAMES_USERNAME`, `ADMIN_CHAT_IDS`. Può essere avviato anche manualmente dalla tab
**Actions** (`workflow_dispatch`).

Le variabili opzionali (`HEALTHCHECKS_URL`, `MAX_ATTEMPTS`, `ITALY_ALERT_THRESHOLD`,
`WORLD_ALERT_THRESHOLD`, `MAX_LOCATIONS_PER_USER`, `LOOKBACK_WINDOW_MIN`,
`DELIVERIES_RETENTION_DAYS`, `EVENTS_RETENTION_DAYS`) vengono sincronizzate automaticamente
**se** esiste un secret GitHub con lo stesso nome; in caso contrario lo step per quella
variabile viene semplicemente saltato, lasciando il default (o un eventuale valore già
impostato a mano su Cloudflare).

I cron trigger (poll principale, retry, pulizia) sono configurati in `wrangler.jsonc` e
vengono pubblicati insieme al Worker.

### Deploy manuale

```bash
npx wrangler deploy

wrangler secret put BOT_TOKEN
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put GEONAMES_USERNAME
wrangler secret put WEBHOOK_SECRET
wrangler secret put HEALTHCHECKS_URL  # opzionale

# eventuali tunable opzionali, solo se vuoi cambiare i default:
# wrangler secret put MAX_ATTEMPTS
# wrangler secret put ITALY_ALERT_THRESHOLD
# wrangler secret put WORLD_ALERT_THRESHOLD
# wrangler secret put MAX_LOCATIONS_PER_USER
# wrangler secret put LOOKBACK_WINDOW_MIN
# wrangler secret put DELIVERIES_RETENTION_DAYS
# wrangler secret put EVENTS_RETENTION_DAYS
```

### Registrazione del webhook Telegram

Passo una tantum (da ripetere solo se cambia l'URL del Worker o `WEBHOOK_SECRET`), non
gestito automaticamente dal workflow:

```bash
npm run set-webhook -- set https://<worker-url>
npm run set-webhook -- info
npm run set-webhook -- delete
```
