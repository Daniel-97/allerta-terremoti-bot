# allerta-terremoti-bot — Software Requirements Specification (SRS)

**Versione:** 1.2 (bozza per riscrittura)
**Data:** giugno 2026
**Stato:** documento di riferimento per la reimplementazione da zero

---

## 1. Introduzione

### 1.1 Scopo del documento
Questo documento descrive i requisiti software di **allerta-terremoti-bot**, un bot Telegram che avvisa gli utenti in caso di terremoto. È redatto come base per una **reimplementazione completa da zero** del bot esistente con uno stack tecnologico moderno. Definisce *cosa* il sistema deve fare (requisiti funzionali), *quanto bene* deve farlo (requisiti non funzionali), le interfacce esterne, il modello dati e i vincoli tecnologici. Non descrive l'implementazione attuale del progetto originale.

### 1.2 Ambito del prodotto
allerta-terremoti-bot è un servizio di **allerta sismica personalizzata** su Telegram, in lingua italiana, operante **solo in chat private**. Gli utenti registrano una o più posizioni geografiche; il sistema monitora i dati sismici ufficiali dell'INGV e invia una notifica quando un evento soddisfa i criteri (distanza e magnitudo) configurati per ciascuna posizione. È inoltre prevista una notifica per i grandi eventi (allerte nazionali e mondiali).

Fuori ambito per la versione 1 (v1): immagini/mappe nelle notifiche, pubblicazione su social, riscontri "hai sentito il terremoto?" e relative statistiche, etichette personalizzate delle posizioni, uso in gruppi/supergruppi, cancellazione completa dei dati utente (erasure), gestione delle revisioni/ritrattazioni degli eventi INGV.

### 1.3 Definizioni, acronimi e abbreviazioni
- **INGV**: Istituto Nazionale di Geofisica e Vulcanologia, fonte ufficiale dei dati sismici.
- **FDSN**: Federation of Digital Seismograph Networks; standard del web service eventi INGV.
- **QuakeML**: formato XML per dati sismici.
- **Chat**: conversazione privata Telegram tra il bot e un utente; identificata da un chat ID.
- **Posizione**: punto geografico salvato da un utente, con soglie di notifica proprie.
- **Allerta nazionale / mondiale**: notifica per grandi eventi inviata a tutti gli utenti idonei a prescindere dalla distanza — nell'area italiana (`italy_alerts`) o nel resto del mondo sopra una soglia elevata (`world_alerts`).
- **Consegna (delivery)**: singolo tentativo/esito di invio di una notifica a una chat.
- **Inline keyboard**: pulsanti sotto un messaggio Telegram (callback).
- **Reply keyboard**: tastiera personalizzata che sostituisce quella di sistema.
- **Stateless**: senza stato conversazionale memorizzato tra messaggi.
- **Idempotente**: operazione che, ripetuta, non produce effetti aggiuntivi.
- **Watchdog**: meccanismo di auto-monitoraggio del sistema (es. fonte dati irraggiungibile).
- **Dead-man's-switch**: monitoraggio esterno che rileva l'assenza di "segni di vita" del sistema.
- **Finestra di lookback**: intervallo temporale recente entro cui il polling considera gli eventi.
- **v1**: prima versione del prodotto reimplementato.

### 1.4 Riferimenti
- INGV FDSN event web service: `https://webservices.ingv.it/fdsnws/event/1/query`
- Telegram Bot API: `https://core.telegram.org/bots/api`
- GeoNames API: `https://www.geonames.org`
- Standard di riferimento per la struttura: IEEE 830 / ISO/IEC/IEEE 29148.

### 1.5 Panoramica del documento
La sezione 2 descrive il contesto generale e gli utenti. La sezione 3 elenca i requisiti funzionali numerati. La sezione 4 definisce le interfacce esterne. La sezione 5 elenca i requisiti non funzionali. La sezione 6 specifica il modello dati. La sezione 7 definisce lo stack tecnologico e i vincoli implementativi. La sezione 8 raccoglie le appendici.

---

## 2. Descrizione generale

### 2.1 Contesto del prodotto
Il sistema è un'applicazione serverless che integra attori esterni: **Telegram** (canale di interazione e notifica), **INGV** (fonte dati sismici), un **servizio di reverse geocoding** (GeoNames, per nominare le posizioni utente) e un **servizio di monitoraggio esterno** (dead-man's-switch). Opera in due modalità complementari: reattiva (risponde agli aggiornamenti degli utenti via webhook) e proattiva (interroga periodicamente l'INGV e invia notifiche tramite job schedulati).

### 2.2 Funzioni principali del prodotto
- Registrazione e gestione di posizioni geografiche per utente (max 10 per utente).
- Configurazione per-posizione di raggio e soglia di magnitudo; preferenze globali di allerta nazionale e mondiale.
- Monitoraggio continuo degli eventi sismici INGV.
- Invio di notifiche di prossimità, nazionali e mondiali, con tracciamento di consegna e ritentativi.
- Disiscrizione/riattivazione dell'utente (`/stop` / `/start`).
- Interazione interamente a pulsanti (inline-first) con un piccolo insieme di comandi.
- Comandi e notifiche amministrative; auto-monitoraggio del sistema; pulizia periodica dei dati.

### 2.3 Caratteristiche degli utenti
Utente finale generico, non tecnico, che usa Telegram da smartphone in chat privata. Non è richiesta alcuna competenza particolare. L'interazione deve essere comprensibile e a basso attrito (condividere la posizione, premere pulsanti). La lingua per l'utente è l'italiano.

### 2.4 Vincoli generali
- Il sistema deve girare su **Cloudflare Workers** (serverless; limiti di CPU/tempo per invocazione; assenza di binari di sistema).
- La persistenza deve usare **Turso** (database SQLite/libSQL), privo di funzioni geospaziali native.
- Il sistema opera **solo in chat private**; i messaggi provenienti da gruppi non sono supportati.
- L'interazione utente deve essere **inline-first**, senza inserimento di testo libero per i valori.
- Le notifiche in v1 devono essere **solo testo**.
- Il sistema si basa sui dati INGV **non revisionati** (primo avvistamento), accettando come limite noto che revisioni o ritrattazioni successive non vengano rielaborate (priorità alla tempestività).

### 2.5 Assunzioni e dipendenze
- I dati sismici sono presi **esclusivamente dall'INGV**. In base all'accordo INGV–Protezione Civile, l'INGV garantisce le localizzazioni per magnitudo ≥ 2.5 entro i confini italiani, ≥ 5.0 nell'area mediterranea e ≥ 6.0 a livello globale. Conseguenza di progetto: le allerte mondiali sono affidabili solo per soglie ≥ M6.0 (vedi FR-4.6).
- Telegram Bot API è disponibile e rispetta i propri limiti di rate.
- GeoNames copre IT, San Marino, Austria e Svizzera.
- L'utente ha consentito al proprio client Telegram di condividere la posizione.
- Le magnitudo INGV possono essere di tipo diverso (ML, Mw, …); il confronto con le soglie usa il valore numerico riportato, accettando la non perfetta comparabilità tra tipi come semplificazione.

---

## 3. Requisiti funzionali

I requisiti usano la forma "il sistema deve" e sono identificati da un codice **FR-x.y** per la tracciabilità.

### 3.1 Gestione delle posizioni
- **FR-1.1** Il sistema deve permettere all'utente di aggiungere una posizione condividendo una posizione Telegram (messaggio di tipo *location* o *venue*). Una *live location* è trattata come uno scatto statico al momento della ricezione.
- **FR-1.2** Il sistema deve convertire le coordinate ricevute in un nome automatico nel formato `Comune (PROV)` tramite reverse geocoding (servizio GeoNames). Il geocoding è usato **solo** per nominare le posizioni inserite dagli utenti, non per gli eventi sismici. L'utente non assegna nomi (nessun testo libero).
- **FR-1.2.1** In caso di fallimento o timeout del geocoding durante l'aggiunta di una posizione, il sistema deve gestire l'errore con grazia (messaggio "non riesco a determinare il comune, riprova") senza salvare una posizione senza nome e senza propagare l'errore ad altre funzioni.
- **FR-1.3** Il sistema deve accettare solo posizioni in Italia, San Marino, Austria e Svizzera; le posizioni fuori da queste aree devono essere rifiutate con un messaggio esplicativo.
- **FR-1.4** Il sistema deve applicare un vincolo di unicità `(chat, name)`: una sola posizione per comune per utente. Un secondo inserimento nello stesso comune deve essere rifiutato con un messaggio dedicato, tramite un controllo esplicito a livello applicativo (il vincolo DB è rete di sicurezza, non logica di flusso).
- **FR-1.5** Il sistema deve permettere a un utente di salvare più posizioni in comuni diversi.
- **FR-1.6** Il sistema deve limitare a **10** (`MAX_LOCATIONS_PER_USER`) il numero massimo di posizioni per utente; oltre il limite, l'aggiunta è rifiutata con un messaggio dedicato.
- **FR-1.7** Il sistema deve permettere all'utente di elencare le proprie posizioni.
- **FR-1.8** Il sistema deve permettere all'utente di rimuovere una posizione, previa conferma esplicita in due passaggi (inline).
- **FR-1.9** Alla creazione di una posizione il sistema deve assegnare i valori di default di raggio e soglia di magnitudo (vedi 3.2).
- **FR-1.10** Il nome della posizione è una semplice etichetta descrittiva e non deve essere usato come identificatore: la selezione avviene tramite ID.

### 3.2 Impostazioni
- **FR-2.1** Il sistema deve gestire, **per ciascuna posizione**, un raggio di notifica (`radius`) con default 100 km e massimo 300 km, selezionabile da preset inline (25 / 50 / 75 / 100 / 150 / 200 / 300 km).
- **FR-2.2** Il sistema deve gestire, **per ciascuna posizione**, una soglia di magnitudo (`magnitude_threshold`) con default 2.0 e minimo 2.0, selezionabile da preset inline (2.0 / 2.5 / 3.0 / 3.5 / 4.0 / 4.5 / 5.0).
- **FR-2.3** Il sistema deve gestire, **a livello utente** (globale), una preferenza di allerte nazionali (`italy_alerts`) on/off, default **on** (vedi FR-4.2).
- **FR-2.3.1** Il sistema deve gestire, **a livello utente** (globale), una preferenza di allerte mondiali (`world_alerts`) on/off, default **off** (opt-in) (vedi FR-4.3).
- **FR-2.4** Tutti i valori devono essere modificabili esclusivamente tramite pulsanti inline a valori predefiniti (preset); non è ammesso l'inserimento numerico libero. `italy_alerts` e `world_alerts` sono toggle inline.
- **FR-2.5** Per modificare raggio o magnitudo l'utente deve prima selezionare la posizione a cui applicare la modifica.
- **FR-2.6** Un utente senza alcuna posizione salvata può comunque ricevere allerte nazionali e mondiali (in base ai flag globali); le notifiche di prossimità richiedono almeno una posizione.

### 3.3 Rilevamento degli eventi sismici
- **FR-3.1** Il sistema deve interrogare periodicamente il web service eventi dell'INGV per individuare nuovi terremoti.
- **FR-3.2** Il sistema deve interrogare l'INGV su due ambiti, usando i filtri dell'API (bounding box e tempo): (a) l'**area italiana**, definita dalla bounding box costante `ITALY_BBOX` (lat 35–48, lon 6–27, box di riferimento INGV per l'Italia), con soglia di magnitudo bassa; (b) l'**area mondiale** (query globale, senza bounding box) limitatamente agli eventi con magnitudo ≥ soglia mondiale (vedi FR-4.3).
- **FR-3.3** Ogni interrogazione deve restringersi alla **finestra di lookback** (`LOOKBACK_WINDOW`, default 60 minuti) tramite il filtro temporale dell'API INGV (`starttime`), così da prelevare solo gli eventi recenti e non l'intero archivio. La finestra fornisce resilienza in caso di cicli saltati.
- **FR-3.4** Il sistema deve processare ciascun evento **una sola volta**, identificandolo tramite l'ID univoco dell'evento INGV (deduplica contro `history`). Conseguenza all'avvio: al primo deploy gli eventi presenti nella finestra di lookback al momento dell'avvio sono trattati come nuovi (comportamento limitato a ≤ `LOOKBACK_WINDOW`).
- **FR-3.5** Il sistema deve usare la descrizione testuale della zona epicentrale fornita dall'INGV (campo `zone`) per nominare l'epicentro, sia per eventi italiani sia mondiali. Non deve effettuare reverse geocoding per l'epicentro.
- **FR-3.6** Il sistema deve registrare in `history` **tutti** gli eventi processati (anche quelli senza destinatari), necessari alla deduplica e al recupero dei dettagli. Gli eventi senza destinatari saranno rimossi dal job di pulizia (vedi 3.11).
- **FR-3.7 (area "italiana")** Un evento è considerato "in area italiana" se ricade nella bounding box `ITALY_BBOX`. Definizione approssimata e accettata: il box di riferimento INGV include mare e porzioni dell'area mediterranea orientale (fino a lon 27), quindi un'allerta "nazionale" può riguardare anche eventi in regioni confinanti entro quel box.

### 3.4 Notifiche e criteri di invio
- **FR-4.1** Il sistema deve inviare una **notifica di prossimità** quando, per almeno una posizione dell'utente, la distanza dall'epicentro è ≤ `radius` di quella posizione e la magnitudo dell'evento è ≥ `magnitude_threshold` di quella posizione.
- **FR-4.2** Il sistema deve inviare una **notifica nazionale** per eventi con magnitudo ≥ `ITALY_ALERT_THRESHOLD` (costante di codice, default 5.0), a tutti gli utenti con `italy_alerts` attivo, indipendentemente dalla distanza, ma solo se l'evento è in area italiana (FR-3.7).
- **FR-4.3** Il sistema deve inviare una **notifica mondiale** per eventi con magnitudo ≥ `WORLD_ALERT_THRESHOLD` (costante di codice, default 7.0) ovunque nel mondo, a tutti gli utenti con `world_alerts` attivo, indipendentemente dalla distanza.
- **FR-4.4** Un evento può rendere un utente idoneo per più criteri (prossimità, nazionale, mondiale). In tal caso l'utente deve ricevere **una sola** notifica per quell'evento (garantito dal vincolo univoco `(event_id, chat)` su `deliveries`); la logica di matching deve unire gli insiemi di destinatari prima dell'invio.
- **FR-4.5** Quando un utente ha più posizioni idonee per lo stesso evento, il sistema deve mostrare la distanza e il nome della sola posizione **più vicina**.
- **FR-4.6 (vincolo soglia mondiale)** Poiché la copertura globale INGV è garantita per magnitudo ≥ 6.0 (vedi 2.5), `WORLD_ALERT_THRESHOLD` non deve essere impostata sotto 6.0; il default 7.0 è entro questo vincolo.
- **FR-4.7** Il sistema deve dare priorità di invio agli utenti più vicini all'epicentro (ordinamento per distanza crescente).
- **FR-4.8** In v1 la notifica deve essere un **messaggio di solo testo**. Per le notifiche di prossimità e nazionali il messaggio contiene, in ordine: magnitudo "pulita" (es. "M 4.2", senza il tipo nella riga principale); distanza e nome della posizione più vicina (se l'utente ha almeno una posizione); zona epicentrale; profondità; data e ora in ora locale italiana.
- **FR-4.9** Le notifiche **nazionali** usano lo stesso formato con la riga della distanza dalla posizione più vicina, anche per epicentri lontani; se l'utente non ha alcuna posizione la riga è omessa.
- **FR-4.10** Le notifiche **mondiali** usano un formato dedicato **senza la riga della distanza personale**, centrato su magnitudo, zona/paese dell'epicentro, profondità, data e ora in ora locale italiana.
- **FR-4.11** Ogni notifica deve includere pulsanti inline: **Dettagli** (coordinate, profondità, magnitudo con **tipo** e incertezza, numero di stazioni, data/ora, letti da `history`) e **Pagina evento INGV** (URL button).
- **FR-4.12** Se i dettagli di un evento non sono più disponibili (evento rimosso dal job di pulizia), il pulsante "Dettagli" deve rispondere con un messaggio gestito con grazia (es. "dettagli non più disponibili").
- **FR-4.13 (limite noto — sciami sismici)** In presenza di sequenze (foreshock/mainshock/aftershock) l'utente può ricevere più notifiche ravvicinate, una per evento. In v1 non è previsto raggruppamento o throttling; è un limite accettato.

### 3.5 Consegna affidabile e ritentativi
- **FR-5.1** Il sistema deve tracciare in modo persistente ogni invio di **notifica sismica** in `deliveries`, una riga per coppia `(event_id, chat)` con stato (`pending` / `sent` / `failed_transient` / `failed_permanent`) e contatore tentativi.
- **FR-5.2** Il sistema deve classificare gli errori di invio in **permanenti** (es. bot bloccato, chat inesistente, utente disattivato) e **transitori** (es. rate limit, errori 5xx, timeout).
- **FR-5.3** Per gli errori permanenti il sistema non deve ritentare e deve aggiornare lo stato della chat (vedi 3.6).
- **FR-5.4** Per gli errori transitori il sistema deve ritentare l'invio fino a `MAX_ATTEMPTS` tentativi, tramite il cron di retry.
- **FR-5.5** Il sistema deve poter determinare se un evento è stato consegnato a tutti i destinatari (assenza di righe `deliveries` con stato diverso da `sent` per quell'evento).
- **FR-5.6** Le operazioni di rilevamento e invio devono essere **idempotenti** (vedi NFR-2.3): un evento non deve essere notificato due volte alla stessa chat anche in presenza di esecuzioni sovrapposte.

### 3.6 Stato della chat e ciclo di vita (solo chat private)
- **FR-6.1** Il sistema deve gestire i seguenti stati per una chat (campo `status`): **attivo** (`active`), **bloccato dall'utente**, **disattivato dall'utente** (via `/stop`), **account disattivato/cancellato** (rilevato da Telegram).
- **FR-6.2** In caso di errore di invio, il sistema deve interpretare l'errore Telegram e aggiornare lo stato della chat di conseguenza (bloccato / account disattivato).
- **FR-6.3** Le chat in qualsiasi stato diverso da "attivo" devono essere escluse dalle notifiche future.
- **FR-6.4** Un comando `/start` deve **riattivare** la chat da qualsiasi stato non attivo (riportando `status = 'active'`), inclusa la situazione in cui l'utente aveva precedentemente bloccato il bot e poi lo sblocca.
- **FR-6.5** Il sistema deve **ignorare** i messaggi provenienti da chat non private (gruppi/supergruppi/canali); l'uso in gruppo non è supportato in v1.

### 3.7 Comandi utente e interazione
- **FR-7.1** Il sistema deve esporre i comandi slash utente `/start`, `/aiuto`, `/posizioni`, `/impostazioni`, `/stop`, `/credits`, registrati nel menu comandi di Telegram.
- **FR-7.1.1** Il messaggio di `/start` (e/o `/aiuto`) deve indicare esplicitamente che le **allerte nazionali sono attive per impostazione predefinita**, così che l'utente capisca perché può ricevere allerte anche senza aver aggiunto posizioni.
- **FR-7.2 (`/stop`)** Il comando deve **disattivare** l'utente impostando lo stato "disattivato dall'utente" e interrompendo le notifiche. I dati dell'utente **non vengono cancellati** (disattivazione, non erasure). L'azione deve essere notificata all'amministratore (FR-9.3). Un successivo `/start` riattiva l'utente.
- **FR-7.3 (`/credits`)** Il comando deve mostrare le fonti dei dati (INGV) con relativo link, l'autore del bot e i link utili. (Contenuti iniziali: fonte/link INGV; autore e ulteriori link come placeholder da definire.)
- **FR-7.4** Il sistema deve gestire l'aggiunta di una posizione tramite una reply keyboard con pulsante `request_location`, mostrata solo quando necessaria e rimossa dopo l'uso.
- **FR-7.5** Tutte le altre interazioni (selezione posizione, modifica preset, rimozione con conferma, toggle allerte nazionali/mondiali, dettagli evento) devono avvenire tramite pulsanti inline.
- **FR-7.6** Le schermate interattive devono essere realizzate come un singolo messaggio-pannello che si aggiorna in place durante la navigazione.
- **FR-7.7** Il sistema deve essere **stateless a livello conversazionale**: ogni messaggio è interpretabile dal solo contenuto corrente; il contesto necessario (ID posizione/evento, azione, valore) è codificato nel `callback_data` (≤ 64 byte).
- **FR-7.8** Qualsiasi testo non riconosciuto deve ricevere una risposta che rimanda ai pulsanti o a `/aiuto`.

### 3.8 Comandi amministrativi
Comandi riservati agli amministratori, per operatività e comunicazione. Costituiscono una **superficie operativa separata** dall'esperienza utente: accettano argomenti testuali nel comando stesso (unica eccezione consentita al "niente testo libero", valido per l'utente finale). I testi delle risposte admin sono in **inglese**.

- **FR-8.1** Il sistema deve identificare gli amministratori tramite la variabile d'ambiente `ADMIN_CHAT_IDS` (elenco di chat ID). I comandi amministrativi da non amministratori devono essere **ignorati silenziosamente**.
- **FR-8.2** I comandi amministrativi **non** devono essere registrati nel menu comandi pubblico di Telegram.
- **FR-8.3 (`/broadcast <messaggio>`)** Il sistema deve inviare il messaggio di testo a **tutti gli utenti attivi** (`status = 'active'`). L'invio è **diretto** (nessuna anteprima/conferma inline, nessun tracciamento `deliveries`). Il sistema deve **validare** l'argomento: rifiutare messaggi vuoti o più lunghi di 4096 caratteri, con feedback all'amministratore. Ogni broadcast deve essere **registrato in un log strutturato** (amministratore, timestamp, numero di destinatari). Gli errori permanenti di invio devono comunque aggiornare lo stato della chat (FR-6). **Limite noto**: non essendo tracciato né ritentabile, un broadcast interrotto a metà (timeout/errore del Worker) resta **parziale** e non recuperabile.
- **FR-8.4 (`/stats`)** Il sistema deve restituire statistiche operative: utenti totali / attivi / disattivati / bloccati; numero di posizioni; ultimo evento processato e timestamp; esito di consegna dell'ultimo evento; timestamp dell'ultimo polling riuscito.
- **FR-8.5 (`/events`)** Il sistema deve restituire gli ultimi ~10 eventi processati con i rispettivi ID, da usare con `/delivery`.
- **FR-8.6 (`/delivery <event_id>`)** Il sistema deve restituire lo stato di consegna di un evento sismico: consegnati, falliti transitori, falliti permanenti (da `deliveries`).
- **FR-8.7 (`/health`)** Il sistema deve verificare la raggiungibilità/salute di tutte le dipendenze esterne: Telegram Bot API, web service INGV, GeoNames, database Turso. Deve riportare l'esito per ciascuna.

### 3.9 Notifiche verso l'amministratore (push)
Notifiche operative inviate automaticamente ai chat ID in `ADMIN_CHAT_IDS`.

- **FR-9.1 (nuovo utente)** Alla creazione di una nuova chat (primo inserimento del record in `chats`), il sistema deve notificare all'amministratore i dati disponibili (nome, username se presente) e l'orario.
- **FR-9.2 (riepilogo evento)** Al termine della prima ondata di invio di un evento, se i destinatari sono ≥ 1, il sistema deve notificare all'amministratore: identificativo evento (magnitudo, zona, ID), numero di destinatari ed esito di consegna (consegnati / falliti). Nessun riepilogo per eventi senza destinatari.
- **FR-9.3 (disiscrizione)** All'esecuzione di `/stop` da parte di un utente, il sistema deve notificarlo all'amministratore.
- **FR-9.4 (robustezza)** Le notifiche verso l'amministratore devono essere **best-effort (fire-and-forget)**: un loro fallimento non deve mai bloccare né alterare la registrazione dell'utente, il processamento dell'evento o la consegna delle allerte agli utenti finali.

### 3.10 Monitoraggio del sistema (watchdog)
- **FR-10.1 (stato di sistema)** Il sistema deve mantenere uno stato persistente in una tabella `system_state` (key/value) con almeno: contatore di fallimenti consecutivi del fetch INGV, flag "admin già avvisato", timestamp dell'ultimo polling riuscito.
- **FR-10.2 (allerta INGV irraggiungibile)** Se il fetch INGV fallisce per **`INGV_FAILURE_ALERT_THRESHOLD`** cicli consecutivi (costante di codice, default 5) e l'admin non è già stato avvisato, il sistema deve inviare un alert all'amministratore e impostare il flag. Al primo fetch riuscito successivo, se il flag è attivo, deve inviare un avviso di ripristino e azzerare contatore e flag. Un fallimento isolato non genera alert (edge-triggered).
- **FR-10.3 (database irraggiungibile)** In caso di errore del database intercettato durante un ciclo, il sistema deve tentare un avviso best-effort all'amministratore.
- **FR-10.4 (consegne fallite)** Le consegne ancora fallite dopo l'esaurimento dei tentativi sono riportate nel riepilogo evento (FR-9.2); non generano un alert separato.
- **FR-10.5 (dead-man's-switch)** **All'inizio** di ogni esecuzione del cron principale, **indipendentemente dall'esito del fetch INGV**, il sistema deve inviare un ping a un servizio di monitoraggio esterno (`HEALTHCHECKS_URL`) per segnalare che lo scheduler è vivo. L'assenza prolungata di ping (rilevata dal servizio esterno) copre il caso "sistema completamente fermo", che l'auto-monitoraggio interno non può rilevare.

### 3.11 Pulizia dei dati
- **FR-11.1** Il sistema deve eseguire un job di pulizia **giornaliero** (terzo cron).
- **FR-11.2** Il job deve cancellare le righe `deliveries` più vecchie di **3 mesi**.
- **FR-11.3** Il job deve cancellare da `history` gli eventi **senza alcuna riga in `deliveries`** e più vecchi della finestra di lookback. Gli eventi referenziati da `deliveries` non devono essere cancellati.

---

## 4. Requisiti di interfaccia esterna

### 4.1 Interfacce utente (Telegram)
- **Comandi slash utente** registrati nel menu (`/start`, `/aiuto`, `/posizioni`, `/impostazioni`, `/stop`, `/credits`).
- **Comandi amministrativi** non pubblicati nel menu (`/broadcast`, `/stats`, `/events`, `/delivery`, `/health`), riservati ai chat ID in `ADMIN_CHAT_IDS`.
- **Inline keyboard** per tutte le azioni utente; payload nel `callback_data` (≤ 64 byte → schema compatto).
- **Reply keyboard** unicamente per la condivisione della posizione (`request_location`).
- Lingua: italiano per l'utente, inglese per i messaggi amministrativi. Nessuna immagine nelle notifiche in v1.

### 4.2 Interfacce software (servizi esterni)
- **INGV FDSN event web service**: interrogazione HTTP con filtri su bounding box, finestra temporale e magnitudo; risposta in QuakeML (XML) o formato testo. Recupero del singolo evento per ID.
- **Telegram Bot API**: ricezione aggiornamenti via webhook; invio/modifica messaggi e markup; impostazione comandi e webhook.
- **GeoNames**: reverse geocoding a `Comune (PROV)`; copertura IT/SM/AT/CH. Solo per posizioni utente.
- **Servizio di monitoraggio esterno (es. healthchecks.io)**: ricezione dei ping del dead-man's-switch.

### 4.3 Interfacce di comunicazione
- Tutte le comunicazioni esterne su **HTTPS**.
- Ricezione degli aggiornamenti Telegram via **webhook** verso l'endpoint del Worker, autenticato (vedi NFR-4.2).
- Esecuzione dei job tramite **Cron Trigger**: principale, retry, pulizia.

---

## 5. Requisiti non funzionali

### 5.1 Prestazioni e tempestività
- **NFR-1.1** Il rilevamento di un nuovo evento e l'invio della prima ondata di notifiche devono avvenire nella **stessa esecuzione** del cron principale, per minimizzare la latenza.
- **NFR-1.2** L'invio deve rispettare i limiti di rate di Telegram (≈30 messaggi/secondo).
- **NFR-1.3** Per i volumi attesi in v1 (10–100 utenti), un intero invio di massa (allerta o broadcast admin) deve completarsi entro una singola invocazione del Worker.

### 5.2 Affidabilità e consegna
- **NFR-2.1** La consegna delle notifiche sismiche deve essere tracciata in modo persistente per consentire la verifica "consegnato a tutti".
- **NFR-2.2** Gli invii falliti per cause transitorie devono essere ritentati selettivamente tramite un job di retry a bassa frequenza.
- **NFR-2.3** Le operazioni critiche devono essere **idempotenti** tramite vincoli di unicità: rivendicazione dell'evento su `history.id` e inserimento condizionale (`ON CONFLICT DO NOTHING`) sulla coppia univoca `(event_id, chat)` di `deliveries`.
- **NFR-2.4 (prevenzione sovrapposizione)** Per ridurre la probabilità di esecuzioni concorrenti, il sistema può adottare un lock leggero con scadenza/TTL (es. chiave in `system_state`), una finestra di polling contenuta e run brevi. Per i volumi v1 l'idempotenza è sufficiente; il lock è un irrobustimento opzionale.

### 5.3 Scalabilità
- **NFR-3.1** L'architettura deve reggere senza modifiche fino a qualche migliaio di utenti.
- **NFR-3.2** Oltre tale soglia (quando un invio di massa non sta più in una singola invocazione), il sistema dovrà spezzare l'invio in batch o introdurre una coda (es. Cloudflare Queues) senza cambiare il modello dati `deliveries`.

### 5.4 Sicurezza
- **NFR-4.1** I segreti (token bot, token DB, username/credenziali esterni, URL del monitoraggio) devono essere gestiti come secret di piattaforma, mai in codice.
- **NFR-4.2** L'endpoint webhook deve autenticare le richieste di Telegram tramite il **secret token** inviato nell'header `X-Telegram-Bot-Api-Secret-Token` (impostato in `setWebhook`), preferito al segreto nel path.
- **NFR-4.3** I dati personali memorizzati si limitano allo stretto necessario (chat ID, dati profilo opzionali, posizioni). `/stop` disattiva senza cancellare; la cancellazione completa (erasure) è un'evoluzione futura.

### 5.5 Manutenibilità
- **NFR-5.1** Il codice deve essere in TypeScript in modalità strict.
- **NFR-5.2** Lo **schema del database è SQL scritto a mano**, versionato nel repository (`schema.sql`), applicato manualmente. Non si usano strumenti di migrazione automatica (no drizzle-kit).
- **NFR-5.3** Il sistema deve produrre log strutturati degli errori di invio, dei cicli di polling e dei broadcast amministrativi.

### 5.6 Usabilità e localizzazione
- **NFR-6.1** L'interfaccia utente deve essere interamente in italiano e comprensibile a utenti non tecnici; i messaggi rivolti all'utente sono centralizzati in un unico modulo.
- **NFR-6.2** Le azioni distruttive lato utente devono richiedere conferma (es. rimozione posizione).
- **NFR-6.3** Le date/ore mostrate devono essere in fuso orario italiano (`Europe/Rome`).

### 5.7 Disponibilità
- **NFR-7.1** Il polling deve proseguire in modo resiliente: un errore temporaneo dell'INGV o di Telegram in un ciclo non deve impedire i cicli successivi.
- **NFR-7.2** Il sistema deve auto-monitorarsi (watchdog, sezione 3.10) e affidarsi a un dead-man's-switch esterno per i guasti totali.

---

## 6. Modello dati (schema logico)

Modello logico, indipendente dal motore. **Nota geospaziale**: Turso/SQLite non offre funzioni geospaziali native; la distanza dall'epicentro va calcolata a livello applicativo (Haversine), con pre-filtro su bounding box.

### 6.1 Entità `chats`
| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | intero/bigint | Chat ID Telegram (univoco) |
| `first_name` | testo | Nome (opzionale) |
| `last_name` | testo | Cognome (opzionale) |
| `username` | testo | Username (opzionale) |
| `created_at` | datetime | Prima registrazione |
| `last_seen_at` | datetime | Ultima interazione |
| `updated_at` | datetime | Ultimo aggiornamento impostazioni |
| `status` | testo/enum | `active` · `blocked` · `stopped` (via `/stop`) · `deleted` (default `active`) |
| `italy_alerts` | booleano | Allerte grandi eventi nazionali (default true) — preferenza globale |
| `world_alerts` | booleano | Allerte grandi eventi mondiali (default false, opt-in) — preferenza globale |

### 6.2 Entità `locations`
| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | identificatore | Chiave primaria |
| `chat` | intero/bigint | FK → `chats.id` |
| `lat` | numero | Latitudine |
| `lon` | numero | Longitudine |
| `name` | testo | `Comune (PROV)` da reverse geocoding (etichetta, non identificatore) |
| `radius` | intero | Raggio km (default 100, max 300) |
| `magnitude_threshold` | numero | Magnitudo minima (default 2.0, min 2.0) |

Vincolo `(chat, name)` univoco. Max 10 posizioni per chat (FR-1.6, enforce applicativo).

### 6.3 Entità `history`
| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | testo | ID evento INGV (univoco) |
| `zone` | testo | Descrizione testuale della zona epicentrale (INGV); nome dell'epicentro nelle notifiche |
| `date` | datetime | Data/ora evento (UTC) |
| `lat` | numero | Latitudine epicentro |
| `lon` | numero | Longitudine epicentro |
| `depth` | numero | Profondità (km) |
| `stations_count` | intero | Numero stazioni |
| `magnitude_type` | testo | Tipo magnitudo (ML, Mw…) |
| `magnitude_value` | numero | Valore magnitudo |
| `magnitude_uncertainty` | numero | Incertezza magnitudo |

Contiene tutti gli eventi processati (deduplica + dettagli). Soggetta a pulizia (3.11).

### 6.4 Entità `deliveries`
| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | identificatore | Chiave primaria |
| `event_id` | testo | FK → `history.id` |
| `chat` | intero/bigint | FK → `chats.id` |
| `status` | testo/enum | `pending` / `sent` / `failed_transient` / `failed_permanent` |
| `attempts` | intero | Tentativi effettuati |
| `updated_at` | datetime | Ultimo aggiornamento |

Vincolo `(event_id, chat)` univoco (idempotenza). Riguarda le sole notifiche sismiche (il `/broadcast` admin non vi scrive). Soggetta a pulizia (3.11: >3 mesi).

### 6.5 Entità `system_state`
| Campo | Tipo | Descrizione |
|---|---|---|
| `key` | testo | Chiave (PK), es. `ingv_consecutive_failures`, `ingv_alerted`, `last_successful_sync_at` |
| `value` | testo | Valore serializzato |
| `updated_at` | datetime | Ultimo aggiornamento |

Stato di sistema per il watchdog (3.10) e l'eventuale lock di overlap (NFR-2.4).

### 6.6 Indici e relazioni
- Indici: `chats(id)`; `locations(chat)`, `locations(chat,name)` UNIQUE; `history(id)`, `history(date)`; `deliveries(event_id,chat)` UNIQUE, `deliveries(event_id,status)`, `deliveries(status)`, `deliveries(updated_at)` (per la pulizia); `system_state(key)`.
- Relazioni: `chats` 1—N `locations`, `deliveries`; `history` 1—N `deliveries`. `system_state` isolata.
- **Tabelle rimosse** rispetto all'originale: `incoming`, `outgoing`. In v1 **non** è presente `felt_reports` (la feature "hai sentito il terremoto?" è rinviata, vedi 8.3).

---

## 7. Stack tecnologico e vincoli implementativi

Le scelte seguenti sono vincoli di progetto e raccomandazioni allineate all'ecosistema attuale (giugno 2026).

### 7.1 Linguaggio e qualità del codice
- **TypeScript** strict; **ESLint** + **Prettier**.
- Messaggi utente in italiano centralizzati in un unico modulo; messaggi admin in inglese.

### 7.2 Runtime e hosting
- **Cloudflare Workers** + **Wrangler**.
- **Cron Triggers**: il Worker espone `fetch` (webhook) e `scheduled` (job). **Tre** espressioni cron sullo stesso Worker, distinte in base a `event.cron`: principale (~1 min), retry (~1–5 min), pulizia (giornaliero).
- **Cloudflare KV** non necessario (lo stato di sistema vive in `system_state` su Turso); resta opzionale.
- **Cloudflare Queues** non necessario in v1 (evoluzione futura, NFR-3.2).

### 7.3 Framework del bot Telegram
- **grammY** (supporto di prima classe per Workers): `webhookCallback(bot, "cloudflare-mod")` nell'handler `fetch`; `bot.api` standalone per gli invii dai job; comandi via `setMyCommands` (solo comandi utente).

### 7.4 Database e accesso ai dati
- **Turso** (libSQL) con driver **`@libsql/client`** (variante web `@libsql/client/web` su Workers).
- **Drizzle ORM** (`drizzle-orm/libsql`) per query type-safe.
- **Schema SQL scritto a mano** in `src/db/schema.sql`, unica fonte di verità del database, applicato manualmente alla Turso (es. via Turso CLI). **Nessun drizzle-kit / migrazioni automatiche.** Le definizioni Drizzle in `db/schema.ts` (per le query) sono mantenute coerenti con `schema.sql` a mano.

### 7.5 Integrazione INGV e parsing
- Recupero eventi via **`fetch`** nativo verso il web service FDSN, con filtri bounding box (`ITALY_BBOX`) / magnitudo / tempo (`starttime`); query globale per gli eventi mondiali.
- **Preferenza**: output FDSN in **formato testo** (evita l'XML); in alternativa **`fast-xml-parser`** per QuakeML.
- **Zod** per validare risposte esterne e configurazione.

### 7.6 Geocoding e calcolo geografico
- Reverse geocoding via **GeoNames API** (`fetch`), solo posizioni utente, con timeout corto e fallback (FR-1.2.1).
- **Haversine** come utility interna + pre-filtro bounding box.

### 7.7 Data/ora e localizzazione
- **`Intl.DateTimeFormat`** con `timeZone: 'Europe/Rome'`, locale `it-IT`; nessuna libreria di date.

### 7.8 Testing e CI
- **Vitest** + **`@cloudflare/vitest-pool-workers`**; **Miniflare** per il locale. Deploy via **Wrangler**.

### 7.9 Mappatura architetturale
- **Un solo Worker**: `fetch` (interazioni utente, stateless) e `scheduled` (tre job).
- **Cron principale** (~1 min): ping dead-man's-switch (a inizio run) → poll INGV (Italia + mondo, finestra lookback) → aggiorna `system_state` (watchdog) → dedup su `history` → matching destinatari (Haversine, unione prossimità/nazionale/mondiale) → scrittura `deliveries` (`pending`) → invio immediato con aggiornamento stato → salvataggio evento → riepilogo admin.
- **Cron di retry** (~1–5 min): reinvio dei `failed_transient` con `attempts < MAX_ATTEMPTS`.
- **Cron di pulizia** (giornaliero): cancella `deliveries` >3 mesi ed eventi `history` senza destinatari oltre la finestra.

---

## 8. Appendici

### 8.1 Configurazione
**Variabili d'ambiente / secret:**
- `BOT_TOKEN` — token del bot Telegram.
- `WEBHOOK_SECRET` — secret token del webhook (header `X-Telegram-Bot-Api-Secret-Token`).
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — connessione Turso.
- `GEONAMES_USERNAME` — reverse geocoding.
- `ADMIN_CHAT_IDS` — chat ID amministratori.
- `HEALTHCHECKS_URL` — endpoint del dead-man's-switch.
- `MAX_ATTEMPTS` — tentativi massimi per errori transitori.

**Costanti di codice:**
- `ITALY_ALERT_THRESHOLD` = 5.0 · `WORLD_ALERT_THRESHOLD` = 7.0 (non sotto 6.0, vedi FR-4.6).
- `ITALY_BBOX` = { minlat 35, maxlat 48, minlon 6, maxlon 27 } (box di riferimento INGV).
- `LOOKBACK_WINDOW` = 60 minuti.
- `INGV_FAILURE_ALERT_THRESHOLD` = 5 cicli.
- `MAX_LOCATIONS_PER_USER` = 10.

### 8.2 Schema dei `callback_data` (indicativo)
Schema compatto entro 64 byte, separatore `;`. Esempi:
- `l;<locId>;r;100` → imposta raggio 100 km.
- `l;<locId>;m;45` → imposta magnitudo 4.5 (intero ×10).
- `l;<locId>;del` / `l;<locId>;del;ok` → rimozione e conferma.
- `set;ita;1` / `set;ita;0` → toggle allerte nazionali.
- `set;wld;1` / `set;wld;0` → toggle allerte mondiali.
- `ev;<eventId>;det` → dettagli evento.

### 8.3 Evoluzioni future (post-v1)
- **Riscontro "hai sentito il terremoto?"** (pulsanti sentito/non sentito) e statistiche associate, con tabella `felt_reports` — rimosso dalla v1, candidato per una versione successiva (preferibilmente limitato alle notifiche di prossimità per non inquinare le statistiche).
- Arricchimento visivo delle notifiche con mappa statica via URL (testo come fallback).
- Etichette di posizione da preset (🏠 Casa, 💼 Lavoro…).
- Cancellazione completa dei dati utente (erasure GDPR), oltre alla disattivazione.
- Raggruppamento/throttling delle sequenze sismiche (sciami/aftershock).
- Gestione delle revisioni/ritrattazioni degli eventi INGV.
- Supporto ai gruppi.
- Logging persistente dei broadcast (tabella dedicata) per tracciamento/recupero.
- Coda di invio (Cloudflare Queues) per volumi elevati.
