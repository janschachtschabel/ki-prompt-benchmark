// Parser für mds.xml-Prompt-Sets: extrahiert System-Prompt + Feld-Prompts.
// Läuft clientseitig (nutzt DOMParser).

export interface ParsedPromptSet {
  system: string;
  prompts: Record<string, string>;
}

function children(el: Element, tag: string): Element[] {
  return Array.from(el.children).filter(c => c.tagName === tag);
}

function firstChild(el: Element, tag: string): Element | null {
  return children(el, tag)[0] ?? null;
}

function getId(el: Element): string | null {
  const ids = children(el, 'id');
  const plain = ids.find(c => !c.hasAttribute('rel'));
  return (plain ?? ids[0])?.textContent?.trim() ?? null;
}

// Tolerantes JSON-Parsing (entfernt notfalls Trailing-Kommas).
function parseLenient(text: string): Record<string, unknown> | null {
  const t = (text || '').trim();
  if (!t) return null;
  try { return JSON.parse(t); } catch { /* retry */ }
  try { return JSON.parse(t.replace(/,(\s*[}\]])/g, '$1')); } catch { /* give up */ }
  return null;
}

interface Extracted { system?: string; user?: string; prompt?: string }

function extract(promptEl: Element | null): Extracted {
  if (!promptEl) return {};
  const j = parseLenient(promptEl.textContent || '');
  if (!j) return {};
  const out: Extracted = {};
  const messages = (j as { messages?: unknown }).messages;
  if (Array.isArray(messages)) {
    for (const m of messages) {
      if (m && typeof m === 'object') {
        const role = (m as { role?: string }).role;
        const content = (m as { content?: unknown }).content;
        if (typeof content === 'string') {
          if (role === 'system') out.system = content;
          else if (role === 'user') out.user = content;
        }
      }
    }
  }
  const p = (j as { prompt?: unknown }).prompt;
  if (typeof p === 'string') out.prompt = p;
  return out;
}

/**
 * Liest ein mds.xml-Dokument und liefert den System-Prompt (aus `suggestion_ai`)
 * sowie die Feld-Prompts (Widget-aiConfigs + topic_page_ai_*).
 * Die Keys entsprechen den PromptField-IDs der App.
 */
export function parseMdsPrompts(xmlText: string): ParsedPromptSet {
  if (typeof DOMParser === 'undefined') {
    throw new Error('XML-Parsing nur im Browser verfügbar');
  }
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Ungültiges XML');

  const root = doc.documentElement;
  if (!root || root.tagName !== 'metadataset') {
    throw new Error('Kein <metadataset>-Wurzelelement gefunden');
  }

  const result: ParsedPromptSet = { system: '', prompts: {} };

  // Top-Level aiConfigs (suggestion_ai-System + topic_page_ai_*)
  const topAi = firstChild(root, 'aiConfigs');
  if (topAi) {
    for (const cfg of children(topAi, 'aiConfig')) {
      const id = getId(cfg);
      if (!id) continue;
      const ex = extract(firstChild(cfg, 'prompt'));
      if (id === 'suggestion_ai') {
        if (ex.system) result.system = ex.system;
      } else if (id.startsWith('topic_page_ai_')) {
        const val = ex.prompt ?? ex.user;
        if (val) result.prompts[id] = val;
      }
    }
  }

  // Widget-Ebene: <widget><id>FELD</id> … <aiConfigs><aiConfig><prompt>
  const widgetsEl = firstChild(root, 'widgets');
  if (widgetsEl) {
    for (const w of children(widgetsEl, 'widget')) {
      const wid = getId(w);
      if (!wid || wid in result.prompts) continue;
      const ai = firstChild(w, 'aiConfigs');
      if (!ai) continue;
      const cfg = firstChild(ai, 'aiConfig');
      if (!cfg) continue;
      const ex = extract(firstChild(cfg, 'prompt'));
      const val = ex.user ?? ex.prompt;
      if (val) result.prompts[wid] = val;
    }
  }

  return result;
}
