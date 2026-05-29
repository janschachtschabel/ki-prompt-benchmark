import type { PromptField, TestMaterial } from '@/types';

export const SYSTEM_PROMPTS = {
  old: `Du bist ein Assistent für edu-sharing.
Du sollst dem Nutzer helfen die Metadaten der Materialien mit passenden Vorschlägen zu vervollständigen. Gibt nur den Vorschlag als Wert zurück.`,

  new: `Du bist ein Klassifikations- und Texterstellungsdienst für Bildungsmetadaten im offenen Bildungsrepositorium edu-sharing / WirLernenOnline (OER für Schule und Bildung in Deutschland).
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
- Ist keine fundierte Aussage möglich, gib eine leere Antwort zurück.`,
};

// ── Material message builders ───────────────────────────────────

function buildOldUserMessage(m: TestMaterial): string {
  return `Ich benötige Hilfe bei diesem Material. Es hat die folgenden Eigenschaften
Titel: ${m.title || '-'}
Dateiname: ${m.filename || '-'}
Link: ${m.url || '-'}
Materialart: ${m.learningResourceType || '-'}
Schlagworte: ${m.keywords || '-'}
Beschreibung: ${m.description || '-'}
Format: ${m.format || '-'}
Medientyp: ${m.mediatype || '-'}

Volltext/Inhalt:
${m.fullText || '-'}`;
}

function buildNewUserMessage(m: TestMaterial, fieldPrompt: string): string {
  return `Material mit folgenden vorhandenen Informationen:
Titel: ${m.title || '-'}
Beschreibung: ${m.description || '-'}
Schlagworte: ${m.keywords || '-'}
Dateiname: ${m.filename || '-'}
Link: ${m.url || '-'}
Übergeordnete Kategorie: ${m.extendedType || '-'}
Materialart: ${m.learningResourceType || '-'}
Inhaltstyp: ${m.oehLrt || '-'}
Bildungsstufe: ${m.educationalContext || '-'}
Fachgebiet: ${m.discipline || '-'}
Zielgruppe: ${m.targetAudience || '-'}
Berufsgruppe: ${m.professionGroup || '-'}
Sprache: ${m.language || '-'}
Format: ${m.format || '-'}
Medientyp: ${m.mediatype || '-'}

Volltext:
${m.fullText || '-'}

Auftrag: ${fieldPrompt}`;
}

// ── Topic message builder (replaces {{var(...)}} placeholders) ──

function resolveTopicPrompt(template: string, m: TestMaterial): string {
  return template
    .replace(/\{\{var\(cm:name\)\|node\(cm:name\)\|-\}\}/g, m.title || '-')
    .replace(/\{\{var\(ccm:educationalcontext_DISPLAYNAME\)\|node\(ccm:educationalcontext_DISPLAYNAME\)\|-\}\}/g, m.educationalContext || '-')
    .replace(/\{\{var\(ccm:taxonid_DISPLAYNAME\)\|node\(ccm:taxonid_DISPLAYNAME\)\|-\}\}/g, m.discipline || '-')
    .replace(/\{\{var\(cclom:general_keyword\)\|node\(cclom:general_keyword\)\|-\}\}/g, m.keywords || '-');
}

// ── Public API ──────────────────────────────────────────────────

export function buildMessages(
  variant: 'old' | 'new',
  field: PromptField,
  material: TestMaterial
): { system: string; user: string } {
  const prompt = variant === 'old' ? field.oldPrompt : field.newPrompt;

  if (field.category === 'topic') {
    return {
      system: '',
      user: resolveTopicPrompt(prompt, material),
    };
  }

  if (variant === 'old') {
    return {
      system: SYSTEM_PROMPTS.old,
      user: buildOldUserMessage(material) + '\n\n' + prompt,
    };
  }
  return {
    system: SYSTEM_PROMPTS.new,
    user: buildNewUserMessage(material, prompt),
  };
}

// ── Prompt field definitions ────────────────────────────────────

export const PROMPT_FIELDS: PromptField[] = [
  // ── Material-Metadaten (Abschnitte 2–12) ──────────────────
  {
    id: 'cclom:title',
    name: 'Titel',
    category: 'material',
    description: 'Suchoptimierten, inhaltsbeschreibenden Titel generieren',
    oldPrompt: 'Erzeuge einen aussagekräftigen Titel',
    newPrompt: `Formuliere einen suchoptimierten Titel, der den INHALT benennt – nicht die Form.
- 40–70 Zeichen, substantivisch, ohne Artikel; wichtigste Begriffe zuerst.
- Materialtyp (Arbeitsblatt, Video, Quiz …) gehört NICHT in den Titel.
- Nicht nur das Fachgebiet ("Mathematik"), sondern das konkrete Thema.
- Keine Sonderzeichen oder Anführungszeichen.
Beispiele: "Fotosynthese Lichtreaktion und Dunkelreaktion", "Bruchrechnung Kürzen und Erweitern".
Ausgabe: nur der Titel.`,
  },
  {
    id: 'cclom:general_description',
    name: 'Beschreibung',
    category: 'material',
    description: 'Motivierenden, suchoptimierten Beschreibungstext generieren',
    oldPrompt: 'Erzeuge eine kurze zusammenfassende Beschreibung',
    newPrompt: `Schreibe eine motivierende Beschreibung des Inhalts.
- ca. 400–800 Zeichen, aktive Sprache, kurze Sätze (max. 20 Wörter).
- Reihenfolge: Kernthema → zentrale Inhalte/Konzepte → didaktische Form → Zielgruppe/Einsatz → Mehrwert.
- Fachbegriffe und gängige Suchbegriffe natürlich einbinden.
- Keine Floskeln ("Dieses Material …", "Hier finden Sie …"), keine erfundenen Inhalte, keine URLs/Dateinamen.
Ausgabe: nur der Beschreibungstext.`,
  },
  {
    id: 'cclom:general_keyword',
    name: 'Schlagworte',
    category: 'material',
    description: 'Inhaltliche Schlagworte zur Suche/Erschließung generieren',
    oldPrompt: 'Erstelle Schlagwörter, welche das Material für eine Suche auffindbar machen',
    newPrompt: `Erzeuge 5–8 inhaltliche Schlagworte, absteigend nach Relevanz (Kernthema zuerst).
- Substantive im Nominativ Singular, etablierte Fachterminologie.
- Spezifisch statt generisch ("Bruchrechnung" statt "Mathematik").
- Keine Synonym-Dopplungen, keine Ober- und Unterbegriffe gleichzeitig.
- Keine Materialtypen, Bildungsstufen, Marken- oder Personennamen (außer bei historischen/literarischen Themen).
Ausgabe: kommagetrennte Liste, z. B. "Schlagwort1, Schlagwort2".`,
  },
  {
    id: 'ccm:educationallearningresourcetype',
    name: 'Materialart',
    category: 'material',
    description: 'Materialart-Kategorie zuordnen (→ id)',
    oldPrompt: 'Ordne das Material in einer der folgende Kategorien ein: {{WIDGET_MATERIALART}} nutze zur Einordnung den Namen aber gib die jeweilige id zurück.',
    newPrompt: `Bestimme die Materialart nach der DIDAKTISCHEN FUNKTION, nicht nach dem Dateiformat.
Leitfrage – was soll man damit tun?
  lesen/ansehen · bearbeiten/lösen · nachschlagen · ausprobieren · Unterricht planen
Wähle genau EINE Kategorie; bei Mischformen die dominante Funktion.
Kategorien (Name → id):
{{WIDGET_MATERIALART}}
Ausgabe: nur die id.`,
  },
  {
    id: 'ccm:oeh_lrt',
    name: 'Inhaltstyp',
    category: 'material',
    description: 'Inhaltstyp(en) zuordnen (→ ids)',
    oldPrompt: 'Ordne das Material in einer der folgende Kategorien ein: {{WIDGET_LRT}} nutze zur Einordnung den Namen aber gib die jeweilige id zurück.',
    newPrompt: `Bestimme den/die Inhaltstyp(en) nach didaktischer Funktion und Nutzungsweise, nicht nach Format.
- Mehrfachzuordnung erlaubt; Ober- und Unterkategorie NICHT gleichzeitig.
- "Quelle" nur als Einzelwert: Angebot eines Anbieters mit mehreren fachbezogenen Inhalten (z. B. ein YouTube-Kanal). Abzugrenzen von der Bezugsquelle (Distributionsdienst, z. B. YouTube selbst) und vom Herausgeber (rechtlich Verantwortlicher). Nicht gemeint im Sinne wissenschaftlicher Primär-/Sekundärquellen.
Kategorien (Name → id):
{{WIDGET_LRT}}
Ausgabe: kommagetrennte ids, z. B. "id1, id2".`,
  },
  {
    id: 'ccm:educationalcontext',
    name: 'Bildungsstufe',
    category: 'material',
    description: 'Bildungsstufe(n) zuordnen (→ ids)',
    oldPrompt: 'Ordne das Material in passende Bildungsstufen ein: {{WIDGET_BILDUNGSSTUFE}} nutze zur Einordnung den Namen aber gib die jeweilige id zurück.',
    newPrompt: `Ordne passende Bildungsstufe(n) zu – nach Sprachniveau, vorausgesetztem Vorwissen, didaktischer Aufbereitung und typischer Lehrplanzuordnung in Deutschland.
- Maximal 3 Stufen, möglichst aufeinanderfolgend (keine Sprünge wie Elementarbereich + Hochschule).
Stufen (Name → id):
{{WIDGET_BILDUNGSSTUFE}}
Ausgabe: kommagetrennte ids.`,
  },
  {
    id: 'ccm:educationalintendedenduserrole',
    name: 'Zielgruppe',
    category: 'material',
    description: 'Intendierte Nutzerrolle(n) bestimmen (→ ids)',
    oldPrompt: 'Antworte, für welche Zielgruppen das Material geeignet ist. Nutze folgende Werte und nenne nur die Ids: {{WIDGET_ZIELGRUPPE}}',
    newPrompt: `Bestimme, WER das Material nutzen soll – nicht, wer es theoretisch könnte.
Merkmale:
  direkte Lerneransprache, Aufgaben, Übungen        → Lernende
  didaktische Hinweise, Lernziele, Lösungen          → Lehrende
  Erziehungs-/häusliche Förderhinweise               → Eltern
  Anleitungen zur Materialerstellung/Lizenzierung    → Autor/Ersteller
Mehrfachzuordnung nur bei eindeutiger Adressierung; sonst die wahrscheinlichste Hauptzielgruppe.
Rollen (Name → id):
{{WIDGET_ZIELGRUPPE}}
Ausgabe: kommagetrennte ids.`,
  },
  {
    id: 'ccm:oeh_text_difficulty',
    name: 'Textkomplexität',
    category: 'material',
    description: 'Sprachliche Komplexität des Textes bewerten',
    oldPrompt: 'Ordne den Text in eine der folgenden Komplexitäten ein: {{WIDGET_TEXTKOMPLEXITAET}} nutze zur Einordnung den Namen und gib ihn zurück.',
    newPrompt: `Bewerte die sprachliche Komplexität des TEXTES, nicht des Themas (ein einfach formulierter Text über Quantenphysik = niedrige Komplexität).
Kriterien: Satzbau, Wortschatz, Abstraktionsgrad, vorausgesetztes Vorwissen, Informationsdichte.
- Wenig/kein Text (Bild, Video ohne Transkript): niedrigste Stufe.
- Gemischte Komplexität: nach dem Hauptteil gewichten.
- Fachbegriffe mit Erklärung: eine Stufe niedriger als ohne.
Stufen (Name):
{{WIDGET_TEXTKOMPLEXITAET}}
Ausgabe: nur der Name der Stufe.`,
  },
  {
    id: 'cclom:general_language',
    name: 'Sprache',
    category: 'material',
    description: 'Sprache und regionale Variante bestimmen',
    oldPrompt: 'Antworte nur mit der Sprache des Inhalts in exakt diesem Format: en_US oder de_DE',
    newPrompt: `Bestimme Sprache und regionale Variante des Haupt-Inhaltstextes (nicht der Metadaten oder Dateinamen).
- Format: xx_YY, z. B. de_DE, de_AT, de_CH, en_US, en_GB, fr_FR, es_ES, tr_TR, it_IT.
- Variante an sprachlichen Markern festmachen (z. B. de_CH ohne ß, "Velo"; en_GB "-our"/"-ise").
- Mehrsprachig: Sprache mit dem größten Textanteil. Kein erkennbarer Text: de_DE als Fallback.
Ausgabe: nur der Code, z. B. de_DE.`,
  },
  {
    id: 'cclom:typicallearningtime',
    name: 'Lernzeit',
    category: 'material',
    description: 'Typische Bearbeitungszeit im Unterricht schätzen (ms)',
    oldPrompt: 'Antworte, wie lange man für dieses Material im Unterricht benötigt, lediglich als Zahl in Millisekunden.',
    newPrompt: `Schätze die typische Bearbeitungszeit im Unterricht in MILLISEKUNDEN (ganze Zahl).
Anhaltspunkte: 5 min = 300000 · 10 min = 600000 · 15 min = 900000 · 45 min (eine Stunde) = 2700000.
Schätzkriterien:
- Text: ~150 Wörter/Min (Fachtext ~100). Video/Audio: Medienlänge + 30 %. Übungen: Summe der Aufgaben.
- Keine Einschätzung möglich: 2700000.
Ausgabe: nur die Zahl, z. B. 2700000.`,
  },

  // ── Themenseiten (Abschnitt 15) ───────────────────────────────

  {
    id: 'topic_page_ai_topic_header_image',
    name: 'Themenbild',
    category: 'topic',
    description: 'Vorschaubild für Sammlung generieren (Bildprompt, gpt-image-2)',
    oldPrompt: `## Aufgabe
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
**Integriere alle oben genannten Anforderungen und Stilvorgaben sowie die Eingabedaten 'Beschreibung des Bildungsinhalts' und 'Wichtige Schlagwörter'.**`,
    newPrompt: `Erzeuge ein realistisches, ansprechendes Vorschaubild für eine Sammlung von Bildungsinhalten zum Thema "{{var(cm:name)|node(cm:name)|-}}" ({{var(ccm:taxonid_DISPLAYNAME)|node(ccm:taxonid_DISPLAYNAME)|-}}).
Zentrale Motive aus den Schlagwörtern: {{var(cclom:general_keyword)|node(cclom:general_keyword)|-}}.
Stil: ein klares Hauptmotiv, minimalistisch und aufgeräumt, warme Farben, natürliches Licht, einladende Atmosphäre, hohe Detailtiefe, scharfer Fokus, ausgewogene Komposition, professionelle Qualität.
Darstellung glaubwürdig, inklusiv und kulturell sensibel.
Kein Text, keine Schrift, keine Logos.`,
  },
  {
    id: 'topic_page_ai_topic_header_description',
    name: 'Sammlungs-Beschreibung',
    category: 'topic',
    description: 'Zweiabsätziger Vorstellungstext (max. 400 Zeichen)',
    oldPrompt: `## Aufgabe
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
- **Maximale Zeichenlänge:** 400`,
    newPrompt: `Stell eine Sammlung von Bildungsressourcen in genau zwei Absätzen vor (max. 400 Zeichen inkl. Leerzeichen).
- Absatz 1: konkreter thematischer Einstieg (Problem, Frage oder Szenario), der die zentralen Themen benennt und zum Weiterlesen einlädt.
- Absatz 2: Hauptthemen im Überblick, Mehrwert für Lehrende und Lernende, Bezug zu Lernzielen; Schluss mit aktivierendem Satz.
Stil: aktive Sprache, kurze Sätze (max. 20 Wörter), verständlich, an Bildungsstufe und Fachgebiet angepasst.
Verboten: Floskeln wie "Diese Sammlung…"/"Hier finden Sie…"; Allgemeinplätze; URLs, Marken- und Dateinamen; reine Schlagwortlisten; erfundene Inhalte; Superlative.
Gib ausschließlich den Beschreibungstext aus (keine Überschriften, keine Meta-Kommentare).

Eingabedaten:
- Thema: {{var(cm:name)|node(cm:name)|-}}
- Bildungsstufe: {{var(ccm:educationalcontext_DISPLAYNAME)|node(ccm:educationalcontext_DISPLAYNAME)|-}}
- Fachgebiet: {{var(ccm:taxonid_DISPLAYNAME)|node(ccm:taxonid_DISPLAYNAME)|-}}
- Maximale Zeichenlänge: 400`,
  },
  {
    id: 'topic_page_ai_topic_header_text',
    name: 'Sammlungs-Einleitung',
    category: 'topic',
    description: 'Einleitungstext mit Praxis-/Relevanzbezug (max. 400 Zeichen)',
    oldPrompt: `## Aufgabe
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
**Hinweis:** Verwende die oben genannten Informationen, um einen einheitlichen, gut strukturierten Text zu erstellen, der alle genannten Anforderungen erfüllt. Achte dabei besonders auf Sprachstil, Verständlichkeit und die Einhaltung der Zeichenbegrenzung.`,
    newPrompt: `Stell eine Sammlung von Bildungsressourcen in genau zwei Absätzen vor (max. 400 Zeichen inkl. Leerzeichen).
- Absatz 1: kurzer Einstieg, der die zentralen Themen nennt und Interesse weckt.
- Absatz 2: Hauptthemen, Mehrwert für Lehrende und Lernende, Bezug zu Lernzielen – und beantworte "Wofür ist das wichtig?" mit konkretem Nutzen für Alltag, Beruf, Gesellschaft oder Wissenschaft.
Stil: aktive Sprache, kurze Sätze (max. 20 Wörter), verständlich, an Zielgruppe und Fachgebiet angepasst.
Verboten: URLs, Marken- und Dateinamen, Füllwörter, erfundene Inhalte.
Gib ausschließlich den Text aus.

Eingabedaten:
- Thema: {{var(cm:name)|node(cm:name)|-}}
- Bildungsstufe: {{var(ccm:educationalcontext_DISPLAYNAME)|node(ccm:educationalcontext_DISPLAYNAME)|-}}
- Fachgebiet: {{var(ccm:taxonid_DISPLAYNAME)|node(ccm:taxonid_DISPLAYNAME)|-}}
- Maximale Zeichenlänge: 400`,
  },
  {
    id: 'topic_page_ai_text_widget',
    name: 'Zusammenfassung',
    category: 'topic',
    description: 'Kurze Themenzusammenfassung in 5 Sätzen',
    oldPrompt: `Erstelle eine Zusammenfassung des Themas ({{var(cm:name)|node(cm:name)|-}}) in 5 Sätzen.`,
    newPrompt: `Fasse das Thema "{{var(cm:name)|node(cm:name)|-}}" in genau 5 Sätzen verständlich zusammen.
- Aktive Sprache, kurze Sätze, an die Zielgruppe angepasst.
- Keine Floskeln, keine URLs/Markennamen, keine erfundenen Fakten.
Gib ausschließlich die Zusammenfassung aus.`,
  },
];
