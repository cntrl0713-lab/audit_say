import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studyTopics } from '../../wiki/scripts/ox-study-order.mjs';

const base = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve('docs/reports/question-authoring-frequency-gap-2026-09-10');
fs.mkdirSync(out, { recursive: true });
const read = n => JSON.parse(fs.readFileSync(path.join(base, n), 'utf8'));
const map = read('frequency-links.json');
const validation = read('validation.json');
if (validation.errors.length) throw new Error('Fix batch validation before rendering');
const order = studyTopics.map(t => t.id);
const entries = map.sets.map(m => ({ ...m, set: read(`${m.set_id}.json`) })).sort((a,b) => order.indexOf(a.topic_id) - order.indexOf(b.topic_id) || a.candidate.localeCompare(b.candidate));
const total = s => s.subquestions.reduce((n,q) => n + points(q), 0);
const points = q => q.criteria.reduce((n,c) => n + c.max_points, 0);
const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const link = (label, absolute) => `[${label}](${path.relative(out, absolute).replace(/\\/g, '/')})`;
const local = (label, filename) => link(label, path.join(base, filename));
const source = r => link(r.title || r.file, path.resolve(r.file));
const relation = value => ({ direct: '동일 요구', direct_with_excluded_example: '동일 요구·원문의 예시 제외', related_with_excluded_example: '인접 요구·원문의 예시 제외', adjacent: '인접 요구', adjacent_not_same_reporting_basis: '인접 요구·보고 방식이 다름', excluded_frequency_match_comparative_statements: '빈도 연결 제외·비교재무제표', broader_source_not_exact_independence_frequency: '상위 요구·독립성 자체의 빈도 아님', adjacent_followup_scope_candidate: '후속 보강 후보·이번 범위 외', optional_followup: '후속 보강 후보·이번 범위 외' }[value] ?? value);
const historicalNotice = '> 이 문서는 제작 당시 초안과 검증 기록을 재현한 자료입니다. 최신 은행 반영·검토·게시 상태는 [통합 현황](../../../cpa_uploader/wiki/_meta/authoring-dashboard.md)을 확인하세요.';
const writeReport = (name, body) => {
  const newline = body.indexOf('\n');
  fs.writeFileSync(path.join(out, name), body.slice(0, newline) + '\n\n' + historicalNotice + '\n' + body.slice(newline));
};
const lines = [];
lines.push('# 출제 공백 보강 문제지', '', `기존 설계안 A–I 전체를 구체 요구사항 빈도와 대조하여 제작한 **${validation.sets}세트·${validation.subquestions}물음·${validation.points}점** 초안이다. 주제 순서는 필수암기 OX 교재에 맞춘 wiki 학습 순서를 따른다.`, '', '2026년 시행 기준을 사용하며 2027년에도 동일 적용한다고 가정한다. 2027년 시험 적용 판본의 확정은 아니다. 각 물음에서 요구한 범위의 항목을 모두 작성한다. 번호·문장 수·나열 순서로 답안을 제한하지 않는다.', '', '[모범답안·채점기준](answers-and-rubrics.md) · [빈도·공백 연결과 제작 기록](authoring-map.md)', '');
for (const [index, {candidate, set}] of entries.entries()) {
  lines.push(`## 문제 ${index + 1}. ${set.title} — ${total(set)}점`, '', `원설계 ${candidate} · 주제 ${set.classification.topic_id}`, '', ...set.shared_context.facts.map(f => f.text + '\n'));
  for (const [qi,q] of set.subquestions.entries()) lines.push(`### 물음 ${qi + 1} — ${points(q)}점`, '', q.prompt, '');
}
writeReport('questions.md', lines.join('\n') + '\n');
const answers = ['# 모범답안과 채점기준', '', '[문제지](questions.md) · [제작 기록](authoring-map.md)', '', '각 criterion은 1점이다. 충족한 독립 명제의 점수를 합산하며 일부 누락으로 나머지 점수를 없애지 않는다. 동일 의미의 표현과 명백히 함축된 판단을 인정하되, 명시적 반대 결론은 해당 판단 점수를 받지 못한다. 아래는 출처를 대조해 작성한 채점 초안이며 실제 모델 채점·사람 승인이 완료된 문항은 아니다.', ''];
for (const [index,{candidate,set}] of entries.entries()) {
  answers.push(`## 문제 ${index + 1}. ${set.title} — ${total(set)}점`, '', `원설계 ${candidate} · ${local('v3 JSON', `${set.id}.json`)} · ${local('제작 계획', `${set.id}.authoring-plan.json`)} · ${local('답안 경계 사례', `qa-${set.id.replace('draft-', '')}.json`)}`, '');
  for (const [qi,q] of set.subquestions.entries()) {
    answers.push(`### 물음 ${qi + 1} — ${points(q)}점`, '', `**발문:** ${q.prompt}`, '', '**모범답안**', '', ...q.model_answer.map((a,i) => `${i+1}. ${a}`), '', '**채점기준**', '', '| 명제 | 점수 | 직접 근거 |', '| --- | ---: | --- |');
    for (const c of q.criteria) {
      const refs = c.source_ref_ids.map(id => set.source_refs.find(r => r.id === id));
      answers.push(`| ${cell(c.claim)} | ${c.max_points} | ${refs.map(source).join(' / ')} |`);
    }
    answers.push('');
  }
  answers.push('**출처·설계 메모**', '', ...set.verification.notes.map(n => `- ${n}`), '');
}
writeReport('answers-and-rubrics.md', answers.join('\n') + '\n');
const report = ['# 요구사항 빈도와 출제 공백의 연결', '', '2026-09-10. 대상은 9월8일 작성된 기존 설계안 A–I다. 이후의 실제 은행 발문·정답·criterion을 다시 대조하고 추출 요소를 연결했다. 빈도에 관계없이 사용자가 선택한 9세트를 모두 제작했으며, 확인되지 않은 빈도를 만들거나 인접 주제의 횟수를 옮기지 않았다.', '', local('기계 판독용 요소·원출제·페이지 연결', 'frequency-links.json'), '', '## 읽는 방법', '', '- 기출과 모의고사는 각각 원시험의 고유 물음별로 세며 교재 재수록은 추가하지 않는다.', '- 한 세트의 여러 요소 빈도를 더해 그 세트의 출제 횟수로 쓰지 않는다. 아래 표는 요소별 수치다.', '- 0회 또는 매칭 없음은 현재 추출 범위에서 확정된 동일 요구를 찾지 못했다는 뜻이다.', '- 대응수치와 비교재무제표처럼 결론을 바꾸는 보고 방식이 다르면 빈도를 분리한다.', '', '## 세트별 요구사항', ''];
for (const {candidate,set,links,bank_overlap,design_notes,...rest} of entries) {
  report.push(`### ${candidate}. ${set.title}`, '', `${local(set.id, `${set.id}.json`)} · ${set.subquestions.length}물음 · ${total(set)}점`, '', '| 대상 | 추출 요구사항 | 연결 관계 | 원요소 기출 | 연도 | 원요소 모의 |', '| --- | --- | --- | ---: | --- | ---: |');
  if (!links.length) report.push('| — | 동일 요구의 확정 요소 매칭 없음 | 기준서와 은행 공백에서 설계 | — | — | — |');
  for (const l of links) report.push(`| ${cell(l.target)} | ${cell(l.label)} | ${cell(relation(l.relationship))} | ${l.exam_frequency} | ${(l.exam_years ?? []).join(', ') || '—'} | ${l.mock_frequency} |`);
  report.push('', '**기존 은행과의 관계**', '');
  if (bank_overlap?.length) for (const overlap of bank_overlap) report.push(`- ${typeof overlap === 'string' ? overlap : Object.entries(overlap).map(([k,v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('; ')}`);
  else report.push('- 해당 기준서의 구체 요구를 기존 세트에서 독립 물음으로 다루는지 대조했다. 상세 판정은 연결 JSON과 계획서에 기록했다.');
  for (const note of design_notes ?? []) report.push(`- ${note}`);
  // Preserve additional selection notes such as rejected frequency matches.
  for (const [key,value] of Object.entries(rest)) if (!['topic_id','set_id','candidate'].includes(key) && value && (Array.isArray(value) ? value.length : true)) report.push(`- ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  report.push('', '**대표 원출제 위치**', '');
  const seen = new Set();
  for (const l of links) for (const r of l.source_records) {
    if (seen.has(r.record_id)) continue; seen.add(r.record_id);
    report.push(`- ${link(`${r.record_id} — 원문 ${r.source.page}쪽, L${r.source.start_line}–L${r.source.end_line}`, path.resolve(r.source.file))}`);
  }
  report.push('');
}
report.push('## 이전 설계에서 바로잡은 내용', '', '- 서비스조직 절차는 선택 가능한 대안을 모두 답하도록 하면서 실제 감사에서는 하나 이상을 선택한다는 조건을 보존했다.', '- 서비스조직 증거부족의 판단과 감사범위 제한이라는 이유에 각각 배점했다. 단순 기재사항을 판단형으로 분류한 물음은 서술형으로 바로잡았다.', '- 지배기구와의 커뮤니케이션에서 회계실무가 구체 상황에 가장 적합하지 않은 이유 설명과 독립성 안전장치에 관한 요구를 보완했다.', '- 대응수치 문제에 국내 외감법상 비교재무제표 방식의 기출 빈도를 옮기지 않았다. 공식 보론의 실제 사례를 사용하고 지문에서 정답 결론을 제외했다.', '- 대응수치의 미재작성 또는 공시 미비라는 또는 관계, 전임감사인 언급의 법규 조건, 기타정보 적용 범위·시점을 보존했다.', '- 유형1 보고서의 운영효과성 한계가 계획의 부적절 판단을 분명히 함축하면 판단 점수도 인정하도록 기대 사례를 수정했다.', '', '## 검증과 남은 단계', '', `- ${validation.sets}세트·${validation.subquestions}물음·${validation.criteria}개 1점 명제: 구조·원문 인용·인용 해시·계획 및 원자료 단위 연결 검증.`, '- 기존 96세트와의 ID·동일 발문 중복, 이번 9세트끼리의 중복, 편입을 가정한 은행 검증 및 공개 변환의 비공개 필드 제외 확인.', `- 작성자가 원문에서 정한 ${validation.qa_cases}개 답안 사례의 기대 판정을 실제 점수 합산 함수에 재생하여 확인. 이는 모델이 해당 답안을 정확히 판정한다는 실측 결과가 아니다.`, '- 2025 개정 및 2026년7월 개정 공식 전문의 해당 인용을 대조했다. 기준서 판본·쪽수·해시는 각 출처 대조 파일과 계획에 보존했다.', '- 문항 상태는 needs_review이며 실제 채점 모델 실측, 사람의 검수 승인, 정본 편입·게시는 후속 단계다. 현재의 작성자 QA는 정식 의미검수 receipt를 대체하지 않는다.', '', local('일괄 검증 결과', 'validation.json'), '', '## 원문서', '', link('출제 공백 지도(9월8일 기록)', path.resolve('docs/reports/question-review-2027/출제-공백-지도-위키-기준-2026-09-08.md')), '', link('원래 A–I 설계안(9월8일 기록)', path.resolve('docs/reports/question-review-2027/신규-출제-설계안-주제별-문제-후보-2026-09-08.md')), '', link('요구사항별 빈도표', path.resolve('cpa_uploader/analysis/question-elements/frequency.md')));
writeReport('authoring-map.md', report.join('\n') + '\n');
const overview = ['# 빈도·출제 공백 기반 문제 9세트', '', `**${validation.sets}세트·${validation.subquestions}물음·${validation.points}점**을 제작했다. 기존 설계안 A–I 전체를 포함하며 OX 교재의 대표 학습 순서로 배치했다.`, '', '- [문제지](questions.md)', '- [모범답안·채점기준](answers-and-rubrics.md)', '- [요구사항 빈도·은행 공백·원출제 연결](authoring-map.md)', '', '| 순서 | 원설계 | 주제 | 물음 | 점수 |', '| ---: | --- | --- | ---: | ---: |', ...entries.map(({candidate,set},i) => `| ${i+1} | ${candidate} | ${set.title} | ${set.subquestions.length} | ${total(set)} |`), '', '2026년 시행 기준을 적용하고 2027년에도 동일하게 적용한다는 기존 작업 가정을 유지한다. 2027년 시험 적용 판본의 확정은 아니다.', '', '현재 상태는 검토 전 초안(needs_review)이다. 원문·형상·연결·기대점수 재생 검증과 독립 내용 검토를 수행했으며, 실제 채점 모델 실측·사람 승인·정본 편입은 수행하지 않았다.', '', local('초안·계획·근거·검증 파일 폴더', '.'), '', '재검증: `npx tsx cpa_uploader/drafts/frequency-gap-2026-09-10/verify-batch.ts`', '', '문서 재생성: `node cpa_uploader/drafts/frequency-gap-2026-09-10/render-batch.mjs`'];
writeReport('README.md', overview.join('\n') + '\n');
console.log(`Rendered ${out}`);
