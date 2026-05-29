import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { withRetry } from '@/lib/llm-retry';

export const runtime = 'nodejs';
export const maxDuration = 60;

const JUDGE_SYSTEM_PROMPT = `Du bist ein Evaluator für KI-generierte Bildungsmetadaten. Du bewertest zwei Outputs (A = Original-Prompt, B = Optimierter Prompt) für dasselbe Material und Feld.

Bewerte nach diesen Kriterien (je 1–10):
1. **Inhaltliche Korrektheit** – Stimmt die Ausgabe mit dem Material überein?
2. **Bildungseignung** – Ist die Ausgabe für den Bildungskontext geeignet?
3. **Formatkonformität** – Entspricht die Ausgabe dem geforderten Format?
4. **Suchoptimierung** – Ist die Ausgabe gut auffindbar/suchoptimiert?
5. **Sprachqualität** – Korrekte, angemessene Sprache?

Antworte EXAKT in diesem JSON-Format (kein Markdown, keine Codeblöcke):
{
  "criteria": [
    {"name": "Inhaltliche Korrektheit", "oldScore": X, "newScore": X, "comment": "..."},
    {"name": "Bildungseignung", "oldScore": X, "newScore": X, "comment": "..."},
    {"name": "Formatkonformität", "oldScore": X, "newScore": X, "comment": "..."},
    {"name": "Suchoptimierung", "oldScore": X, "newScore": X, "comment": "..."},
    {"name": "Sprachqualität", "oldScore": X, "newScore": X, "comment": "..."}
  ],
  "oldScore": X.X,
  "newScore": X.X,
  "winner": "old|new|tie",
  "reasoning": "Kurze Zusammenfassung (2-3 Sätze)"
}`;

function resolveEnvKey(providerType: string): string {
  if (providerType === 'openai') return process.env.OPENAI_API_KEY ?? '';
  if (providerType === 'bapi-academic') return process.env.B_API_KEY ?? process.env.GWDG_API_KEY ?? '';
  return process.env.B_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { baseUrl, apiKey, model, fieldName, material, oldOutput, newOutput, fieldPromptOld, fieldPromptNew, providerType } = body;

  const resolvedKey = apiKey || resolveEnvKey(providerType || '');

  if (!resolvedKey) {
    return NextResponse.json({ error: 'Kein API-Key angegeben' }, { status: 400 });
  }

  const isBapi = (providerType || '').startsWith('bapi');

  const client = new OpenAI({
    apiKey: resolvedKey,
    baseURL: baseUrl || 'https://api.openai.com/v1',
    defaultHeaders: isBapi ? { 'Cache-Control': 'no-cache, no-store' } : undefined,
    maxRetries: 0,
  });

  const userMessage = `Feld: ${fieldName}
Material-Titel: ${material.title || material.filename || '-'}
Material-Beschreibung: ${material.description || '-'}
Volltext (Auszug): ${(material.fullText || '-').substring(0, 500)}

Prompt A (Original): ${fieldPromptOld}
Output A: ${oldOutput}

Prompt B (Optimiert): ${fieldPromptNew}
Output B: ${newOutput}

Bewerte beide Outputs nach den Kriterien.`;

  try {
    const useModel = model || 'gpt-4.1-mini';
    const usesNewApi = /^(gpt-5|o[1-9]|o3)/.test(useModel);
    const tokenParam = usesNewApi
      ? { max_completion_tokens: 4096 }
      : { max_tokens: 4096 };

    let durationMs = 0;
    const response = await withRetry(async () => {
      const t = Date.now();
      const r = await client.chat.completions.create({
        model: useModel,
        messages: [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.2,
        ...tokenParam,
        ...(isBapi ? { seed: Math.floor(Math.random() * 2147483647) } : {}),
      }, { timeout: 60000, maxRetries: 0 });
      durationMs = Date.now() - t;
      return r;
    });

    const content = response.choices[0]?.message?.content?.trim() ?? '';

    try {
      // Reasoning-Modelle: <think>…</think> und Codeblock-Marker entfernen.
      let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      // Falls Reasoning vor dem JSON steht: ab erster "{" bis letzter "}" schneiden.
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace > 0 && lastBrace > firstBrace) cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({
        ...parsed,
        durationMs,
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      });
    } catch {
      return NextResponse.json({
        oldScore: 0,
        newScore: 0,
        winner: 'tie' as const,
        reasoning: content,
        criteria: [],
        durationMs,
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
