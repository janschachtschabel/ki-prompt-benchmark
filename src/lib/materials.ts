import type { TestMaterial } from '@/types';

const SAMPLE_MATERIALS: TestMaterial[] = [
  {
    title: 'Fotosynthese einfach erklärt',
    filename: 'fotosynthese_arbeitsblatt.pdf',
    url: 'https://example.com/bio/fotosynthese',
    learningResourceType: '',
    keywords: '',
    description: '',
    format: 'application/pdf',
    mediatype: 'file-pdf',
    educationalContext: '',
    discipline: '',
    targetAudience: '',
    language: '',
    fullText: `Die Fotosynthese ist ein biochemischer Prozess, bei dem Pflanzen, Algen und einige Bakterien Lichtenergie in chemische Energie umwandeln. Dabei wird Kohlenstoffdioxid (CO₂) aus der Luft und Wasser (H₂O) aus dem Boden aufgenommen und mithilfe von Sonnenlicht in Glucose (C₆H₁₂O₆) und Sauerstoff (O₂) umgewandelt.

Die Reaktionsgleichung lautet: 6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂

Die Fotosynthese läuft in den Chloroplasten ab und gliedert sich in zwei Teilprozesse:
1. Lichtreaktion (in den Thylakoidmembranen): Lichtenergie wird in ATP und NADPH umgewandelt. Wasser wird gespalten und Sauerstoff freigesetzt.
2. Dunkelreaktion / Calvin-Zyklus (im Stroma): CO₂ wird mithilfe von ATP und NADPH zu Glucose aufgebaut.

Aufgabe 1: Beschrifte die Abbildung des Chloroplasten.
Aufgabe 2: Erkläre den Unterschied zwischen Licht- und Dunkelreaktion.
Aufgabe 3: Warum ist die Fotosynthese für das Leben auf der Erde unverzichtbar?`,
    oehLrt: '',
    professionGroup: '',
    extendedType: '',
  },
  {
    title: '',
    filename: 'bruchrechnung_erklaervideo.mp4',
    url: 'https://example.com/mathe/brueche',
    learningResourceType: '',
    keywords: 'Bruchrechnung, Kürzen',
    description: '',
    format: 'video/mp4',
    mediatype: 'file-video',
    educationalContext: '',
    discipline: '',
    targetAudience: '',
    language: '',
    fullText: `In diesem Video lernst du, wie man Brüche kürzt und erweitert. Brüche bestehen aus einem Zähler (oben) und einem Nenner (unten). Kürzen bedeutet, Zähler und Nenner durch die gleiche Zahl zu teilen. Erweitern bedeutet, beide mit der gleichen Zahl zu multiplizieren.

Beispiel Kürzen: 6/8 = 3/4 (beide durch 2 geteilt)
Beispiel Erweitern: 2/3 = 4/6 (beide mit 2 multipliziert)

Wann kürzt man? Immer wenn Zähler und Nenner einen gemeinsamen Teiler haben. Am besten kürzt man mit dem größten gemeinsamen Teiler (ggT).

Wann erweitert man? Wenn man Brüche mit verschiedenen Nennern addieren oder vergleichen will. Man erweitert auf den kleinsten gemeinsamen Nenner (kgV).

Übung: Kürze die folgenden Brüche so weit wie möglich: 12/18, 15/25, 8/24.`,
    oehLrt: '',
    professionGroup: '',
    extendedType: '',
  },
  {
    title: 'Der Dreißigjährige Krieg',
    filename: 'dreissigjaehriger_krieg_unterrichtseinheit.docx',
    url: '',
    learningResourceType: '',
    keywords: '',
    description: 'Eine Unterrichtseinheit zum Dreißigjährigen Krieg für die Sekundarstufe I',
    format: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mediatype: 'file-word',
    educationalContext: '',
    discipline: '',
    targetAudience: '',
    language: '',
    fullText: `Der Dreißigjährige Krieg (1618–1648) war einer der verheerendsten Konflikte in der europäischen Geschichte. Er begann als religiöser Konflikt zwischen Protestanten und Katholiken im Heiligen Römischen Reich und entwickelte sich zu einem gesamteuropäischen Machtkampf.

Ursachen:
- Konfessionelle Spannungen seit der Reformation
- Machtstreben der Habsburger
- Ständische Opposition in Böhmen

Der Prager Fenstersturz (1618) gilt als Auslöser. Böhmische Protestanten warfen zwei kaiserliche Statthalter aus einem Fenster der Prager Burg.

Phasen des Krieges:
1. Böhmisch-Pfälzischer Krieg (1618–1623)
2. Dänisch-Niedersächsischer Krieg (1625–1629)
3. Schwedischer Krieg (1630–1635)
4. Schwedisch-Französischer Krieg (1635–1648)

Der Westfälische Frieden von 1648 beendete den Krieg und schuf eine neue politische Ordnung in Europa.

Arbeitsauftrag für Lehrkräfte: Nutzen Sie die Zeitleiste als Einstieg. Die Schülerinnen und Schüler sollen die Phasen des Krieges in Gruppenarbeit erarbeiten und auf einem Plakat visualisieren.`,
    oehLrt: '',
    professionGroup: '',
    extendedType: '',
  },
  {
    title: 'Python Grundlagen für Anfänger',
    filename: 'python_basics_tutorial.html',
    url: 'https://example.com/informatik/python-grundlagen',
    learningResourceType: '',
    keywords: '',
    description: '',
    format: 'text/html',
    mediatype: 'link',
    educationalContext: '',
    discipline: '',
    targetAudience: '',
    language: '',
    fullText: `Willkommen zum Python-Tutorial! Python ist eine der beliebtesten Programmiersprachen der Welt und eignet sich hervorragend für Einsteiger.

Variablen und Datentypen:
name = "Anna"        # String (Text)
alter = 14           # Integer (Ganzzahl)
note = 2.3           # Float (Kommazahl)
ist_schueler = True  # Boolean (Wahrheitswert)

Bedingte Anweisungen:
if alter >= 18:
    print("Du bist volljährig")
elif alter >= 16:
    print("Du darfst wählen gehen")
else:
    print("Du bist minderjährig")

Schleifen:
for i in range(5):
    print(f"Durchlauf {i}")

Funktionen:
def begruessung(name):
    return f"Hallo {name}!"

Übung 1: Schreibe ein Programm, das deinen Namen und dein Alter ausgibt.
Übung 2: Erstelle eine Funktion, die prüft, ob eine Zahl gerade oder ungerade ist.
Übung 3: Schreibe eine Schleife, die alle Zahlen von 1 bis 100 addiert.`,
    oehLrt: '',
    professionGroup: '',
    extendedType: '',
  },
  {
    title: 'Nachhaltigkeit im Alltag – Quiz',
    filename: 'nachhaltigkeit_quiz.h5p',
    url: 'https://example.com/sachkunde/nachhaltigkeit-quiz',
    learningResourceType: '',
    keywords: '',
    description: '',
    format: 'application/zip',
    mediatype: 'file-zip',
    educationalContext: '',
    discipline: '',
    targetAudience: '',
    language: '',
    fullText: `Quiz: Nachhaltigkeit im Alltag

Frage 1: Was bedeutet der Begriff "Nachhaltigkeit"?
a) Möglichst viel kaufen
b) So leben, dass auch zukünftige Generationen gut leben können ✓
c) Nur Bio-Produkte kaufen
d) Auf Technik verzichten

Frage 2: Welches Verkehrsmittel ist am klimafreundlichsten für kurze Strecken?
a) Auto
b) Bus
c) Fahrrad ✓
d) E-Scooter

Frage 3: Was passiert mit Plastik im Meer?
a) Es löst sich nach einem Jahr auf
b) Es zersetzt sich in Mikroplastik und schadet Tieren und Umwelt ✓
c) Fische fressen es und wachsen davon
d) Es sinkt sofort auf den Meeresboden

Frage 4: Wie kann man im Haushalt Energie sparen?
a) Licht anlassen, damit es gemütlich ist
b) Standby-Geräte ausschalten und LED-Lampen nutzen ✓
c) Die Heizung immer auf 5 stellen
d) Jeden Tag baden statt duschen`,
    oehLrt: '',
    professionGroup: '',
    extendedType: '',
  },
  {
    title: '',
    filename: 'erste_hilfe_pflege.pdf',
    url: 'https://example.com/pflege/erste-hilfe-massnahmen',
    learningResourceType: '',
    keywords: 'Erste Hilfe, Notfall',
    description: 'Lernmaterial für Pflegeauszubildende zu Erste-Hilfe-Maßnahmen',
    format: 'application/pdf',
    mediatype: 'file-pdf',
    educationalContext: '',
    discipline: '',
    targetAudience: '',
    language: '',
    fullText: `Erste-Hilfe-Maßnahmen in der Pflege

Als Pflegefachkraft sind Sie häufig die erste Person, die bei einem Notfall vor Ort ist. Dieses Modul vermittelt die wichtigsten Erste-Hilfe-Maßnahmen speziell für den Pflegealltag.

1. Bewusstlosigkeit erkennen und handeln
- Ansprechen und vorsichtig an den Schultern rütteln
- Bei Bewusstlosigkeit: Stabile Seitenlage
- Notruf absetzen (112)

2. Herz-Lungen-Wiederbelebung (HLW)
- 30 Herzdruckmassagen, dann 2 Beatmungen
- Drucktiefe: 5–6 cm, Frequenz: 100–120/min
- AED (Automatisierter Externer Defibrillator) einsetzen, sobald verfügbar

3. Verschlucken und Aspiration
- Oberkörper vorbeugen, kräftige Schläge zwischen die Schulterblätter
- Heimlich-Manöver bei vollständiger Verlegung der Atemwege

4. Sturzereignisse
- Patienten nicht sofort aufheben
- Verletzungen prüfen (Kopf, Hüfte, Handgelenk)
- Vitalzeichen kontrollieren und dokumentieren

Fallbeispiel: Frau Müller, 82 Jahre, wird bewusstlos im Aufenthaltsraum aufgefunden. Beschreiben Sie Ihr Vorgehen Schritt für Schritt.`,
    oehLrt: '',
    professionGroup: '',
    extendedType: '',
  },
];

const SAMPLE_TOPICS: TestMaterial[] = [
  {
    title: 'Fotosynthese',
    filename: '', url: '', learningResourceType: '',
    keywords: 'Fotosynthese, Chloroplast, Lichtreaktion, Calvin-Zyklus, Pflanzenzelle',
    description: '', format: '', mediatype: '',
    educationalContext: 'Sekundarstufe I',
    discipline: 'Biologie',
    targetAudience: '', language: '', fullText: '',
    oehLrt: '', professionGroup: '', extendedType: '',
  },
  {
    title: 'Klimawandel und Nachhaltigkeit',
    filename: '', url: '', learningResourceType: '',
    keywords: 'Klimawandel, Treibhauseffekt, Nachhaltigkeit, CO2, Erderwärmung',
    description: '', format: '', mediatype: '',
    educationalContext: 'Sekundarstufe I, Sekundarstufe II',
    discipline: 'Geographie, Politik',
    targetAudience: '', language: '', fullText: '',
    oehLrt: '', professionGroup: '', extendedType: '',
  },
  {
    title: 'Bruchrechnung',
    filename: '', url: '', learningResourceType: '',
    keywords: 'Bruch, Kürzen, Erweitern, Zähler, Nenner, gemeinsamer Nenner',
    description: '', format: '', mediatype: '',
    educationalContext: 'Primarstufe, Sekundarstufe I',
    discipline: 'Mathematik',
    targetAudience: '', language: '', fullText: '',
    oehLrt: '', professionGroup: '', extendedType: '',
  },
  {
    title: 'Programmieren mit Python',
    filename: '', url: '', learningResourceType: '',
    keywords: 'Python, Programmierung, Variable, Schleife, Funktion, Algorithmus',
    description: '', format: '', mediatype: '',
    educationalContext: 'Sekundarstufe I, Sekundarstufe II',
    discipline: 'Informatik',
    targetAudience: '', language: '', fullText: '',
    oehLrt: '', professionGroup: '', extendedType: '',
  },
];

export function getRandomMaterial(): TestMaterial {
  const idx = Math.floor(Math.random() * SAMPLE_MATERIALS.length);
  return { ...SAMPLE_MATERIALS[idx] };
}

export function getRandomTopic(): TestMaterial {
  const idx = Math.floor(Math.random() * SAMPLE_TOPICS.length);
  return { ...SAMPLE_TOPICS[idx] };
}

export function getEmptyTopic(): TestMaterial {
  return {
    title: '',
    filename: '', url: '', learningResourceType: '',
    keywords: '',
    description: '', format: '', mediatype: '',
    educationalContext: '',
    discipline: '',
    targetAudience: '', language: '', fullText: '',
    oehLrt: '', professionGroup: '', extendedType: '',
  };
}

export function getEmptyMaterial(): TestMaterial {
  return {
    title: '',
    filename: '',
    url: '',
    learningResourceType: '',
    keywords: '',
    description: '',
    format: '',
    mediatype: '',
    educationalContext: '',
    discipline: '',
    targetAudience: '',
    language: '',
    fullText: '',
    oehLrt: '',
    professionGroup: '',
    extendedType: '',
  };
}

export const SAMPLE_MATERIAL_COUNT = SAMPLE_MATERIALS.length;
