import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const output = path.join(control, 'runtime-v4-followup');
if (fs.existsSync(output)) throw Error('기존 후속 기록을 덮어쓰지 않습니다.');
const lock = JSON.parse(fs.readFileSync(path.join(control, 'runtime-v3-stable/runtime-lock.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = ['cpa_uploader/questionSemanticReview.ts', 'lib/questionV3Grading.ts'];
const changes = files.map(file => {
  const before = fs.readFileSync(file);
  if (hash(before) !== lock.code_files.find(row => row.file === file)?.sha256) throw Error(`v3 이후 외부 변경: ${file}`);
  return { file, before, text: before.toString('utf8') };
});
const replace = (value, old, next) => {
  if (!value.includes(old) || value.indexOf(old) !== value.lastIndexOf(old)) throw Error(`치환 위치 불명확: ${old.slice(0, 70)}`);
  return value.replace(old, next);
};
const semantic = changes[0];
const helper = `// Positions come from the exact local file; they establish location, not authority.
function locatedSourceExcerpt(text: string, sourceQuote: string, contextChars = 0) {
    const index = text.indexOf(sourceQuote);
    if (index < 0) return { quote: sourceQuote, line_start: null, line_end: null, source_quote_line_start: null, source_quote_line_end: null };
    const requestedStart = Math.max(0, index - contextChars);
    const start = requestedStart === 0 ? 0 : text.lastIndexOf('\\n', requestedStart - 1) + 1;
    const requestedEnd = Math.min(text.length, index + sourceQuote.length + contextChars);
    const nextBreak = text.indexOf('\\n', requestedEnd);
    const end = nextBreak < 0 ? text.length : nextBreak;
    const lineAt = (offset: number) => text.slice(0, offset).split('\\n').length;
    return { quote: text.slice(start, end), line_start: lineAt(start), line_end: lineAt(Math.max(start, end - 1)),
        source_quote_line_start: lineAt(index), source_quote_line_end: lineAt(index + Math.max(0, sourceQuote.length - 1)) };
}

`;
semantic.text = replace(semantic.text, 'export function prepareSemanticReview(', helper + 'export function prepareSemanticReview(');
const oldExcerpts = semantic.text.slice(semantic.text.indexOf('    const excerpts = verifiedPacket ?'), semantic.text.indexOf('    // Include every peer'));
if (!oldExcerpts.includes('index - 600')) throw Error('예상한 기존 발췌 계약과 다름');
semantic.text = replace(semantic.text, oldExcerpts, `    const excerpts = verifiedPacket ? verifiedPacket.units.map((unit) => ({ id: unit.id, file: unit.file, locator: unit.locator, authority: unit.authority, edition: unit.edition,
        ...locatedSourceExcerpt(fs.readFileSync(path.resolve(root, unit.file), 'utf8'), unit.quote) }))
        : sources.map((source) => ({ id: source.source_ref_id, file: source.file,
            ...locatedSourceExcerpt(source.text, source.declared_metadata.source_quote, 600),
            scope: '직접 근거와 인접 문맥. line_start부터 quote의 각 줄은 실제 파일의 연속된 줄이다. 위치 정보는 공식 권위·판본의 확정을 대신하지 않는다. 별도 문서 의존 관계가 미확인인 경우 uncertain으로 검토할 것.' }));
`);
semantic.text = replace(semantic.text, 'source_span은 원문 인용 자체가 아니므로', 'source_excerpts의 line_start/line_end와 source_quote_line_start/source_quote_line_end는 실제 파일에서 산출한 1부터 시작하는 줄 위치다. quote의 첫 줄을 line_start로 삼아 줄바꿈 순서로 대조하라. 위치 값이 null이면 위치가 확인된 것으로 추정하지 않는다. source_span은 원문 인용 자체가 아니므로');
semantic.text = replace(semantic.text, '조건 경계라는 종류만으로 빠진 필수 요소를 충족한 것으로 보지 않는다.', '조건 경계라는 종류만으로 빠진 필수 요소를 충족한 것으로 보지 않는다. 각 사례의 expected는 target_unit의 criterion 자체에 대한 판정이다. 다른 독립 criterion에만 해당하는 오류나 누락을 목표 criterion의 반대로 전가하지 않는다. 별도 배점되는 적용 범위·효과를 틀린 답안에서도 정확히 충족한 목표 명제는 그 계약대로 판단한다. omission/opposite/condition_boundary는 목표 criterion의 필수 요소·조건을 실제로 바꾸는 사례로 설계한다.');
const grader = changes[1];
grader.text = replace(grader.text, "        '[보안 규칙]',", `        '[명제와 부정 범위 확인]',
        '- claim과 critical_facts에 적힌 구체 대상·조건·허용 범위(scope 포함)를 함께 적용한다. 허용된 함축 표현을 특정 단어가 없다는 이유로 배제하지 않는다. 이웃 criterion과 추상어가 비슷해도 그 이웃만 충족한 답안을 해당 구체 명제의 충족으로 확대하지 않는다.',
        '- 포함과 배타를 구별한다. X도 포함한다는 말은 X만 포함한다는 말이 아니며, X만을 뜻하지 않는다는 말은 X를 제외한다는 말이 아니다. 부정이 걸린 대상과 한정어를 답안 전체에서 확인한다.',
        '- 같은 대상·시점에 대해 양립할 수 없는 정답과 반대 결론을 함께 쓴 경우, 명시적인 철회·자기정정이 없으면 그 criterion은 contradicted이다. 뒷부분의 정답 문장만 골라 앞부분의 반대를 무시하지 않는다. 그 모순과 독립적으로 정확한 다른 criterion은 따로 인정한다.',
        '- 각 criterion의 reason에 실제 충족·누락·반대를 결정한 구체 요건을 짧게 적는다. 여러 criterion에 같은 evidence_ids를 쓸 때도 각각의 다른 요건이 그 구간에 있는지 확인한다. 일반적인 감사목적이나 다른 요건의 오류만으로 판정을 전파하지 않는다.',
        '',
        '[보안 규칙]',`);
fs.mkdirSync(output);
for (const row of changes) {
  fs.writeFileSync(path.join(output, path.basename(row.file) + '.before.txt'), row.before, { flag: 'wx' });
}
const record = { created_at: new Date().toISOString(), purpose: 'actual_mismatch_followup_not_validation_complete',
  evidence: [
    't04-a-locator-investigation.json',
    'cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/phase-two-v3/t09-a/generated3-01',
    'cpa_uploader/drafts/delegated-authoring-2026-09-11/r02/evidence/phase2/phase-two-v3/pilot-05-008/request-pending-six-run-investigation.json',
    'cpa_uploader/drafts/delegated-authoring-2026-09-11/n02/evidence/phase2/phase-two-v3/initial-content-mismatch-proposals.json',
    'cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/phase-two-v3/t12-a/author3b/omit1-investigation.json',
    'cpa_uploader/drafts/delegated-authoring-2026-09-11/n06/phase-two-v3/pilot-16-010/author-qa-01/case-0041-attempt-1.json' ],
  changes: changes.map(row => ({ file: row.file, before_sha256: hash(row.before), after_sha256: hash(Buffer.from(row.text)) })),
  policy: '원문·정답 명제와 과거 raw/receipt는 보존한다. 일반 해석 규칙과 실제 위치 근거를 보완하며 특정 답안을 매칭하거나 모델 기대를 강제로 통과시키지 않는다. 반례·영향 정상/부분/반대 사례를 새 코드로 실측한다.' };
fs.writeFileSync(path.join(output, 'change-record.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
for (const row of changes) fs.writeFileSync(row.file, row.text);
console.log(JSON.stringify(record.changes));
