import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const REPO_HOSTS: Record<string, string> = {
  prod: 'https://redaktion.openeduhub.net',
  staging: 'https://repository.staging.openeduhub.net',
};

const UUID = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

function extractNodeId(input: string): string {
  const s = (input || '').trim();
  try {
    const u = new URL(s);
    const q = u.searchParams.get('nodeId');
    if (q && UUID.test(q)) return q.match(UUID)![0];
  } catch { /* not a URL */ }
  const m = s.match(UUID);
  return m ? m[0] : s;
}

type Props = Record<string, string[] | string | undefined>;

function first(p: Props, key: string): string {
  const v = p[key];
  if (Array.isArray(v)) return v[0] ?? '';
  return (v as string) ?? '';
}
function joinAll(p: Props, key: string): string {
  const v = p[key];
  if (Array.isArray(v)) return v.filter(Boolean).join(', ');
  return (v as string) ?? '';
}
function display(p: Props, key: string): string {
  return joinAll(p, key + '_DISPLAYNAME') || joinAll(p, key);
}

interface RepoNode {
  properties?: Props;
  title?: string;
  name?: string;
  mimetype?: string;
  mediatype?: string;
}

function mapNode(node: RepoNode) {
  const p: Props = node.properties ?? {};
  return {
    title: first(p, 'cclom:title') || first(p, 'cm:title') || node.title || first(p, 'cm:name') || '',
    filename: first(p, 'cm:name') || node.name || '',
    url: first(p, 'ccm:wwwurl') || '',
    keywords: joinAll(p, 'cclom:general_keyword'),
    description: first(p, 'cclom:general_description') || first(p, 'cm:description') || '',
    format: first(p, 'cclom:format') || node.mimetype || '',
    mediatype: first(p, 'virtual:mediatype') || node.mediatype || '',
    educationalContext: display(p, 'ccm:educationalcontext'),
    discipline: display(p, 'ccm:taxonid'),
    targetAudience: display(p, 'ccm:educationalintendedenduserrole'),
    language: first(p, 'cclom:general_language'),
    learningResourceType: display(p, 'ccm:educationallearningresourcetype'),
    oehLrt: display(p, 'ccm:oeh_lrt'),
    professionGroup: display(p, 'ccm:oeh_profession_group'),
    extendedType: first(p, 'ccm:oeh_extendedType'),
    fullText: '',
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nodeRef, env, user, password } = body;

  if (!nodeRef) return NextResponse.json({ error: 'Keine Node-ID / URL angegeben' }, { status: 400 });

  const host = REPO_HOSTS[env] ?? REPO_HOSTS.prod;
  const id = extractNodeId(nodeRef);
  if (!UUID.test(id)) {
    return NextResponse.json({ error: `Keine gültige Node-ID erkannt in "${nodeRef}"` }, { status: 400 });
  }

  const url = `${host}/edu-sharing/rest/node/v1/nodes/-home-/${id}/metadata?propertyFilter=-all-`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (user && password) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const hint = res.status === 401 || res.status === 403
        ? ' — Inhalt evtl. nicht öffentlich; optional Zugangsdaten angeben.'
        : '';
      return NextResponse.json({ error: `Repo-Abruf fehlgeschlagen (${res.status})${hint} ${txt.slice(0, 150)}` }, { status: 502 });
    }
    const data = await res.json();
    const node = data.node ?? data;
    return NextResponse.json({ nodeId: id, host, material: mapNode(node) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
