import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { baseUrl, apiKey, providerType } = await req.json();

  const resolvedKey = apiKey || resolveEnvKey(providerType);
  if (!resolvedKey) {
    return NextResponse.json({ error: 'Kein API-Key angegeben' }, { status: 400 });
  }

  const modelsUrl = `${baseUrl}/models`;

  try {
    const res = await fetch(modelsUrl, {
      headers: { Authorization: `Bearer ${resolvedKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `${res.status}: ${text.substring(0, 200)}` }, { status: res.status });
    }

    const data = await res.json();
    const models: string[] = [];

    if (Array.isArray(data?.data)) {
      for (const m of data.data) {
        if (m.id) models.push(m.id);
      }
    } else if (Array.isArray(data)) {
      for (const m of data) {
        models.push(typeof m === 'string' ? m : m.id ?? m.name ?? String(m));
      }
    }

    models.sort();
    return NextResponse.json({ models });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function resolveEnvKey(providerType: string): string {
  if (providerType === 'openai') return process.env.OPENAI_API_KEY ?? '';
  if (providerType === 'bapi-academic') return process.env.B_API_KEY ?? process.env.GWDG_API_KEY ?? '';
  return process.env.B_API_KEY ?? '';
}
