# WLO Prompt Tester

Test- und Vergleichstool für die KI-Prompts der automatischen Metadaten-Generierung in **edu-sharing / WirLernenOnline**. Es stellt den **IST-Stand der Prompts (`mds.xml`, edu-sharing 10.0)** einer **optimierten Fassung** gegenüber, bewertet beide per **LLM-as-Judge** und erhebt Qualität, Generierungszeit und Token-Verbrauch — über mehrere Modelle und Provider hinweg.

## Hauptfunktionen

- **Provider-Wahl:** OpenAI nativ · B-API → OpenAI · B-API → AcademicCloud (KISSKI), jeweils Staging/Prod/Custom-Endpunkt.
- **Modell-Wahl:** Testmodell, optionale Vergleichsmodelle (Batch) und ein separates, optional konstantes **Judge-Modell**. Modell-Listen werden vom Provider geladen.
- **Prompt-Quellen je Set (A = Original, B = Optimiert):** `mds.xml`, `mds_28052026.xml`, `mds_28052026_v2.xml`, eigene XML-Datei oder manuelle Eingabe.
- **Zwei Prompt-Kategorien:** Material-Metadaten (Titel, Beschreibung, Schlagworte, Klassifikationen …) und Themenseiten-Prompts.
- **Testmaterial-Quellen:** Beispielmaterialien · WLO-Inhalt aus dem Repo (per Node-ID/Render-URL) · beliebige URL (Volltext über Text-Extraktionsdienst).
- **Einzeltest & Batch:** Material × Feld × Modell; Ergebnisse, Auswertung und Statistik tabellarisch/grafisch.
- **LLM-as-Judge:** Bewertung nach 5 Kriterien (Skala 1–10) mit Gewinner und Begründung.
- **Verbesserungsvorschläge:** sammelt Judge-Feedback über alle Durchläufe und erzeugt je Feld einen verbesserten Prompt.
- **Export:** Prompt-Sets als `mds.xml` (Original/Optimiert).
- **Robustheit:** Rate-Limit-Throttle + serielle Calls für AcademicCloud, Retry mit Backoff, 60 s Timeout, Sonderbehandlung von Reasoning-Modellen (`<think>`-Stripping, höheres Token-Budget).

## Tech-Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript 5**
- **Tailwind CSS 4** (`@tailwindcss/postcss`)
- **OpenAI SDK** für alle Provider (OpenAI-kompatible API)

## Voraussetzungen

- **Node.js ≥ 18.18** (empfohlen 20+)
- npm
- Mindestens ein API-Key (OpenAI bzw. B-API/AcademicCloud)

## Installation

```bash
npm install
```

## Umgebungsvariablen

Keys können **in der UI** eingegeben oder als Umgebungsvariablen hinterlegt werden (z. B. in `.env.local` oder bei Vercel). Sind sie gesetzt, werden sie als Default verwendet (in der UI maskiert angezeigt).

| Variable          | Zweck                                                        |
| ----------------- | ----------------------------------------------------------- |
| `OPENAI_API_KEY`  | OpenAI nativ                                                |
| `B_API_KEY`       | B-API (für OpenAI- **und** AcademicCloud-Backend)           |
| `GWDG_API_KEY`    | Fallback für AcademicCloud, falls `B_API_KEY` nicht gesetzt |

Beispiel `.env.local`:

```bash
OPENAI_API_KEY=sk-...
B_API_KEY=...
GWDG_API_KEY=...
```

## Starten

```bash
npm run dev      # Entwicklungsserver (http://localhost:3000)
npm run build    # Produktions-Build
npm run start    # Produktionsserver
npm run lint     # Linting
```

Eigener Port: `npx next dev -p 3099`

## Bedienung

1. **KI-Anbindung** (oben): Provider, ggf. Umgebung (Staging/Prod), Base URL und API-Key wählen. Darunter **Testmodell**, im Batch optionale **Vergleichsmodelle** und das **Judge-Modell** (gleiches Modell wie Test oder konstantes Modell).
2. **Prompt-Quellen:** Set A (Original) und Set B (Optimiert) je aus Datei, mitgelieferter `mds*.xml` oder manuell laden. Felder ohne Eintrag in der Datei nutzen die App-Vorgabe.
3. **Testmaterial:** Beispiel, Repo-Inhalt (Node-ID/Render-URL) oder URL (Volltext-Extraktion); Prod/Staging wählbar.
4. **Einzeltest:** Feld wählen, **Vergleichen** → Original- vs. Optimiert-Output, danach **Judge starten**.
5. **Batch-Modus:** Materialien (auch mehrere per Node-ID/URL), Felder und Modelle wählen, **Batch starten**. Ergebnisse, **Auswertung** (Modellvergleich, Kriterien-Heatmap, Feld-Aufschlüsselung) und **Verbesserungsvorschläge** erscheinen darunter.
6. **Export:** „Export Original XML" / „Export Optimiert XML" erzeugt eine `mds.xml`-Datei.

## Projektstruktur

```
src/
  app/
    page.tsx            # Haupt-UI (Einzeltest, Batch, Auswertung)
    layout.tsx, globals.css
    api/
      generate/         # Text-Generierung
      judge/            # LLM-as-Judge
      generate-image/   # Bildgenerierung (Themenbild)
      models/           # Modell-Liste vom Provider
      env/              # maskierte Env-Keys für die UI
      extract-text/     # Volltext-Extraktion einer URL
      repo-node/        # edu-sharing Node-Metadaten
  lib/
    prompts.ts          # Prompt-Felder + Message-Builder
    materials.ts        # Beispielmaterialien & Themen
    xml-export.ts       # Export als mds.xml
    xml-import.ts       # Prompts aus mds.xml einlesen
    llm-retry.ts        # Retry/Backoff für Rate-Limits & Timeouts
  types/index.ts        # gemeinsame Typen
public/data/            # ausgelieferte Prompt-Sets: mds.xml, mds_28052026.xml, mds_28052026_v2.xml
docs/                   # Dokumentation + Referenz-/Quellkopien der mds*.xml
```

## API-Routen

| Route                | Zweck                                                  |
| -------------------- | ----------------------------------------------------- |
| `/api/generate`      | Prompt → Output (Text)                                |
| `/api/judge`         | Bewertung Original vs. Optimiert (5 Kriterien, JSON)  |
| `/api/generate-image`| Bildgenerierung (Themenbild, `gpt-image-1`)           |
| `/api/models`        | verfügbare Modelle des Providers laden                |
| `/api/env`           | maskierte Env-Keys für die Anzeige in der UI          |
| `/api/extract-text`  | Volltext einer URL via Text-Extraktionsdienst         |
| `/api/repo-node`     | Metadaten eines edu-sharing-Knotens laden             |

## Prompt-Sets / Datendateien (`public/data/`)

| Datei                  | Inhalt                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| `mds.xml`              | IST-Stand der Prompts (edu-sharing 10.0)                         |
| `mds_28052026.xml`     | optimierte Fassung (V1), syntaxgleicher Drop-in-Ersatz          |
| `mds_28052026_v2.xml`  | optimierte Fassung V2 (Judge-Feedback aus Durchlauf 1 eingearbeitet) |

Die App lädt diese Dateien aus `public/data/` (Abruf über `/data/...`). Referenz-/Quellkopien sowie die Projektdokumentation liegen im Ordner `docs/`; bei Änderungen die Kopie unter `public/data/` aktualisieren, damit die App sie ausliefert.

## Externe Dienste

- **edu-sharing Repository:** Prod `https://redaktion.openeduhub.net` · Staging `https://repository.staging.openeduhub.net`
- **Text-Extraktion:** Prod `https://text-extraction.prod.openeduhub.net` · Staging `https://text-extraction.staging.openeduhub.net`
- **B-API:** `https://b-api.{staging|prod}.openeduhub.net/api/v1/llm/{openai|academiccloud}`

## Technische Hinweise (B-API & AcademicCloud)

- **AcademicCloud erlaubt keine parallelen Anfragen** → die App serialisiert Alt/Neu-Calls und hält einen Mindestabstand (Throttle) ein; Wartezeit fließt **nicht** in die Messung ein.
- **Reasoning-Modelle** (qwen3, glm-4.x …) verbrauchen Tokens für sichtbares „Denken" (`<think>…</think>`): Token-Budget auf 4096 angehoben, `<think>`-Blöcke werden entfernt, leere/abgeschnittene Antworten erkannt; 60 s Timeout + Retry mit Backoff.
- **Token-Parameter modellabhängig:** gpt-5/o-Serie nutzen `max_completion_tokens`, klassische Modelle `max_tokens`.

Details und Messergebnisse: siehe `docs/Management_Summary_Prompt-Optimierung.md`.

## Deployment (Vercel)

1. Repository mit Vercel verbinden — Next.js wird automatisch erkannt (kein `vercel.json` nötig).
2. Umgebungsvariablen (`OPENAI_API_KEY`, `B_API_KEY`, `GWDG_API_KEY`) im Projekt setzen (Environment: Production/Preview/Development nach Bedarf).
3. Deploy. Die Prompt-Sets unter `public/data/*.xml` werden als statische Assets ausgeliefert (Abruf über `/data/...`).

**Hinweise zu Vercel-Funktionen:**
- Die API-Routen setzen `runtime = 'nodejs'` und `maxDuration` (60 s für LLM-/Extraktions-Routen, 30 s für models/repo-node). Auf dem **Hobby-Plan** ist 60 s das Maximum — für sehr langsame Reasoning-Modelle mit Wiederholungen ggf. **Pro-Plan** mit höherem `maxDuration`.
- Keys können alternativ direkt in der UI eingegeben werden, falls keine Env-Variablen gesetzt sind.

## Bekannte Einschränkungen

- Anonymer Repo-Zugriff funktioniert nur für **öffentliche** Inhalte (sonst 401/403).
- Die mitgelieferten `mds*.xml` enthalten KI-Prompts nur für die Felder, die in der edu-sharing-`mds.xml` als `aiConfig` verdrahtet sind (Titel, Beschreibung, Schlagworte, Materialart + Themenseiten). Weitere Felder werden aus den App-Vorgaben ergänzt.
- Bildgenerierung läuft über OpenAI (`gpt-image-1`); ob die B-API einen Image-Endpunkt proxyt, hängt vom Backend ab.
