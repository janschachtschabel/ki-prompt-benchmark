# KI-Prompts Metadataset – Metadaten-Pipeline & Themenseiten (alt & optimiert)

> **Quelle:** Metadataset-Konfiguration `mds.xml` (edu-sharing / WirLernenOnline) sowie interne Entwurfsfassungen.
> **Zweck dieser Seite:** Dokumentation der Prompts für (a) die automatische Metadaten-Vervollständigung/-Klassifikation einzelner Materialien und (b) die Texte/Bilder von Themenseiten – jeweils mit **Originalfassung (alt)** und **optimierter Fassung (neu)**.
> **Modell:** OpenAI `gpt-4.1` / `gpt-4.1-mini` (Texte), `gpt-image-2` (Bilder). Provider/Modell sind konfigurierbar; die optimierten Textprompts sind providerneutral formuliert.

---

## Optimierungsprinzipien

Die neuen Fassungen folgen den aktuellen Prompting-Empfehlungen von OpenAI (GPT-4.1) und Anthropic:

- **Explizit statt implizit.** GPT-4.1 befolgt Anweisungen wörtlicher als frühere Modelle; gewünschtes Format und Entscheidungsregeln werden klar benannt.
- **Inhalt vor Label.** Jede Einordnung erfolgt auf Basis des Volltexts, nicht von Dateinamen oder Selbstbeschreibungen.
- **Klare Trennung von Kontext und Auftrag.** Material (Informationen + Volltext) steht im `[user]`-Teil; die feldspezifische Aufgabe wird **nach** dem (potenziell langen) Kontext angehängt.
- **Positive Steuerung.** Es wird primär gesagt, was zu tun ist; Verbote nur, wo sie wiederkehrende Fehler verhindern.
- **Token-Effizienz durch Zentralisierung.** Gemeinsame Regeln stehen **einmal** im System-Prompt; die Feld-Prompts enthalten nur noch feldspezifische Logik und das Ausgabeformat.
- **Bildprompts knapp und beschreibend.** Bildmodelle reagieren besser auf eine konzentrierte Bildbeschreibung als auf lange Meta-Anweisungen.

### Architektur der Anfragen

Der Aufbau lehnt sich an die bisherige Vorgehensweise der Originalprompts an:

1. **Globaler Config** (wie ursprünglich `suggestion_ai`) – `[system]` (Rolle, Regeln, Ausgabedisziplin) + `[user]` (Materialinformationen + Volltext). Statisch und cachebar (Abschnitt 1).
2. **Feld-Auftrag** – die kurze, feldspezifische Anweisung (Abschnitte 2 ff.) wird – wie bei den alten Widget-Configs – an die `[user]`-Nachricht angehängt.
3. **Themenseiten-Prompts** (Abschnitt 15) sind eigenständige Configs für ganze Sammlungen und nutzen einen anderen Datensatz (Sammlungsthema, Bildungsstufe, Fachgebiet, Schlagwörter).

> **Platzhalter:** `{{var(...)}}` = Metadatenwert, `{{node(...)}}` = Knoten-/Inhaltswert, `{{widget(...)}}` = dynamisch eingesetzte Wertelisten, `_DISPLAYNAME` = lesbarer Anzeigename eines Vokabularwerts. `|` trennt Fallback-Quellen, `-` ist der Standardwert bei leerem Feld.

---

## 1. System-Prompt & Material-Kontext (globaler Config)

**Funktion:** Setzt Rolle, Domäne und globale Regeln (`[system]`) und stellt die Materialinformationen + Volltext bereit (`[user]`). Die feldspezifische Aufgabe aus den Abschnitten 2 ff. wird unter den Materialblock gesetzt.

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

**Geändert:** Klare Rolle als Klassifikationsdienst statt „Assistent"; explizite Inhalts-vor-Label-Regel; Umgang mit leeren (`-`) und widersprüchlichen Feldern definiert; strikte Ausgabedisziplin; Materialblock um klassifikationsrelevante Felder und Volltext erweitert; Feld-Auftrag ans Ende der `[user]`-Nachricht.

> **Hinweis:** Property korrekt als `ccm:wwwurl` (drei „w"). Die Originalfassung enthielt den Tippfehler `ccm:wwwwurl`.
> **Offen (siehe Abschnitt 13):** Die Vokabular-Felder (Fachgebiet, Bildungsstufe, Materialart, Zielgruppe, Berufsgruppe) liefern aktuell vermutlich Roh-IDs/URIs statt lesbarer Namen.

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

**Geändert:** Trennung von Inhalt und Materialtyp, konkrete Längen-/Formregeln, Beispiele, klares Ausgabeformat.

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

**Geändert:** Klare Längenspanne (statt „max. 2 Sätze"), feste Reihenfolge, Stilregeln und Floskel-Verbote. *Längenspanne bei Bedarf anpassen.*

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

**Geändert:** Spanne 5–8 statt „max. 5", Relevanzreihenfolge, Begriffsqualität, gezielte Verbote, eindeutiges Ausgabeformat.

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

**Geändert:** Entscheidungsprinzip (Funktion statt Format) und Leitfrage ergänzt; Ein-Kategorie-Regel explizit.

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
- "Quelle" nur als Einzelwert: Angebot eines Anbieters mit mehreren fachbezogenen Inhalten (z. B. ein YouTube-Kanal). Abzugrenzen von der Bezugsquelle (Distributionsdienst, z. B. YouTube selbst) und vom Herausgeber (rechtlich Verantwortlicher). Nicht im Sinne wissenschaftlicher Primär-/Sekundärquellen.
Kategorien (Name → id):
{{widget("ccm:oeh_lrt".values[*].{id:id,name:caption})}}
Ausgabe: kommagetrennte ids, z. B. "id1, id2".
```

**Geändert:** Mehrfachzuordnungsregel, Ober-/Unterkategorie-Ausschluss, präzise Definition/Abgrenzung von „Quelle".

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

**Geändert:** Einordnungskriterien benannt, Obergrenze (max. 3) und Plausibilitätsregel ergänzt.

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

> **Hinweis (Bug):** Original/Entwurf griffen im `{{widget(...)}}` versehentlich auf `ccm:educationallearningresourcetype` zu. Korrekt: `ccm:oeh_text_difficulty` – unten behoben.

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

**Geändert:** Widget-Referenz korrigiert; Text-statt-Thema-Prinzip, Kriterien und Sonderfälle ergänzt.

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

**Geändert:** Klar auf Inhaltstext bezogen, mehr Locale-Optionen, Markerlogik, Mehrsprachig-/Fallback-Regel.

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

**Geändert:** Referenzwerte und Schätzkriterien ergänzt, Standardwert definiert.

---

## 13. Eingaben-Check: Was jeder besondere Prompt braucht – und ob er es bekommt

Geprüft wurde, ob die besonderen (Klassifikations-/Generierungs-)Prompts die für ihre Entscheidung nötigen Informationen tatsächlich aus dem Materialblock (Abschnitt 1) bzw. ihren Eingabedaten erhalten.

| Prompt | Braucht zusätzlich zum Volltext | Im Kontext vorhanden? |
|---|---|---|
| Materialart (5) | Format, Medientyp | ja |
| Inhaltstyp (6) | Format, Medientyp, Anbieterkontext | weitgehend ja |
| Bildungsstufe (7) | Fachgebiet, Sprachniveau | ja – Fachgebiet **als Roh-ID** |
| Zielgruppe (8) | Volltext (Ansprache erkennen) | ja |
| **Berufsgruppe (9)** | **Fachgebiet, Bildungsstufe, Materialart** | **ja – aber als Roh-ID statt lesbar** |
| Textkomplexität (10) | der eigentliche Text | ja (Volltext) |
| Sprache (11) | der eigentliche Text | ja (Volltext) |
| Lernzeit (12) | Textlänge **und Mediendauer** | Textlänge ja, **Mediendauer fehlt** |

### Befund 1 (wichtig): Vokabular-Felder kommen vermutlich als ID/URI, nicht lesbar

Fachgebiet, Bildungsstufe, Materialart, Zielgruppe und Berufsgruppe stehen im Materialblock als `{{var(...)}}` bzw. `{{node(...)}}`. Bei SKOS-Vokabularen liefern diese in edu-sharing in der Regel den **Schlüssel/URI** (z. B. `…/vocabs/discipline/380`), nicht „Biologie". Der **Berufsgruppen-Prompt** soll aber gerade aus Fachgebiet + Bildungsstufe + Materialart auf einen Berufsbezug schließen – mit kryptischen URIs als Kontext ist diese Information faktisch unbrauchbar. Die Themenseiten-Prompts (Abschnitt 15) lösen das bereits über die `_DISPLAYNAME`-Variante.

**Empfehlung:** Für alle Vokabular-Felder im Materialblock den lesbaren Namen einsetzen:

```text
Materialart: {{var(ccm:educationallearningresourcetype_DISPLAYNAME)|var(ccm:educationallearningresourcetype)|-}}
Inhaltstyp: {{var(ccm:oeh_lrt_DISPLAYNAME)|var(ccm:oeh_lrt)|-}}
Bildungsstufe: {{var(ccm:educationalcontext_DISPLAYNAME)|node(ccm:educationalcontext_DISPLAYNAME)|-}}
Fachgebiet: {{var(ccm:taxonid_DISPLAYNAME)|node(ccm:taxonid_DISPLAYNAME)|-}}
Zielgruppe: {{var(ccm:educationalintendedenduserrole_DISPLAYNAME)|var(ccm:educationalintendedenduserrole)|-}}
Berufsgruppe: {{var(ccm:oeh_profession_group_DISPLAYNAME)|var(ccm:oeh_profession_group)|-}}
```

*(Den genauen Resolver-Suffix `_DISPLAYNAME` gegen das eigene Setup prüfen; das `var|node|-`-Fallback-Muster stammt aus den `topic_page`-Prompts.)*

### Befund 2: Lernzeit erhält keine Mediendauer

Der Lernzeit-Prompt rechnet „Video/Audio: Medienlänge + 30 %", doch im Kontext gibt es nur Format und Medientyp, keine Dauer. Für Video/Audio schätzt das Modell damit blind. Falls in den Metadaten vorhanden (LOM `cclom:duration`), Zeile ergänzen: `Mediendauer: {{node(cclom:duration)|-}}`.

### Befund 3: Volltext-Fokus vs. Link-Ressourcen

Viele WLO-Inhalte sind reine Links ohne extrahierten `textContent`. Der System-Prompt betont „auf Basis des tatsächlichen INHALTS (Volltext)" und „keine fundierte Aussage → leere Antwort". Bei leerem Volltext kann das Modell so zu oft aufgeben, obwohl Titel/Beschreibung/Schlagworte vorliegen. **Optionale Entschärfung** der ersten Grundregel: „… auf Basis des tatsächlichen Inhalts (Volltext bzw. der vorliegenden Informationen)".

---

## 14. Themenseiten-Prompts: Eingaben-Check

Die Themenseiten-Prompts beschreiben **ganze Sammlungen**, nicht einzelne Materialien. Sie verwenden bereits die lesbare `_DISPLAYNAME`-Variante.

| Prompt | Eingaben | Anmerkung |
|---|---|---|
| Header-Bild (15.1) | Thema, Fachgebiet, Schlagwörter | lesbar, ausreichend |
| Header-Beschreibung (15.2) | Thema, Bildungsstufe, Fachgebiet | **kein Inhalt der Sammlung** → kann keine konkreten Ressourcen nennen |
| Header-Text (15.3) | Thema, Bildungsstufe, Fachgebiet | wie oben |
| Zusammenfassung (15.4) | nur Sammlungsthema (`cm:name`) | arbeitet praktisch nur aus dem Modellwissen, kein Sammlungsinhalt |

**Hinweis:** 15.2/15.3 fordern „Hinweise auf konkrete Ressourcen, sofern vorliegen", bekommen aber keine Ressourcenliste. 15.4 erhält nur den Sammlungstitel. Wenn konkretere Texte gewünscht sind, sollten Titel/Schlagwörter enthaltener Materialien als zusätzliche Eingabe übergeben werden.

---

## 15. Themenseiten-Prompts (`topic_page_*`) – optimiert

### 15.1 `topic_page_ai_topic_header_image` — Vorschaubild einer Sammlung

**Funktion:** Erzeugt ein realistisches Header-/Vorschaubild für eine Sammlung (Modell `gpt-image-2`).

**Alt (Original):**

```text
## Aufgabe
Erzeuge ein ansprechendes, realistisch wirkendes Vorschaubild zu einer Sammlung von Bildungsinhalten.
- Vermeide sämtliche Textelemente oder Logos im Bild.
- Nutze die zentralen Schlagwörter, um das Thema klar widerzuspiegeln.
- Richte Dich nach den folgenden Anforderungen und Stilvorgaben.
## Anforderungen
1. **Hauptmotiv**: Beschreibe das zentrale Element der Sammmlung (eine Szene oder ein Kernthema), das den Bildungsinhalt repräsentiert.
2. **Realismus**: Achte auf eine glaubwürdige Darstellung aller Objekte und Szenen, inklusiv und kulturell sensitiv.
3. **Minimalismus**: Reduziere Ablenkungen, konzentriere Dich auf das Wesentliche, um eine klare Botschaft zu vermitteln.
4. **Emotionale Ansprache**: Verwende warme Farben, natürliches Licht und eine einladende Atmosphäre.
5. **Keine Texte im Bild**: Verzichte gänzlich auf Schrift oder Logos, um Redundanz und visuelle Störungen zu vermeiden.
## Stilvorgaben
- **Attribute**: hochdetailliert, scharfe Fokussierung, poliert, makellos, ansprechend, Symmetrie, kohärent, minimalistisch, sauber, aufgeräumt
- **Farben und Beleuchtung**: warme Farben, natürliches Licht
- **Designelemente**: klare Linien, einfache Formen, ausbalancierte Komposition
- **Qualität**: professionelle Qualität, hohe Auflösung
- **Ästhetik**: elegant, geradlinig, modern, klare visuelle Hierarchie
## Eingabedaten
- **Beschreibung des Bildungsinhalts**: {{var(cm:name)|node(cm:name)|-}} ({{var(ccm:taxonid_DISPLAYNAME)|node(ccm:taxonid_DISPLAYNAME)|-}})
- **Wichtige Schlagwörter**: {{var(cclom:general_keyword)|node(cclom:general_keyword)|-}}
**Integriere alle oben genannten Anforderungen und Stilvorgaben sowie die Eingabedaten 'Beschreibung des Bildungsinhalts' und 'Wichtige Schlagwörter'.**
```

**Neu (optimiert):**

```text
Erzeuge ein realistisches, ansprechendes Vorschaubild für eine Sammlung von Bildungsinhalten zum Thema "{{var(cm:name)|node(cm:name)|-}}" ({{var(ccm:taxonid_DISPLAYNAME)|node(ccm:taxonid_DISPLAYNAME)|-}}).
Zentrale Motive aus den Schlagwörtern: {{var(cclom:general_keyword)|node(cclom:general_keyword)|-}}.
Stil: ein klares Hauptmotiv, minimalistisch und aufgeräumt, warme Farben, natürliches Licht, einladende Atmosphäre, hohe Detailtiefe, scharfer Fokus, ausgewogene Komposition, professionelle Qualität.
Darstellung glaubwürdig, inklusiv und kulturell sensibel.
Kein Text, keine Schrift, keine Logos.
```

**Geändert:** Lange Meta-Struktur in eine konzentrierte Bildbeschreibung überführt (Bildmodelle arbeiten so zuverlässiger), Kernvorgaben und Daten erhalten.

---

### 15.2 `topic_page_ai_topic_header_description` — Beschreibungstext einer Sammlung

**Funktion:** Zweiabsätziger Vorstellungstext (max. 400 Zeichen).

**Alt (Original):**

```text
## Aufgabe
1. **Ziel**
   - Erstelle einen ansprechenden, prägnanten Text, der eine Sammlung von Bildungsressourcen vorstellt.
   - Wecke das Interesse der Leserinnen und Leser durch einen konkreten, thematischen Einstieg.
   - Erkläre kurz und verständlich die wichtigsten Themen der Sammlung.
   - Zeige, wie Lehrende und Lernende die Ressourcen praktisch einsetzen können.
   - Integriere Hinweise auf konkrete Ressourcen der Sammlung in den Text, sofern Dir diese als Information vorliegen.
2. **Struktur**
   - **Absatz 1**: Thematischer Einstieg, der ein konkretes Problem, eine Frage oder ein Szenario aufgreift und so zum Weiterlesen einlädt. Benenne die zentralen Themen der Sammlung.
   - **Absatz 2**: Übersicht der Hauptthemen, konkreter Mehrwert für Lehrende und Lernende, Bezug zu Lernzielen oder Kompetenzen. Schließe mit einem aktivierenden Satz, der zur Nutzung einlädt.
3. **Sprache und Stil**
   - **Verständlichkeit**: Vermeide unnötige Fachbegriffe. Erläutere komplexe Konzepte in einem Nebensatz oder durch ein Beispiel.
   - **Aktive Formulierungen**: Verwende aktive Satzstrukturen. Vermeide Passivkonstruktionen, wo immer möglich.
   - **Kohärenz**: Nutze einheitliche Terminologie. Vermeide Wiederholungen, Widersprüche und Synonymketten.
   - **Prägnanz**: Schreibe kurze Sätze (max. 20 Wörter). Bevorzuge einfache Wörter (2–3 Silben).
   - **Lesbarkeit**: Setze klare Absätze. Jeder Absatz verfolgt genau einen Gedanken.
   - **Zielgruppenanpassung**: Passe Tonalität und Sprachniveau an Bildungsstufe und Fachgebiet an (z. B. spielerischer für Grundschule, fachlicher für Sekundarstufe II).
4. **Inhaltliche Relevanz**
   - Baue relevante Schlüsselbegriffe natürlich in den Fließtext ein.
   - Orientiere dich am Vorwissen, den Interessen und dem Nutzen der Zielgruppe.
   - Mache den Mehrwert der Sammlung greifbar: Was können Nutzende nach der Arbeit mit den Materialien besser?
5. **Verboten**
   - Eröffnungen mit 'Diese Sammlung...', 'Dieses Material...', 'Hier finden Sie...' oder ähnlichen Floskeln.
   - Allgemeine, nichtssagende Aussagen wie 'Ein spannendes Thema für alle' oder 'Ideal für den Unterricht'.
   - URLs, Markennamen und Dateinamen.
   - Reine Aufzählung von Schlagworten ohne Satzstruktur.
   - Inhalte erfinden, die nicht in den gegebenen Informationen enthalten sind.
   - Übertriebene Superlative ('die beste Sammlung', 'unverzichtbar').
6. **Output-Format**
   - Gib den fertigen Text als zusammenhängende Beschreibung in genau zwei Absätzen aus.
   - Halte die maximale Zeichenlänge ein (inkl. Leerzeichen).
   - Gib ausschließlich den Beschreibungstext aus – keine Überschriften, keine Meta-Kommentare, keine Erklärungen.
## Eingabedaten
- **Thema der Sammlung:** {{var(cm:name)|node(cm:name)|-}}
- **Bildungsstufe:** {{var(ccm:educationalcontext_DISPLAYNAME)|node(ccm:educationalcontext_DISPLAYNAME)|-}}
- **Fachgebiet:** {{var(ccm:taxonid_DISPLAYNAME)|node(ccm:taxonid_DISPLAYNAME)|-}}
- **Maximale Zeichenlänge:** 400
```

**Neu (optimiert):**

```text
Stell eine Sammlung von Bildungsressourcen in genau zwei Absätzen vor (max. 400 Zeichen inkl. Leerzeichen).
- Absatz 1: konkreter thematischer Einstieg (Problem, Frage oder Szenario), der die zentralen Themen benennt und zum Weiterlesen einlädt.
- Absatz 2: Hauptthemen im Überblick, Mehrwert für Lehrende und Lernende, Bezug zu Lernzielen; Schluss mit aktivierendem Satz.
Stil: aktive Sprache, kurze Sätze (max. 20 Wörter), verständlich, an Bildungsstufe und Fachgebiet angepasst.
Verboten: Floskeln wie "Diese Sammlung…"/"Hier finden Sie…"; Allgemeinplätze; URLs, Marken- und Dateinamen; reine Schlagwortlisten; erfundene Inhalte; Superlative.
Gib ausschließlich den Beschreibungstext aus (keine Überschriften, keine Meta-Kommentare).

Eingabedaten:
- Thema: {{var(cm:name)|node(cm:name)|-}}
- Bildungsstufe: {{var(ccm:educationalcontext_DISPLAYNAME)|node(ccm:educationalcontext_DISPLAYNAME)|-}}
- Fachgebiet: {{var(ccm:taxonid_DISPLAYNAME)|node(ccm:taxonid_DISPLAYNAME)|-}}
- Maximale Zeichenlänge: 400
```

**Geändert:** Auf das Wesentliche verdichtet (Ziel, Struktur, Stil, Verbote, Output) bei gleichem Ergebnis; deutlich token-ärmer.

---

### 15.3 `topic_page_ai_topic_header_text` — Einleitungstext einer Sammlung

**Funktion:** Wie 15.2, zusätzlich mit Praxis-/Relevanzbezug („Wofür ist das wichtig?").

**Alt (Original):**

```text
## Aufgabe
1. **Ziel**
   - Erstelle einen ansprechenden, prägnanten Text, der eine Sammlung von Bildungsressourcen vorstellt.
   - Wecke das Interesse der Leserinnen und Leser.
   - Erkläre kurz und verständlich die wichtigsten Themen der Sammlung.
   - Zeige, wie die Ressourcen der Sammlung von Lehrenden und Lernenden genutzt werden können.
   - Erkläre zusätzlich: 'Wofür ist das wichtig?' → Stelle den Bezug zur Lebenswelt, zum Alltag oder Arbeitsleben her. Gib ggf. auch einen Ausblick auf gesellschaftliche oder wissenschaftliche Relevanz.
   - Integriere Hinweise auf konkrete Ressourcen der Sammlung in den Beschreibungstext, falls Dir diese als Information gegeben werden.
2. **Struktur**
   - **Absatz 1**: Kurzer Einstieg, der zentrale Themen nennt und Interesse weckt.
   - **Absatz 2**: Übersicht der Hauptthemen, Mehrwert für Lehrende und Lernende, Bezug zu Lernzielen. Beantworte hier auch die Frage 'Wofür ist das wichtig?' mit konkretem Nutzen und Relevanz für Alltag, Beruf, Gesellschaft oder Wissenschaft.
3. **Sprache und Stil**
   - **Verständlichkeit**: Keine unnötigen Fachbegriffe, kurze Erläuterung komplexer Themen.
   - **Aktive Formulierungen**: Verzichte nach Möglichkeit auf den Passivstil.
   - **Kohärenz**: Verwende konsistente Terminologie, vermeide Wiederholungen und Widersprüche.
   - **Prägnanz**: Nutze kurze Sätze (max. 20 Wörter) und möglichst einfache Wörter (2–3 Silben).
   - **Lesbarkeit**: Achte auf klare Absätze und ausreichend Leerraum.
   - **Zielgruppenanpassung**: Passe Stil und Sprachgebrauch an die Bedürfnisse der Zielgruppe und des Fachgebiets an.
4. **Inhaltliche Relevanz**
   - Baue relevante Schlüsselbegriffe ein.
   - Passe den Text an die Zielgruppe an (Vorwissen, Interessen, Nutzen).
   - Erkläre den Mehrwert der Inhalte und zeige auf, in welchen Kontexten das Wissen angewendet werden kann.
5. **Output-Format**
   - Gib den fertigen Text als zusammenhängende Beschreibung in **zwei Absätzen** aus.
   - Halte dich an die **maximale Zeichenlänge** (inkl. Leerzeichen).
   - Verzichte auf URLs, Markennamen und unnötige Füllwörter.
## Eingabedaten
- **Thema der Sammlung:** {{var(cm:name)|node(cm:name)|-}}
- **Bildungsstufe:** {{var(ccm:educationalcontext_DISPLAYNAME)|node(ccm:educationalcontext_DISPLAYNAME)|-}}
- **Fachgebiet:** {{var(ccm:taxonid_DISPLAYNAME)|node(ccm:taxonid_DISPLAYNAME)|-}}
- **Maximale Zeichenlänge:** 400
**Hinweis:** Verwende die oben genannten Informationen, um einen einheitlichen, gut strukturierten Text zu erstellen, der alle genannten Anforderungen erfüllt. Achte dabei besonders auf Sprachstil, Verständlichkeit und die Einhaltung der Zeichenbegrenzung.
```

**Neu (optimiert):**

```text
Stell eine Sammlung von Bildungsressourcen in genau zwei Absätzen vor (max. 400 Zeichen inkl. Leerzeichen).
- Absatz 1: kurzer Einstieg, der die zentralen Themen nennt und Interesse weckt.
- Absatz 2: Hauptthemen, Mehrwert für Lehrende und Lernende, Bezug zu Lernzielen – und beantworte "Wofür ist das wichtig?" mit konkretem Nutzen für Alltag, Beruf, Gesellschaft oder Wissenschaft.
Stil: aktive Sprache, kurze Sätze (max. 20 Wörter), verständlich, an Zielgruppe und Fachgebiet angepasst.
Verboten: URLs, Marken- und Dateinamen, Füllwörter, erfundene Inhalte.
Gib ausschließlich den Text aus.

Eingabedaten:
- Thema: {{var(cm:name)|node(cm:name)|-}}
- Bildungsstufe: {{var(ccm:educationalcontext_DISPLAYNAME)|node(ccm:educationalcontext_DISPLAYNAME)|-}}
- Fachgebiet: {{var(ccm:taxonid_DISPLAYNAME)|node(ccm:taxonid_DISPLAYNAME)|-}}
- Maximale Zeichenlänge: 400
```

**Geändert:** Verdichtet wie 15.2; Relevanzfrage als klarer Bestandteil von Absatz 2 erhalten.

---

### 15.4 `topic_page_ai_text_widget` — Zusammenfassung

**Funktion:** Kurze Themenzusammenfassung in fünf Sätzen.

**Alt (Original):**

```text
Erstelle eine Zusammenfassung des Themas ({{var(cm:name)|node(cm:name)|-}}) in 5 Sätzen.
```

**Neu (optimiert):**

```text
Fasse das Thema "{{var(cm:name)|node(cm:name)|-}}" in genau 5 Sätzen verständlich zusammen.
- Aktive Sprache, kurze Sätze, an die Zielgruppe angepasst.
- Keine Floskeln, keine URLs/Markennamen, keine erfundenen Fakten.
Gib ausschließlich die Zusammenfassung aus.
```

**Geändert:** Stil- und Ausgabevorgaben ergänzt; „genau 5 Sätze" geschärft. *Hinweis: erhält nur das Thema als Eingabe (siehe Abschnitt 14).*

---

## 16. Weitere Konfigurationen (ohne Prompttext / nicht optimiert)

- `image_ai` – Bildgenerierung zu einem **einzelnen Material** (OpenAI, `gpt-image-2`). Eigener Prompt vorhanden; bei Bedarf analog zu 15.1 optimierbar.
- `topic_page_ai_default` / `…_chat_completion` / `…_create_image` / `…_clear_cache` – reine Provider-/Modell-/Cache-Einstellungen, kein Prompttext.

---

## 17. Platz für neue Prompts

> *Vorlage unten kopieren und ausfüllen.*

### 17.1 *(Feld / Konfig-ID)*

**Funktion:**

**Alt (falls vorhanden):**

```text
```

**Neu (optimiert):**

```text
```

**Geändert:**

---

## 18. Vermerke / Notizen

> *Raum für Anmerkungen, Tests und Entscheidungen des Teams.*

**Bereits korrigierte Auffälligkeiten aus den Vorlagen:**

- `ccm:wwwwurl` → korrekt `ccm:wwwurl` (Tippfehler, vier statt drei „w").
- `ccm:oeh_text_difficulty`: Widget-Referenz zeigte auf `ccm:educationallearningresourcetype` → korrigiert auf `ccm:oeh_text_difficulty`.
- Überschrift `ccm:educationalintededenduserrole` → korrekt `ccm:educationalintendedenduserrole`.

**Offene Punkte (aus dem Eingaben-Check, Abschnitt 13/14):**

- [ ] Vokabular-Felder im Materialblock auf lesbare `_DISPLAYNAME`-Variante umstellen (Resolver-Suffix prüfen).
- [ ] `Mediendauer: {{node(cclom:duration)|-}}` für die Lernzeit-Schätzung ergänzen.
- [ ] Erste Grundregel ggf. um „bzw. der vorliegenden Informationen" entschärfen (Link-Ressourcen ohne Volltext).
- [ ] Themenseiten-Texte (15.2–15.4): Übergabe von Titeln/Schlagwörtern enthaltener Materialien prüfen.

| Datum | Person | Vermerk |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |

**Freie Notizen:**

-
-
-
