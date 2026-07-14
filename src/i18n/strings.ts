import { escapeHtml } from "@/util/html";

export const STRINGS = {
  start: {
    welcome: (italyThreshold: number, worldThreshold: number) =>
      "👋 <b>Allerta Terremoti (INGV)</b>\n\n" +
      "Ti avviso in tempo reale quando avviene un terremoto, usando i dati ufficiali dell'INGV.\n\n" +
      `Riceverai le allerte nazionali per <b>tutti</b> gli eventi sismici rilevanti (M ≥ ${italyThreshold.toFixed(1)}) ` +
      "che avvengono sul territorio italiano, indipendentemente dalle posizioni che hai salvato.\n\n" +
      "Questa funzione è attiva <b>di default</b>.\n\n" +
      "Per le allerte di prossimità (eventi vicini alle tue posizioni), aggiungi una o più posizioni con /posizioni.\n" +
      `Per le allerte mondiali (M ≥ ${worldThreshold.toFixed(1)}), attivale in /impostazioni.\n\n` +
      "⚠️ <i>Bot non ufficiale, non affiliato all'INGV.</i>",
  },
  mainMenu: {
    posizioni: "📍 Posizioni",
    impostazioni: "⚙️ Impostazioni",
    aiuto: "❓ Aiuto",
  },
  aiuto: {
    body:
      "❓ <b>Aiuto</b>\n\n" +
      "🚀 /start — Avvia il bot\n" +
      "❓ /aiuto — Questo messaggio\n" +
      "📍 /posizioni — Aggiungi, visualizza o rimuovi posizioni\n" +
      "⚙️ /impostazioni — Modifica raggio, magnitudo e preferenze globali\n" +
      "🛑 /stop — Disattiva il tuo account\n" +
      "ℹ️ /credits — Fonti e crediti\n\n" +
      "🇮🇹 Le allerte nazionali sono attive di default.\n" +
      "🌍 Le allerte mondiali sono disattive (opt-in da /impostazioni).",
  },
  posizioni: {
    empty:
      "📍 <b>Posizioni</b>\n\n" +
      "Non hai ancora posizioni salvate.\n\n" +
      "Premi <b>➕ Aggiungi posizione</b> qui sotto per iniziare.",
    addBtn: "➕ Aggiungi posizione",
    listHeader: "📍 <b>Posizioni</b>\n\nSeleziona una posizione da gestire:",
    addPrompt:
      "📍 Invia la tua posizione attuale col pulsante qui sotto, oppure scegli un punto sulla mappa dal menu allegati (📎 → Posizione) — utile ad esempio per la casa di un familiare.",
    detailHeader: (name: string) => `📍 <b>${escapeHtml(name)}</b>`,
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
    added: (name: string) => `✅ Posizione <b>${escapeHtml(name)}</b> aggiunta.`,
    removed: (name: string) => `🗑 Posizione <b>${escapeHtml(name)}</b> rimossa.`,
  },
  impostazioni: {
    title: "⚙️ <b>Impostazioni</b>",
    radiusTitle: (name: string) => `📏 <b>Raggio — ${escapeHtml(name)}</b>`,
    magnitudeTitle: (name: string) => `📊 <b>Magnitudo — ${escapeHtml(name)}</b>`,
    italyLabel: (on: boolean) => (on ? "✅ Notifiche Italia: ON" : "❌ Notifiche Italia: OFF"),
    worldLabel: (on: boolean) => (on ? "✅ Notifiche Mondo: ON" : "❌ Notifiche Mondo: OFF"),
  },
  toggles: {
    italyOn: "Le allerte nazionali sono ora attive.",
    italyOff: "Le allerte nazionali sono ora disattive.",
    worldOn: "Le allerte mondiali sono ora attive.",
    worldOff: "Le allerte mondiali sono ora disattive.",
  },
  delete: {
    confirm: (name: string) =>
      `Confermi di voler rimuovere <b>${escapeHtml(name)}</b>?`,
    confirmBtn: "✅ Conferma",
    cancelBtn: "❌ Annulla",
  },
  stop: {
    done:
      "🛑 <b>Notifiche disattivate</b>\n\n" +
      "I tuoi dati sono conservati.\n" +
      "Per riattivare, invia /start.",
  },
  credits: {
    body:
      "ℹ️ <b>Credits</b>\n\n" +
      "📡 <b>Fonti dati</b>\n" +
      '<a href="https://webservices.ingv.it/">INGV - Istituto Nazionale di Geofisica e Vulcanologia</a>\n\n' +
      "🤖 <b>Autore</b>\n" +
      "@DaniZ97\n\n" +
      "💡 <b>Codice sorgente</b>\n" +
      '<a href="https://github.com/Daniel-97/allerta-terremoti-bot">allerta-terremoti-bot</a>\n\n' +
      "🙏 <b>Ispirazione</b>\n" +
      'Progetto ispirato a <a href="https://github.com/botfactoryit/terremotibot">terremotibot</a> di BotFactory\n\n' +
      "⚠️ <b>Disclaimer</b>\n" +
      "Questo bot non è ufficiale e non è in alcun modo affiliato, sponsorizzato o " +
      "approvato dall'INGV. I dati sono ricavati dai servizi pubblici INGV ma il bot " +
      "è un progetto indipendente.",
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
} as const;

export const ADMIN = {
  broadcast: {
    empty: "❌ Message cannot be empty.",
    tooLong: (len: number) => `❌ Message too long (${len} chars). Max 4096.`,
    sent: (sent: number, total: number) =>
      `📨 Broadcast sent to ${sent}/${total} active users.`,
  },
  stats: {
    title: "📊 <b>Bot Statistics</b>",
    users: (total: number, active: number, stopped: number, blocked: number, deleted: number) =>
      `👤 <b>Users</b>\n` +
      `Total: ${total}\n` +
      `Active: ${active}\n` +
      `Stopped: ${stopped}\n` +
      `Blocked: ${blocked}\n` +
      `Deleted: ${deleted}`,
    locations: (count: number) => `📍 Total locations: ${count}`,
    lastEvent: (id: string | null, zone: string | null, mag: number | null, date: string | null) =>
      id
        ? `📅 Last event: <b>${mag != null ? `M${mag.toFixed(1)}` : "?"}</b> — ${escapeHtml(zone ?? "")} (${date})  <code>${escapeHtml(id)}</code>`
        : "📅 No events yet.",
    lastPoll: (ts: string | null) => `🔄 Last successful poll: ${ts ?? "never"}`,
  },
  events: {
    title: "📋 <b>Recent Events</b>",
    none: "No events found.",
    line: (id: string, mag: number, zone: string, date: string) =>
      `• <b>M${mag.toFixed(1)}</b> — ${escapeHtml(zone)}  <code>${escapeHtml(id)}</code>  <i>${date}</i>`,
  },
  delivery: {
    usage: "Usage: <code>/delivery &lt;event_id&gt;</code>",
    notFound: (id: string) => `❌ No deliveries found for event <code>${escapeHtml(id)}</code>.`,
    title: (id: string) => `📬 <b>Delivery status — ${escapeHtml(id)}</b>`,
    line: (chat: number, status: string, attempts: number) =>
      `• <code>${chat}</code>: ${status} (attempts: ${attempts})`,
    summary: (total: number, sent: number, transient: number, permanent: number, pending: number) =>
      `\nTotal: ${total} | ✅ ${sent} | ⏳ ${pending} | ⚠️ ${transient} | ❌ ${permanent}`,
  },
  health: {
    title: "🏥 <b>System Health</b>",
    ok: "✅",
    fail: "❌",
    line: (service: string, ok: boolean, detail: string) =>
      `${ok ? "✅" : "❌"} <b>${escapeHtml(service)}</b>: ${escapeHtml(detail)}`,
  },
  help: {
    body:
      "🛠 <b>Admin Commands</b>\n\n" +
      "• /broadcast &lt;message&gt; — Send a message to all active users\n" +
      "• /stats — View bot statistics\n" +
      "• /events — View recent events\n" +
      "• /delivery &lt;event-id&gt; — Check delivery status\n" +
      "• /health — Check system health",
  },
} as const;
