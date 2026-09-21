import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { writePublicationFiles } from '../cpa_uploader/questionBankPublication.ts';
import {
    buildBankFromSetFiles, checkSetFiles, planSetFileWrites, serializeBank, serializeOrder, serializeSet, setFileLayout, splitWritesForAuthoring, styleMap,
} from '../cpa_uploader/questionSetFiles.ts';

const root = process.cwd();
const canonical = setFileLayout(path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json'));

// 저장소 게이트: 세트 파일은 정본과 같은 바이트를 만들어야 하고 위치는 분류와 맞아야 한다.
test('the committed set files rebuild the canonical bank byte for byte', { skip: !fs.existsSync(canonical.orderFile) }, () => {
    assert.deepEqual(checkSetFiles(canonical), []);
    const built = buildBankFromSetFiles(canonical);
    assert.equal(built.document, fs.readFileSync(canonical.authoring, 'utf8'));
    assert.equal(built.sets.length, built.ids.length);
});

function minimalSet(id: string, subquestionIds: string[]): QuestionSetV3 {
    // 세트 파일 계층은 형상 검증을 하지 않으므로 ID와 물음 ID만 있는 최소 객체로 충분하다.
    return { id, subquestions: subquestionIds.map((sub) => ({ id: sub, prompt: `${id} ${sub}` })) } as unknown as QuestionSetV3;
}

function review(entries: Array<[string, string, string]>) {
    return { entries: entries.map(([set_id, subquestion_id, question_style]) => ({ set_id, subquestion_id, question_style })) };
}

function isolatedRoot() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-set-files-'));
    const data = path.join(directory, 'cpa_uploader/data');
    fs.mkdirSync(data, { recursive: true });
    return { directory, layout: setFileLayout(path.join(data, 'cpa_question_sets_v3.authoring.json')) };
}

test('split plan writes one file per set under its style, an order file, and rebuilds the same bytes', () => {
    const { directory, layout } = isolatedRoot();
    try {
        const sets = [minimalSet('pilot-01-001', ['sub1', 'sub2']), minimalSet('case-02-x-20260921', ['sub1']), minimalSet('std-b', ['sub1'])];
        const styles = styleMap(review([['pilot-01-001', 'sub1', 'standard'], ['pilot-01-001', 'sub2', 'standard'], ['case-02-x-20260921', 'sub1', 'case'], ['std-b', 'sub1', 'standard']]));
        const plan = planSetFileWrites(sets, styles, layout);
        assert.deepEqual(plan.placements.map((item) => [item.style, path.relative(layout.directory, item.file).split(path.sep).join('/')]),
            [['standard', 'standard/pilot-01-001.json'], ['case', 'case/case-02-x-20260921.json'], ['standard', 'standard/std-b.json']]);
        assert.equal(plan.writes.length, 4); assert.deepEqual(plan.deletes, []);
        writePublicationFiles(plan.writes);
        const built = buildBankFromSetFiles(layout);
        assert.equal(built.document, serializeBank(sets));
        assert.deepEqual(built.ids, ['pilot-01-001', 'case-02-x-20260921', 'std-b']);
        // 두 번째 계획은 바뀐 것이 없으니 아무것도 쓰지 않는다.
        assert.deepEqual(planSetFileWrites(sets, styles, layout).writes, []);
        // 정본 파일이 있으면 검사가 통과한다. 순서 파일은 삽입 순서를 그대로 가진다.
        fs.writeFileSync(layout.authoring, serializeBank(sets));
        fs.writeFileSync(layout.classificationReview, JSON.stringify(review([['pilot-01-001', 'sub1', 'standard'], ['pilot-01-001', 'sub2', 'standard'], ['case-02-x-20260921', 'sub1', 'case'], ['std-b', 'sub1', 'standard']])));
        assert.deepEqual(checkSetFiles(layout), []);
        assert.equal(fs.readFileSync(layout.orderFile, 'utf8'), serializeOrder(['pilot-01-001', 'case-02-x-20260921', 'std-b']));
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('a retired set is deleted, a moved style is relocated, and mixed or unclassified sets are refused', () => {
    const { directory, layout } = isolatedRoot();
    try {
        const first = [minimalSet('a-1', ['sub1']), minimalSet('b-2', ['sub1'])];
        const styles = styleMap(review([['a-1', 'sub1', 'case'], ['b-2', 'sub1', 'standard']]));
        writePublicationFiles(planSetFileWrites(first, styles, layout).writes);
        // b-2 퇴역, a-1은 기준서형으로 재분류, c-3 추가
        const next = [minimalSet('a-1', ['sub1']), minimalSet('c-3', ['sub1'])];
        const nextStyles = styleMap(review([['a-1', 'sub1', 'standard'], ['c-3', 'sub1', 'case']]));
        const plan = planSetFileWrites(next, nextStyles, layout);
        assert.deepEqual(plan.deletes.map((file) => path.relative(layout.directory, file).split(path.sep).join('/')).sort(), ['case/a-1.json', 'standard/b-2.json']);
        assert.deepEqual(plan.writes.map((write) => path.relative(layout.directory, write.file).split(path.sep).join('/')).sort(), ['case/c-3.json', 'order.json', 'standard/a-1.json']);
        for (const file of plan.deletes) fs.unlinkSync(file);
        writePublicationFiles(plan.writes);
        assert.equal(buildBankFromSetFiles(layout).document, serializeBank(next));
        assert.throws(() => planSetFileWrites([minimalSet('m-1', ['sub1', 'sub2'])], styleMap(review([['m-1', 'sub1', 'case'], ['m-1', 'sub2', 'standard']])), layout), /섞여 있어/);
        assert.throws(() => planSetFileWrites([minimalSet('u-1', ['sub1'])], styleMap(review([])), layout), /학습 유형이 없어/);
        assert.throws(() => planSetFileWrites([minimalSet('Bad_ID', ['sub1'])], styleMap(review([['Bad_ID', 'sub1', 'case']])), layout), /파일 이름으로 쓸 수 없습니다/);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('rebuilding refuses a missing, duplicated, extra or misnamed set file and a reordered bank fails the check', () => {
    const { directory, layout } = isolatedRoot();
    try {
        const sets = [minimalSet('a-1', ['sub1']), minimalSet('b-2', ['sub1'])];
        const styles = styleMap(review([['a-1', 'sub1', 'case'], ['b-2', 'sub1', 'standard']]));
        writePublicationFiles(planSetFileWrites(sets, styles, layout).writes);
        fs.writeFileSync(layout.authoring, serializeBank(sets));
        fs.writeFileSync(layout.classificationReview, JSON.stringify(review([['a-1', 'sub1', 'case'], ['b-2', 'sub1', 'standard']])));
        assert.deepEqual(checkSetFiles(layout), []);
        // 순서만 바꾼 정본은 세트 파일과 다르다(정렬 금지).
        fs.writeFileSync(layout.authoring, serializeBank([sets[1], sets[0]]));
        assert.match(checkSetFiles(layout).join('\n'), /순서가 다릅니다/);
        fs.writeFileSync(layout.authoring, serializeBank([sets[0], minimalSet('b-2', ['sub1', 'sub9'])]));
        assert.match(checkSetFiles(layout).join('\n'), /내용이 다른 세트: \[b-2\]/);
        fs.writeFileSync(layout.authoring, serializeBank(sets));
        // 여분·중복·이름 불일치·누락
        const stray = path.join(layout.directory, 'standard', 'z-9.json');
        fs.writeFileSync(stray, serializeSet(minimalSet('z-9', ['sub1'])));
        assert.throws(() => buildBankFromSetFiles(layout), /순서 파일에 없는 세트 파일/);
        fs.unlinkSync(stray);
        const duplicate = path.join(layout.directory, 'standard', 'a-1.json');
        fs.writeFileSync(duplicate, serializeSet(sets[0]));
        assert.throws(() => buildBankFromSetFiles(layout), /두 디렉터리에 있습니다: a-1/);
        fs.unlinkSync(duplicate);
        const renamed = path.join(layout.directory, 'case', 'a-1.json');
        fs.writeFileSync(renamed, serializeSet(minimalSet('a-0', ['sub1'])));
        assert.throws(() => buildBankFromSetFiles(layout), /파일 이름과 안의 ID가 다릅니다/);
        fs.unlinkSync(renamed);
        assert.throws(() => buildBankFromSetFiles(layout), /세트 파일이 없습니다: a-1/);
        // 위치가 분류와 다르면 검사가 잡는다.
        fs.writeFileSync(path.join(layout.directory, 'standard', 'a-1.json'), serializeSet(sets[0]));
        assert.match(checkSetFiles(layout).join('\n'), /위치가 학습 유형과 다릅니다/);
        // sets/ 바로 아래의 README.md는 허용, 다른 파일은 거절
        fs.writeFileSync(path.join(layout.directory, 'README.md'), '# sets\n');
        fs.writeFileSync(path.join(layout.directory, 'notes.txt'), 'x');
        assert.throws(() => buildBankFromSetFiles(layout), /둘 수 없는 파일/);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('writing the split canonical file fans out to the set files atomically and rolls back deletions', (t) => {
    const { directory, layout } = isolatedRoot();
    try {
        const sets = [minimalSet('a-1', ['sub1']), minimalSet('b-2', ['sub1'])];
        const reviewText = JSON.stringify(review([['a-1', 'sub1', 'case'], ['b-2', 'sub1', 'standard']]));
        fs.writeFileSync(layout.classificationReview, reviewText);
        // sets/가 없으면 정본 쓰기는 세트 파일을 만들지 않는다(나누기 전의 저장소 형상).
        writePublicationFiles([{ file: layout.authoring, content: serializeBank(sets) }]);
        assert.equal(fs.existsSync(layout.directory), false);
        assert.deepEqual(splitWritesForAuthoring([{ file: layout.authoring, content: serializeBank(sets) }]), { writes: [], deletes: [] });
        fs.mkdirSync(layout.directory);
        writePublicationFiles(planSetFileWrites(sets, styleMap(JSON.parse(reviewText)), layout).writes);
        // 정본을 새 판본으로 쓰면 세트 파일이 함께 바뀐다: b-2 퇴역·c-3 추가, 같은 묶음의 분류 입력 쓰기를 위치 판정에 쓴다.
        const next = [minimalSet('a-1', ['sub1']), minimalSet('c-3', ['sub1'])];
        const nextReview = JSON.stringify(review([['a-1', 'sub1', 'case'], ['c-3', 'sub1', 'standard']]));
        writePublicationFiles([{ file: layout.authoring, content: serializeBank(next) }, { file: layout.classificationReview, content: nextReview }]);
        assert.deepEqual(fs.readdirSync(path.join(layout.directory, 'standard')), ['c-3.json']);
        assert.deepEqual(fs.readdirSync(path.join(layout.directory, 'case')), ['a-1.json']);
        assert.deepEqual(checkSetFiles(layout), []);
        // 나중 교체가 실패하면 지운 세트 파일까지 되돌린다.
        const rename = fs.renameSync;
        t.mock.method(fs, 'renameSync', (from: fs.PathLike, to: fs.PathLike) => {
            if (String(to) === layout.orderFile) throw new Error('injected order replacement failure');
            rename(from, to);
        });
        assert.throws(() => writePublicationFiles([{ file: layout.authoring, content: serializeBank([next[0]]) }]), /injected order replacement failure/);
        t.mock.restoreAll();
        assert.equal(fs.readFileSync(layout.authoring, 'utf8'), serializeBank(next));
        assert.equal(fs.existsSync(path.join(layout.directory, 'standard', 'c-3.json')), true);
        assert.deepEqual(checkSetFiles(layout), []);
    } finally { t.mock.restoreAll(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('the CLI splits once, refuses a second split, checks, and rebuilds the canonical file from edited set files', () => {
    const { directory, layout } = isolatedRoot();
    try {
        const sets = [minimalSet('a-1', ['sub1']), minimalSet('b-2', ['sub1'])];
        fs.writeFileSync(layout.authoring, serializeBank(sets));
        fs.writeFileSync(layout.classificationReview, JSON.stringify(review([['a-1', 'sub1', 'case'], ['b-2', 'sub1', 'standard']])));
        const env = { ...process.env, CPA_QUESTION_V3_AUTHORING_PATH: layout.authoring, CPA_QUESTION_V3_PROMOTIONS_PATH: path.join(directory, 'ledger.json'),
            CPA_QUESTION_V3_PUBLIC_PATH: path.join(directory, 'public.json'), CPA_QUESTION_V3_ENCRYPTED_PATH: path.join(directory, 'enc.json') };
        const run = (command: string) => spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--import', 'tsx', 'scripts/manage-question-set-files.ts', command],
            { cwd: root, env, encoding: 'utf8', timeout: 120_000, windowsHide: true, shell: false });
        assert.match(run('check').stderr, /세트 파일 디렉터리가 없습니다/);
        const split = run('split'); assert.equal(split.status, 0, split.stderr); assert.match(split.stdout, /2세트를 .*나눴습니다/);
        assert.equal(fs.readFileSync(layout.authoring, 'utf8'), serializeBank(sets));
        assert.match(run('split').stderr, /이미 나뉘어 있습니다/);
        assert.equal(run('check').status, 0);
        // 세트 파일을 직접 고친 뒤 build로 정본을 다시 만든다.
        const edited = minimalSet('b-2', ['sub1', 'sub2']);
        fs.writeFileSync(path.join(layout.directory, 'standard', 'b-2.json'), serializeSet(edited));
        assert.match(run('check').stderr, /내용이 다른 세트: \[b-2\]/);
        const build = run('build'); assert.equal(build.status, 0, build.stderr);
        assert.equal(fs.readFileSync(layout.authoring, 'utf8'), serializeBank([sets[0], edited]));
        assert.match(run('build').stdout, /변경 없음/);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
