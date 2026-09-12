import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/n03';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const hash = x => createHash('sha256').update(x).digest('hex');
const write = (f, value) => fs.writeFileSync(`${folder}/${f}`, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const manifest = read(`${folder}/draft-manifest.json`), qa = read(`${folder}/qa-manifest.json`);
const latest = read(`${folder}/evidence/phase1/latest-static.json`), evidence = read(latest.file);
if (evidence.results.some(r => r.structural.errors.length || r.plan_errors.length || r.source_errors.length || r.qa_errors.length || !r.semantic_preparation.success) || evidence.in_memory_bank.errors.length || evidence.conflicts.length) throw new Error('정적 오류가 남아 있음');
for (const s of manifest.sets) if (evidence.results.find(r => r.set_id === s.set_id)?.sha256 !== hash(fs.readFileSync(s.file))) throw new Error('정적 증거 이후 파일 변경');
const catalog = buildSourceCatalog();
const elementsFile = 'cpa_uploader/analysis/question-elements/question-elements.json';
const elements = read(elementsFile);
const choices = [
  ['element-edc1f6b71281768e', 'T07-A-Q1 adjacent; Q2 direct', '원공통지문의 유의적 위험·통제의존을 복원하여 일반 재사용 주기의 직접 빈도에서 제외'],
  ['element-c9dfa1eadd596205', 'T07-A-Q2 direct', '유의적 위험의 당기 통제테스트'],
  ['element-bbbd311ee3f504ad', 'T07-A-Q3 partial', '원선택3개에서 A34 전체6개로 확장'],
  ['element-155f4440175b820d', 'T07-B-Q1 direct', '원발문의 세부테스트 표현은 공식 기준상 실증절차로 대조'],
  ['element-db271df4ab09aa40', 'T07-B-Q1 direct; Q2 adjacent', '효과적인 통제만으로 실증절차 생략 불가; 결산 두 절차는 별도 공식 요구'],
  ['element-673cef00049bd81c', 'T05-B-Q1 direct', '주된 책임 판단과 합리적 확신 책임을 비교'],
  ['fraud.management-detection-risk', 'T05-B-Q2 direct', '경영진 부정과 종업원 부정의 미발견위험과 이유'],
  ['fraud.override-unconditional', 'T05-B-Q3 direct', '위험평가와 무관한 무력화 대응 의무 및 이유'],
];
const frequency = choices.map(([id, target, note]) => {
  const e = elements.elements.find(e => e.id === id);
  const records = e.occurrence_ids.map(id => elements.occurrences.find(o => o.id === id)).map(o => elements.records.find(r => r.id === o.record_id));
  const ox = records.filter(r => r.id.startsWith('ox-') || r.source.file.includes('OX_200'));
  return { id, target, note, label: e.label, exam_frequency: e.exam_frequency, exam_years: e.exam_years, exam_questions: e.exam_questions,
    mock_frequency: e.mock_frequency, practice_occurrence_count_including_ox: e.practice_occurrences.length,
    general_practice_occurrence_count: e.practice_occurrences.filter(id => !ox.some(r => r.id === id)).length, ox_occurrence_count: ox.length,
    actual_records: records.map(r => ({ id: r.id, origin: r.origin, source: r.source, source_unit_ids: r.source_unit_ids, source_role: r.source_role, text: r.text })) };
});
const bankFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const priorIds = ['pilot-07-001', 'pilot-07-002', 'pilot-07-004', 'pilot-05-002', 'pilot-05-006'];
write('evidence/phase1/frequency-and-prior-evidence.json', { checked_at: new Date().toISOString(), elements_file: elementsFile, elements_sha256: hash(fs.readFileSync(elementsFile)), policy: elements.policy, choices: frequency,
  bank_file: bankFile, bank_sha256: hash(fs.readFileSync(bankFile)), prior_sets: read(bankFile).filter(s => priorIds.includes(s.id)),
  n02_predecessor_manifest: 'cpa_uploader/drafts/delegated-authoring-2026-09-11/n02/draft-manifest.json',
  original_shared_context: catalog.units.filter(u => ['src-0e7ae72c569fb376df', 'src-dc4efc5926493cc52d'].includes(u.id)).map(({ id, file, locator, quote, contentHash }) => ({ id, file, locator, quote, content_hash: contentHash })),
  active_draft_comparison: { file: evidence.comparison_file, sha256: evidence.comparison_sha256, initial_sets: evidence.initial_sets, n02_additional_sets: evidence.n02_additional_sets, own_other_sets_per_review: 2, final: false },
  original_interpretation_correction: '2023:5:3은 공통지문의 유의적 위험·통제의존에 따라330.15를 직접 묻는다. 과거 계획의330.14 일반 재사용 직접 빈도 해석은 유지하지 않는다. 2023/2024 서로 다른 실제 출제는 모두 보존하되 두 요소의 의미상 통합은 총괄 수동 검토 대상으로 남긴다.' });
const investigation = read(`${folder}/evidence/phase1/packet-context-investigation.json`);
write('evidence/phase1/manual-context-review.json', { checked_at: new Date().toISOString(), final_packet: false,
  investigation_file: `${folder}/evidence/phase1/packet-context-investigation.json`,
  results: investigation.results.map(r => ({ set_id: r.set_id, completeness: r.completeness, chars: r.charCount, unresolved_count: r.unresolved.length, direct_unresolved: r.direct_unresolved,
    assessment: r.set_id === 'pilot-07-006' ? '직접 공식refs의 unresolved는0개다. 원기출 페이지147은 실제 topic07 의미이나 자동 카탈로그의 페이지 주제 연결이 없어 원래400k 조사에 실패했다. 1m 후속조사에서만 이를 명시적으로 제외했고 원계획·계보·관계제안에서는 보존한다.'
      : r.set_id === 'pilot-07-007' ? '330.A43 각주7은315.36이며 공식 기등록본과2025/2026 전문을 대조하고 전체 인용·파일해시를 plan.scope.exceptions에 넣어 모델입력에 포함했다.330.6에 붙은315 일반참조는 같은 쪽의 각주1(기준서 제목)이며 새 답안 요건이 아니다.'
        : '240.5에 붙은315/330 일반참조는 같은 쪽의 각주1·2(도입부 기준서 제목)다.240.5 각주3→200.A53/A54,240.6 각주4→200.A53은 양 판본24쪽에서 직접 읽고 전체 인용·보관파일 해시를 plan.scope.exceptions에 포함했다.',
    policy: '연쇄 의존 전체를 complete라고 하지 않는다. 수동 제작 plan+등록 공식refs 경로로 검수한다. 1m는 원인조사용 예산이며 모델 입력 상한400k를 변경하지 않는다.' })),
  required_context: ['330.14(a)(b) 전체와A36~A40: 관련성·신뢰성, 질문+관찰또는검사, 변화 있는 경우, 매3회 최소1회, 매 감사 일부통제', '330.15: 유의적이라고 결정한 위험에 대응하고 의존하려는 통제의 당기 테스트', '330.12와A34 전체6요소: 중간기간 증거와 잔여기간 결정, 전기 재사용과 구별', '330.18/.A43 전체 두 상황 및 두 이유, A44 모든주장 요구 아님, A45 분석적절차/세부테스트 선택,330.20(a)(b) 원장밖공시와중요분개기타수정 포함', '240.3~.8 책임·미발견위험·법률판단 경계, .10~.11 목적·정의, .32~.34 위험평가와 무관한 대응 및 추가절차의 경계'],
  supplemental_evidence: [`${folder}/evidence/phase1/kga200-footnote-context.json`, `${folder}/evidence/phase1/kga315-cross-reference-context.json`],
  source_origin: '수동 작성이며 문항에 generation hash marker를 만든 적이 없고 제거하지도 않았다. 등록 source ID와 정확 quote/span은 별도 바인딩 장부에서 검증했다.' });
manifest.stage = 'draft_ready';
manifest.checked_at = new Date().toISOString();
manifest.latest_static = latest;
manifest.qa_manifest = `${folder}/qa-manifest.json`;
manifest.total_qa_cases = qa.total_cases;
manifest.manual_context_review = `${folder}/evidence/phase1/manual-context-review.json`;
manifest.coverage_proposal = `${folder}/coverage-proposal.json`;
manifest.final_automatic_packet = 'unresolved_investigation_not_supplied_to_review';
manifest.sets = manifest.sets.map(s => ({ ...s, qa_file: qa.sets.find(q => q.set_id === s.set_id).file, qa_sha256: qa.sets.find(q => q.set_id === s.set_id).sha256, qa_cases: qa.sets.find(q => q.set_id === s.set_id).cases }));
write('draft-manifest.json', manifest);
const rows = manifest.sets.map(s => `| ${s.plan_id} | [${s.set_id}](${s.set_id}.json) | ${s.questions} | ${s.points} | [계획](${s.set_id}.authoring-plan.json) | [QA ${s.qa_cases}개](qa-cases-${s.plan_id.toLowerCase()}.json) |`).join('\n');
write('README.md', `# N03 1차 제작 인계

**draft_ready: 3세트·8물음·23점, 작성자 QA 156개.** 문항 형상·공식 인용·version1 계획·정수 배점·QA 형상·현행 은행 메모리 검증·초기 활성111세트 및 선행N02 4세트와의 ID/발문 충돌 검사가 통과했다. 독립 모델 의미검수와 실제 모델 채점은 미실행이다. 정본 편입·게시·배포도 하지 않았다.

| 계획 | 실제 문항 | 물음 | 점수 | 계획 | 작성자 QA |
|---|---|---:|---:|---|---|
${rows}

[고정 파일·해시](draft-manifest.json), [범위·근거·빈도](scope-and-sources.md), [인계와 재개 조건](handoff.md), [최신 정적증거](evidence/phase1/latest-static.json), [관계제안](coverage-proposal.json)을 함께 본다. 각 문항 파일은1세트 배열이며 중복 합본을 만들지 않았다. [수동 입력](content.mjs)과 [전용 생성기](build-n03.mjs)는N03 폴더만 쓴다. 원자료·기존 초안·과거receipt를 수정하지 않았다.

2027년 CPA 시험 목표와2026년1월1일 개시 사례를 사용한다. 최종 시험 기준서 판본의 공고를 확인했다고 주장하지 않는다. 공식2025/2026 전문 대조, A43 다음 쪽의 두 이유, 교차참조 각주와 전체목록 확인은 근거 장부에 남겼다.

자동 source packet은 원페이지 분류와 연쇄참조 예산·미해결 문제를 가진 조사물이다. [자동 의존 조사](evidence/phase1/packet-context-investigation.json)와 [수동 문맥검토](evidence/phase1/manual-context-review.json)를 보존하며 complete packet으로 표시하거나 검수CLI에 전달하지 않는다. 수동 plan과 실제 등록공식 source_refs로 검수한다.

정적 확인 명령은 'node --import tsx cpa_uploader/drafts/delegated-authoring-2026-09-11/n03/audit-phase1.ts'다. 의미검수 입력 준비는 명시400,000자로 수행했으며 실제 모델 호출은 총괄의 최종 비교 은행·출처 고정 후 진행한다.
`);
write('handoff.md', `# N03 인계

현재 단계는 draft_ready이며 제작 완료가 아니다. 모두 needs_review / needs_human_review 상태를 유지한다.

| 계획 ID / 실제 ID | 출처·판본 | 초안 버전·해시 | 정적검사 | 의미검수 | 실제 채점 사례 수·불일치 | 남은 일 | 증거 경로 |
|---|---|---|---|---|---|---|---|
${manifest.sets.map(s => `| ${s.plan_id} / ${s.set_id} | 공식2025 + 2026 관련문단 대조 | SHA256 ${s.sha256} | 통과 | 미실행 | 0회 / 미확인; 작성자QA ${s.qa_cases}개 | 고정은행 모델검수·QA·불일치수정 | [문항](${s.set_id}.json), [계획](${s.set_id}.authoring-plan.json), [QA](qa-cases-${s.plan_id.toLowerCase()}.json) |`).join('\n')}

## 선행·후속 경계

- N02: 통제의 이해·설계·실행 확인은 기간 운영효과성 증거와 구별된다. 여기서는330.14 전기 증거,330.15 유의적 위험의 당기 테스트,330.A34 당기 중간기간 이후 추가증거를 분리했다.330.8 수행 의무의 두 조건은 기존07-002/004가 이미 다뤄 새 배정 점수에 재열거하지 않았고 필수 적용 문맥으로 보존했다.
- S02: T07-C-Q1은 N02 T08-B-Q3의 기간귀속·배송기간 적용복습, T07-C-Q3은 T08-A의 기업생성정보 품질 적용복습이다. 새 커버리지로 세지 않는다. N03의 A34는 잔여기간 추가증거 결정요소이며 기간귀속 대상기간 조정이나 표본수 산정과 다르다.
- S04: 효과적 통제도 중요한 항목의 실증절차를 모두 면제하지 않는다.330.A44는 모든 주장에 대한 테스트를 요구하지 않으며 A45는 실증적 분석절차만/세부테스트만/둘의 조합을 허용한다. 유의적 위험에서 실증절차만으로 대응할 때 세부테스트 포함은 기존07-001의 범위다.
- R02: 본 T05-B는 부정 책임과 무력화 위험·대응 원칙이다.260의 지배기구 커뮤니케이션 목록은 R02에 남긴다. 기존05-002/006의 부정분개·추정편의·비경상거래 세부절차 목록을 숨은 점수로 넣지 않았다.

2023:5:3 원공통지문에서 유의적 위험을 확인해 T07-A-Q1의 직접 빈도 해석을 정정했다. 상세 계획 원본과 공통 분석 입력은 수정하지 않았다. [관계제안](coverage-proposal.json)10개는 모두 needs_review이며 총괄이 승인·snapshot·공통links를 담당한다. 별도 승인에 따라 선행 [N02 관계제안](../n02/coverage-proposal.json)12개와 [R02 관계제안](../r02/coverage-proposal.json)3개만 추가했으며 그 문항/계획/QA는 바꾸지 않았다.

## 최종 검증 재개

1. 최종 catalog와 활성 비교 은행·해시를 받는다. 현재 준비 비교는111개 + N02 4개 + 다른N03 2개다. 전체49개 최종 중복 의미검수는 아직 하지 않았다.
2. [검수 래퍼](../../../analysis/reviews/delegated-authoring-2026-09-11/run-review.ts)에 실제 '--file', '--plan', 최종 '--bank'를 지정한다. 자동 조사물을 '--packet'으로 전달하지 않는다. 필요한200.A53/A54·315.36 외부 문맥의 정확 인용과 해시도 계획에 실려 모델입력으로 전달된다.
3. 공통 runtime 설정의 gpt-5.6-luna, .env.local 로딩을 따른다. 현재 수동 검수입력은 ${evidence.results.map(r => `${r.set_id} ${r.semantic_preparation.request_chars.toLocaleString('en-US')}자`).join(', ')}로 구성되었다. 명시400,000자이며 원문이나 동료를 잘라내지 않았다.
4. [공통 QA 실행기](../../../analysis/reviews/delegated-authoring-2026-09-11/run-author-qa.ts)로156개 전부 새 실행 폴더에서 실측한다. 누락·반대는 판정명까지 비교하고 조건경계만 not_met/contradicted의0점 동등 정책을 적용한다. 불일치는 같은입력 총3회 및 원인수정 후 영향사례 재채점이 필요하다.
5. 조치가 함축한 판단, A34 여섯 요소의 명칭만 답한 충분한 답안, '3년의감사'를3회감사로 정확히 설명한 표현, 기록조작 대신 통제무력화를 제시한 동등 이유, 실증절차 선택 대안을 집중 확인한다. 지문에서 얻은 사실 복사나 부정의 발생확률을 감사인의 미발견위험으로 오인한 답은 구별한다.

작성자 기대값은 실제 결과가 아니다. 현행 코드와 최종 입력 해시가 바뀌면 재사용 가능성을 다시 판단한다. 이전의155개 정적 검사와 후속156개 증거를 모두 보존했다.
`);
const freqRows = frequency.map(f => `| ${f.id} | ${f.target} | ${f.exam_frequency} (${f.exam_years.join(', ')}) | ${f.mock_frequency} | ${f.general_practice_occurrence_count} | ${f.ox_occurrence_count} |`).join('\n');
const sourceRows = read(`${folder}/source-registration-map.json`).sources.map(s => `| ${s.key} | ${s.id} | ${s.locator} |`).join('\n');
write('scope-and-sources.md', `# N03 요구·근거·빈도·경계

[배정서](../../../../docs/plans/question-authoring-by-topic-2026-09-11/assignments/N03-통제증거-실증절차-부정책임.md), [주제07 계획](../../../../docs/plans/question-authoring-by-topic-2026-09-11/topics/주제07-평가위험-대응-통제테스트-실증절차.md), [주제05 계획](../../../../docs/plans/question-authoring-by-topic-2026-09-11/topics/주제05-부정-법규-지배기구-커뮤니케이션.md)을 실제 발문·원문과 대조했다. [wiki07](../../../wiki/question-generation/topics/topic-07-design.md), [wiki05](../../../wiki/question-generation/topics/topic-05-design.md)의 개념·요소·원출제·현재은행을 따라 설계했다. 실제 원발문과 현재 기출·모의·연습·OX 분리는 [빈도 및 기존 요구 증거](evidence/phase1/frequency-and-prior-evidence.json)에 보존했다.

## 발문·명제·배점의 확정 범위

- T07-A/pilot-07-006: sub1 crit1~4는 계속적 관련성·신뢰성 확인 목적과 질문+관찰또는검사, 변화 시 당기 테스트, 변화가 없어도 최소 매3회 감사1회, 매 감사 일부통제다. 비유의적 위험의 독립상황A에서 답하게 하며 지문은 질문만 했다는 사실을 준다. 변화가 없음을 이미 충분히 검증해놓고 그 사실을 재득점하지 않는다. sub2 crit5~6은 별도 상황B의 전기 결과만으로 불충분 및 당기 테스트다. 답의 조치가 판단을 함축하면 인정한다. sub3 crit7~12는 상황C에서 A34의 관련요소 전체6개다. 원기출의 임의3개 제한을 제거했고 정의·증감방향을 숨은 요구로 더하지 않았다.
- T07-B/pilot-07-007: sub1 crit1~3은 중요한 각 거래유형·잔액·공시의 실증절차, 위험평가 판단의 한계, 내부통제 고유한계다. 두 이유는330.A43의 다음 쪽까지 이어진 본문에 있다. 모든 주장에 대한 테스트나 두 실증절차 유형의 동시 수행은 요구하지 않는다. 지문의 종결 분석은 실증적 분석절차로 설계하지 않았음을 명시해 대체 가능한 절차의 오해를 막았다. sub2 crit4~5는 재무제표와 기초기록의 대사·조정(원장 안팎 공시 포함), 중요한 결산분개 및 기타 수정사항 조사다.
- T05-B/pilot-05-009: sub1 crit1~2는 경영진·지배기구의 주된 책임과 감사인의 재무제표 전체에 대한 중요왜곡표시 부재의 합리적 확신 책임이다. sub2 crit3~4는 경영진 부정의 높은 미발견위험 및 기록·제공정보 조작 또는 정상통제 무력화가 가능한 지위의 이유다. '또는'을 발문에 넣어 동등한 이유를 허용했고 직급이 높다는 사실만으로 이유 점수를 주지 않는다. sub3 crit5~6은 평가와 무관한 대응절차 수행, 예측불가능성에 따른 부정 중요왜곡표시의 유의적 위험이다. 모든 세부절차 열거를 추가하지 않았다.

총3세트·8물음·23criterion이며 각1점이다. 모두 작성·순서무관·개수상한없음·overflow none이다. 소수 partial은 없다. 주체·시점·조건·예외·제외범위와 명제/요구/source의 실제 대응은 세트별 version1 계획과 *.source-bindings.json에 있다.

## 실제 빈도와 해석

| 요소 ID | 새 물음 관계 | 기출(연도) | 모의 | 일반연습 | OX |
|---|---|---:|---:|---:|---:|
${freqRows}

원출제별 실제 횟수와 재수록을 구별한다. fraud.management-detection-risk의 원JSON practice_occurrences에는 OX109 한 건이 들어 있어 일반연습0·OX1로 분리했다. 이를 일반연습1+OX1로 중복 가산하지 않는다. 나머지 선정요소는 일반연습·OX가0이다. 미연결·0회는 미출제 확정이 아니다.

대표 출처는 기출문제_연도별_해설_A의2023:5:3 148쪽(src-dc4efc5926493cc52d), 공통지문·2023:5:2 147쪽(src-0e7ae72c569fb376df),2024:7:3 106쪽(src-f3304ffcc0063092e3),2015:4:5 523쪽(src-855fae5999ef280f1d),2020:6:1 292쪽(src-0cb71a127a3e580f7e),2024:5:1 94쪽(src-16f0eeb4dcd6484206),2019:2:4 326쪽(src-aedf50f2dc438d3dfc),2014:6:1 574쪽(src-48d918076083b19b13)이다. OX109는61쪽(src-e4c6a8847fcd517da2)이다. 실제 파일·행·재수록·전체 원발문은 증거JSON에서 확인한다.

계획의 2023:5:3 해석은 공통지문 확인 후 정정했다. 원문은 이미 유의적 위험과 통제의존을 전제하므로 일반 전기증거 재사용의330.14 전체를 직접 물었다고 할 수 없다. 새 Q1에는 adjacent, Q2의330.15에는 direct다. 원문에 최소3회 주기·변경없음 확인이 지문으로 주어졌다는 사실도 구별한다.2023·2024는 서로 다른 출제이므로 각각 보존하지만 두 요소의 의미상 정규화 여부는 수동 검토 대상으로 남긴다. Q3는 원기출3개 선택에서6개 전부로 확장된 partial이다.2015 원발문의 '세부테스트'를 공식330.18/.A45의 일반 실증절차 의무로 대조하여 옛 표현을 무조건적인 세부테스트 의무로 재생산하지 않았다.

## 기존 요구와 새 가치

pilot-07-002/sub2/crit3·crit4는 중간기간 이후 변화 증거 입수와 추가증거 결정이라는 조치이며 T07-A-Q3는 결정요소6개로 심화한다. pilot-07-002/sub1/crit1·crit2 및07-004/sub1/crit1·crit2의 통제테스트 의무 두 조건은 새로 반복하지 않는다. pilot-07-004/sub2/crit3의 높은 의존→설득력 높은 증거와 A34의 의존정도 고려는 관련되지만 같은 발문이 아니다.

pilot-07-001/subq1/crit1·crit2의 유의적 위험 대응 실증절차 및 실증만의 접근에서 세부테스트 포함, subq2/crit3의 이중목적테스트는 본 실증절차 최소원칙과 구별한다. pilot-05-002/sub1/crit1~3의 분개선정 세 절차, sub2/crit4~6의 추정편의·소급검토, pilot-05-006/sub2/crit2·crit3의 비경상거래 근거는 T05-B에서 다시 열거하지 않는다. 부정의 주된 책임·미발견위험·무조건 대응 이유가 본 세트의 적용가치다.

N02의 통제 설계·실행 확인은 본 운영효과성 재사용과 별개다. S02 T07-C-Q1/Q3은 선행N02의 기간귀속·자료품질 적용복습이며 새 커버리지로 세지 않는다. 통제 잔여기간 증거, 배송기간에 따른 기간귀속 대상, 표본규모 결정도 서로 구별한다.

## 공식 판본·출처·의존 문맥

[공통 판본정책](../../../analysis/reviews/delegated-authoring-2026-09-11/edition-policy.md)에 따라2027 시험을 목표로2026년1월1일 개시 사례를 쓴다. 출제비중 공고는 최종 기준서 판본의 확정이 아니다. [공식2025 전문 배포 URL](https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06)의 기존 보관 PDF SHA256은 b6b3a965c25cdb5bfdc0bf54838ae1bcc642581eef2d2d9e306a67ac811b0989다. 이번에는 보관 공식바이트를 재검증했으며 새 다운로드로 표시하지 않는다.

[최초 발췌 제안](source-registration-proposal.json)을 보존하고 [후속 제안](source-registration-proposal-v2.json)에서240의 목차82쪽을 등록본문에서 제외했다. 목차의 보론 제목 때문에 본문이 보론으로 오인되는 문제를 피했으며 원문의 기준서 전체 읽기 문맥은 직접·관련 요구와 함께 검토했다. 독립 pypdf 추출과 보관 PyMuPDF 전사를 최초18쪽 모두 대조했고, 후속 등록선택은240 6쪽과330 11쪽의17쪽이다.

총괄 등록본 [240](../../../data/official/delegated-n03-kga240-2025.txt)25단위와 [330](../../../data/official/delegated-n03-kga330-2025.txt)48단위에서 실제 문단·ID를 선택했다. 이전330 발췌의A43는 다음 쪽 두 이유까지 이어지지 않았으므로 그 파일을 그대로 근거 삼지 않았다. 새A43는328~329쪽 전체 두 상황과 두 이유를 포함한다. A44는 모든 주장 테스트가 아님, A45는 실증절차 유형의 대안이며 두 이유의 문단 번호와 혼동하지 않는다.

[38개 문단의 양 판본 대조](evidence/phase1/edition-comparison.json)에서37개는 공백·머리말 제외 동일이고240.5는 인접 각주1의315 제목만 달라 직접 책임 요구는 같다.330.14(b)는 '매3회의감사'이며 A38의 인쇄된 '매3년의감사'는 원문에서 고치지 않았다. 답안은 감사횟수 기준으로 명시한다. [200.A53/A54 문맥](evidence/phase1/kga200-footnote-context.json)은 양 판본24쪽, [315.36 문맥](evidence/phase1/kga315-cross-reference-context.json)은2025 204쪽/2026 229쪽에서 확인했다. 둘 다 별도 득점요건은 아니고 정확 인용·파일해시를 계획에 포함해 모델입력에서 누락되지 않도록 했다.

| 공식 문단 키 | 실제 source ID | locator |
|---|---|---|
${sourceRows}

각 source_refs의 정확 인용·span과 파일/인용해시는 [현재 출처 장부](source-registration-map.json), 세트별 source-bindings에 있다. 학습자료 ID를 공식 인용 ID로 대신하지 않는다.200의 보조 문맥에는 존재하지 않는 등록ID를 만들지 않았다.

## 자동 패킷 한계와 검증

[자동 조사](evidence/phase1/packet-context-investigation.json)는 원인조사 전용1,000,000자에서 ${investigation.results.map(r => `${r.set_id} ${r.charCount.toLocaleString('en-US')}자·미해결${r.unresolved.length}개`).join(', ')}를 반환했다. 이 예산은 실제 모델 입력의400,000자 한도를 바꾸지 않는다.07A의 카탈로그 주제 미연결 원페이지는 조사에서만 명시적으로 제외하고 원계획·계보·관계 장부에 유지했다. 초기400k 오류도 보존한다. 직접 교차참조는 실제 각주로 좁혀 수동 검토했지만 넓은 연쇄의 자동 complete를 주장하지 않는다.

[수동 문맥검토](evidence/phase1/manual-context-review.json)와 실제 등록refs·계획으로 의미검수를 진행할 수 있다. 문항은 처음부터 수동 작성이며 생성 marker 제거로 검증을 우회한 것이 아니다. 최종 카탈로그·동료 은행이 달라지면 해시와 입력크기를 다시 검증한다.

QA156개는 모든23criterion의 독립 동의표현·누락·명시반대·조건경계, 각 물음의 만점답안·빈답안·역순·한문장복수명제·무관문장뒤정답·중복/여분정답을 포함한다. 함축판단과 동등한 통제무력화 이유, A34명칭만 전부 답한 표현, 허용 실증절차 대안도 별도 확인한다. 실제 모델 의미검수·채점은 아직0회이며 최종freeze 이후 실행하고 불일치를 고친 뒤 재검증해야 한다.
`);
console.log(JSON.stringify({ stage: manifest.stage, sets: manifest.total_sets, questions: manifest.total_questions, points: manifest.total_points, qa: manifest.total_qa_cases, latest_static: latest.file }, null, 2));
