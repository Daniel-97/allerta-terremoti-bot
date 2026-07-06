export const STRINGS = {
  start: {
    welcome:
      "👋 *Allerta Terremoti (INGV)*\n\n" +
      "Riceverai le allerte nazionali per **tutti** gli eventi sismici rilevanti (M ≥ 5.0) " +
      "che avvengono sul territorio italiano, indipendentemente dalle posizioni che hai salvato.\n\n" +
      "Questa funzione è attiva **di default**.\n\n" +
      "Per le allerte di prossimità (eventi vicini alle tue posizioni), aggiungi una o più posizioni con /posizioni.\n" +
      "Per le allerte mondiali (M ≥ 7.0), attivale in /impostazioni.",
  },
  aiuto: {
    body:
      "🤖 *Allerta Terremoti (INGV)*\n\n" +
      "• /start — Avvia il bot\n" +
      "• /aiuto — Questo messaggio\n" +
      "• /posizioni — Aggiungi, visualizza o rimuovi posizioni\n" +
      "• /impostazioni — Modifica raggio, magnitudo e preferenze globali\n" +
      "• /stop — Disattiva il tuo account\n" +
      "• /credits — Fonti e crediti\n\n" +
      "Le allerte nazionali sono attive di default.\n" +
      "Le allerte mondiali sono disattive (opt-in da /impostazioni).",
  },
  posizioni: {
    empty:
      "Non hai ancora posizioni salvate.\n\n" +
      "Premi il pulsante *Condividi posizione* per aggiungerne una.",
    addBtn: "➕ Aggiungi posizione",
    listHeader: "Le tue posizioni:",
    detailHeader: (name: string) => `📍 *${name}*`,
    cap:
      "Hai raggiunto il limite di 10 posizioni.\n" +
      "Rimuovine una prima di aggiungerne nuove.",
    duplicate:
      "Hai già una posizione in questo comune.\n" +
      "Ogni comune può essere salvato una sola volta.",
    outOfArea:
      "Posizione fuori dall'area ammessa.\n" +
      "Sono accettate solo posizioni in Italia, San Marino, Austria e Svizzera.",
    geocodingFail:
      "Non riesco a determinare il comune. Riprova.",
    added: (name: string) => `✅ Posizione *${name}* aggiunta.`,
    removed: (name: string) => `🗑 Posizione *${name}* rimossa.`,
  },
  impostazioni: {
    title: "⚙️ *Impostazioni*",
    radiusTitle: (name: string) => `📏 *Raggio — ${name}*`,
    magnitudeTitle: (name: string) => `📊 *Magnitudo — ${name}*`,
    italyLabel: (on: boolean) => (on ? "✅ Italia: ON" : "⬜ Italia: OFF"),
    worldLabel: (on: boolean) => (on ? "✅ Mondo: ON" : "⬜ Mondo: OFF"),
  },
  toggles: {
    italyOn: "Le allerte nazionali sono ora *attive*.",
    italyOff: "Le allerte nazionali sono ora *disattive*.",
    worldOn: "Le allerte mondiali sono ora *attive*.",
    worldOff: "Le allerte mondiali sono ora *disattive*.",
  },
  delete: {
    confirm: (name: string) =>
      `Confermi di voler rimuovere *${name}*?`,
    confirmBtn: "✅ Conferma",
    cancelBtn: "❌ Annulla",
  },
  stop: {
    done:
      "Notifiche disattivate. I tuoi dati sono conservati.\n" +
      "Per riattivare, invia /start.",
  },
  credits: {
    body:
      "📡 *Fonti dati*\n" +
      "INGV - Istituto Nazionale di Geofisica e Vulcanologia\n" +
      "https://webservices.ingv.it/\n\n" +
      "🤖 *Autore*\n" +
      "@Daniel-97\n\n" +
      "💡 *Codice sorgente*\n" +
      "https://github.com/Daniel-97/allerta-terremoti-bot",
  },
  unknownCommand: {
    hint:
      "Non ho capito.\n" +
      "Usa /aiuto per vedere i comandi disponibili.",
  },
  errors: {
    generic:
      "Si è verificato un errore. Riprova più tardi.",
  },
  locationLimitReached:
    "Hai raggiunto il limite massimo di posizioni.",
  eventDetail: {
    title: "🔍 *Dettagli evento*",
    notAvailable: "Dettagli non più disponibili.",
    source: "_Fonte: INGV_",
  },
} as const;

export const ADMIN = {
  broadcast: {
    empty: "❌ Message cannot be empty.",
    tooLong: (len: number) => `❌ Message too long (${len} chars). Max 4096.`,
    sent: (sent: number, total: number) =>
      `📨 Broadcast sent to ${sent}/${total} active users.`,
  },
  stats: {
    title: "📊 *Bot Statistics*",
    users: (total: number, active: number, stopped: number, blocked: number, deleted: number) =>
      `👤 *Users*\n` +
      `Total: ${total}\n` +
      `Active: ${active}\n` +
      `Stopped: ${stopped}\n` +
      `Blocked: ${blocked}\n` +
      `Deleted: ${deleted}`,
    locations: (count: number) => `📍 Total locations: ${count}`,
    lastEvent: (id: string | null, zone: string | null, mag: number | null, date: string | null) =>
      id
        ? `📅 Last event: *${mag != null ? `M${mag.toFixed(1)}` : "?"}* — ${zone} (${date})  \`${id}\``
        : "📅 No events yet.",
    lastPoll: (ts: string | null) => `🔄 Last successful poll: ${ts ?? "never"}`,
  },
  events: {
    title: "📋 *Recent Events*",
    none: "No events found.",
    line: (id: string, mag: number, zone: string, date: string) =>
      `• *M${mag.toFixed(1)}* — ${zone}  \`${id}\`  _${date}_`,
  },
  delivery: {
    usage: "Usage: `/delivery <event_id>`",
    notFound: (id: string) => `❌ No deliveries found for event \`${id}\`.`,
    title: (id: string) => `📬 *Delivery status — ${id}*`,
    line: (chat: number, status: string, attempts: number) =>
      `• \`${chat}\`: ${status} (attempts: ${attempts})`,
    summary: (total: number, sent: number, transient: number, permanent: number, pending: number) =>
      `\nTotal: ${total} | ✅ ${sent} | ⏳ ${pending} | ⚠️ ${transient} | ❌ ${permanent}`,
  },
  health: {
    title: "🏥 *System Health*",
    ok: "✅",
    fail: "❌",
    line: (service: string, ok: boolean, detail: string) =>
      `${ok ? "✅" : "❌"} *${service}*: ${detail}`,
  },
  help: {
    body:
      "🛠 *Admin Commands*\n\n" +
      "• /broadcast <message> — Send a message to all active users\n" +
      "• /stats — View bot statistics\n" +
      "• /events — View recent events\n" +
      "• /delivery <event-id> — Check delivery status\n" +
      "• /health — Check system health",
  },
} as const;
