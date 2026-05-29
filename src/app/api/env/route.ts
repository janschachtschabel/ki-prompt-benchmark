import { NextResponse } from 'next/server';

function mask(key: string | undefined): string {
  if (!key) return '';
  if (key.length <= 8) return '***';
  return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}

export async function GET() {
  return NextResponse.json({
    openaiKey: mask(process.env.OPENAI_API_KEY),
    bapiKey: mask(process.env.B_API_KEY),
    gwdgKey: mask(process.env.GWDG_API_KEY),
  });
}
