import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s02';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const hash = x => createHash('sha256').update(x).digest('hex');
const write = (f, value) => fs.writeFileSync(`${folder}/${f}`, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const manifest = read(`${folder}/draft-manifest.json`), qa = read(`${folder}/qa-manifest.json`);
const latest = read(`${folder}/evidence/phase1/latest-static.json`), staticEvidence = read(latest.file);
if (staticEvidence.results.some(r => r.structural.errors.length || r.plan_errors.length || r.source_errors.length || r.qa_errors.length || !r.semantic_preparation.success) || staticEvidence.in_memory_bank.errors.length || staticEvidence.conflicts.length) throw new Error('정적 오류가 남아 있음');
for (const s of manifest.sets) if (staticEvidence.results.find(r => r.set_id === s.set_id)?.sha256 !== hash(fs.readFileSync(s.file))) throw new Error('정적 증거 이후 파일 변경');
const catalog = buildSourceCatalog(), elementsFile = 'cpa_uploader/analysis/question-elements/question-elements.json', elements = read(elementsFile);
const choices = [
  ['element-36b640a9b0378ca4', 'T08-C-Q1/Q2 partial; Q3 adjacent', '원대화 두 문장 선택에서 경영진측 전문가 평가범위 전체로 확장'],
  ['element-ed97d946175b3812', 'T06-C-Q1 direct', '대표 기출수록의 기출변형 표시를 보존'],
  ['element-1943e90e48630440', 'T06-C-Q2 partial; Q3 adjacent', '원유의적 위험 고려사항을 개정판 고유위험요소의 사례 적용으로 재구성'],
  ['element-f1a4672efd547526', 'T07-C-Q1 partial', '원통제실패 사례에 인도조건·배송기간을 결합한 의도된 복습'],
  ['element-94ffa1bcf8d89e15', 'T07-C-Q2 direct', '외부조회의 시기·범위 조정 및 이유'],
  ['element-d636e70ed3dc0bd1', 'T07-C-Q3 partial', '분석적절차계획의 범위를 기초자료 품질 확인으로 한정한 복습'],
  ['element-28cfd73c262d1eb8', 'T07-C-Q1 direct', 'N02 T08-B-Q3와 공유하는 기간귀속 적용복습. 별도 신규 요구로 세지 않음'],
  ['evidence.entity-produced-information', 'T07-C-Q3 partial', '정밀도·상세도를 별도 확인한 사실로 주어 정확성·완전성 증거에 한정. N02 T08-A와 공유'],
];
const frequency = choices.map(([id, target, note]) => {
  const e = elements.elements.find(e => e.id === id); if (!e) throw new Error(`요소 없음 ${id}`);
  const records = e.occurrence_ids.map(id => elements.occurrences.find(o => o.id === id)).map(o => elements.records.find(r => r.id === o.record_id));
  const ox = records.filter(r => r.id.startsWith('ox-') || r.source.file.includes('OX_200'));
  return { id, target, note, label: e.label, exam_frequency: e.exam_frequency, exam_years: e.exam_years, exam_questions: e.exam_questions, mock_frequency: e.mock_frequency,
    general_practice_occurrence_count: e.practice_occurrences.filter(id => !ox.some(r => r.id === id)).length, ox_occurrence_count: ox.length,
    actual_records: records.map(r => ({ id: r.id, origin: r.origin, source: r.source, source_unit_ids: r.source_unit_ids, source_role: r.source_role, text: r.text })) };
});
const bankFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
write('evidence/phase1/frequency-and-prior-evidence.json', { checked_at: new Date().toISOString(), elements_file: elementsFile, elements_sha256: hash(fs.readFileSync(elementsFile)), policy: elements.policy, choices: frequency,
  bank_file: bankFile, bank_sha256: hash(fs.readFileSync(bankFile)), prior_sets: read(bankFile).filter(s => ['pilot-08-002', 'pilot-06-003', 'pilot-06-004', 'pilot-06-005', 'pilot-07-005'].includes(s.id)),
  predecessor_manifests: ['n02', 'n03'].map(p => `cpa_uploader/drafts/delegated-authoring-2026-09-11/${p}/draft-manifest.json`),
  original_shared_context: catalog.units.filter(u => ['src-21232c45234c79c5db', 'src-989e2cf6d0605e3947', 'src-ae8c8559961f195cac', 'src-0cb6cd248647c5539b', 'src-ab6d6e111370d7d7aa'].includes(u.id)).map(({ id, file, locator, quote, contentHash }) => ({ id, file, locator, quote, content_hash: contentHash })),
  active_draft_comparison: { file: staticEvidence.comparison_file, sha256: staticEvidence.comparison_sha256, initial_sets: staticEvidence.initial_sets, n02_additional_sets: staticEvidence.n02_additional_sets, n03_additional_sets: staticEvidence.n03_additional_sets, own_other_sets_per_review: 2, final: false } });
const linkDefinitions = [
  ['element-36b640a9b0378ca4','pilot-08-008','sub1','partial',['src-21232c45234c79c5db','src-989e2cf6d0605e3947'],'원문은 대화중부적절한두문장 선택이다. 적격성·역량과 보수상충의 객관성 전체를 사례에 적용하는 범위는 일부만 일치한다.'],
  ['element-36b640a9b0378ca4','pilot-08-008','sub2','partial',['src-21232c45234c79c5db','src-989e2cf6d0605e3947'],'전문가업무 이해·적합성과 입력검토를 모두 묻도록 확장했다. 기존08-002의 사례 심화이며 새 기준범주가 아니다.'],
  ['element-36b640a9b0378ca4','pilot-08-008','sub3','adjacent',['src-989e2cf6d0605e3947'],'자료불일치 대응 두조치는 원선택발문의 직접요구로 보지 않는다. 기존08-002/sub2의 의도된 복습이다.'],
  ['element-ed97d946175b3812','pilot-06-008','sub1','direct',['src-136c133b38f8844f95'],'기업이 놓친 위험에 관한 세후속 판단을 연결한다. 대표 수록의기출변형표시를 보존하고 공식시험 무변형원문확인과 구별한다.'],
  ['element-1943e90e48630440','pilot-06-008','sub2','partial',['src-d733ef2ddd5495adbb'],'원문의유의적위험 고려사항 대신 개정315의변화·불확실성과 가능성·규모영향을 명시해적용한다.'],
  ['element-1943e90e48630440','pilot-06-008','sub3','adjacent',['src-d733ef2ddd5495adbb'],'원위험평가사례는 참고지만 새정보에따른 평가와추가감사절차수정은 직접원요구가 아니다.'],
  ['element-f1a4672efd547526','pilot-07-008','sub1','partial',['src-ae8c8559961f195cac','src-0cb6cd248647c5539b','src-ab6d6e111370d7d7aa'],'통제실패후기간귀속절차를바꾸는원요구에 배송기간·인수조건을추가했다. N02이후적용복습이며 신규커버리지로세지않는다.'],
  ['element-94ffa1bcf8d89e15','pilot-07-008','sub2','direct',['src-ae8c8559961f195cac','src-0cb6cd248647c5539b','src-ab6d6e111370d7d7aa'],'통제의존약화에따른조회기준일과관련확인범위변경의직접요구. 구체표본수계산은제외한다.'],
  ['element-d636e70ed3dc0bd1','pilot-07-008','sub3','partial',['src-ae8c8559961f195cac','src-0cb6cd248647c5539b','src-ab6d6e111370d7d7aa'],'분석적절차계획보다좁은기업생성기초자료의정확성·완전성증거를묻는다.'],
  ['element-28cfd73c262d1eb8','pilot-07-008','sub1','direct',['src-f3304ffcc0063092e3'],'N02 pilot-08-007/sub3과같은인수조건·배송기간의적용복습으로 신규요구로재집계하지않는다.'],
  ['evidence.entity-produced-information','pilot-07-008','sub3','partial',['src-f3906bccdb6c4ec743'],'N02 pilot-08-006/sub1의정확성·완전성증거를반복적용하며 목적상정밀도·상세도는이미확인한사실로제외했다.'],
];
const entries = linkDefinitions.map(([element_id, set_id, subquestion_id, relationship, source_unit_ids, reason]) => {
  const file = `${folder}/${set_id}.json`, q = read(file)[0].subquestions.find(q => q.id === subquestion_id);
  if (!elements.elements.some(e => e.id === element_id) || source_unit_ids.some(id => !catalog.units.some(u => u.id === id)) || !q) throw new Error(`잘못된 관계 ${element_id}`);
  return { element_id, source_unit_ids, target: { scope: 'draft', file, set_id, subquestion_id, criterion_ids: q.criteria.map(c => c.id) }, relationship, reason, review_status: 'needs_review' };
});
write('coverage-proposal.json', { version: 1, artifact_type: 'coverage_proposal', package: 'S02', entries,
  evidence_paths: [`${folder}/scope-and-sources.md`, `${folder}/evidence/phase1/frequency-and-prior-evidence.json`, elementsFile, 'cpa_uploader/analysis/question-elements/frequency.md'],
  policy: '관계 제안만 작성했다. source snapshot 및공통links통합은최종내용확정후총괄이수행한다. 원문·빈도표복제없음. T07-C-Q1/Q3은의도된복습으로새커버리지아님.' });
const investigation = read(`${folder}/evidence/phase1/packet-context-investigation.json`);
write('evidence/phase1/manual-context-review.json', { checked_at: new Date().toISOString(), final_packet: false, investigation_file: `${folder}/evidence/phase1/packet-context-investigation.json`,
  results: investigation.results.map(r => ({ set_id: r.set_id, completeness: r.completeness, chars: r.charCount, unresolved_count: r.unresolved.length, direct_unresolved: r.direct_unresolved,
    assessment: r.set_id === 'pilot-08-008' ? '500.8의620표제각주는5(d)구별 문맥이고,A68의530표제각주는A67쪽각주다.500.5의일반기준서목록은도입부각주1~5, A45의705.13은앞A44의범위제한각주22이다. 실제전문가업무이해의620.7과불일치문서화의230.11은정확한인용·실제ID·파일해시로계획에포함했다. 원기출527쪽은08주제연결이없지만사례맥락이어서원계획과계보에보존했다.'
      : r.set_id === 'pilot-06-008' ? '315.22/A109→A62 및A111→A86을공식양판본에서읽고전체인용·파일해시를계획에포함했다. A206의330일반참조는추가절차대응문맥으로330.6/A8을직접포함한다. A220의240각주57은26~28이며12(f)/보론2/A113의240관련문맥도확인해계획에보존했다. 새점수로부정위험절차를추가하지않는다.'
        : '330.A9의315일반참조는각주3→315.31/34이며실제등록공식두문단을전체인용·파일해시와함께계획에넣었다.330.6의315표제각주는도입부기준서명이다.500.9/.A60-.A62로자료품질의직접근거와통제테스트대안을포함했다.',
    policy: '직접문맥을수동확인했지만전체연쇄자동의존의complete로표시하지않는다. 수동plan+등록공식refs경로이며자동조사파일을--packet으로넘기지않는다.' })),
  supplementary_context_evidence: `${folder}/evidence/phase1/supplementary-cross-context.json`,
  explicit_model_context: '보조문맥은문서장부에만남긴것이아니라plan.scope.exceptions에정확인용·파일·해시로포함되어prepareSemanticReview의authoring_plan에전달된다.',
  generation: 'manual_authoring; generation marker는최초부터없었고제거한적도없음' });
manifest.stage = 'draft_ready'; manifest.checked_at = new Date().toISOString(); manifest.latest_static = latest;
manifest.qa_manifest = `${folder}/qa-manifest.json`; manifest.total_qa_cases = qa.total_cases;
manifest.manual_context_review = `${folder}/evidence/phase1/manual-context-review.json`; manifest.coverage_proposal = `${folder}/coverage-proposal.json`;
manifest.final_automatic_packet = 'unresolved_investigation_not_supplied_to_review';
manifest.sets = manifest.sets.map(s => ({ ...s, qa_file: qa.sets.find(q => q.set_id === s.set_id).file, qa_sha256: qa.sets.find(q => q.set_id === s.set_id).sha256, qa_cases: qa.sets.find(q => q.set_id === s.set_id).cases }));
write('draft-manifest.json', manifest);
const rows = manifest.sets.map(s => `| ${s.plan_id} | [${s.set_id}](${s.set_id}.json) | ${s.questions} | ${s.points} | [계획](${s.set_id}.authoring-plan.json) | [QA ${s.qa_cases}개](qa-cases-${s.plan_id.toLowerCase()}.json) |`).join('\n');
write('README.md', `# S02 1차 제작 인계

**draft_ready: 3세트·9물음·23점, 작성자 QA172개.** 형상·공식인용·version1계획·정수배점·QA·현행은행메모리·초기111세트 및선행N02 4세트/N03 3세트와의ID·발문충돌 검사를 통과했다. 독립 모델 의미검수와 실제 모델 채점은 미실행이며 정본 편입·게시·배포하지 않았다.

| 계획 | 실제 문항 | 물음 | 점수 | 계획 | 작성자 QA |
|---|---|---:|---:|---|---|
${rows}

[고정파일·해시](draft-manifest.json), [범위·근거·빈도](scope-and-sources.md), [인계·재개조건](handoff.md), [최신정적증거](evidence/phase1/latest-static.json), [관계제안](coverage-proposal.json)을 함께 본다. 문항은각1세트배열이며중복합본은없다. [수동입력](content.mjs), [전용생성기](build-s02.mjs), [작성자QA생성기](build-qa.mjs)는S02만 쓴다.

2027년CPA목표·2026년1월1일개시사례, 현재 확보한 공식 근거 기준이다.2027년최종시험판본확정을주장하지않는다. 자동packet은 넓은 연쇄의존·원페이지분류 한계를 가진 [조사물](evidence/phase1/packet-context-investigation.json)로 보존했고 complete로 표시하지 않았다. [수동문맥검토](evidence/phase1/manual-context-review.json)와 실제 등록refs·계획으로 최종 검수한다.
`);
write('handoff.md', `# S02 인계

현재는 draft_ready이며 의미검수·실제채점이 남았다. 모든 문항은 needs_review / needs_human_review 상태다.

| 계획 ID / 실제 ID | 출처·판본 | 초안 버전·해시 | 정적검사 | 의미검수 | 실제 채점 사례 수·불일치 | 남은 일 | 증거 경로 |
|---|---|---|---|---|---|---|---|
${manifest.sets.map(s => `| ${s.plan_id} / ${s.set_id} | 공식2025 + 2026 관련문단 대조 | SHA256 ${s.sha256} | 통과 | 미실행 | 0회 / 미확인; 작성자QA ${s.qa_cases}개 | 고정은행 모델검수·QA·불일치수정 | [문항](${s.set_id}.json), [계획](${s.set_id}.authoring-plan.json), [QA](qa-cases-${s.plan_id.toLowerCase()}.json) |`).join('\n')}

## 후속 및 의도된 복습

- T07-C-Q1은 N02 pilot-08-007/sub3/crit6~crit8(T08-B-Q3)의 인도조건·기간귀속 대상기간 조정이다. T07-C-Q3은 pilot-08-006/sub1/crit1·crit2(T08-A-Q1)의 정확성·완전성 증거다. 두 물음은 새 커버리지로 세지 않는다.
- T07-C-Q2는 통제의존 약화에 따른 조회기준일·관련범위 조정이다. S04의 다른조건고정 표본크기 영향요소나 특정 수량 계산과 구별한다. 조회는실재성·정확성위험에관련된증거를얻는절차로계속사용한다는전제를두었다.
- T06-C-Q3의 위험평가 수정은315.37, 계획된 추가감사절차 수정은330.6/A8 및315.A236이다.315.37이 두 조치를 모두 직접 명시한다고 쓰지 않는다.
- T08-C는 기존08-002의 사례 심화다. 감사인측 전문가620.11이나 N04 회계추정540 전체검증으로 바꾸지 않는다. 적합성의 반복 점수를 피하도록 sub2 crit4는 발견사항·결론, crit5는 유의적 가정·방법과 자료로 발문에서 분리했다.

공통 분류의 topic07에500이 필요함을 제안했고 총괄이330기본을유지하며500을추가했다. 실제 후보로 공식source_refs·분류검사를통과했다. source catalog의 등록과 공통wiki·coverage변경은 총괄이 처리했으며 담당자가 공통파일을 직접 수정하지 않았다.

## 최종 검증 재개

1. 총괄의최종catalog와활성비교은행·해시를받아후보·계획·QA의재사용가능성을다시확인한다. 현재비교는111+N02 4+N03 3+다른S02 2개이며전체49세트최종의미중복검사를대신하지않는다.
2. [검수래퍼](../../../analysis/reviews/delegated-authoring-2026-09-11/run-review.ts)에 '--file'·'--plan'·최종'--bank'를지정한다. 미완전자동조사물을'--packet'으로넘기지않는다. 보조교차문맥도계획에전체인용·해시로포함된다.
3. 공통 gpt-5.6-luna/.env.local 설정과명시400,000자입력을따른다. 현재입력준비는 ${staticEvidence.results.map(r => `${r.set_id} ${r.semantic_preparation.request_chars.toLocaleString('en-US')}자`).join(', ')}다. 원문·동료문항을자르지않았으며최종은행합류후크기를다시확인한다.
4. [QA실행기](../../../analysis/reviews/delegated-authoring-2026-09-11/run-author-qa.ts)로172개를새폴더에서실측한다. 불일치는같은입력총3회확인하고원인수정후영향사례를재검증한다. 조건경계만not_met/contradicted의0점동등을허용하고누락·반대는판정명까지대조한다.
5. 복합입력검토의가정/자료누락, 조치가함축한판단, 영향설명이함축한고유위험요소, 비공식기업위험평가절차, 조회기준잔액과발송시점구별,500.A61관련통제테스트경로를집중확인한다.

[관계제안](coverage-proposal.json)11개는모두needs_review다. 작성자QA와정적검사는모델실측이아니며이전실패·준비기록을삭제하지않는다.
`);
const freqRows = frequency.map(f => `| ${f.id} | ${f.target} | ${f.exam_frequency} (${f.exam_years.join(', ')}) | ${f.mock_frequency} | ${f.general_practice_occurrence_count} | ${f.ox_occurrence_count} |`).join('\n');
const sourceRows = read(`${folder}/source-registration-map.json`).sources.map(s => `| ${s.key} | ${s.id} | ${s.locator} |`).join('\n');
write('scope-and-sources.md', `# S02 요구·근거·빈도·판본

[배정서](../../../../docs/plans/question-authoring-by-topic-2026-09-11/assignments/S02-증거평가-위험수정-감사계획-조정.md), [주제08](../../../../docs/plans/question-authoring-by-topic-2026-09-11/topics/08-감사증거와-경영진주장-출제-계획.md), [주제06](../../../../docs/plans/question-authoring-by-topic-2026-09-11/topics/06-위험평가와-내부통제-이해-출제-계획.md), [주제07](../../../../docs/plans/question-authoring-by-topic-2026-09-11/topics/주제07-평가위험-대응-통제테스트-실증절차.md)의C세트를작성했다. [wiki08](../../../wiki/question-generation/topics/topic-08-design.md)·[wiki06](../../../wiki/question-generation/topics/topic-06-design.md)·[wiki07](../../../wiki/question-generation/topics/topic-07-design.md)의조건·필수예외·기존요구를공식전문과대조했다.

## 구체화한 요구

- T08-C/pilot-08-008: sub1 crit1은 해당산업의적격성·상황에맞는역량, crit2는보수약정의객관성평가다. sub2 crit3은업무의성격·범위·목적과전문영역이해, crit4는발견사항·결론의관련성·합리성·다른증거일관성·재무제표반영, crit5는유의적가정·방법과회사원천자료/외부시장자료의구분검토다. 셋째영역에자료별검토특성을발문으로명시하여숨은요건을피했다. sub3 crit6~7은불일치해결을위한절차변경/추가필요성결정과다른감사측면의영향이다. 자료불일치만으로자료의우열이나의견을확정하지않는다.
- T06-C/pilot-06-008: sub1 crit1~3은기업절차에서식별할것으로기대한종류인지판단→그렇다면실패이유이해→기업절차적합성평가의시사점이다. 최초목록누락후실제미식별을추가확인했다는사실을두되기업에절차가없다고단정하지않았다. sub2 crit4~6은기술환경의변화,관측자료로만정보를작성할수없는불확실성,발생가능성과규모의사례상영향이다. 두요소를식별할대상을발문에서한정하고고유위험요소전체나구판의최소두고려사항을가져오지않았다. sub3 crit7~8은위험평가수정과그에맞는추가감사절차수정이며각각315.37/330.6에직접연결한다.
- T07-C/pilot-07-008: sub1 crit1~3은실제인수증거·검사대상기간조정·종전범위가놓치는이유다. sub2 crit4~6은기말에가까운기준잔액의조회·관련조회범위확대·당초통제의존근거약화에따른설득력요구다. 실제조회발송일을기준잔액일과혼동하지않는다. sub3 crit7~8은검증생략계획판단·정확성완전성증거다. 정밀도·상세도는이미확인한사실로주어새점수로요구하지않았다. 관련통제테스트로동등한정보품질증거를얻는방법도허용했다.

총23criterion각1점,모두작성·순서무관·개수상한없음·overflow none이며소수partial은없다.발문·조건·예외·정답명제·정수점수·공식quote/span은각version1계획과source-bindings에대응시켰다.

## 빈도·원출제·기존요구

| 요소 ID | 관계 | 기출(연도) | 모의 | 일반연습 | OX |
|---|---|---:|---:|---:|---:|
${freqRows}

[실제요소·원발문·현재은행증거](evidence/phase1/frequency-and-prior-evidence.json)는통합JSON을읽어작성했다. 기출·모의·일반연습·OX를합산하지않으며재수록만제외한다.2016:5:3의세요소는한원물음의서로다른요구다.0회/미연결을미출제확정으로보지않는다.

대표원문은기출해설A의2015:5:2 527~528쪽(src-21232c45234c79c5db/src-989e2cf6d0605e3947),2017:3:4 427쪽(src-136c133b38f8844f95),2025:2:2 20쪽(src-d733ef2ddd5495adbb),2016:5:3 483~485쪽(src-ae8c8559961f195cac/src-0cb6cd248647c5539b/src-ab6d6e111370d7d7aa),2024:7:3 106쪽(src-f3304ffcc0063092e3)이다.기업생성정보대표는2021:7:1 253쪽(src-f3906bccdb6c4ec743)이며2022:4:1/2024:8:1도서로다른기출로보존한다.2017수록의기출변형표시를공식시험무변형원문으로바꾸지않는다.

2015의527쪽대화는감사담당자의전문성부족과경영진측전문가의관련산업경험을함께묻는다. 새T08-C는경영진측전문가의평가범위로한정했고그빈도를개별새명제의직접빈도로확대하지않았다.527쪽카탈로그는현재08로연결되지않지만필수공통지문이라수동계보와계획에서보존했다.자동packet조사에서만제외표시했다.

기존08-002/sub1/crit1~3·sub2/crit4~5와T08-C는동일기준범주의심화·복습이다.06-003/sub1/crit1~3은기업절차이해이며T06-C-Q1은실패후후속평가다.06-004/sub2/crit3~4의가능성·규모와06-005/sub1/crit1~2의영향고려는T06-C-Q2에서사례적용한다.07-005/sub2/crit3의위험→설득력은T07-C-Q2의조회계획으로적용했다.

N02 T08-B-Q3/pilot-08-007/sub3/crit6~8 ↔ 본T07-C-Q1/pilot-07-008/sub1/crit1~3, N02 T08-A-Q1/pilot-08-006/sub1/crit1~2 ↔ 본T07-C-Q3/pilot-07-008/sub3/crit7~8의의도된복습을명시한다.후자의판단1점은상황적용이며품질특성이신규요구로늘어난것이아니다.조회조정은S04표본규모요소와구별하며특정표본수계산은제외한다. [관계제안](coverage-proposal.json)은이구별을보존한다.

## 공식근거와 판본

[공통판본정책](../../../analysis/reviews/delegated-authoring-2026-09-11/edition-policy.md)의2027목표·2026개시사례를따른다. 특정2027시험최종판본공고가확인되었다고주장하지않는다. [공식2025전문배포URL](https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06)의기존PDF SHA256은 b6b3a965c25cdb5bfdc0bf54838ae1bcc642581eef2d2d9e306a67ac811b0989다. 이번은보관공식바이트재검증이며새웹다운로드로표시하지않는다.

[추가공식등록제안](source-registration-proposal.json)의315 12쪽·330 4쪽은독립pypdf추출16/16쪽이보관전사와공백제외일치했다. 총괄이 [315추가문맥](../../../data/official/delegated-s02-kga315-2025.txt)51단위, [330추가문맥](../../../data/official/delegated-s02-kga330-2025.txt)19단위로등록했다. [보론2별도제안](source-registration-proposal-appendix2.json)은269~270쪽2항끝까지정의전체를보존했으며독립추출2/2쪽일치, [등록본](../../../data/official/delegated-s02-kga315-appendix2-2025.txt)은표제와1·2항의3단위다. 문단12(f)의정의와보론2.2변화·불확실성을직접연결했다.

[82문단양판본대조](evidence/phase1/edition-comparison.json)는80문단이공백·머리말제외동일이고,500.5인접각주315제목과500.A45인접각주705제목만다르며직접요구는같다. [보론2.1/.2](evidence/phase1/edition-appendix2.json)도동일하다.500.A52/.A53의품질관리예시는양판본동일했고620품질관리체계평가를본물음의새요구로옮기지않았다. [추가교차문맥10문단](evidence/phase1/supplementary-cross-context.json)도양판본동일이다.

조회시기조정의직접적용자료는330.A11,조회범위는A15/.A19다.계획에언급된A12는기중절차의장점을설명하므로기말근접이유의직접문단으로잘못사용하지않았다. 기간귀속인도조건은사례가명시한조건이며330.6/.A9/.A13의위험에맞는절차설계에적용했다.새회계·무역법판단을만들지않았다.

| 공식 문단 키 | 실제 source ID | locator |
|---|---|---|
${sourceRows}

[출처장부](source-registration-map.json)와각source-bindings에실제파일·정확quote/span·인용해시·파일해시를보존했다. 학습자료ID와공식문단ID는구별한다.500은08뿐아니라07의자료품질복습에직접연결되도록총괄이공통계약을반영했고실제후보로검증했다.

## 자동패킷 한계·모델입력·QA

[자동의존조사](evidence/phase1/packet-context-investigation.json)는원인조사전용1,200,000자예산에서 ${investigation.results.map(r => `${r.set_id} ${r.charCount.toLocaleString('en-US')}자/미해결${r.unresolved.length}`).join(', ')}를반환했다. 최초400k초과및원페이지분류실패를보존하며이를완전한생성packet으로표시하지않는다.1.2m는자동조사용이고실제모델입력상한400k를바꾸지않는다.

[수동문맥검토](evidence/phase1/manual-context-review.json)는직접교차참조를실제각주와대조했다.315.A62/.A86와240의관련문맥,620.7·230.11,330.A9가가리키는315.31/.34는계획에정확인용·파일·해시로포함하여모델입력에서누락되지않게했다.이것이전체연쇄자동의존을complete로만든다는뜻은아니다.수동작성의등록공식refs+계획경로를사용하고generation marker를제거한적도없다.

QA172개는모든23criterion의독립동의표현·의미누락·반대·조건경계와각9물음의완전답안·빈답안·역순·한문장복수명제·무관문장뒤정답·중복/여분정답을포함한다. 가정만또는자료만검토한답,함축된판단·요소,비공식위험평가절차,조회수량비계산,관련통제테스트대안도별도준비했다. 기대값은작성자판정이며실제모델채점0회다.최종은행고정뒤불일치를확인·수정·재채점해야한다.
`);
console.log(JSON.stringify({ stage: manifest.stage, sets: manifest.total_sets, questions: manifest.total_questions, points: manifest.total_points, qa: manifest.total_qa_cases, coverage_entries: entries.length }, null, 2));
