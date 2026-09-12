import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const output = path.join(control, 'runtime-v5-source-ranges');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (fs.existsSync(output)) throw Error('이전 변경 증거를 덮어쓰지 않습니다.');
if (!fs.existsSync(`${control}/semantic-cohort-v4-01/paused.json`)) throw Error('현재 의미검수 큐의 세트 경계 중지 확인 필요');
const lock = read(`${control}/runtime-v4-bank-v2/runtime-lock.json`);
const file = 'cpa_uploader/questionSemanticReview.ts', before = fs.readFileSync(file);
if (hash(before) !== lock.code_files.find(row => row.file === file)?.sha256) throw Error('v4 이후 외부 코드 변경');
const manifest = read(`${control}/final-153-v2/manifest.json`);
const positions = [];
for (const entry of manifest.entries.filter(row => ['T04-A', 'T09-B', 'T10-A'].includes(row.plan_id))) {
    const raw = read(entry.file), set = Array.isArray(raw) ? raw[0] : raw;
    if (hash(fs.readFileSync(entry.file)) !== entry.sha256) throw Error('고정 문항 변경');
    for (const sub of set.subquestions) for (const requirement of sub.requirements) {
        const ref = set.source_refs.find(source => source.id === requirement.source_ref_id);
        const text = fs.readFileSync(ref.file, 'utf8'), quote = requirement.source_quote, index = text.indexOf(quote);
        if (index < 0) throw Error('실제 연속 인용 부재');
        const lineAt = offset => text.slice(0, offset).split('\n').length;
        const start = lineAt(index), end = lineAt(index + quote.length - 1);
        const ranges = [...requirement.source_span.matchAll(/L(\d+)\s*-\s*L?(\d+)/g)].map(match => ({ start: Number(match[1]), end: Number(match[2]) }));
        const contained = ranges.some(range => range.start <= start && range.end >= end);
        if (!contained) throw Error('정상 포함 관계라는 진단과 실제 파일이 다름');
        positions.push({ plan_id: entry.plan_id, subquestion_id: sub.id, requirement_id: requirement.id,
            source_file: ref.file, source_file_sha256: hash(fs.readFileSync(ref.file)), source_quote_sha256: hash(quote),
            declared_span: requirement.source_span, declared_line_ranges: ranges, quote_lines: { start, end }, contained,
            meaning: '같은 실제 파일의 선언 범위 안에 연속된 인용이 있다. 이 계산은 공식 권위·판본·주장의 의미 지지를 자동 판정하지 않는다.' });
    }
}
const replace = (text, old, next) => {
    if (!text.includes(old) || text.indexOf(old) !== text.lastIndexOf(old)) throw Error('지시 교체 위치 불명확');
    return text.replace(old, next);
};
let text = replace(before.toString('utf8'), 'source_span은 원문 인용 자체가 아니므로',
    'source_span은 문단 전체나 더 넓은 발췌 위치를, source_quote_line_start/end는 실제 인용 부분을 가리킬 수 있다. 같은 파일의 선언 줄 범위가 실제 인용 줄 범위를 포함하고 문단·페이지도 일치하면 두 끝줄이 같지 않다는 이유만으로 source_support를 uncertain으로 판정하지 않는다. 선언 범위 밖의 인용이나 잘못된 문단·페이지는 실제 불일치로 조사한다. 범위 포함만으로 내용·판본의 지지를 추정하지 않는다. source_span은 원문 인용 자체가 아니므로');
text = replace(text, '실제 겹치는 ID와 명제를 rationale에 적는다.',
    '실제 겹치는 ID와 명제를 rationale에 적는다. 중복은 발문이 요구하는 구체 판단·행동·결과 명제의 중복이다. 주제·기준서·선행 개념을 공유한다는 이유만으로 중복으로 판정하지 않는다. 같은 세트의 물음과 criterion에도 동일한 구체 요구를 기준으로 일관되게 대조한다.');
fs.mkdirSync(output);
fs.writeFileSync(path.join(output, 'questionSemanticReview.ts.before.txt'), before, { flag: 'wx' });
fs.writeFileSync(path.join(output, 'source-range-evidence.json'), JSON.stringify({ at: new Date().toISOString(), positions }, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(output, 'change-record.json'), JSON.stringify({ at: new Date().toISOString(), file,
    before_sha256: hash(before), after_sha256: hash(Buffer.from(text)), grading_files_unchanged: true,
    evidence: ['semantic-cohort-v4-01/summary.json', 'runtime-v5-source-ranges/source-range-evidence.json'],
    policy: '실제 포함 관계를 전체 범위의 양끝 일치와 구별하며, 동일 주제와 동일 요구를 구별한다. 과거 uncertain/fail과 원시 응답을 보존하고 신규 실제 검수로 확인한다. 채점 함수·문항·QA·비교은행은 변경하지 않는다.' }, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(file, text);
console.log(JSON.stringify({ file, source_ranges_checked: positions.length, grading_code_changed: false }));
