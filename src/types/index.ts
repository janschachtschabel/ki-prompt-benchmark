export interface ProviderConfig {
  type: 'openai' | 'bapi-openai' | 'bapi-academic';
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TestMaterial {
  title: string;
  filename: string;
  url: string;
  learningResourceType: string;
  keywords: string;
  description: string;
  format: string;
  mediatype: string;
  educationalContext: string;
  discipline: string;
  targetAudience: string;
  language: string;
  fullText: string;
  oehLrt: string;
  professionGroup: string;
  extendedType: string;
}

export interface PromptField {
  id: string;
  name: string;
  description: string;
  oldPrompt: string;
  newPrompt: string;
  category: 'material' | 'topic';
}

export interface GenerationResult {
  output: string;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason?: string;
  note?: string;
}

export interface ComparisonRun {
  field: PromptField;
  material: TestMaterial;
  oldResult: GenerationResult | null;
  newResult: GenerationResult | null;
  judgeResult: JudgeResult | null;
  status: 'idle' | 'running-old' | 'running-new' | 'running-judge' | 'done' | 'error';
  error?: string;
}

export interface JudgeResult {
  oldScore: number;
  newScore: number;
  reasoning: string;
  winner: 'old' | 'new' | 'tie';
  criteria: JudgeCriterion[];
}

export interface JudgeCriterion {
  name: string;
  oldScore: number;
  newScore: number;
  comment: string;
}

export interface VocabEntry {
  id: string;
  label: string;
  children?: VocabEntry[];
}

export interface EnvInfo {
  openaiKey: string;
  bapiKey: string;
  gwdgKey: string;
}
