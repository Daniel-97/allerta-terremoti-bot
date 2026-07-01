# API INGV – Eventi sismici (FDSN-event)

Documentazione sintetica del web service dell'Istituto Nazionale di Geofisica e
Vulcanologia (INGV) per il recupero degli eventi sismici.

---

## 1. Servizio e standard

L'INGV distribuisce i dati sugli eventi sismici tramite un web service conforme
allo standard **FDSN-event** (Federation of Digital Seismograph Networks), la
stessa specifica usata da USGS, EMSC e altri enti internazionali. I parametri
sono quindi in larga parte interoperabili tra i diversi provider.

**Endpoint principale** (catalogo ISIDe, aggiornamento in tempo quasi reale):

```
https://webservices.ingv.it/fdsnws/event/1/query?<parametri>
```

Una richiesta è una semplice URL con coppie `parametro=valore` separate da `&`,
senza spazi. Si può usare sia il metodo HTTP GET che POST.

---

## 2. Copertura geografica: Italia vs. resto del mondo

Nello standard FDSN **non esiste un filtro "per nazione"**: si filtra sempre per
**geografia** (riquadro o raggio).

- **Solo Italia** → si usa un *bounding box* (riquadro) che copre il territorio
  italiano, oppure un filtro a raggio attorno a un punto.
- **Copertura mondiale** → il catalogo ISIDe dell'INGV è incentrato sull'area
  **italiana e mediterranea** (eventi dal gennaio 1985), perciò non offre una
  copertura globale uniforme. L'INGV pubblica solo alcuni eventi teleseismici di
  grande magnitudo tramite il sistema Early-Est. Per una copertura mondiale
  completa lo standard resta identico ma conviene cambiare ente:
  - USGS → `https://earthquake.usgs.gov/fdsnws/event/1/query`
  - EMSC / Seismic Portal → `https://www.seismicportal.eu/fdsnws/event/1/query`

**Riquadro indicativo per l'Italia:**

| Parametro     | Valore |
|---------------|--------|
| minlatitude   | 35     |
| maxlatitude   | 47.5   |
| minlongitude  | 6      |
| maxlongitude  | 19     |

---

## 3. Filtri / parametri disponibili

La maggior parte dei parametri ha anche una forma abbreviata (indicata tra
parentesi).

### Temporali
| Parametro | Descrizione |
|-----------|-------------|
| `starttime` (`start`) | Inizio intervallo, formato ISO `AAAA-MM-GGThh:mm:ss` (UTC) |
| `endtime` (`end`)     | Fine intervallo (UTC) |
| `updatedafter`        | Solo eventi modificati dopo la data indicata |

### Geografici – riquadro (bounding box)
| Parametro | Descrizione |
|-----------|-------------|
| `minlatitude` (`minlat`) / `maxlatitude` (`maxlat`)   | Latitudine min/max |
| `minlongitude` (`minlon`) / `maxlongitude` (`maxlon`) | Longitudine min/max |

### Geografici – raggio (alternativi al riquadro)
| Parametro | Descrizione |
|-----------|-------------|
| `latitude` (`lat`) / `longitude` (`lon`) | Coordinate del centro |
| `minradius` / `maxradius`                | Raggio in **gradi** |
| `minradiuskm` / `maxradiuskm`            | Raggio in **chilometri** |

### Magnitudo e profondità
| Parametro | Descrizione |
|-----------|-------------|
| `minmagnitude` (`minmag`) / `maxmagnitude` (`maxmag`) | Magnitudo min/max |
| `magnitudetype` | Tipo di magnitudo (es. `ML`, `Mw`, `Md`) |
| `mindepth` / `maxdepth` | Profondità min/max in km |

### Identificativo e contenuto
| Parametro | Descrizione |
|-----------|-------------|
| `eventid` | Recupero diretto di un singolo evento |
| `includeallorigins`    | Include tutte le localizzazioni alternative |
| `includeallmagnitudes` | Include tutte le stime di magnitudo |
| `includearrivals`      | Include i tempi di arrivo alle stazioni |
| `limit`  | Numero massimo di risultati (esiste un default, va aumentato se serve) |
| `offset` | Paginazione: indice di partenza |
| `orderby`| Ordinamento (es. `time`, `magnitude`) |

### Formato di output
| Parametro | Valori |
|-----------|--------|
| `format`  | `xml` (QuakeML), `text`, `json`, `geojson`, `kml`, `csv` |

Nel formato `text` i campi sono separati dal carattere `|` (barra verticale) e
comprendono, tra gli altri: id univoco, data/ora, latitudine, longitudine,
profondità, autore, magnitudo, tipo di magnitudo e località.

---

## 4. Esempi pratici

**Eventi recenti in Italia, magnitudo ≥ 2, formato testo:**
```
https://webservices.ingv.it/fdsnws/event/1/query?starttime=2026-06-01T00:00:00&minmagnitude=2&minlatitude=35&maxlatitude=47.5&minlongitude=6&maxlongitude=19&format=text
```

**Eventi entro 10 km da un punto (filtro a raggio), formato GeoJSON:**
```
https://webservices.ingv.it/fdsnws/event/1/query?starttime=2024-06-01&endtime=2024-07-01&minmagnitude=1.5&latitude=40.822&longitude=14.139&maxradiuskm=10&format=geojson
```

**Singolo evento per ID con tutte le magnitudo:**
```
https://webservices.ingv.it/fdsnws/event/1/query?eventid=46227982&includeallmagnitudes=true
```

**Esempio in Python:**
```python
import requests

url = "https://webservices.ingv.it/fdsnws/event/1/query"
params = {
    "starttime": "2026-06-01T00:00:00",
    "endtime":   "2026-07-01T00:00:00",
    "minmagnitude": 2.0,
    "minlatitude": 35, "maxlatitude": 47.5,
    "minlongitude": 6, "maxlongitude": 19,
    "format": "geojson",
}
r = requests.get(url, params=params, timeout=30)
r.raise_for_status()
eventi = r.json()["features"]
print(f"Trovati {len(eventi)} eventi")
```

---

## 5. Documentazione e licenza

- **Documentazione OpenAPI / Swagger ufficiale:**
  `https://webservices.ingv.it/swagger-ui/dist/?url=https://ingv.github.io/openapi/fdsnws/event/0.0.1/event.yaml`
  (equivalente API della pagina web `https://terremoti.ingv.it/`).
- **Licenza dati:** CC-BY — i dati possono essere riutilizzati con l'unico
  obbligo di citare la fonte (INGV).

---

## 6. Fonti

Documentazione e dettagli tratti dalle seguenti pagine:

1. INGV – Osservatorio Nazionale Terremoti, *Webservices and software*
   https://terremoti.ingv.it/webservices_and_software
2. INGV – *ISIDe, Italian Seismological Instrumental and Parametric Database*
   (dataset, formati e copertura) — https://data.ingv.it/dataset/09
3. INGV – Documentazione OpenAPI Earthquake Event (Swagger)
   https://webservices.ingv.it/swagger-ui/dist/?url=https://ingv.github.io/openapi/fdsnws/event/0.0.1/event.yaml
4. GitHub – *insomniacslk/ingv* (riferimento all'API documentata)
   https://github.com/insomniacslk/ingv
5. ASMI – *FDSN event web service* (esempi di vincoli temporali, box e circolari)
   https://emidius.mi.ingv.it/ASMI/services/events.php
6. ITACA – *FDSNWS Event Web-Service* (esempi di query FDSN)
   https://itaca.mi.ingv.it/fdsnws/event/1/query-options.html
7. Piersoft – *Come creare una mappa con i Terremoti registrati da INGV*
   (esempio formato `text` e licenza CC-BY)
   https://www.piersoft.it/come-creare-una-mappa-con-i-terremoti-registrati-da-ingv/
8. Capotosti et al., *Seismic and Geodetic Monitoring of the Federico II
   Building (Naples)*, GNGTS 2025 (esempio di query a raggio in GeoJSON)
   https://ricerca.ogs.it/retrieve/abf786b9-8025-49a4-818b-972aab7446cd/Capotosti_etal_GNGTS2025.pdf

> **Nota:** l'endpoint e la struttura dei parametri seguono lo standard FDSN-event
> versione 1. Verifica sempre la documentazione Swagger ufficiale (fonte 3) per
> eventuali aggiornamenti, poiché alcuni dettagli possono cambiare.