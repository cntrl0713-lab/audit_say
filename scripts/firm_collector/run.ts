import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DartClient } from './dartClient.ts';
import { collectEngagements } from './collectEngagements.ts';
import type { EngagementReport } from './collectEngagements.ts';
import { collectFirmProfiles } from './collectFirmProfiles.ts';
import { createStoreClient } from './store.ts';
import { collectAnnualReports } from './collectAnnualReports.ts';
import { koreanToday } from './annualReportSelection.ts';

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
    resume: boolean;
    retryFrom: string | null;
    endDate: string;
    dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
    const [command, ...rest] = argv;
    const args: Args = { command: command ?? '', year: NaN, limit: null, corps: [], reportPath: null, resume: false, retryFrom: null, endDate: koreanToday(), dryRun: false };

    for (let i = 0; i < rest.length; i += 1) {
        const flag = rest[i];
        const value = rest[i + 1];
        switch (flag) {
            case '--dry-run':
                args.dryRun = true;
                break;
            case '--end-date':
                args.endDate = value;
                i++;
                break;
            case '--resume':
                args.resume = true;
                break;
            case '--retry-from':
                args.retryFrom = value;
                i += 1;
                break;
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
    if (!reportPath) console.log(JSON.stringify(report, null, 2));
    if (!reportPath) return;

    const target = path.resolve(reportPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ name, generatedAt: new Date().toISOString(), report }, null, 2));
    console.log(`보고서를 저장했습니다: ${target}`);
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));

    if (!['engagements', 'firm-profiles', 'annual-reports'].includes(args.command)) {
        throw new Error('명령은 engagements, firm-profiles 또는 annual-reports 입니다.');
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

    const dart = new DartClient({ apiKey, cacheDir: process.env.DART_CACHE_DIR });
    const db = createStoreClient();

    if (args.command === 'annual-reports') {
        if (!process.env.DART_CACHE_DIR || !args.reportPath) throw new Error('annual-reports에는 DART_CACHE_DIR와 --report 필요');
        if (args.limit !== null && (!Number.isSafeInteger(args.limit) || args.limit < 1)) throw new Error('limit은 양의 정수');
        await collectAnnualReports({ db, dart, year: args.year, startDate: '20240101', endDate: args.endDate, reportPath: args.reportPath,
            dryRun: args.dryRun, resume: args.resume, retryFrom: args.retryFrom, corps: args.corps, limit: args.limit, onProgress: progressBar('회계법인 결산분') });
        console.log(`보고서를 저장했습니다: ${args.reportPath}`);
        return;
    }

    console.log('corpCode.xml 내려받는 중...');
    const corpCodes = await dart.corpCodes();
    console.log(`고유번호 ${corpCodes.length.toLocaleString('ko-KR')}건 확보`);

    if (args.command === 'engagements') {
        // 종목코드 보유 회사에는 상장폐지 회사도 포함된다. 실제 시장 구분은 응답 corp_cls로 저장한다.
        let companies = corpCodes.filter((entry) => entry.stock_code !== null);
        if (args.corps.length > 0) {
            const wanted = new Set(args.corps);
            companies = companies.filter((entry) => wanted.has(entry.corp_code));
        }
        if (args.limit !== null) companies = companies.slice(0, args.limit);

        if (args.retryFrom) {
            if (args.resume || path.resolve(args.retryFrom) === path.resolve(args.reportPath ?? '')) {
                throw new Error('--retry-from은 --resume 없이 별도의 --report 경로로 실행하세요.');
            }
            const prior = JSON.parse(fs.readFileSync(args.retryFrom, 'utf8')).report as EngagementReport;
            if (prior.year !== args.year) throw new Error('재처리 보고서의 사업연도가 다릅니다.');
            const wanted = new Set([
                ...prior.errors.map((entry) => entry.corp_code),
                ...prior.unmatchedAuditors.map((entry) => entry.corp_code),
                ...(prior.financialsUnsupportedCurrency ?? []),
            ]);
            companies = companies.filter((company) => wanted.has(company.corp_code));
        }

        let initialReport: EngagementReport | undefined;
        if (args.resume) {
            if (!args.reportPath || !fs.existsSync(args.reportPath)) throw new Error('--resume에는 기존 --report 파일이 필요합니다.');
            initialReport = JSON.parse(fs.readFileSync(args.reportPath, 'utf8')).report as EngagementReport;
            if (initialReport.year !== args.year || !Array.isArray(initialReport.completedCorps)) {
                throw new Error('재개 보고서의 사업연도 또는 완료 목록이 잘못되었습니다.');
            }
            const completed = new Set(initialReport.completedCorps);
            companies = companies.filter((company) => !completed.has(company.corp_code));
        }

        let checkpointQueue = Promise.resolve();
        console.log(`대상 종목코드 보유 회사 ${companies.length.toLocaleString('ko-KR')}곳 · ${args.year} 사업연도`);
        const report = await collectEngagements({
            db,
            dart,
            year: args.year,
            companies,
            initialReport,
            concurrency: 4,
            onProgress: progressBar('감사대상회사'),
            onCheckpoint: args.reportPath ? (snapshot) => {
                const target = path.resolve(args.reportPath!);
                const contents = JSON.stringify({
                    name: 'engagements', generatedAt: new Date().toISOString(), report: snapshot,
                }, null, 2);
                checkpointQueue = checkpointQueue.then(async () => {
                    fs.mkdirSync(path.dirname(target), { recursive: true });
                    fs.writeFileSync(`${target}.tmp`, contents);
                    for (let attempt = 0; ; attempt++) {
                        try {
                            fs.renameSync(`${target}.tmp`, target);
                            break;
                        } catch (error) {
                            const code = (error as NodeJS.ErrnoException).code;
                            if (!['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '') || attempt >= 5) throw error;
                            // Windows readers/scanners can briefly lock the destination. Retain the last valid checkpoint.
                            await delay(100 * (attempt + 1));
                        }
                    }
                });
                return checkpointQueue;
            } : undefined,
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
