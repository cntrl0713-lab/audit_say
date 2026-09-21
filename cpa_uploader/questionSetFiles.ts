import fs from 'node:fs';
import path from 'node:path';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

// 세트별 파일: 편집 원천은 `cpa_uploader/data/sets/{case,standard}/<세트ID>.json`과 `sets/order.json`이고,
// 정본 파일 `cpa_question_sets_v3.authoring.json`은 그 파일들로부터 같은 바이트로 다시 만드는 생성물이다.
// 정본 파일의 경로·바이트가 그대로이므로 과거 receipt·manifest·읽기 전용 도구는 손대지 않는다.
// 배치는 정본 배열의 삽입 순서를 그대로 따르며 정렬하지 않는다. 릴리스 항목의 position 검사가 이 순서에 묶여 있다.
// 설계와 근거: docs/문항-세트별-파일-분리-설계.md

export const AUTHORING_FILE_NAME = 'cpa_question_sets_v3.authoring.json';
export const CLASSIFICATION_REVIEW_FILE_NAME = 'learning-question-classification-review.json';
export const SET_FILES_DIRECTORY_NAME = 'sets';
export const SET_ORDER_FILE_NAME = 'order.json';
export const SET_STYLES = ['case', 'standard'] as const;
export type SetStyle = (typeof SET_STYLES)[number];

export interface SetFileLayout {
    /** 정본 파일 경로(절대). */
    authoring: string;
    /** 물음별 학습 유형이 적힌 분류 입력(절대). 세트의 배치 디렉터리는 이 파일의 `question_style`로 정한다. */
    classificationReview: string;
    /** `sets/` 디렉터리(절대). */
    directory: string;
    /** `sets/order.json`(절대). */
    orderFile: string;
}

export interface SetOrderDocument { version: 1; note: string; set_ids: string[] }
export interface ClassificationReviewDocument { entries: Array<{ set_id: string; subquestion_id: string; question_style: string }> }

const ORDER_NOTE = '정본 배열의 순서다. 정렬하거나 다시 매기지 않는다. 운영 릴리스 항목의 position 검사가 이 순서에 묶여 있다. 세트를 더하면 끝에 붙이고 퇴역시키면 목록에서 뺀다.';

export function setFileLayout(authoringFile: string): SetFileLayout {
    const authoring = path.resolve(authoringFile);
    const dataDirectory = path.dirname(authoring);
    const directory = path.join(dataDirectory, SET_FILES_DIRECTORY_NAME);
    return { authoring, classificationReview: path.join(dataDirectory, CLASSIFICATION_REVIEW_FILE_NAME), directory, orderFile: path.join(directory, SET_ORDER_FILE_NAME) };
}

/** 정본 파일 이름과 같으면서 `sets/`가 옆에 있는 경로만 세트별 파일의 원천으로 본다. 스테이지 사본(tmp/…/authoring.json)은 해당하지 않는다. */
export function isSplitAuthoringFile(file: string): boolean {
    const resolved = path.resolve(file);
    return path.basename(resolved) === AUTHORING_FILE_NAME && fs.existsSync(setFileLayout(resolved).directory);
}

export function serializeSet(set: QuestionSetV3): string {
    return `${JSON.stringify(set, null, 2)}\n`;
}

export function serializeBank(sets: QuestionSetV3[]): string {
    return `${JSON.stringify(sets, null, 2)}\n`;
}

export function serializeOrder(ids: string[]): string {
    const document: SetOrderDocument = { version: 1, note: ORDER_NOTE, set_ids: ids };
    return `${JSON.stringify(document, null, 2)}\n`;
}

export function styleMap(review: ClassificationReviewDocument): Map<string, string> {
    return new Map(review.entries.map((entry) => [`${entry.set_id}/${entry.subquestion_id}`, entry.question_style]));
}

/** 세트의 배치 디렉터리. 모든 물음의 학습 유형이 같아야 하며(혼합 세트는 계약상 없다), 분류가 빠진 물음이 있으면 거절한다. */
export function styleOfSet(set: QuestionSetV3, styles: Map<string, string>): SetStyle {
    const found = new Set<string>();
    for (const sub of set.subquestions) {
        const style = styles.get(`${set.id}/${sub.id}`);
        if (!style) throw new Error(`[${set.id}/${sub.id}] 분류 입력에 학습 유형이 없어 세트 파일의 위치를 정할 수 없습니다.`);
        found.add(style);
    }
    if (found.size !== 1) throw new Error(`[${set.id}] 한 세트에 학습 유형이 섞여 있어(${[...found].join(', ')}) 세트 파일의 위치를 정할 수 없습니다.`);
    const style = [...found][0];
    if (!(SET_STYLES as readonly string[]).includes(style)) throw new Error(`[${set.id}] 알 수 없는 학습 유형: ${style}`);
    return style as SetStyle;
}

export function setFilePath(layout: SetFileLayout, style: SetStyle, id: string): string {
    if (!/^[a-z0-9-]+$/u.test(id)) throw new Error(`세트 ID를 파일 이름으로 쓸 수 없습니다: ${id}`);
    return path.join(layout.directory, style, `${id}.json`);
}

/** `sets/{case,standard}/*.json` 실제 파일 목록. 다른 파일이 섞여 있으면 거절한다. `order.json`과 `README.md`만 `sets/` 바로 아래에 둘 수 있다. */
export function listSetFiles(layout: SetFileLayout): string[] {
    if (!fs.existsSync(layout.directory)) return [];
    const files: string[] = [];
    for (const name of fs.readdirSync(layout.directory)) {
        const entry = path.join(layout.directory, name);
        if (fs.statSync(entry).isDirectory()) {
            if (!(SET_STYLES as readonly string[]).includes(name)) throw new Error(`세트 파일 디렉터리에 알 수 없는 하위 디렉터리가 있습니다: ${entry}`);
            for (const child of fs.readdirSync(entry)) {
                const file = path.join(entry, child);
                if (!child.endsWith('.json') || fs.statSync(file).isDirectory()) throw new Error(`세트 파일이 아닌 항목이 있습니다: ${file}`);
                files.push(file);
            }
        } else if (name !== SET_ORDER_FILE_NAME && name !== 'README.md') {
            throw new Error(`세트 파일 디렉터리에 둘 수 없는 파일입니다: ${entry}`);
        }
    }
    return files.sort();
}

export interface SetFilePlan {
    writes: Array<{ file: string; content: string }>;
    deletes: string[];
    placements: Array<{ id: string; style: SetStyle; file: string }>;
}

/** 정본 배열을 세트 파일과 순서 파일로 옮기는 계획. 바이트가 같은 파일은 다시 쓰지 않고, 대상이 아닌 기존 세트 파일(퇴역·이동)은 지운다. */
export function planSetFileWrites(sets: QuestionSetV3[], styles: Map<string, string>, layout: SetFileLayout): SetFilePlan {
    const ids = sets.map((set) => set.id);
    if (new Set(ids).size !== ids.length) throw new Error('세트 ID가 중복되어 세트 파일을 만들 수 없습니다.');
    const placements = sets.map((set) => { const style = styleOfSet(set, styles); return { id: set.id, style, file: setFilePath(layout, style, set.id) }; });
    const targets = new Map(placements.map((placement, index) => [placement.file, serializeSet(sets[index])]));
    targets.set(layout.orderFile, serializeOrder(ids));
    const writes: SetFilePlan['writes'] = [];
    for (const [file, content] of targets) {
        if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) continue;
        writes.push({ file, content });
    }
    const deletes = listSetFiles(layout).filter((file) => !targets.has(file));
    return { writes, deletes, placements };
}

export interface BuiltBank { document: string; sets: QuestionSetV3[]; ids: string[]; files: string[] }

/** 순서 파일대로 세트 파일을 읽어 정본 문서를 다시 만든다. 파일 이름·ID·순서·여분 파일을 함께 검사한다. */
export function buildBankFromSetFiles(layout: SetFileLayout): BuiltBank {
    if (!fs.existsSync(layout.orderFile)) throw new Error(`세트 순서 파일이 없습니다: ${layout.orderFile}`);
    const order = JSON.parse(fs.readFileSync(layout.orderFile, 'utf8')) as Partial<SetOrderDocument>;
    if (order.version !== 1 || !Array.isArray(order.set_ids) || order.set_ids.some((id) => typeof id !== 'string')) throw new Error(`세트 순서 파일의 형식이 다릅니다: ${layout.orderFile}`);
    const ids = order.set_ids;
    if (new Set(ids).size !== ids.length) throw new Error('세트 순서 파일에 중복 ID가 있습니다.');
    const available = new Map<string, string[]>();
    for (const file of listSetFiles(layout)) {
        const id = path.basename(file, '.json');
        available.set(id, [...(available.get(id) ?? []), file]);
    }
    const files: string[] = [];
    const sets = ids.map((id) => {
        const candidates = available.get(id) ?? [];
        if (candidates.length !== 1) throw new Error(candidates.length ? `세트 파일이 두 디렉터리에 있습니다: ${id}` : `순서 파일에는 있는데 세트 파일이 없습니다: ${id}`);
        const file = candidates[0];
        files.push(file);
        const set = JSON.parse(fs.readFileSync(file, 'utf8')) as QuestionSetV3;
        if (set?.id !== id) throw new Error(`세트 파일 이름과 안의 ID가 다릅니다: ${file} (${String(set?.id)})`);
        return set;
    });
    const extra = [...available.entries()].filter(([id]) => !ids.includes(id)).flatMap(([, list]) => list);
    if (extra.length) throw new Error(`순서 파일에 없는 세트 파일이 있습니다:\n${extra.map((file) => `- ${file}`).join('\n')}`);
    return { document: serializeBank(sets), sets, ids, files };
}

/** 세트 파일이 정본과 같은 바이트를 만들고 배치 디렉터리가 현재 분류와 맞는지 확인한다. 오류 문장을 돌려주며 쓰기는 없다. */
export function checkSetFiles(layout: SetFileLayout): string[] {
    const errors: string[] = [];
    if (!fs.existsSync(layout.authoring)) return [`정본 파일이 없습니다: ${layout.authoring}`];
    if (!fs.existsSync(layout.directory)) return [`세트 파일 디렉터리가 없습니다: ${layout.directory} (npm run questions:v3:sets:split)`];
    let built: BuiltBank;
    try { built = buildBankFromSetFiles(layout); } catch (error) { return [error instanceof Error ? error.message : String(error)]; }
    const document = fs.readFileSync(layout.authoring, 'utf8');
    if (built.document !== document) {
        let detail = '정본 문서와 세트 파일의 재생성 결과가 다릅니다.';
        try {
            const canonical = JSON.parse(document) as QuestionSetV3[];
            const canonicalIds = canonical.map((set) => set.id);
            const missing = canonicalIds.filter((id) => !built.ids.includes(id)), extra = built.ids.filter((id) => !canonicalIds.includes(id));
            if (missing.length || extra.length) detail += ` 정본에만 있는 세트: [${missing.join(', ')}], 세트 파일에만 있는 세트: [${extra.join(', ')}].`;
            else if (canonicalIds.join('\n') !== built.ids.join('\n')) detail += ' 순서가 다릅니다.';
            else {
                const changed = canonical.filter((set, index) => serializeSet(set) !== serializeSet(built.sets[index])).map((set) => set.id);
                detail += changed.length ? ` 내용이 다른 세트: [${changed.join(', ')}].` : ' 직렬화 형식이 다릅니다.';
            }
        } catch { detail += ' 정본 문서를 해석할 수 없습니다.'; }
        errors.push(`${detail} 정본을 바꿨으면 npm run questions:v3:sets:build 또는 세트 파일을 다시 쓰는 도구로 맞추고, 세트 파일을 고쳤으면 npm run questions:v3:sets:build로 정본을 다시 만듭니다.`);
    }
    if (!fs.existsSync(layout.classificationReview)) errors.push(`분류 입력이 없어 세트 파일의 위치를 확인할 수 없습니다: ${layout.classificationReview}`);
    else {
        try {
            const styles = styleMap(JSON.parse(fs.readFileSync(layout.classificationReview, 'utf8')) as ClassificationReviewDocument);
            for (const [index, set] of built.sets.entries()) {
                const expected = setFilePath(layout, styleOfSet(set, styles), set.id);
                if (path.resolve(built.files[index]) !== expected) errors.push(`[${set.id}] 세트 파일의 위치가 학습 유형과 다릅니다: ${built.files[index]} → ${expected}`);
            }
        } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
    }
    return errors;
}

/** 정본 파일이 세트별 파일의 원천이면, 정본을 쓰는 같은 원자적 쓰기에 세트 파일·순서 파일의 변경과 삭제를 더한다.
 * 같은 묶음에 분류 입력 쓰기가 있으면 그 내용으로, 없으면 디스크의 분류 입력으로 위치를 정한다. */
export function splitWritesForAuthoring(writes: Array<{ file: string; content: string | null }>): { writes: Array<{ file: string; content: string }>; deletes: string[] } {
    const authoringWrite = writes.find((write) => write.content !== null && isSplitAuthoringFile(write.file));
    if (!authoringWrite) return { writes: [], deletes: [] };
    const layout = setFileLayout(authoringWrite.file);
    const reviewWrite = writes.find((write) => write.content !== null && path.resolve(write.file) === layout.classificationReview);
    const reviewText = reviewWrite?.content ?? (fs.existsSync(layout.classificationReview) ? fs.readFileSync(layout.classificationReview, 'utf8') : null);
    if (reviewText === null) throw new Error(`세트 파일의 위치를 정할 분류 입력이 없습니다: ${layout.classificationReview}`);
    const sets = JSON.parse(authoringWrite.content!) as QuestionSetV3[];
    const plan = planSetFileWrites(sets, styleMap(JSON.parse(reviewText) as ClassificationReviewDocument), layout);
    return { writes: plan.writes, deletes: plan.deletes };
}
