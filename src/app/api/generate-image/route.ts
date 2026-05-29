import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { withRetry } from '@/lib/llm-retry';

export const runtime = 'nodejs';
export const maxDuration = 60;

function resolveEnvKey(providerType: string): string {
  if (providerType === 'openai') return process.env.OPENAI_API_KEY ?? '';
  if (providerType === 'bapi-academic') return process.env.B_API_KEY ?? process.env.GWDG_API_KEY ?? '';
  return process.env.B_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { baseUrl, apiKey, prompt, providerType, model } = body;

  const resolvedKey = apiKey || resolveEnvKey(providerType || '');

  if (!resolvedKey) {
    return NextResponse.json({ error: 'Kein API-Key angegeben' }, { status: 400 });
  }

  const isBapi = (providerType || '').startsWith('bapi');

  const client = new OpenAI({
    apiKey: resolvedKey,
    baseURL: baseUrl || 'https://api.openai.com/v1',
    defaultHeaders: isBapi ? { 'Cache-Control': 'no-cache, no-store' } : undefined,
  });

  const startTime = Date.now();

  try {
    const response = await withRetry(() => client.images.generate({
      model: model || 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
    }, { timeout: 60000, maxRetries: 0 }));

    const durationMs = Date.now() - startTime;
    const image = response.data?.[0];

    return NextResponse.json({
      output: image?.b64_json
        ? `data:image/png;base64,${image.b64_json}`
        : image?.url ?? '',
      revisedPrompt: image?.revised_prompt ?? '',
      durationMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  } catch (e: unknown) {
    const durationMs = Date.now() - startTime;
    const message = e instanceof Error ? e.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message, durationMs }, { status: 500 });
  }
}
