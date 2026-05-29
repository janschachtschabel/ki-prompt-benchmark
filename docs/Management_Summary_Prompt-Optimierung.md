# Management Summary — KI-Prompt-Optimierung

Optimierte Prompts verbessern die KI-gestützte Metadaten-Generierung über alle getesteten Modelle und beide Plattformen (OpenAI nativ, B-API mit AcademicCloud) hinweg messbar. Der größte Mehrwert entsteht bei Beschreibung, Schlagworten und Materialart sowie in den Kriterien Bildungseignung und Suchoptimierung — bei nur ~10 % höherem Token-Verbrauch.

## Zentrale Erkenntnisse
- **Durchgängiger Qualitätsgewinn:** Die neuen Prompts gewinnen gegen den IST-Stand (edu-sharing 10.0) bei jedem Modell.
  - OpenAI (Judge: gpt-4.1-mini): gpt-4.1-mini 6,7 → 8,7, gpt-4.1-nano 6,1 → 8,4.
  - AcademicCloud (Judge: gpt-oss-120b): Ø 7,0 → 8,3; Spitzenmodelle (gemma-4-31b-it, mistral-large-3) erreichen 9,2–9,3.
- **Schwächere Modelle profitieren am stärksten:** Der Abstand zwischen kleinen und großen Modellen schrumpft — gute Prompts „heben" günstige Modelle näher an die großen heran.
- **Aufgabenabhängiger Effekt:** Große Gewinne bei generativen Feldern (Beschreibung, Schlagworte, Materialart); kleinere bei „einfachen" Feldern (Sprache, Titel).
- **Modellwahl zahlt sich aus:** gemma-4-31b-it und mistral-large-3 lieferten die beste Qualität bei kürzester Laufzeit.
- **Kosten & Geschwindigkeit:** Token-Verbrauch ~+10 %. Bei OpenAI sind die nano-Modelle schneller und günstiger bei vergleichbarer Qualität; die gpt-5-Modelle zeigten keinen Geschwindigkeitsvorteil (vermutlich alter Chat-Completion-Endpunkt und fehlende Optimierung der Reasoning-Anweisungen).
- **Reasoning-Modelle erfordern Sonderbehandlung:** qwen3.6 verursachte Messausfälle (Reasoning sprengt das Token-Budget); mit angepassten Prompts und Parametern lief der Rest stabil.

## Folgetest: Promptset V1 vs. V2
Das händisch erstellte Promptset V1 wurde gegen V2 verglichen, in das bereits die App-Rückmeldungen eingeflossen sind. **V2 gewinnt im Schnitt 8,9 zu 8,1** und hebt das Niveau weiter an (gemessen mit gpt-4.1-mini).

## Empfehlung
- **Optimierte Prompts produktiv übernehmen** (mds.xml) — der Mehrwert ist konsistent und überwiegt die ~10 % Mehrkosten klar.
- **Modell bewusst wählen** — für AcademicCloud z. B. gemma-4-31b-it / mistral-large-3 (Qualität + Tempo).
- **Iterativ weiter optimieren** — das Testtool sammelt das Judge-Feedback und erzeugt automatisch verbesserte Prompts (Durchlauf 2 bereits eingearbeitet).

---

# Technische Hinweise für B-API & AcademicCloud

Relevant für die Integration in edu-sharing und für jede App, die diese Modelle anbindet.

**Reasoning-Modelle (qwen3, glm-4.x …)** „denken" sichtbar (häufig in `<think>…</think>`) und verbrauchen dafür Completion-Tokens. Das hat direkte Folgen:
- **Token-Budget großzügig setzen.** Reasoning und finale Antwort müssen in max_tokens / max_completion_tokens passen. Zu klein → die Antwort wird abgeschnitten oder bleibt komplett leer (finish_reason = length). Im Tool auf 4096 angehoben (Default 2048 reichte für qwen3.6 nicht).
- **`<think>…</think>` serverseitig entfernen** — inklusive unvollständiger/abgeschnittener Blöcke (dann liegt keine gültige Antwort vor).
- **Leere Antworten erkennen und behandeln:** finish_reason prüfen, fehlenden content bzw. separates reasoning_content berücksichtigen → als Fehler/Retry werten, nicht als gültiges Ergebnis in die Pipeline geben.
- **Thinking gezielt abschalten**, wo nur ein knapper Wert gebraucht wird (Klassifikation, Locale, ms-Zahl) — bei Qwen3 z. B. `/no_think` bzw. `chat_template_kwargs: { enable_thinking: false }`. Spart Zeit + Tokens und vermeidet Format-Probleme.
- **Timeout + Retry:** Reasoning ist langsam — pro Aufruf 60 s Timeout, danach Retry mit Backoff. Hohes Token-Budget nicht mit zu kurzem Timeout kombinieren (sonst Abbruch vor der Antwort).

**Rate-Limit & Parallelität (AcademicCloud):** Keine parallelen Anfragen — der AcademicCloud-Key verträgt keine gleichzeitigen Calls; Anfragen serialisieren (nicht alt + neu gleichzeitig feuern).
