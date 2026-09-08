import fs from 'node:fs';
import path from 'node:path';
import { DartClient } from './dartClient.ts';
import { createStoreClient } from './store.ts';
import { buildFirmIndex, matchFirm, normalizeFirmName } from './normalize.ts';
import { firmCorpCandidates } from './responseMapping.ts';

/** P0-5: only a unique full-name DART identity can add a missing auditor. No inferred tier/registration. */
async function main() {
    const apply = process.argv.includes('--apply');
    const reports = process.argv.slice(2).filter((arg) => arg !== '--apply');
    if (!reports.length) throw new Error('수집 보고서 경로를 지정하세요. 기본은 검토만, --apply로 적용합니다.');
    const db = createStoreClient();
    const { data: firms, error } = await db.from('cpa_firm_registered').select('firm_id,firm_name,alias,dart_corp_code,status');
    if (error) throw new Error(error.message);
    const existing = firms as { firm_id: number; firm_name: string; alias: string[]; dart_corp_code: string | null; status: string }[];
    const index = buildFirmIndex(existing);
    const dart = new DartClient({ apiKey: process.env.DART_API_KEY!, cacheDir: process.env.DART_CACHE_DIR });
    const codes = await dart.corpCodes();
    const labels = new Map<string, Set<string>>();
    for (const file of reports) {
        const report = JSON.parse(fs.readFileSync(file, 'utf8')).report;
        for (const { auditor } of report.unmatchedAuditors as { auditor: string }[]) {
            const key = normalizeFirmName(auditor);
            if (!key.includes('회계법인')) continue;
            const group = labels.get(key) ?? new Set<string>();
            group.add(auditor);
            labels.set(key, group);
        }
    }
    const additions: { firm_name: string; alias: string[]; dart_corp_code: string; registration_no: null; tier: null; status: string }[] = [];
    const unresolved: { labels: string[]; candidates: string[] }[] = [];
    const alreadyMatched: string[] = [];
    for (const group of labels.values()) {
        const names = [...group];
        if (matchFirm(index, names[0]) !== null) {
            alreadyMatched.push(...names);
            continue;
        }
        const candidates = firmCorpCandidates({ firm_name: names[0], alias: names }, codes);
        if (candidates.length !== 1) {
            unresolved.push({ labels: names, candidates });
            continue;
        }
        const corp = codes.find((c) => c.corp_code === candidates[0])!;
        const proposed = additions.find((a) => a.dart_corp_code === corp.corp_code);
        if (proposed) {
            proposed.alias = [...new Set([...proposed.alias, ...names.filter((n) => n !== proposed.firm_name)])];
            continue;
        }
        if (existing.some((f) => f.dart_corp_code === corp.corp_code)) {
            unresolved.push({ labels: names, candidates });
            continue;
        }
        additions.push({ firm_name: corp.corp_name, alias: names.filter((n) => n !== corp.corp_name),
            dart_corp_code: corp.corp_code, registration_no: null, tier: null, status: 'active' });
    }
    // Validate all proposed labels against existing owners before any write.
    buildFirmIndex([...existing, ...additions.map((a, i) => ({ ...a, firm_id: -i - 1 }))]);
    const review = { generatedAt: new Date().toISOString(), reports, apply, additions, alreadyMatched, unresolved,
        source: 'OpenDART corpCode.xml full-name unique match + observed auditOpinion.adtor. Registration and tier remain unverified.' };
    const out = path.resolve('docs/reports/auditor-master-reconciliation.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(review, null, 2));
    if (apply && additions.length) {
        const result = await db.from('cpa_firm_registered').insert(additions).select('firm_id,firm_name,dart_corp_code');
        if (result.error) throw new Error(result.error.message);
        const historyPath = 'docs/reports/auditor-master-added.json';
        const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : [];
        fs.writeFileSync(historyPath, JSON.stringify([...history, ...result.data], null, 2));
    }
    console.log(JSON.stringify({ apply, additions: additions.length, alreadyMatched: alreadyMatched.length, unresolved, report: out }, null, 2));
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
