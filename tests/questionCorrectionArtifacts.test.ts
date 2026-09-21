import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { CORRECTIONS_DIRECTORY, readCorrectionFile } from '../cpa_uploader/questionCorrection.ts';

// 저장소 게이트: 문항 수정은 작은 correction 파일과 적용 기록으로만 남고, 전체 은행·SQL 사본을 두지 않는다.
const root = process.cwd();
const corrections = path.join(root, CORRECTIONS_DIRECTORY);
const releases = path.join(root, 'cpa_uploader/releases');
const MAX_CORRECTION_BYTES = 512 * 1024;
const RELEASE_FILES = new Set(['inspection.json', 'preparation.json', 'probe-result.json', 'before.json', 'apply-started.json',
    'apply-response.json', 'apply-failure.json', 'verification.json', 'completion.json']);
const MAX_RELEASE_RECORD_BYTES = 1024 * 1024;
const sha = (bytes: Buffer) => createHash('sha256').update(Buffer.from(bytes.toString('utf8').replace(/\r\n/gu, '\n'), 'utf8')).digest('hex');
const list = (directory: string) => fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }) : [];

test('correction files parse strictly, are named by their ID and stay small', () => {
    for (const entry of list(corrections)) {
        if (entry.isDirectory()) { assert.equal(entry.name, 'applied', `${entry.name}: corrections 아래에는 applied/만 둡니다.`); continue; }
        if (entry.name === 'README.md') continue;
        assert.match(entry.name, /\.json$/u, `${entry.name}: correction은 JSON 파일입니다.`);
        const file = path.join(corrections, entry.name);
        assert.ok(fs.statSync(file).size <= MAX_CORRECTION_BYTES, `${entry.name}: 명세가 너무 큽니다. correction은 바꿀 필드만 적고, 교체 명세는 세트 하나만 담습니다.`);
        assert.doesNotThrow(() => readCorrectionFile(file), entry.name);
    }
});

test('application records point at unchanged correction specs', () => {
    const ids = new Set<string>();
    for (const entry of list(path.join(corrections, 'applied'))) {
        assert.ok(entry.isFile() && entry.name.endsWith('.json'), `${entry.name}: 적용 기록은 JSON 파일입니다.`);
        const record = JSON.parse(fs.readFileSync(path.join(corrections, 'applied', entry.name), 'utf8'));
        assert.ok(['question_set_correction_application', 'question_set_replacement_application'].includes(record.artifact_type), entry.name);
        assert.equal(`${record.correction_id}.json`, entry.name, `${entry.name}: 기록 이름은 correction_id와 같아야 합니다.`);
        assert.ok(!ids.has(record.correction_id)); ids.add(record.correction_id);
        const spec = path.join(root, record.spec.file);
        assert.ok(fs.existsSync(spec), `${entry.name}: 적용한 correction 파일이 없습니다(${record.spec.file}).`);
        assert.equal(sha(fs.readFileSync(spec)), record.spec.sha256, `${entry.name}: 적용 후 correction 파일이 바뀌었습니다. 새 correction을 만드십시오.`);
    }
});

test('release runs keep only small records; SQL and bank copies stay out of the repository', () => {
    for (const run of list(releases)) {
        if (run.isFile() && run.name === 'README.md') continue;
        assert.ok(run.isDirectory() && /^\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(run.name), `${run.name}: 실행 폴더 이름은 YYYYMMDD-slug입니다.`);
        for (const entry of list(path.join(releases, run.name))) {
            assert.ok(entry.isFile() && RELEASE_FILES.has(entry.name), `${run.name}/${entry.name}: 릴리스 기록에 둘 수 없는 파일입니다(SQL·은행 사본은 tmp/에 둡니다).`);
            assert.ok(fs.statSync(path.join(releases, run.name, entry.name)).size <= MAX_RELEASE_RECORD_BYTES, `${run.name}/${entry.name}: 기록이 너무 큽니다.`);
        }
    }
});
