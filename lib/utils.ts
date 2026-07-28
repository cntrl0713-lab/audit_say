import type { AuditQuestion, UserProfile } from './db';

export const ROLE_NAMES = {
    GUEST: '비회원',
    MEMBER: '공인회계사',
    PRO: '등록공인회계사',
    ADMIN: '관리자'
} as const;

export interface StructureHierarchy {
    [partName: string]: {
        [chapterCode: string]: string[]; // Array of standard codes
    };
}

export interface StructureData {
    hierarchy: StructureHierarchy;
    nameMap: { [shortCode: string]: string };
    partCodeMap: { [partNum: string]: string };
    chapterMap: { [shortCode: string]: string };
}

// Chapter sort key equivalent to python's get_chapter_sort_key
export function getChapterSortKey(name: string): number[] {
    if (name === '전체') return [-1];
    const nums = name.match(/\d+/g);
    return nums ? nums.map(Number) : [999];
}

// Standard sort key equivalent to python's get_standard_sort_key
export function getStandardSortKey(code: string): number {
    if (code === '전체') return -1;
    if (code.toLowerCase() === 'ethics') return 100;
    if (code.toLowerCase() === 'law') return 110;

    const parsed = parseInt(code, 10);
    return isNaN(parsed) ? 9999 : parsed;
}

// Compare function for chapter sorting
export function compareChapters(a: string, b: string): number {
    const keyA = getChapterSortKey(a);
    const keyB = getChapterSortKey(b);

    for (let i = 0; i < Math.max(keyA.length, keyB.length); i++) {
        const valA = keyA[i] !== undefined ? keyA[i] : 0;
        const valB = keyB[i] !== undefined ? keyB[i] : 0;
        if (valA !== valB) return valA - valB;
    }
    return 0;
}

// Compare function for standard sorting
export function compareStandards(a: string, b: string): number {
    return getStandardSortKey(a) - getStandardSortKey(b);
}

// Calculate match keyword count
export function calculateMatchedCount(userAns: string, keywords: string[]): number {
    if (!userAns || !keywords || keywords.length === 0) return 0;
    const userAnsNorm = userAns.replace(/\s+/g, '').toLowerCase();

    let count = 0;
    for (const k of keywords) {
        const kNorm = k.replace(/\s+/g, '').toLowerCase();
        if (userAnsNorm.includes(kNorm)) {
            count++;
        }
    }
    return count;
}

// 두 문자열의 Bigram Jaccard 유사도 계산 (공백 제외, 소문자화)
export function calculateBigramJaccard(s1: string, s2: string): number {
    const getBigrams = (str: string): Set<string> => {
        const norm = (str || '').replace(/\s+/g, '').toLowerCase();
        const bigrams = new Set<string>();
        for (let i = 0; i < norm.length - 1; i++) {
            bigrams.add(norm.substring(i, i + 2));
        }
        return bigrams;
    };

    const bigrams1 = getBigrams(s1);
    const bigrams2 = getBigrams(s2);

    if (bigrams1.size === 0 && bigrams2.size === 0) return 1.0;
    if (bigrams1.size === 0 || bigrams2.size === 0) return 0.0;

    let intersectionSize = 0;
    for (const b of bigrams1) {
        if (bigrams2.has(b)) {
            intersectionSize++;
        }
    }

    const unionSize = bigrams1.size + bigrams2.size - intersectionSize;
    return unionSize === 0 ? 0.0 : intersectionSize / unionSize;
}

// Get counts of questions equivalent to python's get_counts
export function getCounts(data: AuditQuestion[]) {
    const counts = {
        parts: {} as { [key: string]: number },
        chapters: {} as { [key: string]: number },
        standards: {} as { [key: string]: number },
    };

    for (const q of data) {
        const p = q.part || '';
        const c = q.chapter || '';
        const s = q.standard || '';

        if (p) counts.parts[p] = (counts.parts[p] || 0) + 1;
        if (c) counts.chapters[c] = (counts.chapters[c] || 0) + 1;
        if (s) counts.standards[s] = (counts.standards[s] || 0) + 1;
    }

    return counts;
}

/**
 * 한 번의 채점 요청에 담을 수 있는 최대 문항 수 (등급별).
 * 예전에는 이 제한이 퀴즈 화면의 버튼 disabled 처리로만 존재해서, 서버 액션을 직접
 * 호출하면 원하는 만큼 문항을 밀어넣을 수 있었다. 액션은 누구나 POST할 수 있는
 * 엔드포인트이므로 화면 제한은 방어선이 아니다 — 서버가 같은 값으로 강제한다.
 */
export const MAX_QUESTIONS_PER_ROLE: Record<UserProfile['role'], number> = {
    GUEST: 3,
    MEMBER: 3,
    PRO: 5,
    ADMIN: 5,
};

/** 알 수 없는 등급은 가장 낮은 상한을 적용한다 (fail closed). */
export function maxQuestionsForRole(role: string): number {
    return MAX_QUESTIONS_PER_ROLE[role as UserProfile['role']] ?? MAX_QUESTIONS_PER_ROLE.GUEST;
}

/**
 * 답안 한 건의 최대 길이(문자). 서술형 답안으로 충분한 길이면서, 한 번의 요청이
 * Gemini 토큰 비용을 무한정 끌어올리지 못하게 막는 상한이다.
 */
export const MAX_ANSWER_LENGTH = 4000;

/** 한 번 제출로 받을 수 있는 최대 경험치: 최대 문항 수(5) × 문항당 만점(10). */
export const MAX_EXP_PER_SUBMISSION = 50;

/**
 * 획득 경험치를 저장 가능한 값으로 정규화한다.
 * - 루브릭 채점은 0.5점 단위라 합계가 소수일 수 있다. exp는 정수로만 누적해야 하므로
 *   반올림한다 (exp가 정수 컬럼이면 소수 update가 거부되어 경험치가 조용히 안 오른다).
 * - 서버가 채점 결과로 직접 계산한 값이지만, 문항 수 상한이 바뀌어도 1회 적립량이
 *   튀지 않도록 최대치로 한 번 더 자른다.
 * @returns 저장할 정수 경험치, 저장할 필요가 없으면 0
 */
export function sanitizeExpGain(addedExp: number): number {
    if (!Number.isFinite(addedExp) || addedExp <= 0) return 0;
    return Math.min(MAX_EXP_PER_SUBMISSION, Math.round(addedExp));
}

/**
 * 채점 요청 페이로드 검증. 서버 액션은 누구나 POST할 수 있는 엔드포인트이므로,
 * 개수·길이·타입을 여기서 전부 확인한 뒤에야 Gemini 호출로 넘어간다.
 * @returns 거절 사유 메시지, 문제가 없으면 null
 */
export function validateGradeRequest(items: unknown, role: string): string | null {
    if (!Array.isArray(items)) {
        return '채점 요청 형식이 올바르지 않습니다.';
    }
    if (items.length === 0) {
        return '채점할 답안이 없습니다.';
    }

    const maxItems = maxQuestionsForRole(role);
    if (items.length > maxItems) {
        return `한 번에 채점할 수 있는 문항은 최대 ${maxItems}개입니다. (요청: ${items.length}개)`;
    }

    const seenIds = new Set<number>();
    const seenQids = new Set<number>();
    for (const item of items) {
        if (!item || typeof item !== 'object') {
            return '채점 요청 항목 형식이 올바르지 않습니다.';
        }

        const { id, qid, a } = item as { id?: unknown; qid?: unknown; a?: unknown };

        if (!Number.isInteger(id)) {
            return '채점 요청 항목의 id가 정수가 아닙니다.';
        }
        // id는 결과 맵의 키다. 중복되면 한 답안의 결과가 다른 답안의 결과를 덮어쓴다.
        if (seenIds.has(id as number)) {
            return `채점 요청 항목의 id가 중복되었습니다: ${id}`;
        }
        seenIds.add(id as number);

        if (!Number.isInteger(qid)) {
            return '채점 요청 항목의 문항 번호(qid)가 정수가 아닙니다.';
        }
        // 같은 문항을 한 요청에 여러 번 담으면, 답 하나를 외워 반복 제출하는 것만으로
        // 1회 상한(50 EXP)을 채울 수 있다. 출제는 항상 서로 다른 문항을 뽑으므로
        // (lib/utils의 getQuizSet) 정상 요청에는 중복이 없다.
        if (seenQids.has(qid as number)) {
            return `같은 문항을 한 번에 여러 번 채점할 수 없습니다: ${qid}`;
        }
        seenQids.add(qid as number);
        if (typeof a !== 'string' || a.trim().length === 0) {
            return '빈 답안은 채점할 수 없습니다.';
        }
        if (a.length > MAX_ANSWER_LENGTH) {
            return `답안은 ${MAX_ANSWER_LENGTH}자를 넘을 수 없습니다. (현재 ${a.length}자)`;
        }
    }

    return null;
}

/**
 * 동시 실행 개수를 제한하며 items를 매핑한다. 결과는 **입력 순서 그대로** 반환한다.
 *
 * 채점은 문항마다 Gemini를 한 번씩 부른다. 이걸 완전 직렬로 돌리면 5문항이 5회 왕복
 * 시간을 그대로 더해 함수 타임아웃에 닿는다. 반대로 전부 동시에 던지면 429/503을 부른다.
 * 그 사이를 잡기 위한 최소 구현이다.
 *
 * worker가 던지는 예외는 그대로 전파된다 — 호출자가 항목별로 try/catch 하는 것을 전제한다.
 */
export async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(items.length);
    if (items.length === 0) return results;

    const effectiveLimit = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
    let nextIndex = 0;

    const runner = async (): Promise<void> => {
        while (true) {
            const current = nextIndex++;
            if (current >= items.length) return;
            results[current] = await worker(items[current], current);
        }
    };

    await Promise.all(Array.from({ length: effectiveLimit }, () => runner()));
    return results;
}

// Randomly sample quiz questions
export function getQuizSet(
    data: AuditQuestion[],
    part: string,
    chapter: string,
    standard: string,
    numQuestions: number,
    excludeIds: string[] = []
): AuditQuestion[] {
    const excludeSet = new Set(excludeIds);

    const candidates = data.filter((q) => {
        const partMatch = q.part === part;
        const chapMatch = chapter === '전체' || q.chapter === chapter;
        const stdMatch = standard === '전체' || q.standard === standard;
        const isNotExcluded = !excludeSet.has(q.id.toString());
        return partMatch && chapMatch && stdMatch && isNotExcluded;
    });

    if (candidates.length === 0) return [];
    if (candidates.length <= numQuestions) return candidates;

    // Shuffle candidates and return first N using Fisher-Yates
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, numQuestions);
}
