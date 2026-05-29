import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { withRetry, isRateLimit } from '@/lib/llm-retry';

export const runtime = 'nodejs';
export const maxDuration = 60;

function resolveEnvKey(providerType: string): string {
  if (providerType === 'openai') return process.env.OPENAI_API_KEY ?? '';
  if (providerType === 'bapi-academic') return process.env.B_API_KEY ?? process.env.GWDG_API_KEY ?? '';
  return process.env.B_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { baseUrl, apiKey, model, systemMessage, userMessage, providerType } = body;

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

  try {
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (systemMessage) messages.push({ role: 'system', content: systemMessage });
    messages.push({ role: 'user', content: userMessage });

    const useModel = model || 'gpt-4.1-mini';
    const usesNewApi = /^(gpt-5|o[1-9]|o3)/.test(useModel);
    // Höheres Budget, damit Reasoning-Modelle (Qwen3 o. Ä.) nach dem Denken
    // noch die eigentliche Antwort ausgeben können.
    const tokenParam = usesNewApi
      ? { max_completion_tokens: 4096 }
      : { max_tokens: 4096 };

    // durationMs misst nur den erfolgreichen Aufruf (ohne Retry-Backoff/Wartezeit)
    let durationMs = 0;
    const response = await withRetry(async () => {
      const t = Date.now();
      const r = await client.chat.completions.create({
        model: useModel,
        messages,
        temperature: 0.3,
        ...tokenParam,
        ...(isBapi ? { seed: Math.floor(Math.random() * 2147483647) } : {}),
      }, { timeout: 60000, maxRetries: 0 });
      durationMs = Date.now() - t;
      return r;
    });

    const choice = response.choices[0];
    const msg = choice?.message as { content?: string | null; reasoning_content?: string } | undefined;
    const finishReason = choice?.finish_reason ?? '';

    // Reasoning-Modelle: <think>…</think> aus dem Antworttext entfernen.
    let output = (msg?.content ?? '').trim();
    if (output.includes('<think>')) {
      output = output.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (output.startsWith('<think>')) output = ''; // ungeschlossen = abgeschnitten
    }

    // Leere Antwort diagnostizieren (z. B. Reasoning hat das Budget aufgebraucht).
    let note: string | undefined;
    if (!output) {
      if (finishReason === 'length') {
        note = 'Antwort leer: Token-Budget durch Reasoning aufgebraucht (finish_reason=length). Ggf. kleineres/Non-Reasoning-Modell wählen.';
      } else if (msg?.reasoning_content) {
        note = 'Modell lieferte nur Reasoning, keinen finalen Antworttext.';
      } else {
        note = `Antwort leer (finish_reason=${finishReason || 'unbekannt'}).`;
      }
    }

    return NextResponse.json({
      output,
      finishReason,
      note,
      durationMs,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    });
  } catch (e: unknown) {
    const rateLimited = isRateLimit(e);
    const message = (rateLimited ? 'Rate-Limit erreicht (auch nach Wiederholungen). Bitte kurz warten. ' : '')
      + (e instanceof Error ? e.message : 'Unbekannter Fehler');
    return NextResponse.json({ error: message, durationMs: 0, rateLimited }, { status: rateLimited ? 429 : 500 });
  }
}
