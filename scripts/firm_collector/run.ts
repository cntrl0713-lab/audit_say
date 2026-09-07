import fs from 'node:fs';
import path from 'node:path';
import { DartClient } from './dartClient.ts';
import { collectEngagements } from './collectEngagements.ts';
import { collectFirmProfiles } from './collectFirmProfiles.ts';
import { createStoreClient } from './store.ts';

/**
 * 수집 배치 진입점.
 *
 *   tsx --env-file=.env.local scripts/firm_collector/run.ts engagements --year 2025
 *   tsx --env-file=.env.local scripts/firm_collector/run.ts firm-profiles --year 2025
 *
 * 옵션
 *   --year <n>    사업연도 (필수)
 *   --limit <n>   상장사 앞에서 n 곳만 (시범 수집용)
 *   --corp <code> 특정 회사만 (여러 번 줄 수 있다)
 *   --report <path>  수집 보고서 JSON 저장 위치
 */

interface Args {
    command: string;
    year: number;
    limit: number | null;
    corps: string[];
    reportPath: string | null;
}

function parseArgs(argv: string[]): Args {
    const [command, ...rest] = argv;
    const args: Args = { command: command ?? '', year: NaN, limit: null, corps: [], reportPath: null };

    for (let i = 0; i < rest.length; i += 1) {
        const flag = rest[i];
        const value = rest[i + 1];
        switch (flag) {
            case '--year':
                args.year = Number(value);
                i += 1;
                break;
            case '--limit':
                args.limit = Number(value);
                i += 1;
                break;
            case '--corp':
                args.corps.push(value);
                i += 1;
                break;
            case '--report':
                args.reportPath = value;
                i += 1;
                break;
            default:
                throw new Error(`알 수 없는 옵션: ${flag}`);
        }
    }

    return args;
}

function progressBar(label: string) {
    let lastPercent = -1;
    return (done: number, total: number) => {
        const percent = Math.floor((done / total) * 100);
        if (percent === lastPercent) return;
        lastPercent = percent;
        process.stdout.write(`\r${label} ${done}/${total} (${percent}%)`);
        if (done === total) process.stdout.write('\n');
    };
}

function writeReport(reportPath: string | null, name: string, report: unknown): void {
    console.log(JSON.stringify(report, null, 2));
    if (!reportPath) return;

    const target = path.resolve(reportPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ name, generatedAt: new Date().toISOString(), report }, null, 2));
    console.log(`보고서를 저장했습니다: ${target}`);
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));

    if (!['engagements', 'firm-profiles'].includes(args.command)) {
        throw new Error('명령은 engagements 또는 firm-profiles 입니다.');
    }
    if (!Number.isInteger(args.year)) {
        throw new Error('--year <사업연도> 가 필요합니다. 예: --year 2025');
    }

    const apiKey = process.env.DART_API_KEY;
    if (!apiKey) {
        throw new Error(
            'DART_API_KEY 가 없습니다. https://opendart.fss.or.kr 에서 발급받아 .env.local 에 넣고 ' +
            '`tsx --env-file=.env.local` 로 실행하세요.',
        );
    }

    const dart = new DartClient({ apiKey });
    const db = createStoreClient();

    console.log('corpCode.xml 내려받는 중...');
    const corpCodes = await dart.corpCodes();
    console.log(`고유번호 ${corpCodes.length.toLocaleString('ko-KR')}건 확보`);

    if (args.command === 'engagements') {
        // 1차 수집 범위는 상장회사다 (PRD §4.2). stock_code 가 있으면 상장사다.
        let companies = corpCodes.filter((entry) => entry.stock_code !== null);
        if (args.corps.length > 0) {
            const wanted = new Set(args.corps);
            companies = companies.filter((entry) => wanted.has(entry.corp_code));
        }
        if (args.limit !== null) companies = companies.slice(0, args.limit);

        console.log(`대상 상장회사 ${companies.length.toLocaleString('ko-KR')}곳 · ${args.year} 사업연도`);
        const report = await collectEngagements({
            db,
            dart,
            year: args.year,
            companies,
            onProgress: progressBar('감사대상회사'),
        });
        writeReport(args.reportPath, 'engagements', report);
        return;
    }

    const report = await collectFirmProfiles({
        db,
        dart,
        year: args.year,
        corpCodes,
        onProgress: progressBar('회계법인'),
    });
    writeReport(args.reportPath, 'firm-profiles', report);
}

main().catch((error: unknown) => {
    console.error(`\n수집 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
