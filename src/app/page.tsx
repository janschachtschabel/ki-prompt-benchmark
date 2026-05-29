'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  ProviderConfig,
  TestMaterial,
  PromptField,
  GenerationResult,
  JudgeResult,
  EnvInfo,
} from '@/types';
import { PROMPT_FIELDS, SYSTEM_PROMPTS, buildMessages } from '@/lib/prompts';
import { getRandomMaterial, getEmptyMaterial, getRandomTopic, getEmptyTopic } from '@/lib/materials';
import { exportFullMdsXml } from '@/lib/xml-export';
import { parseMdsPrompts, type ParsedPromptSet } from '@/lib/xml-import';

// ── Provider / Endpoint configuration ─────────────────────────────

function getBaseUrl(providerType: string, endpoint: string): string {
  if (providerType === 'openai') return 'https://api.openai.com/v1';
  const env = endpoint === 'prod' ? 'prod' : 'staging';
  const backend = providerType === 'bapi-academic' ? 'academiccloud' : 'openai';
  return `https://b-api.${env}.openeduhub.net/api/v1/llm/${backend}`;
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI (direkt)', defaultModel: 'gpt-4.1-mini' },
  { value: 'bapi-openai', label: 'B-API → OpenAI', defaultModel: 'gpt-4.1-mini' },
  { value: 'bapi-academic', label: 'B-API → AcademicCloud / KissKI', defaultModel: 'gemma-4-31b-it' },
];

const BAPI_ENDPOINT_OPTIONS = [
  { value: 'staging', label: 'Staging' },
  { value: 'prod', label: 'Produktion' },
  { value: 'custom', label: 'Custom' },
];

const IMAGE_FIELD_ID = 'topic_page_ai_topic_header_image';

// AcademicCloud erlaubt keine parallelen Anfragen und hat ein Rate-Limit.
// Mindestabstand zwischen aufeinanderfolgenden Academic-Calls (clientseitig,
// daher NICHT Teil der serverseitig gemessenen Generierungszeit).
const ACADEMIC_MIN_INTERVAL_MS = 3000;
let lastAcademicCall = 0;
async function academicRateLimit() {
  const wait = lastAcademicCall + ACADEMIC_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastAcademicCall = Date.now();
}

// Volltext-Extraktion über den text-extraction-Dienst
async function fetchExtractText(url: string, env: string): Promise<{ text: string; lang: string }> {
  const res = await fetch('/api/extract-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, env }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { text: data.text || '', lang: data.lang || '' };
}

// ── Batch entry type ──────────────────────────────────────────────

interface BatchEntry {
  id: string;
  materialIdx: number;
  fieldId: string;
  model: string;
  oldResult: GenerationResult | null;
  newResult: GenerationResult | null;
  judgeResult: JudgeResult | null;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

// ── Main page ─────────────────────────────────────────────────────

export default function PromptTesterPage() {
  // Provider state
  const [provider, setProvider] = useState<ProviderConfig>({
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4.1-mini',
  });
  const [bapiEndpoint, setBapiEndpoint] = useState('staging');
  const [envInfo, setEnvInfo] = useState<EnvInfo>({ openaiKey: '', bapiKey: '', gwdgKey: '' });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Mode: single vs batch
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<'material' | 'topic'>('material');

  // Single-test state
  const [material, setMaterial] = useState<TestMaterial>(getRandomMaterial);
  const [topicData, setTopicData] = useState<TestMaterial>(getRandomTopic);

  // Material source: sample | repo | url; shared prod/staging env
  const [materialSource, setMaterialSource] = useState<'sample' | 'repo' | 'url'>('sample');
  const [repoEnv, setRepoEnv] = useState<'prod' | 'staging'>('prod');
  const [repoRef, setRepoRef] = useState('');
  const [extractUrl, setExtractUrl] = useState('');
  const [loadingMaterial, setLoadingMaterial] = useState(false);
  const [materialNote, setMaterialNote] = useState('');

  // Batch material loading (multi-line repo refs / URLs)
  const [batchRepoRefs, setBatchRepoRefs] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchLoadNote, setBatchLoadNote] = useState('');
  const [selectedFieldIdx, setSelectedFieldIdx] = useState(0);
  const [customPrompts, setCustomPrompts] = useState<Record<string, { old: string; new: string }>>({});
  const [customSystemPrompts, setCustomSystemPrompts] = useState({ old: SYSTEM_PROMPTS.old, new: SYSTEM_PROMPTS.new });

  // Prompt sources (A = old/Original, B = new/Optimiert)
  const [sourceA, setSourceA] = useState('mds');
  const [sourceB, setSourceB] = useState('mds_new');
  const [countA, setCountA] = useState<number | null>(null);
  const [countB, setCountB] = useState<number | null>(null);
  const [fileNameA, setFileNameA] = useState('');
  const [fileNameB, setFileNameB] = useState('');
  const [oldResult, setOldResult] = useState<GenerationResult | null>(null);
  const [newResult, setNewResult] = useState<GenerationResult | null>(null);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [judging, setJudging] = useState(false);
  const [error, setError] = useState('');

  // Batch state
  const [batchMaterials, setBatchMaterials] = useState<TestMaterial[]>(() => {
    const mats: TestMaterial[] = [];
    for (let i = 0; i < 3; i++) mats.push(getRandomMaterial());
    return mats;
  });
  const [batchFields, setBatchFields] = useState<Set<string>>(
    () => new Set(['cclom:title', 'cclom:general_description', 'cclom:general_keyword'])
  );
  const [comparisonModels, setComparisonModels] = useState<string[]>([]);
  const [batchModelInput, setBatchModelInput] = useState('');

  // Judge model: 'same' = wie Testmodell, 'custom' = konstantes Modell
  const [judgeModelMode, setJudgeModelMode] = useState<'same' | 'custom'>('same');
  const [judgeModel, setJudgeModel] = useState('gpt-4.1-mini');
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchAutoJudge, setBatchAutoJudge] = useState(true);
  const abortRef = useRef(false);

  // Improvement suggestions
  const [improvements, setImprovements] = useState<Record<string, { analysis: string; prompt: string }>>({});
  const [improvementsLoading, setImprovementsLoading] = useState(false);
  const [improvementsProgress, setImprovementsProgress] = useState('');

  // UI toggles
  const [configOpen, setConfigOpen] = useState(true);
  const [materialOpen, setMaterialOpen] = useState(true);

  useEffect(() => {
    fetch('/api/env').then(r => r.json()).then(setEnvInfo).catch(() => {});
  }, []);

  // ── Prompt-source loading ─────────────────────────────────────

  const applySet = useCallback((variant: 'old' | 'new', parsed: ParsedPromptSet | null) => {
    setCustomPrompts(prev => {
      const next: Record<string, { old: string; new: string }> = {};
      for (const f of PROMPT_FIELDS) {
        const fallback = variant === 'old' ? f.oldPrompt : f.newPrompt;
        const loaded = parsed?.prompts[f.id] ?? fallback;
        next[f.id] = {
          old: variant === 'old' ? loaded : (prev[f.id]?.old ?? f.oldPrompt),
          new: variant === 'new' ? loaded : (prev[f.id]?.new ?? f.newPrompt),
        };
      }
      return next;
    });
    setCustomSystemPrompts(prev => ({
      ...prev,
      [variant]: parsed?.system || (variant === 'old' ? SYSTEM_PROMPTS.old : SYSTEM_PROMPTS.new),
    }));
  }, []);

  const loadVariant = useCallback(async (variant: 'old' | 'new', source: string, fileText?: string) => {
    try {
      if (source === 'manual') {
        applySet(variant, null);
        if (variant === 'old') setCountA(null); else setCountB(null);
        return;
      }
      let xml = fileText ?? '';
      if (source === 'mds') xml = await fetch('/data/mds.xml').then(r => r.text());
      else if (source === 'mds_new') xml = await fetch('/data/mds_28052026.xml').then(r => r.text());
      else if (source === 'mds_v2') xml = await fetch('/data/mds_28052026_v2.xml').then(r => r.text());
      if (!xml) return;
      const parsed = parseMdsPrompts(xml);
      applySet(variant, parsed);
      const c = Object.keys(parsed.prompts).length;
      if (variant === 'old') setCountA(c); else setCountB(c);
    } catch (e) {
      setError(`Prompt-Quelle ${variant === 'old' ? 'A' : 'B'}: ${e instanceof Error ? e.message : 'Ladefehler'}`);
    }
  }, [applySet]);

  // Load defaults from the bundled XML files on mount
  useEffect(() => {
    loadVariant('old', 'mds');
    loadVariant('new', 'mds_new');
  }, [loadVariant]);

  const handleSourceSelect = (variant: 'old' | 'new', source: string) => {
    if (variant === 'old') { setSourceA(source); setFileNameA(''); }
    else { setSourceB(source); setFileNameB(''); }
    if (source !== 'file') loadVariant(variant, source);
  };

  const handleSourceFile = (variant: 'old' | 'new', file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      loadVariant(variant, 'file', String(reader.result));
      if (variant === 'old') setFileNameA(file.name); else setFileNameB(file.name);
    };
    reader.readAsText(file);
  };

  const fieldsForCategory = PROMPT_FIELDS.filter(f => f.category === selectedCategory);
  const safeIdx = Math.min(selectedFieldIdx, fieldsForCategory.length - 1);
  const field = fieldsForCategory[safeIdx] || PROMPT_FIELDS[0];
  const activeMaterial = selectedCategory === 'topic' ? topicData : material;

  // ── Provider helpers ──────────────────────────────────────────

  const handleProviderChange = (type: string) => {
    const opt = PROVIDER_OPTIONS.find(o => o.value === type)!;
    const url = type === 'openai'
      ? 'https://api.openai.com/v1'
      : getBaseUrl(type, bapiEndpoint);
    setProvider({ type: type as ProviderConfig['type'], baseUrl: url, apiKey: '', model: opt.defaultModel });
    setAvailableModels([]);
  };

  const handleEndpointChange = (ep: string) => {
    setBapiEndpoint(ep);
    if (ep !== 'custom') {
      setProvider(p => ({ ...p, baseUrl: getBaseUrl(p.type, ep) }));
    }
    setAvailableModels([]);
  };

  const envKeyPlaceholder = provider.type === 'openai'
    ? envInfo.openaiKey
    : provider.type === 'bapi-academic'
    ? (envInfo.bapiKey || envInfo.gwdgKey)
    : envInfo.bapiKey;

  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: provider.baseUrl, apiKey: provider.apiKey, providerType: provider.type }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAvailableModels(data.models || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Modelle konnten nicht geladen werden');
    } finally {
      setModelsLoading(false);
    }
  }, [provider.baseUrl, provider.apiKey, provider.type]);

  // ── Prompt helpers ────────────────────────────────────────────

  const getEditablePrompt = useCallback((f: PromptField, variant: 'old' | 'new') => {
    return customPrompts[f.id]?.[variant] ?? (variant === 'old' ? f.oldPrompt : f.newPrompt);
  }, [customPrompts]);

  const setEditablePrompt = (f: PromptField, variant: 'old' | 'new', value: string) => {
    setCustomPrompts(prev => ({
      ...prev,
      [f.id]: {
        old: prev[f.id]?.old ?? f.oldPrompt,
        new: prev[f.id]?.new ?? f.newPrompt,
        [variant]: value,
      },
    }));
  };

  // ── API call helper ───────────────────────────────────────────

  const callGenerate = useCallback(async (msgs: { system: string; user: string }, fieldId?: string, modelOverride?: string) => {
    if (fieldId === IMAGE_FIELD_ID) {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          model: 'gpt-image-1',
          providerType: provider.type,
          prompt: msgs.user,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data as GenerationResult;
    }

    if (provider.type === 'bapi-academic') await academicRateLimit();

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: modelOverride || provider.model,
        providerType: provider.type,
        systemMessage: msgs.system,
        userMessage: msgs.user,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data as GenerationResult;
  }, [provider]);

  // Erzeugt Alt+Neu: bei AcademicCloud sequenziell (Rate-Limit), sonst parallel.
  const generatePair = useCallback(async (
    oldMsgs: { system: string; user: string },
    newMsgs: { system: string; user: string },
    fieldId: string,
    modelOverride?: string,
  ): Promise<[GenerationResult, GenerationResult]> => {
    if (provider.type === 'bapi-academic') {
      const oldRes = await callGenerate(oldMsgs, fieldId, modelOverride);
      const newRes = await callGenerate(newMsgs, fieldId, modelOverride);
      return [oldRes, newRes];
    }
    return Promise.all([
      callGenerate(oldMsgs, fieldId, modelOverride),
      callGenerate(newMsgs, fieldId, modelOverride),
    ]);
  }, [provider.type, callGenerate]);

  const callJudge = useCallback(async (
    f: PromptField,
    mat: TestMaterial,
    oldOut: string,
    newOut: string,
    modelOverride?: string
  ) => {
    if (provider.type === 'bapi-academic') await academicRateLimit();
    const res = await fetch('/api/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: modelOverride || provider.model,
        providerType: provider.type,
        fieldName: f.name,
        material: mat,
        oldOutput: oldOut,
        newOutput: newOut,
        fieldPromptOld: getEditablePrompt(f, 'old'),
        fieldPromptNew: getEditablePrompt(f, 'new'),
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data as JudgeResult;
  }, [provider, getEditablePrompt]);

  // ── Single test ───────────────────────────────────────────────

  const runSingleComparison = useCallback(async () => {
    setRunning(true);
    setError('');
    setOldResult(null);
    setNewResult(null);
    setJudgeResult(null);

    const f: PromptField = {
      ...field,
      oldPrompt: getEditablePrompt(field, 'old'),
      newPrompt: getEditablePrompt(field, 'new'),
    };

    try {
      const oldMsgs = buildMessages('old', f, activeMaterial);
      const newMsgs = buildMessages('new', f, activeMaterial);
      if (f.category === 'material') {
        oldMsgs.system = customSystemPrompts.old;
        newMsgs.system = customSystemPrompts.new;
      }
      const [oldRes, newRes] = await generatePair(oldMsgs, newMsgs, f.id);
      setOldResult(oldRes);
      setNewResult(newRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler bei der Generierung');
    } finally {
      setRunning(false);
    }
  }, [field, activeMaterial, generatePair, getEditablePrompt, customSystemPrompts]);

  const runSingleJudge = useCallback(async () => {
    if (!oldResult || !newResult) return;
    setJudging(true);
    try {
      const jm = judgeModelMode === 'same' ? provider.model : judgeModel;
      const result = await callJudge(field, activeMaterial, oldResult.output, newResult.output, jm);
      setJudgeResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Judge');
    } finally {
      setJudging(false);
    }
  }, [oldResult, newResult, field, activeMaterial, callJudge, judgeModelMode, judgeModel, provider.model]);

  // ── Batch test ────────────────────────────────────────────────

  const runBatch = useCallback(async () => {
    abortRef.current = false;
    setBatchRunning(true);
    setError('');

    const models = [provider.model, ...comparisonModels.filter(m => m && m !== provider.model)];
    const entries: BatchEntry[] = [];
    batchMaterials.forEach((_, mi) => {
      batchFields.forEach(fId => {
        models.forEach(model => {
          entries.push({
            id: `${mi}-${fId}-${model}`,
            materialIdx: mi,
            fieldId: fId,
            model,
            oldResult: null,
            newResult: null,
            judgeResult: null,
            status: 'pending',
          });
        });
      });
    });
    setBatchEntries([...entries]);

    for (let i = 0; i < entries.length; i++) {
      if (abortRef.current) break;

      const entry = entries[i];
      entry.status = 'running';
      setBatchEntries([...entries]);

      const mat = batchMaterials[entry.materialIdx];
      const f = PROMPT_FIELDS.find(p => p.id === entry.fieldId)!;
      const fWithCustom: PromptField = {
        ...f,
        oldPrompt: getEditablePrompt(f, 'old'),
        newPrompt: getEditablePrompt(f, 'new'),
      };

      try {
        const oldMsgs = buildMessages('old', fWithCustom, mat);
        const newMsgs = buildMessages('new', fWithCustom, mat);
        if (fWithCustom.category === 'material') {
          oldMsgs.system = customSystemPrompts.old;
          newMsgs.system = customSystemPrompts.new;
        }
        const [oldRes, newRes] = await generatePair(oldMsgs, newMsgs, fWithCustom.id, entry.model);
        entry.oldResult = oldRes;
        entry.newResult = newRes;

        if (batchAutoJudge && !abortRef.current && fWithCustom.id !== IMAGE_FIELD_ID) {
          try {
            const jm = judgeModelMode === 'same' ? entry.model : judgeModel;
            entry.judgeResult = await callJudge(f, mat, oldRes.output, newRes.output, jm);
          } catch {
            // Judge failure is non-critical
          }
        }

        entry.status = 'done';
      } catch (e) {
        entry.status = 'error';
        entry.error = e instanceof Error ? e.message : 'Fehler';
      }

      setBatchEntries([...entries]);
    }

    setBatchRunning(false);
  }, [batchMaterials, batchFields, comparisonModels, batchAutoJudge, generatePair, callJudge, getEditablePrompt, customSystemPrompts, provider.model, judgeModelMode, judgeModel]);

  const stopBatch = () => { abortRef.current = true; };

  // ── Improvement suggestions ──────────────────────────────────

  const generateImprovements = useCallback(async () => {
    setImprovementsLoading(true);
    setImprovements({});

    const judged = batchEntries.filter(e => e.status === 'done' && e.judgeResult);
    const fieldIds = [...new Set(judged.map(e => e.fieldId))].filter(id => id !== IMAGE_FIELD_ID);

    for (const fId of fieldIds) {
      const f = PROMPT_FIELDS.find(p => p.id === fId);
      if (!f) continue;
      setImprovementsProgress(`${f.name}…`);

      // Collect all feedback for this field across models & materials
      const fieldEntries = judged.filter(e => e.fieldId === fId);
      const feedbackBlocks = fieldEntries.map((e, i) => {
        const jr = e.judgeResult!;
        const criteriaText = jr.criteria?.map(c =>
          `  ${c.name}: Alt ${c.oldScore}/10, Neu ${c.newScore}/10 – ${c.comment}`
        ).join('\n') ?? '';
        return `--- Durchlauf ${i + 1} (${e.model}) ---\nGesamtscore: Alt ${jr.oldScore?.toFixed(1)}, Neu ${jr.newScore?.toFixed(1)}\n${criteriaText}\nBegründung: ${jr.reasoning}`;
      }).join('\n\n');

      const currentPrompt = getEditablePrompt(f, 'new');

      const summaryPrompt = `Du bist ein Prompt-Engineering-Experte für Bildungsmetadaten. Analysiere das gesammelte Judge-Feedback und erstelle konkrete Verbesserungsvorschläge.

Feld: ${f.name} (${f.id})
Beschreibung: ${f.description}

Aktueller optimierter Prompt:
"""
${currentPrompt}
"""

Gesammeltes Judge-Feedback (${fieldEntries.length} Durchläufe):
${feedbackBlocks}

Erstelle eine Analyse in exakt diesem Format:

## Schwachstellen
- (Welche Kriterien sind unter 10? Warum?)

## Konkrete Änderungen
- (Was genau muss im Prompt ergänzt, präzisiert oder umformuliert werden?)

## Verbesserter Prompt
(Der komplette, verbesserte Prompt – direkt einsetzbar, ohne Erklärung drumherum)`;

      try {
        const result = await callGenerate(
          { system: 'Du bist ein Prompt-Optimierungsberater. Antworte auf Deutsch.', user: summaryPrompt },
          undefined
        );

        // Split into analysis (before "## Verbesserter Prompt") and the prompt itself
        const parts = result.output.split(/##\s*Verbesserter Prompt\s*/i);
        const analysis = (parts[0] ?? result.output).trim();
        const suggestedPrompt = (parts[1] ?? '').trim();

        setImprovements(prev => ({ ...prev, [fId]: { analysis, prompt: suggestedPrompt } }));
      } catch {
        setImprovements(prev => ({
          ...prev,
          [fId]: { analysis: 'Fehler bei der Generierung der Vorschläge.', prompt: '' },
        }));
      }
    }

    setImprovementsProgress('');
    setImprovementsLoading(false);
  }, [batchEntries, callGenerate, getEditablePrompt]);

  const applyImprovement = (fieldId: string, prompt: string) => {
    const f = PROMPT_FIELDS.find(p => p.id === fieldId);
    if (f && prompt) {
      setEditablePrompt(f, 'new', prompt);
    }
  };

  // ── Material helpers ──────────────────────────────────────────

  const updateMaterial = (key: keyof TestMaterial, value: string) => {
    setMaterial(m => ({ ...m, [key]: value }));
  };

  const updateTopicData = (key: keyof TestMaterial, value: string) => {
    setTopicData(m => ({ ...m, [key]: value }));
  };

  // ── Material aus Repo / URL laden ─────────────────────────────

  const loadFromRepo = useCallback(async () => {
    if (!repoRef.trim()) return;
    setLoadingMaterial(true);
    setError('');
    setMaterialNote('');
    try {
      const res = await fetch('/api/repo-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeRef: repoRef, env: repoEnv }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const mat: TestMaterial = { ...getEmptyMaterial(), ...data.material };
      setMaterial(mat);
      setMaterialNote(`Metadaten geladen (${repoEnv}).`);
      if (mat.url) {
        setMaterialNote(`Metadaten geladen. Volltext wird von ${mat.url} geladen…`);
        try {
          const { text } = await fetchExtractText(mat.url, repoEnv);
          setMaterial(m => ({ ...m, fullText: text }));
          setMaterialNote(`Metadaten + Volltext geladen (${text.length} Zeichen aus wwwurl).`);
        } catch {
          setMaterialNote('Metadaten geladen — Volltext-Extraktion der wwwurl fehlgeschlagen.');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Repo-Ladefehler');
    } finally {
      setLoadingMaterial(false);
    }
  }, [repoRef, repoEnv]);

  const loadFromUrl = useCallback(async () => {
    if (!extractUrl.trim()) return;
    setLoadingMaterial(true);
    setError('');
    setMaterialNote('');
    try {
      const { text, lang } = await fetchExtractText(extractUrl, repoEnv);
      setMaterial(m => ({
        ...m,
        url: extractUrl,
        fullText: text,
        language: m.language || (lang ? `${lang}_${lang.toUpperCase()}` : ''),
      }));
      setMaterialNote(`Volltext geladen (${text.length} Zeichen, Sprache: ${lang || 'n/a'}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraktionsfehler');
    } finally {
      setLoadingMaterial(false);
    }
  }, [extractUrl, repoEnv]);

  // Batch: mehrere Repo-Knoten (eine ID/URL pro Zeile) laden und anhängen
  const loadBatchFromRepo = useCallback(async () => {
    const refs = batchRepoRefs.split('\n').map(s => s.trim()).filter(Boolean);
    if (refs.length === 0) return;
    setBatchLoading(true);
    setError('');
    const added: TestMaterial[] = [];
    let failed = 0;
    for (let i = 0; i < refs.length; i++) {
      setBatchLoadNote(`Lade Repo-Inhalt ${i + 1}/${refs.length}…`);
      try {
        const res = await fetch('/api/repo-node', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeRef: refs[i], env: repoEnv }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const mat: TestMaterial = { ...getEmptyMaterial(), ...data.material };
        if (mat.url) {
          try { const { text } = await fetchExtractText(mat.url, repoEnv); mat.fullText = text; } catch { /* Volltext optional */ }
        }
        added.push(mat);
      } catch {
        failed += 1;
      }
    }
    if (added.length) setBatchMaterials(ms => [...ms, ...added]);
    setBatchRepoRefs('');
    setBatchLoadNote(`${added.length} geladen${failed ? `, ${failed} fehlgeschlagen` : ''}.`);
    setBatchLoading(false);
  }, [batchRepoRefs, repoEnv]);

  // Batch: mehrere Inhalts-URLs (eine pro Zeile) per Volltext-Extraktion laden
  const loadBatchFromUrls = useCallback(async () => {
    const urls = batchUrls.split('\n').map(s => s.trim()).filter(Boolean);
    if (urls.length === 0) return;
    setBatchLoading(true);
    setError('');
    const added: TestMaterial[] = [];
    let failed = 0;
    for (let i = 0; i < urls.length; i++) {
      setBatchLoadNote(`Extrahiere Volltext ${i + 1}/${urls.length}…`);
      try {
        const { text, lang } = await fetchExtractText(urls[i], repoEnv);
        added.push({ ...getEmptyMaterial(), url: urls[i], fullText: text, language: lang ? `${lang}_${lang.toUpperCase()}` : '' });
      } catch {
        failed += 1;
      }
    }
    if (added.length) setBatchMaterials(ms => [...ms, ...added]);
    setBatchUrls('');
    setBatchLoadNote(`${added.length} geladen${failed ? `, ${failed} fehlgeschlagen` : ''}.`);
    setBatchLoading(false);
  }, [batchUrls, repoEnv]);

  const toggleBatchField = (fId: string) => {
    setBatchFields(prev => {
      const next = new Set(prev);
      next.has(fId) ? next.delete(fId) : next.add(fId);
      return next;
    });
  };

  // ── Export ────────────────────────────────────────────────────

  const handleExport = (variant: 'old' | 'new') => {
    const exports: Record<string, string> = {};
    for (const f of PROMPT_FIELDS) {
      exports[f.id] = getEditablePrompt(f, variant);
    }
    const xml = exportFullMdsXml(variant, exports, 'academiccloud', provider.model);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mds_${variant}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Batch summary stats ───────────────────────────────────────

  const batchStats = (() => {
    const done = batchEntries.filter(e => e.status === 'done');
    if (done.length === 0) return null;
    const judged = done.filter(e => e.judgeResult);
    const oldWins = judged.filter(e => e.judgeResult?.winner === 'old').length;
    const newWins = judged.filter(e => e.judgeResult?.winner === 'new').length;
    const ties = judged.filter(e => e.judgeResult?.winner === 'tie').length;
    const avgOld = judged.length > 0
      ? judged.reduce((s, e) => s + (e.judgeResult?.oldScore ?? 0), 0) / judged.length
      : 0;
    const avgNew = judged.length > 0
      ? judged.reduce((s, e) => s + (e.judgeResult?.newScore ?? 0), 0) / judged.length
      : 0;
    const totalOldTokens = done.reduce((s, e) => s + (e.oldResult?.totalTokens ?? 0), 0);
    const totalNewTokens = done.reduce((s, e) => s + (e.newResult?.totalTokens ?? 0), 0);
    const totalOldMs = done.reduce((s, e) => s + (e.oldResult?.durationMs ?? 0), 0);
    const totalNewMs = done.reduce((s, e) => s + (e.newResult?.durationMs ?? 0), 0);
    return { done: done.length, judged: judged.length, oldWins, newWins, ties, avgOld, avgNew, totalOldTokens, totalNewTokens, totalOldMs, totalNewMs };
  })();

  // Alle Batch-Modelle = Testmodell + Vergleichsmodelle (dedupliziert)
  const allBatchModels = [provider.model, ...comparisonModels.filter(m => m && m !== provider.model)];

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold">WLO Prompt Tester</h1>
            <p className="text-xs text-[var(--text-muted)]">Metadaten-Prompts vergleichen &amp; bewerten</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode toggle */}
            <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-sm">
              <button
                className={`px-3 py-1.5 ${mode === 'single' ? 'bg-[var(--accent)] text-white' : 'bg-white'}`}
                onClick={() => setMode('single')}
              >Einzeltest</button>
              <button
                className={`px-3 py-1.5 ${mode === 'batch' ? 'bg-[var(--accent)] text-white' : 'bg-white'}`}
                onClick={() => setMode('batch')}
              >Batch-Modus</button>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => handleExport('old')}>Export Original XML</button>
            <button className="btn btn-primary btn-sm" onClick={() => handleExport('new')}>Export Optimiert XML</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setConfigOpen(c => !c)}>
              {configOpen ? 'Config ▲' : 'Config ▼'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-4 py-4 space-y-4">
        {/* ── Provider Config ────────────────────────────────── */}
        {configOpen && (
          <section className="card space-y-4">
            <h2 className="text-sm font-semibold">KI-Anbindung</h2>

            {/* Verbindung: Provider / Umgebung / Base URL / API Key */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="label">Provider</label>
                <select className="input" value={provider.type} onChange={e => handleProviderChange(e.target.value)}>
                  {PROVIDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {provider.type.startsWith('bapi') && (
                <div>
                  <label className="label">Umgebung</label>
                  <select className="input" value={bapiEndpoint} onChange={e => handleEndpointChange(e.target.value)}>
                    {BAPI_ENDPOINT_OPTIONS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Base URL</label>
                <input
                  className="input"
                  value={provider.baseUrl}
                  onChange={e => setProvider(p => ({ ...p, baseUrl: e.target.value }))}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="label">
                  API Key {envKeyPlaceholder && <span className="font-normal text-[var(--text-muted)]">(env: {envKeyPlaceholder})</span>}
                </label>
                <input
                  type="password"
                  className="input"
                  value={provider.apiKey}
                  onChange={e => setProvider(p => ({ ...p, apiKey: e.target.value }))}
                  placeholder={envKeyPlaceholder ? `Env wird verwendet (${envKeyPlaceholder})` : 'API Key eingeben'}
                />
              </div>
            </div>

            {/* Test-Modell */}
            <div className="border-t border-[var(--border)] pt-3">
              <label className="label">
                Test-Modell <span className="font-normal text-[var(--text-muted)]">— generiert die zu vergleichenden Outputs</span>
              </label>
              <div className="max-w-md">
                <ModelPicker
                  value={provider.model}
                  onChange={m => setProvider(p => ({ ...p, model: m }))}
                  availableModels={availableModels}
                  onFetch={fetchModels}
                  loading={modelsLoading}
                />
              </div>
            </div>

            {/* Vergleichsmodelle (nur Batch) */}
            {mode === 'batch' && (
              <div className="border-t border-[var(--border)] pt-3">
                <label className="label">
                  Vergleichsmodelle <span className="font-normal text-[var(--text-muted)]">— zusätzliche Modelle des gleichen Providers (Testmodell ist immer dabei)</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--accent)] text-white rounded-md text-sm">
                    {provider.model} <span className="text-[10px] opacity-80">(Test)</span>
                  </span>
                  {comparisonModels.filter(m => m !== provider.model).map(m => (
                    <span key={m} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-300 rounded-md text-sm">
                      {m}
                      <button className="text-blue-400 hover:text-red-600 ml-1" onClick={() => setComparisonModels(ms => ms.filter(x => x !== m))}>&times;</button>
                    </span>
                  ))}
                  <div className="flex gap-1">
                    {availableModels.length > 0 ? (
                      <select className="input text-sm py-1" value={batchModelInput} onChange={e => setBatchModelInput(e.target.value)}>
                        <option value="">Modell wählen…</option>
                        {availableModels.filter(m => m !== provider.model && !comparisonModels.includes(m)).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input text-sm py-1 w-48"
                        value={batchModelInput}
                        onChange={e => setBatchModelInput(e.target.value)}
                        placeholder="Modellname eingeben"
                        onKeyDown={e => {
                          const v = batchModelInput.trim();
                          if (e.key === 'Enter' && v && v !== provider.model && !comparisonModels.includes(v)) {
                            setComparisonModels(ms => [...ms, v]); setBatchModelInput('');
                          }
                        }}
                      />
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={!batchModelInput.trim() || batchModelInput.trim() === provider.model || comparisonModels.includes(batchModelInput.trim())}
                      onClick={() => {
                        const v = batchModelInput.trim();
                        if (v && v !== provider.model && !comparisonModels.includes(v)) { setComparisonModels(ms => [...ms, v]); setBatchModelInput(''); }
                      }}
                    >+</button>
                  </div>
                </div>
              </div>
            )}

            {/* Judge-Modell */}
            <div className="border-t border-[var(--border)] pt-3">
              <label className="label">
                Judge-Modell <span className="font-normal text-[var(--text-muted)]">— bewertet die Outputs</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                <div className="max-w-md w-full">
                  <ModelPicker
                    value={judgeModelMode === 'same' ? provider.model : judgeModel}
                    onChange={setJudgeModel}
                    availableModels={availableModels}
                    onFetch={fetchModels}
                    loading={modelsLoading}
                    disabled={judgeModelMode === 'same'}
                  />
                </div>
                <select
                  className="input sm:w-64"
                  value={judgeModelMode}
                  onChange={e => {
                    const m = e.target.value as 'same' | 'custom';
                    setJudgeModelMode(m);
                    if (m === 'custom') setJudgeModel(provider.model);
                  }}
                >
                  <option value="same">Gleiches Modell wie Testmodell</option>
                  <option value="custom">Konstantes Modell</option>
                </select>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {judgeModelMode === 'same'
                  ? 'Der Judge nutzt jeweils das Modell, das den Output erzeugt hat.'
                  : 'Konstanter Judge für vergleichbare Bewertungen über mehrere Testmodelle hinweg.'}
              </p>
            </div>
          </section>
        )}

        {/* ── Prompt-Quellen ─────────────────────────────────── */}
        <section className="card">
          <h2 className="text-sm font-semibold mb-1">Prompt-Quellen</h2>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Set A = Original-Prompts (links), Set B = optimierte Prompts (rechts). Quelle je Set wählbar; Felder ohne Eintrag in der Datei nutzen die App-Vorgabe.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PromptSourceSelector
              label="Set A — Original"
              color="amber"
              value={sourceA}
              fileName={fileNameA}
              count={countA}
              onSelect={s => handleSourceSelect('old', s)}
              onFile={f => handleSourceFile('old', f)}
            />
            <PromptSourceSelector
              label="Set B — Optimiert"
              color="green"
              value={sourceB}
              fileName={fileNameB}
              count={countB}
              onSelect={s => handleSourceSelect('new', s)}
              onFile={f => handleSourceFile('new', f)}
            />
          </div>
        </section>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
            <button className="ml-2 underline" onClick={() => setError('')}>schließen</button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            SINGLE TEST MODE
            ════════════════════════════════════════════════════════ */}
        {mode === 'single' && (
          <>
            {/* Category Toggle */}
            <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-sm w-fit">
              <button
                className={`px-4 py-2 ${selectedCategory === 'material' ? 'bg-[var(--accent)] text-white font-semibold' : 'bg-white'}`}
                onClick={() => { setSelectedCategory('material'); setSelectedFieldIdx(0); setOldResult(null); setNewResult(null); setJudgeResult(null); }}
              >Metadaten</button>
              <button
                className={`px-4 py-2 ${selectedCategory === 'topic' ? 'bg-[var(--accent)] text-white font-semibold' : 'bg-white'}`}
                onClick={() => { setSelectedCategory('topic'); setSelectedFieldIdx(0); setOldResult(null); setNewResult(null); setJudgeResult(null); }}
              >Themenseiten</button>
            </div>

            {/* Input Data */}
            <section className="card">
              {selectedCategory === 'material' ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold cursor-pointer" onClick={() => setMaterialOpen(m => !m)}>
                      Testmaterial {materialOpen ? '▲' : '▼'}
                    </h2>
                  </div>
                  {materialOpen && (
                    <>
                      {/* Quellen-Auswahl */}
                      <div className="flex flex-wrap items-center gap-1 mb-3">
                        {([
                          ['sample', 'Beispielmaterial'],
                          ['repo', 'Aus Repo laden'],
                          ['url', 'Von URL laden'],
                        ] as const).map(([val, lbl]) => (
                          <button
                            key={val}
                            className={`px-3 py-1.5 text-sm rounded-md border ${
                              materialSource === val ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-white border-[var(--border)]'
                            }`}
                            onClick={() => { setMaterialSource(val); setMaterialNote(''); }}
                          >{lbl}</button>
                        ))}
                        {(materialSource === 'repo' || materialSource === 'url') && (
                          <div className="flex items-center gap-1.5 ml-2">
                            <span className="text-xs text-[var(--text-muted)]">Umgebung:</span>
                            <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-xs">
                              {(['prod', 'staging'] as const).map(ev => (
                                <button
                                  key={ev}
                                  className={`px-2.5 py-1 ${repoEnv === ev ? 'bg-[var(--accent)] text-white' : 'bg-white'}`}
                                  onClick={() => setRepoEnv(ev)}
                                >{ev === 'prod' ? 'Prod' : 'Staging'}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Quellen-spezifische Steuerung */}
                      {materialSource === 'sample' && (
                        <div className="flex gap-2 mb-3">
                          <button className="btn btn-secondary btn-sm" onClick={() => { setMaterial(getRandomMaterial()); setMaterialNote(''); }}>Zufallsmaterial</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setMaterial(getEmptyMaterial()); setMaterialNote(''); }}>Leeren</button>
                        </div>
                      )}
                      {materialSource === 'repo' && (
                        <div className="flex gap-2 mb-3 items-end flex-wrap">
                          <div className="flex-1 min-w-[280px]">
                            <label className="label">Node-ID oder Render-URL (edu-sharing / WLO)</label>
                            <input
                              className="input"
                              value={repoRef}
                              onChange={e => setRepoRef(e.target.value)}
                              placeholder="z.B. 3ee95eb5-c383-4856-892a-9eecc5806cae oder …/render/{id}"
                              onKeyDown={e => { if (e.key === 'Enter') loadFromRepo(); }}
                            />
                          </div>
                          <button className="btn btn-primary" onClick={loadFromRepo} disabled={loadingMaterial || !repoRef.trim()}>
                            {loadingMaterial ? 'Lädt…' : 'Laden'}
                          </button>
                        </div>
                      )}
                      {materialSource === 'url' && (
                        <div className="flex gap-2 mb-3 items-end flex-wrap">
                          <div className="flex-1 min-w-[280px]">
                            <label className="label">URL (Volltext-Extraktion)</label>
                            <input
                              className="input"
                              value={extractUrl}
                              onChange={e => setExtractUrl(e.target.value)}
                              placeholder="https://…"
                              onKeyDown={e => { if (e.key === 'Enter') loadFromUrl(); }}
                            />
                          </div>
                          <button className="btn btn-primary" onClick={loadFromUrl} disabled={loadingMaterial || !extractUrl.trim()}>
                            {loadingMaterial ? 'Lädt…' : 'Volltext laden'}
                          </button>
                        </div>
                      )}

                      {materialNote && (
                        <p className="text-xs text-[var(--accent)] mb-3">{materialNote}</p>
                      )}

                      <MaterialForm material={material} onChange={updateMaterial} />
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">Themenseiten-Daten</h2>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => setTopicData(getRandomTopic())}>Zufallsthema</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setTopicData(getEmptyTopic())}>Leeren</button>
                    </div>
                  </div>
                  <TopicForm data={topicData} onChange={updateTopicData} />
                </>
              )}
            </section>

            {/* Field Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {fieldsForCategory.map((f, idx) => (
                <button
                  key={f.id}
                  className={`px-3 py-1.5 text-sm whitespace-nowrap rounded-t-md border border-b-0 transition-colors ${
                    idx === safeIdx
                      ? 'bg-white font-semibold text-[var(--accent)] border-[var(--border)]'
                      : 'bg-[var(--bg)] text-[var(--text-muted)] border-transparent hover:bg-white'
                  }`}
                  onClick={() => { setSelectedFieldIdx(idx); setOldResult(null); setNewResult(null); setJudgeResult(null); }}
                >
                  {f.name}
                </button>
              ))}
            </div>

            {/* Prompt Comparison */}
            <section className="card -mt-1">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold">{field.name}</h2>
                  <p className="text-xs text-[var(--text-muted)]">{field.description} ({field.id})</p>
                </div>
                <button className="btn btn-primary" onClick={runSingleComparison} disabled={running}>
                  {running ? 'Generiere...' : 'Vergleichen'}
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PromptPanel
                  label="Original-Prompt"
                  color="amber"
                  value={getEditablePrompt(field, 'old')}
                  onChange={v => setEditablePrompt(field, 'old', v)}
                  onReset={() => setEditablePrompt(field, 'old', field.oldPrompt)}
                  result={oldResult}
                />
                <PromptPanel
                  label="Optimierter Prompt"
                  color="green"
                  value={getEditablePrompt(field, 'new')}
                  onChange={v => setEditablePrompt(field, 'new', v)}
                  onReset={() => setEditablePrompt(field, 'new', field.newPrompt)}
                  result={newResult}
                />
              </div>
            </section>

            {/* System Prompt (only for material fields) */}
            {selectedCategory === 'material' && (
              <SystemPromptEditor
                oldValue={customSystemPrompts.old}
                newValue={customSystemPrompts.new}
                onChangeOld={v => setCustomSystemPrompts(p => ({ ...p, old: v }))}
                onChangeNew={v => setCustomSystemPrompts(p => ({ ...p, new: v }))}
                onReset={() => setCustomSystemPrompts({ old: SYSTEM_PROMPTS.old, new: SYSTEM_PROMPTS.new })}
              />
            )}

            {/* Judge (not for image fields) */}
            {oldResult && newResult && field.id !== IMAGE_FIELD_ID && (
              <JudgeSection
                judgeResult={judgeResult}
                judging={judging}
                onRun={runSingleJudge}
              />
            )}

            {/* Metrics */}
            {(oldResult || newResult) && (
              <MetricsSummary oldResult={oldResult} newResult={newResult} />
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════
            BATCH MODE
            ════════════════════════════════════════════════════════ */}
        {mode === 'batch' && (
          <>
            {/* Batch Materials */}
            <section className="card">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-sm font-semibold">Materialien ({batchMaterials.length})</h2>
                <div className="flex gap-2 items-center">
                  <div className="flex items-center gap-1.5 mr-1">
                    <span className="text-xs text-[var(--text-muted)]">Umgebung:</span>
                    <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-xs">
                      {(['prod', 'staging'] as const).map(ev => (
                        <button
                          key={ev}
                          className={`px-2.5 py-1 ${repoEnv === ev ? 'bg-[var(--accent)] text-white' : 'bg-white'}`}
                          onClick={() => setRepoEnv(ev)}
                        >{ev === 'prod' ? 'Prod' : 'Staging'}</button>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setBatchMaterials(m => [...m, getRandomMaterial()])}>
                    + Zufallsmaterial
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setBatchMaterials(m => [...m, getEmptyMaterial()])}>
                    + Leeres Material
                  </button>
                  {batchMaterials.length > 0 && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setBatchMaterials([])}>
                      Alle entfernen
                    </button>
                  )}
                </div>
              </div>

              {/* Aus Repo / URL laden (mehrere auf einmal) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                <div className="p-3 bg-gray-50 rounded-md border border-[var(--border)]">
                  <label className="label">Aus Repo laden — Node-IDs / Render-URLs (eine pro Zeile)</label>
                  <textarea
                    className="input font-mono text-xs"
                    rows={3}
                    value={batchRepoRefs}
                    onChange={e => setBatchRepoRefs(e.target.value)}
                    placeholder={"3ee95eb5-c383-4856-892a-9eecc5806cae\nhttps://redaktion.openeduhub.net/edu-sharing/components/render/…"}
                  />
                  <button
                    className="btn btn-primary btn-sm mt-2"
                    onClick={loadBatchFromRepo}
                    disabled={batchLoading || !batchRepoRefs.trim()}
                  >
                    {batchLoading ? 'Lädt…' : `Aus Repo laden (${batchRepoRefs.split('\n').map(s => s.trim()).filter(Boolean).length})`}
                  </button>
                </div>
                <div className="p-3 bg-gray-50 rounded-md border border-[var(--border)]">
                  <label className="label">Von URL laden — Inhalts-URLs (eine pro Zeile)</label>
                  <textarea
                    className="input font-mono text-xs"
                    rows={3}
                    value={batchUrls}
                    onChange={e => setBatchUrls(e.target.value)}
                    placeholder={"https://www.wirlernenonline.de\nhttps://…"}
                  />
                  <button
                    className="btn btn-primary btn-sm mt-2"
                    onClick={loadBatchFromUrls}
                    disabled={batchLoading || !batchUrls.trim()}
                  >
                    {batchLoading ? 'Lädt…' : `Von URL laden (${batchUrls.split('\n').map(s => s.trim()).filter(Boolean).length})`}
                  </button>
                </div>
              </div>
              {batchLoadNote && <p className="text-xs text-[var(--accent)] mb-3">{batchLoadNote}</p>}

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {batchMaterials.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md text-sm">
                    <span className="badge badge-gray font-mono">#{i + 1}</span>
                    <span className="flex-1 truncate font-medium">
                      {m.title || m.filename || m.url || '(leer)'}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                      {m.format} &middot; {m.fullText.substring(0, 60)}...
                    </span>
                    <button
                      className="text-xs text-[var(--text-muted)] hover:text-red-600"
                      onClick={() => setBatchMaterials(ms => ms.filter((_, j) => j !== i))}
                    >
                      Entfernen
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Field Selection + Run */}
            <section className="card">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold mb-2">Felder</h2>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Metadaten</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {PROMPT_FIELDS.filter(f => f.category === 'material').map(f => (
                          <label key={f.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm cursor-pointer border ${
                            batchFields.has(f.id) ? 'bg-blue-50 border-blue-300' : 'bg-white border-[var(--border)]'
                          }`}>
                            <input type="checkbox" checked={batchFields.has(f.id)} onChange={() => toggleBatchField(f.id)} className="accent-[var(--accent)]" />
                            {f.name}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Themenseiten</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {PROMPT_FIELDS.filter(f => f.category === 'topic').map(f => (
                          <label key={f.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm cursor-pointer border ${
                            batchFields.has(f.id) ? 'bg-blue-50 border-blue-300' : 'bg-white border-[var(--border)]'
                          }`}>
                            <input type="checkbox" checked={batchFields.has(f.id)} onChange={() => toggleBatchField(f.id)} className="accent-[var(--accent)]" />
                            {f.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={batchAutoJudge}
                      onChange={e => setBatchAutoJudge(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    Auto-Judge
                  </label>
                  {batchRunning ? (
                    <button className="btn btn-secondary" onClick={stopBatch}>Abbrechen</button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={runBatch}
                      disabled={batchMaterials.length === 0 || batchFields.size === 0}
                    >
                      Batch starten ({batchMaterials.length} × {batchFields.size} × {allBatchModels.length} = {batchMaterials.length * batchFields.size * allBatchModels.length} Durchläufe)
                    </button>
                  )}
                </div>
              </div>
              {allBatchModels.length > 1 && (
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Modelle: {allBatchModels.join(', ')} — Vergleichsmodelle werden in der KI-Anbindung oben gewählt.
                </p>
              )}
            </section>

            {/* Batch Prompt Editors */}
            {/* Batch System Prompt */}
            {[...batchFields].some(fId => PROMPT_FIELDS.find(p => p.id === fId)?.category === 'material') && (
              <SystemPromptEditor
                oldValue={customSystemPrompts.old}
                newValue={customSystemPrompts.new}
                onChangeOld={v => setCustomSystemPrompts(p => ({ ...p, old: v }))}
                onChangeNew={v => setCustomSystemPrompts(p => ({ ...p, new: v }))}
                onReset={() => setCustomSystemPrompts({ old: SYSTEM_PROMPTS.old, new: SYSTEM_PROMPTS.new })}
              />
            )}

            <section className="card">
              <h2 className="text-sm font-semibold mb-2">Prompts bearbeiten (gelten für Batch)</h2>
              <div className="space-y-3">
                {PROMPT_FIELDS.filter(f => batchFields.has(f.id)).map(f => (
                  <details key={f.id} className="border border-[var(--border)] rounded-md">
                    <summary className="px-3 py-2 cursor-pointer text-sm font-medium bg-gray-50 rounded-t-md">
                      {f.name} <span className="text-[var(--text-muted)]">({f.id})</span>
                    </summary>
                    <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Original</label>
                        <textarea
                          className="input"
                          rows={4}
                          value={getEditablePrompt(f, 'old')}
                          onChange={e => setEditablePrompt(f, 'old', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Optimiert</label>
                        <textarea
                          className="input"
                          rows={4}
                          value={getEditablePrompt(f, 'new')}
                          onChange={e => setEditablePrompt(f, 'new', e.target.value)}
                        />
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>

            {/* Batch Results */}
            {batchEntries.length > 0 && (
              <section className="card">
                <h2 className="text-sm font-semibold mb-3">
                  Ergebnisse
                  {batchRunning && <span className="ml-2 badge badge-blue">läuft...</span>}
                </h2>

                {/* Per-model summary */}
                {batchStats && (
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-sm">
                      <MetricCard label="Abgeschlossen" value={`${batchStats.done}/${batchEntries.length}`} />
                      <MetricCard label="Ø Original" value={batchStats.avgOld.toFixed(1)} />
                      <MetricCard label="Ø Optimiert" value={batchStats.avgNew.toFixed(1)} />
                      <MetricCard label="Original gewinnt" value={String(batchStats.oldWins)} />
                      <MetricCard label="Optimiert gewinnt" value={String(batchStats.newWins)} />
                      <MetricCard label="Tokens (alt/neu)" value={`${batchStats.totalOldTokens}/${batchStats.totalNewTokens}`} />
                      <MetricCard label="Dauer (alt/neu)" value={`${(batchStats.totalOldMs / 1000).toFixed(0)}s/${(batchStats.totalNewMs / 1000).toFixed(0)}s`} />
                    </div>
                    {allBatchModels.length > 1 && (() => {
                      const perModel = allBatchModels.map(m => {
                        const me = batchEntries.filter(e => e.model === m && e.status === 'done');
                        const judged = me.filter(e => e.judgeResult);
                        return {
                          model: m,
                          done: me.length,
                          avgOld: judged.length > 0 ? judged.reduce((s, e) => s + (e.judgeResult?.oldScore ?? 0), 0) / judged.length : 0,
                          avgNew: judged.length > 0 ? judged.reduce((s, e) => s + (e.judgeResult?.newScore ?? 0), 0) / judged.length : 0,
                          oldWins: judged.filter(e => e.judgeResult?.winner === 'old').length,
                          newWins: judged.filter(e => e.judgeResult?.winner === 'new').length,
                          tokens: me.reduce((s, e) => s + (e.oldResult?.totalTokens ?? 0) + (e.newResult?.totalTokens ?? 0), 0),
                          durationMs: me.reduce((s, e) => s + (e.oldResult?.durationMs ?? 0) + (e.newResult?.durationMs ?? 0), 0),
                        };
                      });
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b-2 border-[var(--border)]">
                                <th className="text-left py-1.5 px-2">Modell</th>
                                <th className="text-center py-1.5 px-2">Runs</th>
                                <th className="text-center py-1.5 px-2">Ø Original</th>
                                <th className="text-center py-1.5 px-2">Ø Optimiert</th>
                                <th className="text-center py-1.5 px-2">Alt gewinnt</th>
                                <th className="text-center py-1.5 px-2">Neu gewinnt</th>
                                <th className="text-center py-1.5 px-2">Tokens</th>
                                <th className="text-center py-1.5 px-2">Dauer</th>
                              </tr>
                            </thead>
                            <tbody>
                              {perModel.map(pm => (
                                <tr key={pm.model} className="border-b border-[var(--border)]">
                                  <td className="py-1.5 px-2 font-medium">{pm.model}</td>
                                  <td className="py-1.5 px-2 text-center">{pm.done}</td>
                                  <td className="py-1.5 px-2 text-center">{pm.avgOld.toFixed(1)}</td>
                                  <td className="py-1.5 px-2 text-center">{pm.avgNew.toFixed(1)}</td>
                                  <td className="py-1.5 px-2 text-center">{pm.oldWins}</td>
                                  <td className="py-1.5 px-2 text-center">{pm.newWins}</td>
                                  <td className="py-1.5 px-2 text-center">{pm.tokens}</td>
                                  <td className="py-1.5 px-2 text-center">{(pm.durationMs / 1000).toFixed(0)}s</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Results table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-[var(--border)]">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">Material</th>
                        <th className="text-left py-2 px-2">Feld</th>
                        {allBatchModels.length > 1 && <th className="text-left py-2 px-2">Modell</th>}
                        <th className="text-left py-2 px-2">Original-Output</th>
                        <th className="text-left py-2 px-2">Optimiert-Output</th>
                        <th className="text-center py-2 px-2">Score</th>
                        <th className="text-center py-2 px-2">Dauer</th>
                        <th className="text-center py-2 px-2">Tokens</th>
                        <th className="text-center py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchEntries.map((entry, i) => {
                        const mat = batchMaterials[entry.materialIdx];
                        const f = PROMPT_FIELDS.find(p => p.id === entry.fieldId)!;
                        const prevEntry = i > 0 ? batchEntries[i - 1] : null;
                        const isNewGroup = !prevEntry || prevEntry.materialIdx !== entry.materialIdx || prevEntry.fieldId !== entry.fieldId;
                        return (
                          <tr key={entry.id} className={`border-b border-[var(--border)] align-top hover:bg-gray-50 ${isNewGroup && i > 0 ? 'border-t-2 border-t-[var(--border)]' : ''}`}>
                            <td className="py-2 px-2 font-mono text-xs">{i + 1}</td>
                            <td className="py-2 px-2 max-w-[120px] truncate" title={mat?.title || mat?.filename}>
                              {isNewGroup ? (mat?.title || mat?.filename || `Material ${entry.materialIdx + 1}`) : ''}
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap">{isNewGroup ? f.name : ''}</td>
                            {allBatchModels.length > 1 && (
                              <td className="py-2 px-2 text-xs font-mono whitespace-nowrap">{entry.model}</td>
                            )}
                            <td className="py-2 px-2 max-w-[200px]">
                              <div className="truncate" title={entry.oldResult?.output}>
                                {entry.oldResult?.output || '-'}
                              </div>
                            </td>
                            <td className="py-2 px-2 max-w-[200px]">
                              <div className="truncate" title={entry.newResult?.output}>
                                {entry.newResult?.output || '-'}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center whitespace-nowrap">
                              {entry.judgeResult ? (
                                <span className={`badge ${entry.judgeResult.winner === 'new' ? 'badge-green' : entry.judgeResult.winner === 'old' ? 'badge-amber' : 'badge-gray'}`}>
                                  {entry.judgeResult.oldScore?.toFixed(1)} / {entry.judgeResult.newScore?.toFixed(1)}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2 px-2 text-center text-xs whitespace-nowrap">
                              {entry.oldResult && entry.newResult
                                ? `${(entry.oldResult.durationMs / 1000).toFixed(1)}s / ${(entry.newResult.durationMs / 1000).toFixed(1)}s`
                                : '-'}
                            </td>
                            <td className="py-2 px-2 text-center text-xs whitespace-nowrap">
                              {entry.oldResult && entry.newResult
                                ? `${entry.oldResult.totalTokens} / ${entry.newResult.totalTokens}`
                                : '-'}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <StatusBadge status={entry.status} error={entry.error} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Detailed Evaluation */}
            {!batchRunning && batchEntries.filter(e => e.status === 'done' && e.judgeResult).length > 0 && (
              <>
                <BatchEvaluation entries={batchEntries} models={allBatchModels} />

                {/* Improvement Suggestions */}
                <section className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold">Verbesserungsvorschläge</h2>
                      <p className="text-xs text-[var(--text-muted)]">Feedback aller Durchläufe wird zusammengefasst → konkreter Änderungsvorschlag pro Feld</p>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={generateImprovements}
                      disabled={improvementsLoading}
                    >
                      {improvementsLoading
                        ? `Analysiere ${improvementsProgress}`
                        : Object.keys(improvements).length > 0
                        ? 'Neu generieren'
                        : 'Vorschläge generieren'}
                    </button>
                  </div>

                  {Object.keys(improvements).length > 0 && (
                    <div className="space-y-4">
                      {Object.entries(improvements).map(([fId, imp]) => {
                        const f = PROMPT_FIELDS.find(p => p.id === fId);
                        return (
                          <details key={fId} open className="border border-[var(--border)] rounded-md">
                            <summary className="px-4 py-2.5 cursor-pointer text-sm font-semibold bg-gray-50 rounded-t-md flex items-center justify-between">
                              <span>{f?.name ?? fId} <span className="font-normal text-[var(--text-muted)]">({fId})</span></span>
                              {imp.prompt && (
                                <button
                                  className="btn btn-success btn-sm ml-4"
                                  onClick={e => { e.preventDefault(); applyImprovement(fId, imp.prompt); }}
                                >
                                  Prompt übernehmen
                                </button>
                              )}
                            </summary>
                            <div className="p-4 space-y-3">
                              <div className="text-sm whitespace-pre-wrap">{imp.analysis}</div>
                              {imp.prompt && (
                                <div className="border-t border-[var(--border)] pt-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="label font-semibold text-green-700">Vorgeschlagener Prompt</span>
                                    <button
                                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                                      onClick={() => navigator.clipboard.writeText(imp.prompt)}
                                    >
                                      Kopieren
                                    </button>
                                  </div>
                                  <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm whitespace-pre-wrap font-mono text-xs leading-relaxed">
                                    {imp.prompt}
                                  </div>
                                </div>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function MaterialForm({ material, onChange }: { material: TestMaterial; onChange: (key: keyof TestMaterial, val: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><label className="label">Titel</label><input className="input" value={material.title} onChange={e => onChange('title', e.target.value)} /></div>
        <div><label className="label">Dateiname</label><input className="input" value={material.filename} onChange={e => onChange('filename', e.target.value)} /></div>
        <div><label className="label">URL</label><input className="input" value={material.url} onChange={e => onChange('url', e.target.value)} /></div>
        <div><label className="label">Format</label><input className="input" value={material.format} onChange={e => onChange('format', e.target.value)} /></div>
        <div><label className="label">Medientyp</label><input className="input" value={material.mediatype} onChange={e => onChange('mediatype', e.target.value)} /></div>
        <div><label className="label">Sprache</label><input className="input" value={material.language} onChange={e => onChange('language', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label className="label">Schlagworte</label><input className="input" value={material.keywords} onChange={e => onChange('keywords', e.target.value)} /></div>
        <div><label className="label">Beschreibung</label><input className="input" value={material.description} onChange={e => onChange('description', e.target.value)} /></div>
      </div>
      <div>
        <label className="label">Volltext</label>
        <textarea className="input" rows={6} value={material.fullText} onChange={e => onChange('fullText', e.target.value)} />
      </div>
    </div>
  );
}

function ModelPicker({ value, onChange, availableModels, onFetch, loading, disabled }: {
  value: string;
  onChange: (m: string) => void;
  availableModels: string[];
  onFetch?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const disabledCls = disabled ? 'opacity-60 bg-gray-100 cursor-not-allowed' : '';
  return (
    <div className="flex gap-1">
      {availableModels.length > 0 ? (
        <select className={`input ${disabledCls}`} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
          {!availableModels.includes(value) && <option value={value}>{value}</option>}
          {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      ) : (
        <input className={`input ${disabledCls}`} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />
      )}
      {onFetch && (
        <button className="btn btn-secondary btn-sm whitespace-nowrap" onClick={onFetch} disabled={loading || disabled}>
          {loading ? '...' : 'Laden'}
        </button>
      )}
    </div>
  );
}

function PromptSourceSelector({ label, color, value, fileName, count, onSelect, onFile }: {
  label: string;
  color: 'amber' | 'green';
  value: string;
  fileName: string;
  count: number | null;
  onSelect: (source: string) => void;
  onFile: (file: File) => void;
}) {
  const accent = color === 'amber' ? 'border-l-amber-400' : 'border-l-green-500';
  return (
    <div className={`p-3 rounded-md border border-[var(--border)] border-l-4 ${accent} bg-gray-50`}>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={e => onSelect(e.target.value)}>
        <option value="mds">mds.xml (Original)</option>
        <option value="mds_new">mds_28052026.xml (Optimiert)</option>
        <option value="mds_v2">mds_28052026_v2.xml (Optimiert v2)</option>
        <option value="file">Datei von Festplatte…</option>
        <option value="manual">Manuell (App-Vorgaben)</option>
      </select>
      {value === 'file' && (
        <input
          type="file"
          accept=".xml,text/xml,application/xml"
          className="mt-2 block w-full text-xs file:mr-2 file:px-2 file:py-1 file:rounded file:border file:border-[var(--border)] file:bg-white file:text-xs"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      )}
      <p className="text-xs text-[var(--text-muted)] mt-1.5">
        {value === 'manual'
          ? 'App-interne Standard-Prompts'
          : value === 'file' && !fileName
          ? 'Bitte XML-Datei wählen'
          : count != null
          ? `${count} Prompts geladen${fileName ? ` aus „${fileName}“` : ''}`
          : 'Lädt…'}
      </p>
    </div>
  );
}

function SystemPromptEditor({ oldValue, newValue, onChangeOld, onChangeNew, onReset }: {
  oldValue: string; newValue: string;
  onChangeOld: (v: string) => void; onChangeNew: (v: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold cursor-pointer" onClick={() => setOpen(o => !o)}>
          System-Prompt {open ? '▲' : '▼'}
        </h2>
        {open && (
          <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]" onClick={onReset}>
            Zurücksetzen
          </button>
        )}
      </div>
      {open && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="label">Original System-Prompt</label>
            <textarea className="input text-xs" rows={10} value={oldValue} onChange={e => onChangeOld(e.target.value)} />
          </div>
          <div>
            <label className="label">Optimierter System-Prompt</label>
            <textarea className="input text-xs" rows={10} value={newValue} onChange={e => onChangeNew(e.target.value)} />
          </div>
        </div>
      )}
    </section>
  );
}

function TopicForm({ data, onChange }: { data: TestMaterial; onChange: (key: keyof TestMaterial, val: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div><label className="label">Thema (Sammlungsname)</label><input className="input" value={data.title} onChange={e => onChange('title', e.target.value)} placeholder="z.B. Fotosynthese" /></div>
      <div><label className="label">Bildungsstufe</label><input className="input" value={data.educationalContext} onChange={e => onChange('educationalContext', e.target.value)} placeholder="z.B. Sekundarstufe I" /></div>
      <div><label className="label">Fachgebiet</label><input className="input" value={data.discipline} onChange={e => onChange('discipline', e.target.value)} placeholder="z.B. Biologie" /></div>
      <div><label className="label">Schlagwörter</label><input className="input" value={data.keywords} onChange={e => onChange('keywords', e.target.value)} placeholder="z.B. Fotosynthese, Chloroplast, Lichtreaktion" /></div>
    </div>
  );
}

function PromptPanel({ label, color, value, onChange, onReset, result }: {
  label: string; color: 'amber' | 'green'; value: string;
  onChange: (v: string) => void; onReset: () => void;
  result: GenerationResult | null;
}) {
  const bgClass = color === 'amber' ? 'bg-[#fefce8] border-[#fef08a]' : 'bg-[#ecfdf5] border-[#86efac]';
  const badgeClass = color === 'amber' ? 'badge-amber' : 'badge-green';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="label">{label}</span>
        <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]" onClick={onReset}>Zurücksetzen</button>
      </div>
      <textarea className="input" rows={5} value={value} onChange={e => onChange(e.target.value)} />
      {result && (
        <div className={`mt-3 p-3 rounded-md border ${bgClass}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`badge ${badgeClass}`}>{label.split('-')[0].trim()}</span>
            <span className="badge badge-gray">{(result.durationMs / 1000).toFixed(1)}s</span>
            <span className="badge badge-gray">{result.totalTokens} tok</span>
          </div>
          {result.output.startsWith('data:image/') || result.output.startsWith('https://oaidalleapi') ? (
            <img src={result.output} alt="Generiertes Bild" className="max-w-full rounded-md" />
          ) : result.output ? (
            <p className="text-sm whitespace-pre-wrap">{result.output}</p>
          ) : (
            <p className="text-sm italic text-amber-700">{result.note || '(leere Antwort)'}</p>
          )}
        </div>
      )}
    </div>
  );
}

function JudgeSection({ judgeResult, judging, onRun }: {
  judgeResult: JudgeResult | null; judging: boolean; onRun: () => void;
}) {
  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">LLM-as-Judge Bewertung</h2>
        <button className="btn btn-success" onClick={onRun} disabled={judging}>
          {judging ? 'Bewerte...' : 'Judge starten'}
        </button>
      </div>
      {judgeResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-md bg-[#fefce8]">
              <div className="text-2xl font-bold">{judgeResult.oldScore?.toFixed(1) ?? '-'}</div>
              <div className="text-xs text-[var(--text-muted)]">Original</div>
            </div>
            <div className="p-3 rounded-md bg-gray-50 flex items-center justify-center">
              <span className={`badge ${judgeResult.winner === 'new' ? 'badge-green' : judgeResult.winner === 'old' ? 'badge-amber' : 'badge-gray'}`}>
                {judgeResult.winner === 'new' ? 'Optimiert gewinnt' : judgeResult.winner === 'old' ? 'Original gewinnt' : 'Unentschieden'}
              </span>
            </div>
            <div className="p-3 rounded-md bg-[#ecfdf5]">
              <div className="text-2xl font-bold">{judgeResult.newScore?.toFixed(1) ?? '-'}</div>
              <div className="text-xs text-[var(--text-muted)]">Optimiert</div>
            </div>
          </div>
          {judgeResult.criteria?.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2">Kriterium</th>
                  <th className="text-center py-2 w-20">Original</th>
                  <th className="text-center py-2 w-20">Optimiert</th>
                  <th className="text-left py-2">Kommentar</th>
                </tr>
              </thead>
              <tbody>
                {judgeResult.criteria.map((c, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 font-medium">{c.name}</td>
                    <td className="py-2 text-center"><ScoreIndicator score={c.oldScore} /></td>
                    <td className="py-2 text-center"><ScoreIndicator score={c.newScore} /></td>
                    <td className="py-2 text-[var(--text-muted)]">{c.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {judgeResult.reasoning && (
            <div className="p-3 bg-gray-50 rounded-md text-sm">
              <span className="font-medium">Begründung: </span>{judgeResult.reasoning}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MetricsSummary({ oldResult, newResult }: { oldResult: GenerationResult | null; newResult: GenerationResult | null }) {
  return (
    <section className="card">
      <h2 className="text-sm font-semibold mb-3">Metriken</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center text-sm">
        <MetricCard label="Dauer (Original)" value={oldResult ? `${(oldResult.durationMs / 1000).toFixed(1)}s` : '-'} />
        <MetricCard label="Dauer (Optimiert)" value={newResult ? `${(newResult.durationMs / 1000).toFixed(1)}s` : '-'} />
        <MetricCard label="Tokens (Original)" value={oldResult ? `${oldResult.promptTokens} + ${oldResult.completionTokens} = ${oldResult.totalTokens}` : '-'} />
        <MetricCard label="Tokens (Optimiert)" value={newResult ? `${newResult.promptTokens} + ${newResult.completionTokens} = ${newResult.totalTokens}` : '-'} />
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-gray-50 rounded-md">
      <div className="font-semibold">{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

function ScoreIndicator({ score }: { score: number }) {
  const color = score >= 8 ? 'text-green-600' : score >= 6 ? 'text-amber-600' : 'text-red-600';
  return <span className={`font-bold ${color}`}>{score}/10</span>;
}

function StatusBadge({ status, error }: { status: string; error?: string }) {
  switch (status) {
    case 'pending': return <span className="badge badge-gray">Wartend</span>;
    case 'running': return <span className="badge badge-blue">Läuft...</span>;
    case 'done': return <span className="badge badge-green">Fertig</span>;
    case 'error': return <span className="badge badge-red" title={error}>Fehler</span>;
    default: return <span className="badge badge-gray">{status}</span>;
  }
}

// ── Score bar helper ────────────────────────────────────────────────

function ScoreBar({ value, max = 10, color }: { value: number; max?: number; color: 'amber' | 'green' | 'blue' }) {
  const pct = Math.min(100, (value / max) * 100);
  const bg = color === 'amber' ? 'bg-amber-400' : color === 'green' ? 'bg-green-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-7 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function DualBar({ oldVal, newVal, max = 10 }: { oldVal: number; newVal: number; max?: number }) {
  return (
    <div className="space-y-0.5">
      <ScoreBar value={oldVal} max={max} color="amber" />
      <ScoreBar value={newVal} max={max} color="green" />
    </div>
  );
}

function DurationBar({ ms, maxMs }: { ms: number; maxMs: number }) {
  const pct = maxMs > 0 ? Math.min(100, (ms / maxMs) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs w-10 text-right">{(ms / 1000).toFixed(1)}s</span>
    </div>
  );
}

// ── Batch Evaluation ────────────────────────────────────────────────

function BatchEvaluation({ entries, models }: { entries: BatchEntry[]; models: string[] }) {
  const done = entries.filter(e => e.status === 'done');
  const judged = done.filter(e => e.judgeResult);
  if (judged.length === 0) return null;

  // ── Per-model stats ──
  const modelStats = models.map(model => {
    const me = done.filter(e => e.model === model);
    const mj = me.filter(e => e.judgeResult);
    const avgOld = mj.length > 0 ? mj.reduce((s, e) => s + (e.judgeResult?.oldScore ?? 0), 0) / mj.length : 0;
    const avgNew = mj.length > 0 ? mj.reduce((s, e) => s + (e.judgeResult?.newScore ?? 0), 0) / mj.length : 0;
    const oldWins = mj.filter(e => e.judgeResult?.winner === 'old').length;
    const newWins = mj.filter(e => e.judgeResult?.winner === 'new').length;
    const ties = mj.filter(e => e.judgeResult?.winner === 'tie').length;
    const avgDurOld = me.length > 0 ? me.reduce((s, e) => s + (e.oldResult?.durationMs ?? 0), 0) / me.length : 0;
    const avgDurNew = me.length > 0 ? me.reduce((s, e) => s + (e.newResult?.durationMs ?? 0), 0) / me.length : 0;
    const avgTokOld = me.length > 0 ? me.reduce((s, e) => s + (e.oldResult?.totalTokens ?? 0), 0) / me.length : 0;
    const avgTokNew = me.length > 0 ? me.reduce((s, e) => s + (e.newResult?.totalTokens ?? 0), 0) / me.length : 0;
    return { model, count: mj.length, avgOld, avgNew, oldWins, newWins, ties, avgDurOld, avgDurNew, avgTokOld, avgTokNew };
  });

  const maxDur = Math.max(...modelStats.flatMap(m => [m.avgDurOld, m.avgDurNew]), 1);

  // ── Per-criterion × model ──
  const criteriaNames: string[] = [];
  const first = judged.find(e => e.judgeResult?.criteria?.length);
  if (first?.judgeResult?.criteria) {
    for (const c of first.judgeResult.criteria) {
      if (!criteriaNames.includes(c.name)) criteriaNames.push(c.name);
    }
  }
  const criteriaByModel = models.map(model => {
    const mj = judged.filter(e => e.model === model && e.judgeResult?.criteria?.length);
    const agg: Record<string, { oldSum: number; newSum: number; n: number }> = {};
    for (const e of mj) {
      for (const c of e.judgeResult!.criteria) {
        if (!agg[c.name]) agg[c.name] = { oldSum: 0, newSum: 0, n: 0 };
        agg[c.name].oldSum += c.oldScore;
        agg[c.name].newSum += c.newScore;
        agg[c.name].n += 1;
      }
    }
    return { model, agg };
  });

  // ── Per-field stats ──
  const fieldIds = [...new Set(done.map(e => e.fieldId))];
  const fieldStats = fieldIds.map(fId => {
    const f = PROMPT_FIELDS.find(p => p.id === fId);
    const perModel = models.map(model => {
      const me = judged.filter(e => e.fieldId === fId && e.model === model);
      if (me.length === 0) return { model, avgOld: 0, avgNew: 0, n: 0 };
      return {
        model,
        avgOld: me.reduce((s, e) => s + (e.judgeResult?.oldScore ?? 0), 0) / me.length,
        avgNew: me.reduce((s, e) => s + (e.judgeResult?.newScore ?? 0), 0) / me.length,
        n: me.length,
      };
    });
    return { fieldId: fId, fieldName: f?.name ?? fId, perModel };
  });

  return (
    <section className="card space-y-6">
      <h2 className="text-sm font-bold">Auswertung</h2>

      {/* ── 1. Model comparison with visual bars ── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Modellvergleich — Qualität</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--border)]">
                <th className="text-left py-2 px-2 w-40">Modell</th>
                <th className="text-center py-2 px-1 w-12">n</th>
                <th className="py-2 px-2 min-w-[160px]">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" /> Original
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 ml-1" /> Optimiert
                  </div>
                </th>
                <th className="text-center py-2 px-2 w-14">Δ</th>
                <th className="text-center py-2 px-2 w-32">Bilanz</th>
              </tr>
            </thead>
            <tbody>
              {modelStats.map(ms => {
                const delta = ms.avgNew - ms.avgOld;
                return (
                  <tr key={ms.model} className="border-b border-[var(--border)]">
                    <td className="py-2 px-2 font-medium">{ms.model}</td>
                    <td className="py-2 px-1 text-center text-xs">{ms.count}</td>
                    <td className="py-2 px-2"><DualBar oldVal={ms.avgOld} newVal={ms.avgNew} /></td>
                    <td className={`py-2 px-2 text-center font-bold text-xs ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : ''}`}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                    </td>
                    <td className="py-2 px-2 text-center text-xs whitespace-nowrap">
                      <span className="text-amber-600">{ms.oldWins}×Alt</span>
                      {' / '}
                      <span className="text-green-600">{ms.newWins}×Neu</span>
                      {ms.ties > 0 && <span className="text-gray-400"> / {ms.ties}×=</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. Speed & Tokens ── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Geschwindigkeit &amp; Token-Verbrauch</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--border)]">
                <th className="text-left py-2 px-2 w-40">Modell</th>
                <th className="py-2 px-2 min-w-[140px]">Ø Dauer Original</th>
                <th className="py-2 px-2 min-w-[140px]">Ø Dauer Optimiert</th>
                <th className="text-center py-2 px-2">Ø Tokens Alt</th>
                <th className="text-center py-2 px-2">Ø Tokens Neu</th>
                <th className="text-center py-2 px-2">Δ Tokens</th>
              </tr>
            </thead>
            <tbody>
              {modelStats.map(ms => {
                const tokDelta = Math.round(ms.avgTokNew - ms.avgTokOld);
                return (
                  <tr key={ms.model} className="border-b border-[var(--border)]">
                    <td className="py-2 px-2 font-medium">{ms.model}</td>
                    <td className="py-2 px-2"><DurationBar ms={ms.avgDurOld} maxMs={maxDur} /></td>
                    <td className="py-2 px-2"><DurationBar ms={ms.avgDurNew} maxMs={maxDur} /></td>
                    <td className="py-2 px-2 text-center">{Math.round(ms.avgTokOld)}</td>
                    <td className="py-2 px-2 text-center">{Math.round(ms.avgTokNew)}</td>
                    <td className={`py-2 px-2 text-center font-medium ${tokDelta > 0 ? 'text-red-500' : tokDelta < 0 ? 'text-green-600' : ''}`}>
                      {tokDelta > 0 ? '+' : ''}{tokDelta}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. Criteria heatmap ── */}
      {criteriaNames.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Kriterien-Aufschlüsselung</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--border)]">
                  <th className="text-left py-2 px-2">Kriterium</th>
                  {models.map(m => (
                    <th key={m} className="py-2 px-2 text-center min-w-[120px]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criteriaNames.map(cname => (
                  <tr key={cname} className="border-b border-[var(--border)]">
                    <td className="py-2 px-2 font-medium whitespace-nowrap">{cname}</td>
                    {criteriaByModel.map(cm => {
                      const d = cm.agg[cname];
                      if (!d || d.n === 0) return <td key={cm.model} className="py-2 px-2 text-center text-gray-300">–</td>;
                      const avgO = d.oldSum / d.n;
                      const avgN = d.newSum / d.n;
                      const better = avgN > avgO ? 'green' : avgN < avgO ? 'amber' : 'gray';
                      return (
                        <td key={cm.model} className="py-2 px-2">
                          <div className="flex items-center justify-center gap-1 text-xs">
                            <span className="text-amber-600 font-medium">{avgO.toFixed(1)}</span>
                            <span className="text-gray-300">→</span>
                            <span className={`font-bold ${better === 'green' ? 'text-green-600' : better === 'amber' ? 'text-amber-600' : 'text-gray-500'}`}>
                              {avgN.toFixed(1)}
                            </span>
                            {avgN !== avgO && (
                              <span className={`text-[10px] ${avgN > avgO ? 'text-green-500' : 'text-red-500'}`}>
                                ({avgN > avgO ? '+' : ''}{(avgN - avgO).toFixed(1)})
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. Per-field breakdown ── */}
      {fieldStats.length > 1 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Auswertung nach Feld</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--border)]">
                  <th className="text-left py-2 px-2">Feld</th>
                  {models.map(m => (
                    <th key={m} className="py-2 px-2 min-w-[130px]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fieldStats.map(fs => (
                  <tr key={fs.fieldId} className="border-b border-[var(--border)]">
                    <td className="py-2 px-2 font-medium whitespace-nowrap">{fs.fieldName}</td>
                    {fs.perModel.map(pm => (
                      <td key={pm.model} className="py-2 px-2">
                        {pm.n > 0 ? <DualBar oldVal={pm.avgOld} newVal={pm.avgNew} /> : <span className="text-gray-300 text-xs">–</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
