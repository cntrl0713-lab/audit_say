import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
process.loadEnvFile('.env.local');
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const project = url.hostname.split('.')[0];
if (!/^[a-z0-9]{20}$/.test(project) || url.hostname !== `${project}.supabase.co`) throw new Error('Unexpected project');
const query = `select v.applicability, count(*)::integer as sets
from public.cpa_question_set_versions v
join public.cpa_question_bank_release_items ri on ri.set_version_id=v.id
join public.cpa_question_bank_releases r on r.id=ri.release_id
where r.status='active' group by v.applicability`;
const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: true }), signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error(`Read-only applicability request failed (${response.status})`);
const rows = await response.json();
if (!Array.isArray(rows) || rows.some(row => !row.applicability || !Number.isInteger(row.sets))) throw new Error('Unexpected applicability snapshot');
const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'remote-applicability.json');
fs.writeFileSync(output, JSON.stringify({checked_at: new Date().toISOString(), project, rows}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, rows}));
