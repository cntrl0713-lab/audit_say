import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
import { definitions } from './content.mjs';
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s04';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const hash = x => createHash('sha256').update(x).digest('hex');
const write = (f, value) => fs.writeFileSync(`${folder}/${f}`, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const manifest = read(`${folder}/draft-manifest.json`), qa = read(`${folder}/qa-manifest.json`);
const latest = read(`${folder}/evidence/phase1/latest-static.json`), staticEvidence = read(latest.file);
if (staticEvidence.results.some(r => r.structural.errors.length || r.plan_errors.length || r.source_errors.length || r.qa_errors.length || !r.semantic_preparation.success) || staticEvidence.in_memory_bank.errors.length || staticEvidence.conflicts.length) throw new Error('정적 오류가 남아 있음');
for (const s of manifest.sets) {
  if (staticEvidence.results.find(r => r.set_id === s.set_id)?.sha256 !== hash(fs.readFileSync(s.file)) || s.plan_sha256 !== hash(fs.readFileSync(s.plan)) || s.qa_sha256 !== hash(fs.readFileSync(s.qa_file))) throw new Error('정적 증거 이후 입력 변경');
}
const catalog = buildSourceCatalog(), elementsFile = 'cpa_uploader/analysis/question-elements/question-elements.json', elements = read(elementsFile);
const effect = elements.elements.find(e => e.label === '실증절차 표본위험이 감사의 효과성·효율성에 미치는 영향');
if (!effect) throw new Error('표본위험 영향 요소 없음');
const choices = [
  ['element-2c6e1b8c6a267d05', 'T10-B-Q1 direct', '위험방향의 두 유형. 원문은 같은 물음에서 효과성·효율성도 요구하며 그 별도 요소를Q2로 연결한다.'],
  [effect.id, 'T10-B-Q2 direct', '원문2016:4:1의 별도 영향 요소. 유형 요소와 같은 원물음으로 별도 출제횟수처럼 합산하지 않는다.'],
  ['element-24d739f43bb8cea3', 'T10-B-Q2 A방향 이유 direct', '2016:4:2의 중점통제 이유이며제1종/제2종 번호암기범위는제외'],
  ['element-a13874afd10e5507', 'T10-B-Q3 direct', '2022:4:4의 두 후속경로.앞물음계산완료를새계산문제로되살리지않음'],
  ['element-b78c63e8421dabdb', 'T10-C-Q1 필수 두단계 direct', '실증단계의 선택가능성은 추가 비교 명제'],
  ['element-8fdd1474a3b4749b', 'T10-C-Q2 partial', '원문은기대치정확성평가및수용차이결정이이미수행된사례다.새사례는각절차를미수행으로명시해4점판단형으로확장'],
  ['element-33a11840f60b28c5', 'T10-C-Q2 데이터검증 direct / Q3 adjacent', '자동산출자료를무검증수용한원요구와종합신뢰성고려를연결.차이조사증거두조치의직접빈도로사용하지않음'],
  ['element-37c1e6deb1177a55', 'T12-C-Q1 direct', '경영진조사·수정후감사인추가절차'],
  ['element-36434eeecd82dc04', 'T12-C-Q3 중요성재평가 direct', '실제재무결과관점의중요성적합성'],
  ['element-4f3a3411c985eebb', 'T12-C-Q3 partial', '과거기간영향은넓어진평가요구의일부'],
  ['element-fca298cf50eb814f', 'T12-D-Q1/Q2 adjacent', '일반미제공대응원요구.580.20특정조건의직접출제빈도아님'],
];
const frequency = choices.map(([id, target, note]) => {
  const e = elements.elements.find(e => e.id === id); if (!e) throw new Error(`요소 없음 ${id}`);
  const records = e.occurrence_ids.map(id => elements.occurrences.find(o => o.id === id)).map(o => elements.records.find(r => r.id === o.record_id));
  const ox = records.filter(r => r.id.startsWith('ox-') || r.source.file.includes('OX_200'));
  return { id, target, note, label: e.label, exam_frequency: e.exam_frequency, exam_years: e.exam_years, exam_questions: e.exam_questions, mock_frequency: e.mock_frequency,
    general_practice_occurrence_count: e.practice_occurrences.filter(id => !ox.some(r => r.id === id)).length, ox_occurrence_count: ox.length,
    unknown_origin_non_ox_records: records.filter(r => r.origin?.kind === 'unknown' && !ox.some(o => o.id === r.id)).length,
    actual_records: records.map(r => ({ id: r.id, origin: r.origin, source: r.source, source_unit_ids: r.source_unit_ids, source_role: r.source_role, text: r.text })) };
});
const bankFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
write('evidence/phase1/frequency-and-prior-evidence.json', { checked_at: new Date().toISOString(), elements_file: elementsFile, elements_sha256: hash(fs.readFileSync(elementsFile)), choices: frequency,
  bank_file: bankFile, bank_sha256: hash(fs.readFileSync(bankFile)), prior_sets: read(bankFile).filter(s => ['pilot-10-002', 'pilot-10-004', 'pilot-12-003', 'pilot-12-005', 'pilot-12-006', 'pilot-12-008'].includes(s.id)),
  predecessor_manifests: ['r01/lineage.json','n02/draft-manifest.json','n03/draft-manifest.json','s02/draft-manifest.json'].map(p => `cpa_uploader/drafts/delegated-authoring-2026-09-11/${p}`),
  original_shared_context: catalog.units.filter(u => definitions.some(d => [...d.originIds, ...(d.adjacentOriginIds || [])].includes(u.id))).map(({ id, file, locator, quote, contentHash, topicIds }) => ({ id, file, locator, quote, content_hash: contentHash, topic_ids: topicIds })),
  active_comparison: { initial: staticEvidence.comparison_file, initial_sha256: staticEvidence.comparison_sha256, initial_sets:111, r01_replaced:6, n02_added:4, n03_added:3, s02_added:3, peers_per_review:3, final:false } });
const defs = [
  ['element-2c6e1b8c6a267d05','pilot-10-006','sub1','direct',['src-44ac04ea66bb759abe'],null,'두위험방향을직접대응시킨다. 같은원물음의효과성·효율성은별도요소로연결하되원시험횟수를중복합산하지않는다.'],
  [effect.id,'pilot-10-006','sub2','direct',['src-44ac04ea66bb759abe'],null,'2016:4:1의영향요소이며같은원물음의유형과분리한학습요구다.'],
  ['element-24d739f43bb8cea3','pilot-10-006','sub2','direct',['src-44ac04ea66bb759abe'],['crit3'],'특히통제할A방향이부적합한의견에이를수있다는이유를연결한다. B영향의빈도로확장하지않는다.'],
  ['element-a13874afd10e5507','pilot-10-006','sub3','direct',['src-cc0493fc8e5ba68656'],null,'합리적근거불충분의후속두경로.원출제전제는유지하되계산요구제외.'],
  ['element-b78c63e8421dabdb','pilot-10-007','sub1','direct',['src-b3f69bc86cdd795272'],['crit1','crit2'],'필수두단계와목적.실증단계선택가능성crit3은새비교요구로이빈도의직접범위밖.'],
  ['element-8fdd1474a3b4749b','pilot-10-007','sub2','partial',['src-0cf2bba5cd0f5112d0'],null,'원문에이미수행된기대치정확성평가·수용차이결정을새사례에서는미완료로명시해확장.수정전원문을그대로재현했다고주장하지않는다.'],
  ['element-33a11840f60b28c5','pilot-10-007','sub2','direct',['src-cc73a67971790506af','src-ab954d3e39d630b9d0'],['crit4','crit5'],'회사자체산출자료의신뢰성무검증을지적하고보완하는직접요구.기대치정확성·수용차이로빈도를전용하지않는다.'],
  ['element-33a11840f60b28c5','pilot-10-007','sub3','adjacent',['src-cc73a67971790506af','src-ab954d3e39d630b9d0'],null,'분석절차사례의근접관계일뿐경영진설명후증거·필요한기타절차의직접빈도아님.기존10-002/sub2의의도된복습.'],
  ['element-37c1e6deb1177a55','pilot-12-009','sub1','direct',['src-c72d9326f560951508'],null,'경영진수정후감사인추가절차를판단하고잔존왜곡표시목적을설명한다.'],
  ['element-36434eeecd82dc04','pilot-12-009','sub3','direct',['src-c72d9326f560951508'],['crit5'],'2023:10:3의중요성재평가진술요구를관련criterion에만직접연결.'],
  ['element-4f3a3411c985eebb','pilot-12-009','sub3','partial',['src-c72d9326f560951508'],null,'과거기간미수정영향은평가전체의일부이며규모·성격·상황전체의직접빈도아님.위두요소와동일한2023:10:3.'],
  ['element-fca298cf50eb814f','pilot-12-010','sub1','adjacent',['src-a8854fb319759add8c','src-2195a214336716e50d'],null,'원문은580.19일반대응이고본물음은20특정의견거절조건의적용판단.'],
  ['element-fca298cf50eb814f','pilot-12-010','sub2','adjacent',['src-a8854fb319759add8c','src-2195a214336716e50d'],null,'책임진술두영역과20두조건은공식원문신규제작. sub1과조건반복은의도된복습으로신규coverage를중복집계하지않음.'],
];
const entries = defs.map(([element_id, set_id, subquestion_id, relationship, source_unit_ids, criterionIds, reason]) => {
  const file = `${folder}/${set_id}.json`, q = read(file)[0].subquestions.find(q => q.id === subquestion_id);
  const criterion_ids = criterionIds || q.criteria.map(c => c.id);
  if (!elements.elements.some(e => e.id === element_id) || source_unit_ids.some(id => !catalog.units.some(u => u.id === id)) || criterion_ids.some(id => !q.criteria.some(c => c.id === id))) throw new Error('잘못된 관계');
  return { element_id, source_unit_ids, target: { scope:'draft',file,set_id,subquestion_id,criterion_ids }, relationship,reason,review_status:'needs_review' };
});
write('coverage-proposal.json', { version:1,artifact_type:'coverage_proposal',package:'S04',entries,evidence_paths:[`${folder}/scope-and-sources.md`,`${folder}/evidence/phase1/frequency-and-prior-evidence.json`,elementsFile,'cpa_uploader/analysis/question-elements/frequency.md'],policy:'관계제안만작성. 원문·빈도복사없음. snapshot/공통links통합은최종내용뒤총괄담당.같은원물음·의도된복습의신규커버리지중복계산금지.' });
const investigation = read(`${folder}/evidence/phase1/packet-context-investigation.json`);
const assessments = {
  'pilot-10-006':'530.5의500표제각주는표본감사의도입부문맥이다. 위험정의와A21~A23전체를확인했다. 주제10미연결원페이지195/196은앞선조회·계산물음의자료이며원출제기록과계획은보존했다.',
  'pilot-10-007':'315.13→330일반대응은330.6/.7,520.5→330.18,520.A14→330.22/.23,520.A16→320.A14·330.7(b)/A19를계획의실제인용으로포함했다.520.A13각주5는원문500.10표시를보존하고실제500.10항목추출과500.9정보품질의차이를설명했다.520.A12→500.A35전체양판본과315.A30→520영역경계도포함했다. 원페이지335는다른은행조회물음으로주제10미연결이며계보를보존했다.',
  'pilot-12-009':'450.10/A14/A15의320.10/.12/A14,450.A13의700.12,450.A18의700.13,450.A22의240.36/200.15원문을계획에포함했다.720일반참조는A21의예시적기타정보관심사항으로본사례는사업보고서검토의무를묻지않는다. 원페이지167은다른보고서수정물음이며직접왜곡표시진술은168쪽이다.',
  'pilot-12-010':'580.10/.11의210.6(b)(i)/(iii),580.20/A26의705.9,580.A25의230.8(c)/10,580.A22의260.16(c)(ii)을계획에실제인용했다.580.A21의보론2는예시진술서이며본물음은진술서양식·예문재현을요구하지않는다.580.3/.4와A7/A26의책임진술증거한계, A27의변형된진술예외를모델입력에보존했다.'
};
write('evidence/phase1/manual-context-review.json',{checked_at:new Date().toISOString(),final_automatic_packet:false,results:investigation.results.map(r=>({set_id:r.set_id,char_count:r.charCount,unresolved_count:r.unresolved.length,direct_unresolved:r.direct_unresolved,assessment:assessments[r.set_id]})),supplementary_context:'sources/supplementary-cross-context.json',policy:'직접조건·예외는source_refs와plan.scope.exceptions에포함되어의미검수모델입력으로전달된다. 전이자동의존까지complete라고표시하지않으며조사packet을--packet으로쓰지않는다. 최초부터수동작성계약이며generation marker를제거한적없다.'});
manifest.stage='draft_ready';manifest.handoff_documentation='complete';manifest.coverage_proposal=`${folder}/coverage-proposal.json`;manifest.manual_context_review=`${folder}/evidence/phase1/manual-context-review.json`;manifest.final_automatic_packet='unresolved_investigation_not_supplied_to_review';
write('draft-manifest.json',manifest);
const rows=manifest.sets.map(s=>`| ${s.plan_id} | [${s.set_id}](${s.set_id}.json) | ${s.questions} | ${s.points} | [계획](${s.set_id}.authoring-plan.json) | [QA ${s.qa_cases}개](qa-cases-${s.plan_id.toLowerCase()}.json) |`).join('\n');
write('README.md',`# S04 1차 제작 인계

**draft_ready: 4세트·11물음·29점, 작성자 QA217개.** 형상·공식인용·계획·정수배점·QA·현행은행메모리 및 초기 활성본/선행 후속본과의ID·발문충돌 검사를 통과했다. 독립 모델 의미검수와 실제 모델 채점은 미실행이며 정본 편입·게시·배포하지 않았다.

| 계획 | 실제 문항 | 물음 | 점수 | 계획 | 작성자 QA |
|---|---|---:|---:|---|---|
${rows}

[고정 파일·해시](draft-manifest.json), [범위·근거](scope-and-sources.md), [후속 인계](handoff.md), [정적 증거](evidence/phase1/latest-static.json), [관계 제안13개](coverage-proposal.json)을 함께 본다. 문항은각1세트배열이며탐색대상중복합본이없다. [작성원본](content.mjs), [생성기](build-s04.mjs), [작성자QA 생성기](build-qa.mjs)는S04전용이다.

2027년CPA 목표·2026년개시사례의현재공식근거다.2027최종시험판본확정을주장하지않는다. 자동원자료packet은[조사기록](evidence/phase1/packet-context-investigation.json)에unresolved로보존했으며[수동문맥](evidence/phase1/manual-context-review.json)과등록source_refs·version1계획으로검수한다.
`);
const frequencyRows=frequency.map(e=>`| ${e.id} | ${e.exam_frequency} (${e.exam_years.join(',')}; ${e.exam_questions.join(',')}) | ${e.mock_frequency} | ${e.general_practice_occurrence_count} / ${e.ox_occurrence_count} / ${e.unknown_origin_non_ox_records} | ${e.target} |`).join('\n');
write('scope-and-sources.md',`# S04 범위와 실제 근거

배정서의4세트11물음29점을유지했다.모든물음은모두작성·순서제한없음·개수상한없음이다.독립명제1점이며소수partial이나숨은요건이없다.조건·이유가결합된하나의종합명제는발문에서범위를명시하고전부를충족하면1점으로평가한다.

## 원발문·빈도와 기존 요구

[실제 원발문·공통지문·정본 criterion 장부](evidence/phase1/frequency-and-prior-evidence.json)에 원문/페이지/source_unit_ids를 보존했다. [관계 제안](coverage-proposal.json)은 대상criterion까지 한정한다. 현재정본104세트와초기111활성본의R01역사6을후속6으로교체하고N02 4/N03 3/S02 3및동료S04 3을비교했다. 최종153은행은총괄이별도고정한다.

| 실제 요소 | 기출 횟수·연도·원출제 | 모의 | 연습/ OX/ 원출제 미확정 비OX 수록 | 새 요구 관계 |
|---|---|---:|---:|---|
${frequencyRows}

기출·모의·교재수록단위는합산하지않는다.2016:4:1의유형과영향은같은물음의두요소,2023:10:3의세진술도같은원물음이다.2016유형·중점통제이유에붙은원출제미확정연습수록은검증된기출1회에더하지않는다.

${definitions.map(d=>`### ${d.planId} / ${d.id}

목표: ${d.objective}

${d.prior}

제외: ${d.exclusions.join(' / ')}.

조건·예외: ${d.exceptions.join(' ')}

${d.questions.map((q,i)=>`- ${d.planId}-Q${i+1}: ${q.criteria.length}점. ${q.prompt}`).join('\n')}
`).join('\n')}

## 공식 판본과 실제 인용

공식2025년11월전문을기본2026년1월1일개시사례에적용하고2026년7월전문과대조했다. [450/520/530/580의102문단](sources/official-comparison.json), [315.A27~A31의5문단](sources/kga315-additional-comparison.json), [추가교차문맥22문단](sources/supplementary-cross-context.json)은공백제외동일했다. 총괄 [판본정책](../../../analysis/reviews/delegated-authoring-2026-09-11/edition-policy.md)을따르며FSC2027공고의출제비중을최종시험판본지정으로해석하지않는다.

등록파일은data/official/delegated-s04-kga-2025.txt 및delegated-s04-kga315-2025.txt,315.13/.14는기등록kga315-330-2025-review06.txt이다. [실제ID·locator·파일/인용해시·span](source-registration-map.json)와세트별source-bindings를사용한다. 공식번호를src ID로표시하지않으며원출제의해설을공식본문으로표시하지않는다.

T10-B는530.5(c) 및A23, T10-C는315.13/.14와520.5/.6/.7, T12-C는450.7/.9/.10/.11, T12-D는580.10/.11/.19/.20이직접근거다. 적용자료·하위조건은source_refs와plan에포함된다.580.20의부족증거/전반성문맥은705.9와A26으로확인하되별도의의견유형문제를추가하지않는다.

520.A13의각주5는500.10으로인쇄되어있지만현행500.10은항목추출이고정보품질은500.9이다. 두공식문단을함께읽고원인용의각주를바꾸지않았다.315.A30에따라위험평가분석에520의설계요건을모두의무화하지않는다.

자동packet의원페이지주제분류실패와광범위전이의존은[원실패](draft-manifest.json),[읽기조사](evidence/phase1/packet-context-investigation.json),[수동문맥판단](evidence/phase1/manual-context-review.json)에보존했다. 조사한도150만자는모델상한이아니며실제준비검사는50만자를사용했다. 원문·계획·동료를잘라내거나complete표시를조작하지않았다.

## 작성자 QA와 남은 검증

[QA장부](qa-manifest.json)의217개고유입력은완전답안·빈답안·동의표현·진짜한명제누락·명시반대·조건경계·열거역순·복수명제한문장·무관문장뒤정답·정답중복및여분정상설명을포함한다. 판단이행동에남는문장삭제는의미누락과구별했다. T12-C-Q2는거절사유를평가에반영한다는조치가사유이해를함축할수있다. T12-D-Q1은특정조건확인과무조건의견거절주장의부정을함께평가한다. 실제모델판정을관측한뒤공식원문과발문을기준으로불일치원인을판단하며기대값에기계적으로맞추지않는다.

현재실측0회. 정적검사통과는의미검수·채점통과나사람확인완료가아니다. 고정은행전달뒤의미검수생성사례와전체작성자QA를실제실행하고불일치를같은설정으로총3회확인한다.
`);
write('handoff.md',`# S04 인계

**draft_ready: 4세트·11물음·29점.** 입력은고정가능하며모델의미검수·실제채점이남았다.문항은needs_review / needs_human_review상태다.

| 계획 ID / 실제 ID | 출처·판본 | 초안 버전·해시 | 정적검사 | 의미검수 | 실제 채점 사례 수·불일치 | 남은 일 | 증거 경로 |
|---|---|---|---|---|---|---|---|
${manifest.sets.map(s=>`| ${s.plan_id} / ${s.set_id} | 공식2025+2026문단대조 | SHA256 ${s.sha256} | 통과 | 미실행 | 0회 / 미확인; 작성자QA ${s.qa_cases}개 | 고정은행 의미검수·QA·불일치수정 | [문항](${s.set_id}.json), [계획](${s.set_id}.authoring-plan.json), [QA](qa-cases-${s.plan_id.toLowerCase()}.json) |`).join('\n')}

문항/계획/QA개별해시는[draft-manifest](draft-manifest.json)로고정했다. [최신정적검사](evidence/phase1/latest-static.json)는정본메모리와초기/선행비교를통과했다. 최초정적helper가R01객체를배열로가정한실패는[별도기록](evidence/phase1/preparation-failure-r01-shape.json)에보존하고읽기를정규화했다. 과거파일이나모델receipt를수정하지않았다.

R01 표본크기방향·후속사건이중일자·계속기업, N03 과거통제증거재사용·실증최소범위와별개다. N02 정보품질을전제로520 고유설계를적용한다. T10-C-Q3는기존10-002/sub2의의도된복습이며 T12-D의두물음간조건반복도신규coverage로중복합산하지않는다. S02 T07-C-Q1/Q3의N02적용복습범위는그대로유지한다.

등록·분류공통변경은총괄이수행했다.후속공통coverage통합은[13개제안](coverage-proposal.json)을검토하여snapshot과함께진행한다. 추가원출제효과성·효율성요소 ${effect.id}는2016:4:1의독립요구를실제자료에서확인해연결했으며같은원출제를2회로세지않는다.

2차는총괄phase-two-protocol.md에따른다.최종153은행과입력manifest해시를확인하고gpt-5.6-luna·명시500000자로실행한다.수동source-bindings나unresolved조사packet을--packet으로전달하지않으며--plan과등록source_refs를이용한다.후속실행은새evidence경로이고실행중입력을덮어쓰지않는다.의미fail/uncertain과실제채점실패는분리하고미실측을통과로보고하지않는다.
`);
console.log(JSON.stringify({sets:manifest.total_sets,questions:manifest.total_questions,points:manifest.total_points,qa:qa.total_cases,coverage:entries.length,effect_element_id:effect.id},null,2));
