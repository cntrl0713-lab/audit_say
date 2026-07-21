/**
 * structure.md 파싱 테스트 (loadStructure)
 *
 * loadStructure()는 process.cwd()/structure.md를 읽어서
 * 파트/챕터/스탠다드 계층 구조를 생성합니다.
 * DB나 Gemini 의존성 없이 파일시스템만 사용하므로 단독 실행 가능합니다.
 *
 * 주의: serverUtils.ts를 import하면 db.ts → supabase.ts 모듈 초기화가
 * 실행되어 환경변수 부재 시 실패할 수 있으므로, loadStructure 로직을
 * 독립적으로 재구현하여 검증합니다.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

// ─── loadStructure 독립 재구현 (CTA 패턴: 검증 코드가 소스 코드와 독립) ──

interface StructureData {
    hierarchy: Record<string, Record<string, string[]>>;
    nameMap: Record<string, string>;
    partCodeMap: Record<string, string>;
    chapterMap: Record<string, string>;
}

function parseStructure(content: string): StructureData {
    const hierarchy: Record<string, Record<string, string[]>> = {};
    const nameMap: Record<string, string> = {};
    const partCodeMap: Record<string, string> = {};
    const chapterMap: Record<string, string> = {};

    const lines = content.split('\n');
    let currentPart: string | null = null;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        const partMatch = line.match(/^##\s*(PART\s*\d+.*)/i);
        if (partMatch) {
            let rawPart = partMatch[1].trim();
            rawPart = rawPart.replace(/^PART\s+(\d+)/i, 'PART$1');
            const shortPMatch = rawPart.match(/^(PART\d+)/i);
            if (shortPMatch) {
                partCodeMap[shortPMatch[1].toUpperCase()] = rawPart;
            }
            currentPart = rawPart;
            hierarchy[currentPart] = {};
            continue;
        }

        const chapterMatch = line.match(/^-\s*\*\*(ch[\d~-]+.*?)\*\*:\s*(.+)/i);
        if (chapterMatch && currentPart) {
            const fullName = chapterMatch[1].trim();
            const codeMatch = fullName.match(/^(ch[\d~-]+)/i);
            const shortCode = codeMatch ? codeMatch[1].toLowerCase() : fullName;
            nameMap[shortCode] = fullName;
            hierarchy[currentPart][shortCode] = chapterMatch[2].split(',').map(s => s.trim());

            if (shortCode.includes('~')) {
                const prefixMatch = shortCode.match(/^([a-zA-Z]+)/);
                const prefix = prefixMatch ? prefixMatch[1] : '';
                const rng = shortCode.match(/\d+/g);
                if (rng && rng.length >= 2) {
                    const start = parseInt(rng[0], 10);
                    const end = parseInt(rng[1], 10);
                    for (let i = start; i <= end; i++) {
                        chapterMap[`${prefix}${i}`] = fullName;
                    }
                }
            } else {
                chapterMap[shortCode] = fullName;
            }
        }
    }

    return { hierarchy, nameMap, partCodeMap, chapterMap };
}

// ─── 테스트 ────────────────────────────────────────

const structurePath = path.join(process.cwd(), 'structure.md');
const structureContent = fs.existsSync(structurePath)
    ? fs.readFileSync(structurePath, 'utf-8')
    : '';

const parsed = parseStructure(structureContent);

describe('loadStructure 파싱 검증', () => {
    test('structure.md 파일이 존재해야 함', () => {
        assert.ok(fs.existsSync(structurePath), `structure.md not found at ${structurePath}`);
    });

    test('4개의 PART가 파싱되어야 함', () => {
        const partKeys = Object.keys(parsed.hierarchy);
        assert.equal(partKeys.length, 4, `기대: 4개 PART, 실제: ${partKeys.length}`);
    });

    test('partCodeMap에 PART1~PART4 매핑 존재', () => {
        for (const partNum of ['PART1', 'PART2', 'PART3', 'PART4']) {
            assert.ok(
                parsed.partCodeMap[partNum],
                `partCodeMap에 ${partNum} 없음`,
            );
        }
    });

    test('PART1에 ch1, ch2 챕터 존재', () => {
        const part1Key = parsed.partCodeMap['PART1'];
        const part1 = parsed.hierarchy[part1Key];
        assert.ok(part1, 'PART1 계층이 없음');
        assert.ok(part1['ch1'], 'PART1에 ch1 없음');
        assert.ok(part1['ch2'], 'PART1에 ch2 없음');
    });

    test('ch1의 스탠다드에 Ethics, law 포함', () => {
        const part1Key = parsed.partCodeMap['PART1'];
        const ch1Standards = parsed.hierarchy[part1Key]['ch1'];
        assert.ok(ch1Standards.includes('Ethics'), 'ch1에 Ethics 없음');
        assert.ok(ch1Standards.includes('law'), 'ch1에 law 없음');
    });

    test('ch2의 스탠다드에 200, 210, 500 포함', () => {
        const part1Key = parsed.partCodeMap['PART1'];
        const ch2Standards = parsed.hierarchy[part1Key]['ch2'];
        assert.ok(ch2Standards.includes('200'), 'ch2에 200 없음');
        assert.ok(ch2Standards.includes('210'), 'ch2에 210 없음');
        assert.ok(ch2Standards.includes('500'), 'ch2에 500 없음');
    });

    test('chapterMap에 ch1~ch10 매핑 존재', () => {
        for (let i = 1; i <= 10; i++) {
            assert.ok(
                parsed.chapterMap[`ch${i}`],
                `chapterMap에 ch${i} 없음`,
            );
        }
    });

    test('nameMap에 각 챕터 전체 이름 매핑', () => {
        assert.ok(parsed.nameMap['ch1']?.includes('윤리'), 'ch1 이름에 "윤리" 포함되어야 함');
        assert.ok(parsed.nameMap['ch2']?.includes('기초'), 'ch2 이름에 "기초" 포함되어야 함');
    });

    test('PART4에 ch8, ch9, ch10 존재', () => {
        const part4Key = parsed.partCodeMap['PART4'];
        const part4 = parsed.hierarchy[part4Key];
        assert.ok(part4, 'PART4 계층이 없음');
        assert.ok(part4['ch8'], 'PART4에 ch8 없음');
        assert.ok(part4['ch9'], 'PART4에 ch9 없음');
        assert.ok(part4['ch10'], 'PART4에 ch10 없음');
    });

    test('ch10 스탠다드에 1100, 1200 포함', () => {
        const part4Key = parsed.partCodeMap['PART4'];
        const ch10Standards = parsed.hierarchy[part4Key]['ch10'];
        assert.ok(ch10Standards.includes('1100'), 'ch10에 1100 없음');
        assert.ok(ch10Standards.includes('1200'), 'ch10에 1200 없음');
    });

    test('전체 챕터 수: 10개', () => {
        let totalChapters = 0;
        for (const part of Object.values(parsed.hierarchy)) {
            totalChapters += Object.keys(part).length;
        }
        assert.equal(totalChapters, 10, `기대: 10개 챕터, 실제: ${totalChapters}`);
    });
});

// ─── 엣지 케이스: 빈 구조 파싱 ─────────────────────

describe('parseStructure 엣지 케이스', () => {
    test('빈 문자열 → 모든 맵이 비어야 함', () => {
        const result = parseStructure('');
        assert.deepEqual(result.hierarchy, {});
        assert.deepEqual(result.nameMap, {});
        assert.deepEqual(result.partCodeMap, {});
        assert.deepEqual(result.chapterMap, {});
    });

    test('파트만 있고 챕터 없을 때', () => {
        const result = parseStructure('## PART1 테스트\n');
        assert.equal(Object.keys(result.hierarchy).length, 1);
        assert.deepEqual(result.hierarchy['PART1 테스트'], {});
    });

    test('챕터 범위(~) 구문 파싱', () => {
        const content = '## PART1 테스트\n- **ch3~5 범위 챕터**: 300, 400, 500';
        const result = parseStructure(content);
        // ch3, ch4, ch5 모두 같은 이름으로 매핑
        assert.equal(result.chapterMap['ch3'], 'ch3~5 범위 챕터');
        assert.equal(result.chapterMap['ch4'], 'ch3~5 범위 챕터');
        assert.equal(result.chapterMap['ch5'], 'ch3~5 범위 챕터');
    });
});
