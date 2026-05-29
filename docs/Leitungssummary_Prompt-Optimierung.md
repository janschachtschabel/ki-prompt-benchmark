# KI-Prompt-Optimierung für edu-sharing / WirLernenOnline — Leitungssummary

## Ausgangslage
Die automatische Metadaten-Generierung in edu-sharing nutzt KI-Prompts, um Bildungsinhalte mit Titel, Beschreibung, Schlagworten und Klassifikationen anzureichern. Untersucht wurde der **IST-Stand der Prompts aus edu-sharing Version 10.0 (`mds.xml`)** im Vergleich zu einer **optimierten Prompt-Fassung**.

## Ziel
Belastbar prüfen, ob optimierte Prompts die Qualität der KI-generierten Metadaten verbessern – bei gleichzeitig transparenter Betrachtung von Geschwindigkeit und Kosten (Token-Verbrauch).

## Methodik
- **Optimierung nach aktuellen Empfehlungen von OpenAI und Anthropic:** zielgerichtete, präzise und nicht überladene Formulierungen, klare Ausgabevorgaben sowie passender Kontext (Entscheidung auf Basis des Inhalts statt der Form).
- **Direkter Vergleich beider Prompt-Sets** (IST vs. optimiert) am selben Material.
- **Mehrere LLM-Modelle** im Vergleich, um Modellabhängigkeiten sichtbar zu machen.
- **Wählbare KI-Anbindung:** OpenAI nativ, B-API mit OpenAI sowie B-API mit AcademicCloud (KISSKI).
- **Erhobene Kennzahlen je Durchlauf:** inhaltliche Qualität, **Generierungszeit** und **Token-Verbrauch**.

## Testdaten / Material
Als Eingabematerial stehen drei Quellen zur Verfügung:
- **Zufallsgenerierte Beispielmaterialien** – vordefinierte Testfälle für schnelle Vergleiche.
- **WLO-Inhalte aus dem Repository** – reale Inhalte werden per Node-ID/Link geladen; die Metadaten werden direkt aus edu-sharing übernommen.
- **Beliebige URL** – der Volltext wird über den Text-Extraktionsdienst gewonnen.

Für die **Testserie** wurden reale **Inhalte aus der Produktivumgebung (Prod)** verwendet. Wo eine Quell-URL (`ccm:wwwurl`) hinterlegt war, wurde zusätzlich der **Volltext** über den Text-Extraktionsdienst abgerufen und in die Bewertung einbezogen – so urteilt das Modell auf Basis des tatsächlichen Inhalts, nicht nur der vorhandenen Metadaten.

> Verwendete Inhalte und die zugrunde liegenden Prompt-Definitionen (IST + optimiert je Feld): siehe Confluence-Seite **[Evaluation Prompts für Felder](https://edu-sharing.atlassian.net/wiki/spaces/ITsJOINTLY/pages/1752367107/Evaluation+Prompts+f+r+Felder)**.

## Bewertung durch „LLM-as-Judge"
Ein KI-Modell vergleicht für jedes Feld die beiden Ergebnisse (IST vs. optimiert) und bewertet sie anhand von **fünf Kriterien**:
1. **Inhaltliche Korrektheit** – stimmt die Ausgabe mit dem Material überein?
2. **Bildungseignung** – ist die Ausgabe für den Bildungskontext geeignet?
3. **Formatkonformität** – entspricht die Ausgabe dem geforderten Format?
4. **Suchoptimierung** – ist die Ausgabe gut auffindbar?
5. **Sprachqualität** – korrekte, angemessene Sprache?

**Skala:** Jedes Kriterium wird auf einer Skala von **1 (sehr schwach) bis 10 (optimal)** bewertet. Daraus ergibt sich je Prompt-Set ein **Gesamtscore von 1,0 bis 10,0**. Zusätzlich nennt der Judge einen **Gewinner** (IST, optimiert oder unentschieden) sowie eine kurze **Begründung**.

Für vergleichbare Messungen über mehrere Testmodelle hinweg kann ein **konstantes Judge-Modell** gewählt werden.

**Aggregierte Empfehlung:** Die Bewertungen und Empfehlungen werden **über alle Durchläufe gesammelt** und je Feld zu einem **verbesserten Prompt** zusammengeführt.

## Nutzen
- Objektive, datenbasierte Grundlage für die Wahl von Prompts und Modellen.
- Transparenz über das Verhältnis von Qualität, Geschwindigkeit und Kosten.
- Wiederverwendbares Testtool für künftige Prompt- und Modellvergleiche sowie für die laufende Pflege der `mds.xml`.

## Zentrale Erkenntnisse
> *(Platzhalter – mit den konkreten Messwerten füllen)*
- Qualität (Ø Gesamtscore optimiert vs. IST):
- Geschwindigkeit (Ø Generierungszeit):
- Kosten (Ø Token-Verbrauch):
- Empfehlung:
