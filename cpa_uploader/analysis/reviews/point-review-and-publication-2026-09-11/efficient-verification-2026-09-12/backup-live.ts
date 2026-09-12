import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { contentHash } from '../../../../../lib/learningSubmission.ts';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { reviewedContentHash, sha256 } from '../../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url)), root = process.cwd();
const output = path.resolve(process.argv[2] || path.join(here, 'live-before-publication-v1'));
assert(!fs.existsSync(output), 'Use a new live snapshot directory');
const relative = path.relative(here, output); assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '', key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const project = new URL(url).hostname; assert.equal(project, 'xvifzicrjmbfqaepcfpp.supabase.co'); assert(key);
const canonicalFile = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const canonicalBytes = fs.readFileSync(canonicalFile), canonical = JSON.parse(canonicalBytes.toString('utf8')) as QuestionSetV3[];
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const active = await client.rpc('cpa_get_active_question_bank');
assert(!active.error && Array.isArray(active.data) && active.data.length, 'Active bank read failed');
const releaseIds = [...new Set(active.data.map(s => s.release_id))]; assert.equal(releaseIds.length, 1);
const release = await client.from('cpa_question_bank_releases').select('id,status,source_document,source_file_hash,bank_content_hash,public_content_hash').eq('id', releaseIds[0]).single();
assert(!release.error && typeof release.data?.source_document === 'string', 'Active source read failed');
const source = release.data.source_document; assert.equal(sha256(source), release.data.source_file_hash);
const sets = JSON.parse(source) as QuestionSetV3[];
const classifications = await client.rpc('cpa_get_learning_classifications', { p_release_id: releaseIds[0] });
assert(!classifications.error, 'Active classifications read failed');
const selected = new Set((JSON.parse(fs.readFileSync(path.join(here, '../a/execution-all-v9/manifest.json'), 'utf8')) as { jobs: { set_id: string }[] }).jobs.map(j => j.set_id));
const changed = sets.filter(s => { const prior = canonical.find(p => p.id === s.id); return !prior || reviewedContentHash(prior) !== reviewedContentHash(s); });
const report = { captured_at: new Date().toISOString(), operations: 'Read-only source, public bank and classification snapshot; no learner records',
    db_writes: 0, project_host: project, release_id: release.data.id, source_file_hash: release.data.source_file_hash,
    bank_content_hash: release.data.bank_content_hash, public_content_hash: release.data.public_content_hash,
    empty_applicability_matches_bank_hash: contentHash({ sets, applicability: {} }) === release.data.bank_content_hash,
    canonical: { file: path.relative(root, canonicalFile).replace(/\\/g, '/'), sha256: sha256(canonicalBytes) },
    live_sets: sets.length, live_questions: sets.reduce((n, s) => n + s.subquestions.length, 0),
    live_vs_canonical_reviewed_changes: changed.map(s => s.id), unselected_live_changes: changed.filter(s => !selected.has(s.id)).map(s => s.id) };
assert.equal(sha256(fs.readFileSync(canonicalFile)), sha256(canonicalBytes), 'Canonical changed during snapshot');
fs.mkdirSync(output);
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(output, 'live-source.json'), source, { flag: 'wx' });
write('release.json', release.data); write('public-bank.json', active.data); write('classifications.json', classifications.data); write('summary.json', report);
console.log(JSON.stringify(report));
