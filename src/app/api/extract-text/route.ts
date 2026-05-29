import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const EXTRACTION_HOSTS: Record<string, string> = {
  prod: 'https://text-extraction.prod.openeduhub.net',
  staging: 'https://text-extraction.staging.openeduhub.net',
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, env } = body;

  if (!url) return NextResponse.json({ error: 'Keine URL angegeben' }, { status: 400 });

  const base = EXTRACTION_HOSTS[env] ?? EXTRACTION_HOSTS.prod;
  const startTime = Date.now();

  try {
    const res = await fetch(`${base}/from-url`, {
      method: 'POST',
      headers: { accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: 'browser',
        browser_location: null,
        lang: 'auto',
        output_format: 'markdown',
        preference: 'none',
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return NextResponse.json({ error: `Extraktion fehlgeschlagen (${res.status}) ${txt.slice(0, 200)}`, durationMs }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({
      text: data.text ?? '',
      lang: data.lang ?? '',
      status: data.status ?? res.status,
      durationMs,
    });
  } catch (e: unknown) {
    const durationMs = Date.now() - startTime;
    const message = e instanceof Error ? e.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message, durationMs }, { status: 500 });
  }
}
