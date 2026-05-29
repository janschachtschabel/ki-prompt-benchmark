# KI-Prompts Metadataset – Metadaten-Pipeline (alt & optimiert)

> **Quelle:** Metadataset-Konfiguration `mds.xml` (edu-sharing / WirLernenOnline) sowie interne Entwurfsfassungen.
> **Zweck dieser Seite:** Dokumentation des System-Prompts und der Feld-Prompts für die automatische Metadaten-Vervollständigung und -Klassifikation – jeweils mit **Originalfassung (alt)** und **optimierter Fassung (neu)**.
> **Modell:** OpenAI `gpt-4.1` bzw. `gpt-4.1-mini` (Provider/Modell sind konfigurierbar). Die optimierten Prompts sind providerneutral formuliert.

---

## Optimierungsprinzipien

Die neuen Fassungen folgen den aktuellen Prompting-Empfehlungen von OpenAI (GPT-4.1) und Anthropic:

- **Explizit statt implizit.** GPT-4.1 befolgt Anweisungen wörtlicher als frühere Modelle; gewünschtes Format und Entscheidungsregeln werden klar benannt.
- **Inhalt vor Label.** Jede Einordnung erfolgt auf Basis des Volltexts, nicht von Dateinamen oder Selbstbeschreibungen.
- **Klare Trennung von Kontext und Auftrag.** Material (Informationen + Volltext) steht im `[user]`-Teil; die feldspezifische Aufgabe wird **nach** dem (potenziell langen) Kontext angehängt.
- **Positive Steuerung.** Es wird primär gesagt, was zu tun ist; Verbote nur, wo sie wiederkehrende Fehler verhindern.
- **Token-Effizienz durch Zentralisierung.** Gemeinsame Regeln stehen **einmal** im System-Prompt; die Feld-Prompts enthalten nur noch feldspezifische Logik und das Ausgabeformat.

### Architektur der Anfragen

Der Aufbau lehnt sich an die bisherige Vorgehensweise der Originalprompts an:

1. **Globaler Config** (wie ursprünglich `suggestion_ai`) – besteht aus einer `[system]`-Nachricht (Rolle, Regeln, Ausgabedisziplin) und einer `[user]`-Nachricht mit den Materialinformationen + Volltext. Beides ist statisch und bei jedem Aufruf gleich → cachebar (siehe Abschnitt 1).
2. **Feld-Auftrag** – die kurze, feldspezifische Anweisung (Abschnitte 2 ff.) wird – wie bei den alten Widget-Configs – an die `[user]`-Nachricht angehängt bzw. ergänzt.

> **Platzhalter:** `{{var(...)}}` = Metadatenwert, `{{node(...)}}` = Knoten-/Inhaltswert, `{{widget(...)}}` = dynamisch eingesetzte Wertelisten. `|` trennt Fallback-Quellen, `-` ist der Standardwert bei leerem Feld.

---

## 1. System-Prompt & Material-Kontext (globaler Config)

**Funktion:** Setzt Rolle, Domäne und globale Regeln (`[system]`) und stellt die Materialinformationen + Volltext bereit (`[user]`). Die feldspezifische Aufgabe aus den Abschnitten 2 ff. wird unter den Materialblock gesetzt – so steht die Anweisung nach dem langen Kontext.

**Alt (Original aus `mds.xml`):**

```text
[system]
Du bist ein Assistent für edu-sharing.
Du sollst dem Nutzer helfen die Metadaten der Materialien mit passenden Vorschlägen zu vervollständigen.
Gibt nur den Vorschlag als Wert zurück.

[user]
Ich benötige Hilfe bei diesem Material. Es hat die folgenden Eigenschaften
Titel: {{var(cclom:title)|-}}
Dateiname: {{var(cm:name)|-}}
Link: {{var(ccm:wwwwurl)|-}}
Materialart: {{var(ccm:educationallearningresourcetype)|-}}
Schlagworte: {{var(cclom:general_keyword)|-}}
Beschreibung: {{var(cclom:general_description)|-}}
Format: {{node(cclom:format)|-}}
Medientyp: {{node(virtual:mediatype)|-}}
```

**Neu (optimiert):**

```text
[system]
Du bist ein Klassifikations- und Texterstellungsdienst für Bildungsmetadaten im offenen Bildungsrepositorium edu-sharing / WirLernenOnline (OER für Schule und Bildung in Deutschland).
# Aufgabe
Du erhältst die vorhandenen Informationen zu einem Bildungsmaterial. Gib nur den Vorschlag als Wert zurück - keine Rückfragen, keine Einleitung, keine Begründung.
# Grundregeln
- Entscheide auf Basis des tatsächlichen INHALTS (Volltext). Selbstbeschreibungen und Dein allgemeines Wissen sind nachrangig.
- Felder mit dem Wert "-" sind leer und kein Beleg. Vorhandene Felder sind Kontext und stützen sich gegenseitig (Titel + Beschreibung + Schlagworte ergeben mehr als jedes Feld allein).
- Widerspricht ein Metadatenwert dem Inhalt, richte dich nach dem Inhalt.
- Verwende etablierte deutsche Fach- und Schulterminologie (an Lehrplänen orientiert) und passe das Sprachregister an die Bildungsstufe an.
- Im Zweifel die konservativere, besser belegbare Einordnung wählen.
# Ausgabe
- Gib ausschließlich den geforderten Wert zurück – ohne Einleitung, Anführungszeichen, Markdown oder Codeblöcke.
- Halte dich exakt an das im Auftrag genannte Ausgabeformat.
- Ist keine fundierte Aussage möglich, gib eine leere Antwort zurück.

[user]
Material mit folgenden vorhandenen Informationen:
Titel: {{var(cclom:title)|-}}
Beschreibung: {{var(cclom:general_description)|-}}
Schlagworte: {{var(cclom:general_keyword)|-}}
Dateiname: {{var(cm:name)|-}}
Link: {{var(ccm:wwwurl)|-}}
Übergeordnete Kategorie: {{var(ccm:oeh_extendedType)|-}}
Materialart: {{var(ccm:educationallearningresourcetype)|-}}
Inhaltstyp: {{var(ccm:oeh_lrt)|-}}
Bildungsstufe: {{node(ccm:educationalcontext)|-}}
Fachgebiet: {{node(ccm:taxonid)|-}}
Zielgruppe: {{var(ccm:educationalintendedenduserrole)|-}}
Berufsgruppe: {{var(ccm:oeh_profession_group)|-}}
Sprache: {{node(cclom:general_language)|-}}
Format: {{node(cclom:format)|-}}
Medientyp: {{node(virtual:mediatype)|-}}

Volltext:
{{node(textContent)|-}}

Auftrag: <hier die feldspezifische Aufgabe aus Abschnitt 2 ff. einsetzen>
```

**Geändert:** Klare Rolle als Klassifikationsdienst statt „Assistent"; explizite Inhalts-vor-Label-Regel; Umgang mit leeren (`-`) und widersprüchlichen Feldern definiert; strikte Ausgabedisziplin (kein Markdown/JSON, leer bei Unsicherheit). Materialblock um die für die Klassifikation relevanten Felder und den Volltext erweitert; Feld-Auftrag wird ans Ende der `[user]`-Nachricht gesetzt.

> **Hinweis:** Property korrekt als `ccm:wwwurl` (drei „w"). Die Originalfassung enthielt den Tippfehler `ccm:wwwwurl` (vier „w"), der ins Leere läuft.

---

## 2. `cclom:title` — Titel generieren

**Funktion:** Erzeugt einen suchoptimierten, inhaltsbeschreibenden Titel.

**Alt (Original):**

```text
Erzeuge einen kurzen, präzisen und eindeutigen Titel.
```

**Neu (optimiert):**

```text
Formuliere einen suchoptimierten Titel, der den INHALT benennt – nicht die Form.
- 40–70 Zeichen, substantivisch, ohne Artikel; wichtigste Begriffe zuerst.
- Materialtyp (Arbeitsblatt, Video, Quiz …) gehört NICHT in den Titel.
- Nicht nur das Fachgebiet ("Mathematik"), sondern das konkrete Thema.
- Keine Sonderzeichen oder Anführungszeichen.
Beispiele: "Fotosynthese Lichtreaktion und Dunkelreaktion", "Bruchrechnung Kürzen und Erweitern".
Ausgabe: nur der Titel.
```

**Geändert:** Trennung von Inhalt und Materialtyp, konkrete Längen-/Formregeln, Positiv- und Negativbeispiele, klares Ausgabeformat.

---

## 3. `cclom:general_description` — Beschreibung generieren

**Funktion:** Erzeugt einen motivierenden, suchoptimierten Beschreibungstext.

**Alt (Original):**

```text
Erzeuge eine aussagekräftige Beschreibung, maximal 2 Sätze.
```

**Neu (optimiert):**

```text
Schreibe eine motivierende Beschreibung des Inhalts.
- ca. 400–800 Zeichen, aktive Sprache, kurze Sätze (max. 20 Wörter).
- Reihenfolge: Kernthema → zentrale Inhalte/Konzepte → didaktische Form → Zielgruppe/Einsatz → Mehrwert.
- Fachbegriffe und gängige Suchbegriffe natürlich einbinden.
- Keine Floskeln ("Dieses Material …", "Hier finden Sie …"), keine erfundenen Inhalte, keine URLs/Dateinamen.
Ausgabe: nur der Beschreibungstext.
```

**Geändert:** Klare Längenspanne (statt „max. 2 Sätze"), feste inhaltliche Reihenfolge, Stilregeln und Verbote der häufigsten Floskeln. *Längenspanne bei Bedarf an Repositoriums-Konvention anpassen.*

---

## 4. `cclom:general_keyword` — Schlagworte generieren

**Funktion:** Erzeugt inhaltliche Schlagworte zur Suche/Erschließung.

**Alt (Original):**

```text
Erzeuge maximal 5 passende Schlagworte für dieses Material.
```

**Neu (optimiert):**

```text
Erzeuge 5–8 inhaltliche Schlagworte, absteigend nach Relevanz (Kernthema zuerst).
- Substantive im Nominativ Singular, etablierte Fachterminologie.
- Spezifisch statt generisch ("Bruchrechnung" statt "Mathematik").
- Keine Synonym-Dopplungen, keine Ober- und Unterbegriffe gleichzeitig.
- Keine Materialtypen, Bildungsstufen, Marken- oder Personennamen (außer bei historischen/literarischen Themen).
Ausgabe: kommagetrennte Liste, z. B. "Schlagwort1, Schlagwort2".
```

**Geändert:** Spanne 5–8 statt „max. 5", Relevanzreihenfolge, Begriffsqualität (Numerus, Spezifität), gezielte Verbote, eindeutiges Ausgabeformat.

---

## 5. `ccm:educationallearningresourcetype` — Materialart (Klassifikation → id)

**Funktion:** Ordnet das Material genau einer Materialart-Kategorie zu; gibt deren id zurück.

**Alt (Original):**

```text
Ordne das Material in einer der folgende Kategorien ein: {{widget("ccm:educationallearningresourcetype".values[*].{id:id, name:caption})}} nutze zur Einordnung den Namen aber gib die jeweilige id zurück.
```

**Neu (optimiert):**

```text
Bestimme die Materialart nach der DIDAKTISCHEN FUNKTION, nicht nach dem Dateiformat.
Leitfrage – was soll man damit tun?
  lesen/ansehen · bearbeiten/lösen · nachschlagen · ausprobieren · Unterricht planen
Wähle genau EINE Kategorie; bei Mischformen die dominante Funktion.
Kategorien (Name → id):
{{widget("ccm:educationallearningresourcetype".values[*].{id:id, name:caption})}}
Ausgabe: nur die id.
```

**Geändert:** Entscheidungsprinzip (Funktion statt Format) und Leitfrage ergänzt; Ein-Kategorie-Regel explizit; Ausgabeformat geschärft.

---

## 6. `ccm:oeh_lrt` — Inhaltstyp (Klassifikation → ids)

**Funktion:** Ordnet einen oder mehrere Inhaltstypen zu; gibt deren ids zurück.

**Alt (Original):**

```text
Ordne das Material in einer der folgende Kategorien ein: {{widget("ccm:oeh_lrt".values[*].{id:id,name:caption})}} nutze zur Einordnung den Namen aber gib die jeweilige id zurück.
```

**Neu (optimiert):**

```text
Bestimme den/die Inhaltstyp(en) nach didaktischer Funktion und Nutzungsweise, nicht nach Format.
- Mehrfachzuordnung erlaubt; Ober- und Unterkategorie NICHT gleichzeitig.
- "Quelle" nur als Einzelwert: Angebot eines Anbieters mit mehreren fachbezogenen Inhalten (z. B. ein YouTube-Kanal). Abzugrenzen von der Bezugsquelle (Distributionsdienst, z. B. YouTube selbst) und vom Herausgeber (rechtlich Verantwortlicher). Nicht gemeint im Sinne wissenschaftlicher Primär-/Sekundärquellen.
Kategorien (Name → id):
{{widget("ccm:oeh_lrt".values[*].{id:id,name:caption})}}
Ausgabe: kommagetrennte ids, z. B. "id1, id2".
```

**Geändert:** Mehrfachzuordnungsregel, Ober-/Unterkategorie-Ausschluss, präzise Definition und Abgrenzung von „Quelle" (knapp gehalten), klares Ausgabeformat.

---

## 7. `ccm:educationalcontext` — Bildungsstufe (Klassifikation → ids)

**Funktion:** Ordnet passende Bildungsstufe(n) zu; gibt deren ids zurück.

**Alt (Original):**

```text
Ordne das Material in passende Bildungsstufen ein: {{widget("ccm:educationalcontext".values[*].{id:id,name:caption})}} nutze zur Einordnung den Namen aber gib die jeweilige id zurück.
```

**Neu (optimiert):**

```text
Ordne passende Bildungsstufe(n) zu – nach Sprachniveau, vorausgesetztem Vorwissen, didaktischer Aufbereitung und typischer Lehrplanzuordnung in Deutschland.
- Maximal 3 Stufen, möglichst aufeinanderfolgend (keine Sprünge wie Elementarbereich + Hochschule).
Stufen (Name → id):
{{widget("ccm:educationalcontext".values[*].{id:id,name:caption})}}
Ausgabe: kommagetrennte ids.
```

**Geändert:** Einordnungskriterien benannt, Obergrenze (max. 3) und Plausibilitätsregel (keine Sprünge) ergänzt.

---

## 8. `ccm:educationalintendedenduserrole` — Zielgruppe (Klassifikation → ids)

**Funktion:** Bestimmt die intendierte(n) Nutzerrolle(n); gibt deren ids zurück.

> **Hinweis:** Property korrekt als `ccm:educationalintendedenduserrole`. In einer Entwurfsfassung war die Überschrift als `ccm:educationalintededenduserrole` (fehlendes „n") notiert.

**Alt (Original):**

```text
Antworte, für welche Zielgruppen das Material geeignet ist. Nutze folgende Werte und nenne nur die Ids: {{widget("ccm:educationalintendedenduserrole".values[*].{id:id,name:caption})}}
```

**Neu (optimiert):**

```text
Bestimme, WER das Material nutzen soll – nicht, wer es theoretisch könnte.
Merkmale:
  direkte Lerneransprache, Aufgaben, Übungen        → Lernende
  didaktische Hinweise, Lernziele, Lösungen          → Lehrende
  Erziehungs-/häusliche Förderhinweise               → Eltern
  Anleitungen zur Materialerstellung/Lizenzierung    → Autor/Ersteller
Mehrfachzuordnung nur bei eindeutiger Adressierung; sonst die wahrscheinlichste Hauptzielgruppe.
Rollen (Name → id):
{{widget("ccm:educationalintendedenduserrole".values[*].{id:id,name:caption})}}
Ausgabe: kommagetrennte ids.
```

**Geändert:** Konkrete Erkennungsmerkmale je Rolle, Abgrenzung „soll" vs. „könnte", Mehrfachzuordnungsregel.

---

## 9. `ccm:oeh_profession_group` — Berufsgruppe (Klassifikation → ids, optional)

**Funktion:** Ordnet Berufsgruppe(n) nur bei direktem beruflichem Bezug zu.

**Alt (Original):**

```text
Für welche Berufsgruppen ist dieses Material geeignet? Nutze folgende Werte und nenne nur die Ids: {{widget("ccm:oeh_profession_group".values[*].{id:id,name:caption})}}
```

**Neu (optimiert):**

```text
Bestimme Berufsgruppe(n) nur bei DIREKTEM beruflichem Bezug. Allgemeinbildende Inhalte: leere Ausgabe.
- Zuordnen, wenn das Material explizit für ein Berufsfeld erstellt ist oder klar berufsfeldspezifische Inhalte/Fallbeispiele/Handlungssituationen enthält.
- Nicht zuordnen bei nur lose verwandtem Thema (ein allgemeiner Biologie-Text ist nicht automatisch "Gesundheit").
- Maximal 3; im Zweifel weniger.
Berufsgruppen (Name → id):
{{widget("ccm:oeh_profession_group".values[*].{id:id,name:caption})}}
Ausgabe: kommagetrennte ids – oder leer, wenn kein Berufsbezug.
```

**Geändert:** Explizite Zuordnungsschwelle mit Positiv-/Negativfällen, Obergrenze, ausdrücklich erlaubte Leerausgabe.

---

## 10. `ccm:oeh_text_difficulty` — Textkomplexität (Klassifikation → Name)

**Funktion:** Bewertet die sprachliche Komplexität des Textes; gibt den Stufennamen zurück.

> **Hinweis (Bug):** Original und Entwurf griffen im `{{widget(...)}}` versehentlich auf die Werteliste von `ccm:educationallearningresourcetype` zu. Korrekt muss es `ccm:oeh_text_difficulty` heißen – unten korrigiert.

**Alt (Original, mit Bug):**

```text
Ordne den Text in eine der folgenden Komplexitäten ein: {{widget("ccm:educationallearningresourcetype".values[*].{name:caption})}} nutze zur Einordnung den Namen und gib ihn zurück.
```

**Neu (optimiert, Bug behoben):**

```text
Bewerte die sprachliche Komplexität des TEXTES, nicht des Themas (ein einfach formulierter Text über Quantenphysik = niedrige Komplexität).
Kriterien: Satzbau, Wortschatz, Abstraktionsgrad, vorausgesetztes Vorwissen, Informationsdichte.
- Wenig/kein Text (Bild, Video ohne Transkript): niedrigste Stufe.
- Gemischte Komplexität: nach dem Hauptteil gewichten.
- Fachbegriffe mit Erklärung: eine Stufe niedriger als ohne.
Stufen (Name):
{{widget("ccm:oeh_text_difficulty".values[*].{name:caption})}}
Ausgabe: nur der Name der Stufe.
```

**Geändert:** Widget-Referenz korrigiert; Text-statt-Thema-Prinzip, Bewertungskriterien und Sonderfälle kompakt ergänzt.

---

## 11. `cclom:general_language` — Sprache (→ Locale-Code)

**Funktion:** Bestimmt Sprache und regionale Variante des Inhalts.

**Alt (Original):**

```text
Antworte nur mit der Sprache des Inhalts in exakt diesem Format: en_US oder de_DE
```

**Neu (optimiert):**

```text
Bestimme Sprache und regionale Variante des Haupt-Inhaltstextes (nicht der Metadaten oder Dateinamen).
- Format: xx_YY, z. B. de_DE, de_AT, de_CH, en_US, en_GB, fr_FR, es_ES, tr_TR, it_IT.
- Variante an sprachlichen Markern festmachen (z. B. de_CH ohne ß, "Velo"; en_GB "-our"/"-ise").
- Mehrsprachig: Sprache mit dem größten Textanteil. Kein erkennbarer Text: de_DE als Fallback.
Ausgabe: nur der Code, z. B. de_DE.
```

**Geändert:** Klar auf Inhaltstext bezogen, mehr Locale-Optionen, Markerlogik für Varianten, Mehrsprachig-/Fallback-Regel.

---

## 12. `cclom:typicallearningtime` — Lehr-/Lernzeit (→ Millisekunden)

**Funktion:** Schätzt die typische Bearbeitungszeit im Unterricht in Millisekunden.

**Alt (Original):**

```text
Antworte, wie lange man für dieses Material im Unterricht benötigt, lediglich als Zahl in Millisekunden.
```

**Neu (optimiert):**

```text
Schätze die typische Bearbeitungszeit im Unterricht in MILLISEKUNDEN (ganze Zahl).
Anhaltspunkte: 5 min = 300000 · 10 min = 600000 · 15 min = 900000 · 45 min (eine Stunde) = 2700000.
Schätzkriterien:
- Text: ~150 Wörter/Min (Fachtext ~100). Video/Audio: Medienlänge + 30 %. Übungen: Summe der Aufgaben.
- Keine Einschätzung möglich: 2700000.
Ausgabe: nur die Zahl, z. B. 2700000.
```

**Geändert:** Referenzwerte und Schätzkriterien ergänzt, Standardwert definiert, Ausgabeformat geschärft.

---

## 13. Weitere Konfigurationen (nicht Teil dieser Optimierung)

Die folgenden KI-Konfigurationen aus `mds.xml` gehören nicht zur Metadaten-Suggest-Pipeline und bleiben hier unverändert; sie können bei Bedarf separat optimiert werden:

- `image_ai` – Bildgenerierung zu einem Material (OpenAI, `gpt-image-2`).
- `topic_page_ai_topic_header_image` – Vorschaubild einer Sammlung.
- `topic_page_ai_topic_header_description` / `…_topic_header_text` – Beschreibungs-/Einleitungstexte für Themenseiten.
- `topic_page_ai_text_widget` – 5-Satz-Zusammenfassung.
- `topic_page_ai_default` / `…_chat_completion` / `…_create_image` / `…_clear_cache` – reine Modell-/Cache-Einstellungen.

---

## 14. Platz für neue Prompts

> *Vorlage unten kopieren und ausfüllen.*

### 14.1 *(Feld / Konfig-ID)*

**Funktion:**

**Alt (falls vorhanden):**

```text
```

**Neu (optimiert):**

```text
```

**Geändert:**

---

### 14.2 *(Feld / Konfig-ID)*

**Funktion:**

**Neu (optimiert):**

```text
```

---

## 15. Vermerke / Notizen

> *Raum für Anmerkungen, Tests und Entscheidungen des Teams.*

**Bereits korrigierte Auffälligkeiten aus den Vorlagen:**

- `ccm:wwwwurl` → korrekt `ccm:wwwurl` (Tippfehler, vier statt drei „w").
- `ccm:oeh_text_difficulty`: Widget-Referenz zeigte auf `ccm:educationallearningresourcetype` → korrigiert auf `ccm:oeh_text_difficulty`.
- Überschrift `ccm:educationalintededenduserrole` → korrekt `ccm:educationalintendedenduserrole`.

**Offene Punkte / Tests:**

| Datum | Person | Vermerk |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |

**Freie Notizen:**

-
-
-
