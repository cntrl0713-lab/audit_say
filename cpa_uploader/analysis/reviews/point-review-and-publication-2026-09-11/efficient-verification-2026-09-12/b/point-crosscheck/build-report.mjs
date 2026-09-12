import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const E = `${D}/efficient-verification-2026-09-12`;
const out = `${E}/b/point-crosscheck`;
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const identity = file => ({ file, sha256: hash(fs.readFileSync(file)) });
const master = read(`${D}/a/execution-all-v9/manifest.json`);
const bank = read(master.bank_file);
const entries = [];
function add(setId, subId, owner, oldPoints, verdict, reason, partial, comparison, limitation = null) {
  const file = owner ? `${E}/${owner}/content-followups-v1/${setId}/question.json` : master.jobs.find(j => j.set_id === setId).file;
  const value = read(file), set = Array.isArray(value) ? value.find(s => s.id === setId) : value;
  const q = set.subquestions.find(q => q.id === subId); assert(q);
  const previous = bank.find(s => s.id === setId)?.subquestions.find(q => q.id === subId);
  const ids = [...new Set(q.criteria.flatMap(c => c.source_ref_ids))];
  const sources = ids.map(id => {
    const ref = set.source_refs.find(r => r.id === id); assert(ref, id);
    const source = fs.readFileSync(ref.file, 'utf8'); const offset = source.indexOf(ref.source_quote);
    assert(offset >= 0, `${setId}/${id}: quote missing`); assert.equal(hash(ref.source_quote), ref.content_hash);
    return { id, ...identity(ref.file), title: ref.title, quote_sha256: ref.content_hash, first_line: source.slice(0, offset).split('\n').length,
      last_line: source.slice(0, offset + ref.source_quote.length).split('\n').length, source_quote: ref.source_quote,
      provenance_limit: /ISA800/.test(ref.title) ? '해당 국제 원문의 명시적 인용. 국내 2027 적용 판본을 이 자료만으로 확인하지 못함.' : null };
  });
  entries.push({ set_id: setId, subquestion_id: subId, input: identity(file), parent_facts: set.shared_context,
    prompt: q.prompt, model_answer: q.model_answer, criteria: q.criteria, sources,
    before_points: oldPoints ?? previous?.criteria.reduce((n,c) => n + c.max_points, 0) ?? null,
    after_points: q.criteria.reduce((n,c) => n + c.max_points, 0), point_verdict: verdict,
    reason, independent_partial_example: partial, similar_question_comparison: comparison,
    content_readiness: limitation ? 'hold_for_separate_content_resolution' : verdict === 'needs_change' ? 'hold_for_scoring_contract_resolution' : 'point_crosscheck_pass_not_full_publication_approval',
    limitation, api_calls: 0 });
}

add('pilot-04-007','sub3','a',2,'pass',
  '320.13의 수행중요성 수정 필요 판단과 추가절차의 성격·시기·범위 적합성 재평가는 각각 서로 다른 결정이다. 성격·시기·범위를 단순 단어 수로 쪼갠 것이 아니라 어떤 절차를, 언제, 얼마만큼 수행하는지의 독립적인 계획 차원을 복원한 4점이다. 이미 정해진 중요성 인하 자체나 자동 비율 조정에는 점수를 주지 않는다.',
  '수행중요성 수정 필요와 추가절차 범위만 재평가한다고 쓰면 crit8+crit12=2점; 성격·시기를 쓰지 않은 독립 누락을 보존한다.',
  'pilot-04-001/sub2는 같은 320.13을 동일한 4기준/4점으로 채점한다. 두 물음 모두 전면 재설계·구체 금액 계산은 요구하지 않는다.');
add('pilot-03-004','sub2','a',3,'pass',
  '실제 후속 변경은 발문 수정이 아니라 모범답안의 “이 예외가 적용되지 않는다”를 “이 수임 금지가 적용되지 않는다”로 바로잡은 것이다. 210.8의 두 수임금지 사유와 법규상 요구감사 예외는 독립적으로 답할 수 있어 3점을 유지한다. 문단19 예외는 발문에서 제외되어 추가 배점하지 않는다.',
  '재무보고체계 불수용과 경영진 동의 부재만 맞히면 2점이고, 법규 예외만 정확히 쓰면 1점이다.',
  'pilot-19-003/sub2의 원칙·예외조건·예외시 조치 3점처럼 별도 조건부 명제를 분리한다.');
add('pilot-04-006','sub3','a',5,'pass',
  '230.16이 명시한 문단13 외의 상황이라는 적용 경계를 독립 발문에 복원했다. 이유, 변경자, 변경시기, 검토자, 검토시기는 추적가능성을 구성하는 별도의 기록 필드이므로 5점이 적절하다. 변경과 추가는 대안 행위이므로 각각 점수를 늘리지 않고, 같은 사람이 변경·검토했다고만 쓰는 경우에도 역할별 식별을 확인한다.',
  '구체 이유와 변경자만 제시하면 2점. 검토자만 쓰고 검토시기를 생략한 답에 해당 1점을 남긴다.',
  '04-007의 절차 성격·시기·범위와 같이 독립된 실무 정보를 구분한다. 새로운 절차·결론이 있는 230.13 요구를 여기 5점에 섞지 않는다.');
add('pilot-10-007','sub2','c',7,'pass',
  '기존 혼합 물음에서 정보속성 열거를 새 sub4로 옮겼다. 남은 종료판단1, 계산된 기대치 정확성평가1, 허용차이 결정행위1, 그 결정에 쓰는 중요성·확신수준·평가위험 각1은 520.5(c),(d)와 A16의 서로 다른 요구이다. 결정요인을 모두 묻는 발문에 대응하며, 이미 주어진 계산이나 적합성 판단을 재득점하지 않는다.',
  '“종료는 부적절하며 중요성을 고려해 추가조사 없는 수용차이를 정한다”는 판단·결정·중요성 3점; 정확성·확신수준·위험이 빠졌다는 이유로 결정행위를 지우지 않는다.',
  'pilot-10-002/sub4는 기대치 도출·정확성·차이 결정의 3점이고 A16의 세 요인 열거를 요구하지 않는다. 이 물음은 도출이 주어져 제외되고 대신 A16 요인을 명시적으로 요구하여 6점이다.');
add('pilot-10-007-standards','sub4','c',null,'pass',
  '520.5(b)의 원천·비교가능성·성격·관련성·작성통제 5개 속성을 독립 열거한다. A12(c)가 성격과 관련성을 한 항목에서 예시하더라도 정보의 성격(어떤 종류·구성인가)과 분석 목적에 대한 관련성은 서로 다른 평가이다. 기준서형 독립 질문으로 옮겨 사례 B의 조건 반복 없이 답할 수 있다.',
  '정보의 성격만 제시하고 분석 목적과의 관련성을 생략해도 성격 1점은 보존한다. 같은 A12 예시가 양 속성을 실제로 설명하면 두 명제를 인정하되 축자 표현이나 예시 추가는 강제하지 않는다.',
  'pilot-10-002/sub3는 같은 5속성에 데이터 신뢰성 평가라는 수행행위1을 추가 요구하여6점이다. 새 sub4는 평가를 문제 전제로 주므로 속성만5점이다.');
add('pilot-16-011','sub1','c',3,'pass',
  '초기4점안의 일반적인 보고서 시사점 고려와 구체적인 기타정보 단락 처리는 한 행동에 중복2점을 부여할 수 있었다. 현재 후속은 이 중복을 없애 자동 의견거절 부정1, 기타정보 단락의 미수정왜곡표시 기술1, 보고계획의 지배기구 전달1로3점을 유지했다. 720.18/A45/22(e)(ii)의 세 실제 요구와 일치한다.',
  '“기타정보 단락에 중요한 미수정왜곡표시를 기술한다”는 현재 crit2만1점. 자동 의견거절 여부와 지배기구 보고계획은 별개로 남는다.',
  '19-005/sub2의 같은 의무 표현을 중복 득점하지 않는 원칙과 일치한다. 판단과 구체 보고내용·전달대상은 각각 독립이다.');
add('pilot-17-005','sub2','c',3,'pass',
  '초기4점안은 구체적인 다른 진술 신뢰성 평가와 더 넓은 재무제표감사 영향 고려를 나누며 같은 설명의 함축을 막을 위험이 있었다. 현재 후속은1100.79의 포함 관계를 명시하고 내부회계 의견거절1, 다른 진술에 대한 의존능력 평가를 통한 재무제표감사 영향 고려1, 재무제표 의견의 자동 동일 부정1로3점을 유지한다. 추상 제목 반복에 새 점수를 주지 않아 적절하다.',
  '“서면진술 거부가 재무제표감사에 미치는 영향으로, 그 감사에서 입수한 다른 경영진 진술에 의존할 수 있는지를 평가한다”는 현재 crit4=1점. 자동 의견거절 부정은 별도 crit5이며 언급·함축 없으면0점이다.',
  '16-011처럼 일반·구체 행동의 중복 배점을 없애되, 실제 의견 판단은 별도 점수로 보존한다.');
add('pilot-19-001','sub1',null,3,'pass',
  '제시된 보기에서 서로 다른 비인증업무3개를 선택하는3점이다. 각 업무는 독립 분류 대상이며 재수록명·동의어를 별도 요소로 세지 않는다.',
  '작성업무와 합의된 절차만 맞히면2점; 세무조정 누락을 독립 처리한다.',
  '19-004/sub2의 업무별 수행기준 연결3개/3점과 같은 단위다.');
add('pilot-19-001','sub2',null,5,'pass',
  '검토기준5~8에 따른 제한적 확신1, 질문1, 분석적절차1, 문제 인지시 추가절차 설계1·수행1의5점이다. 설계는 필요한 절차를 정하는 단계, 수행은 그 절차를 실제로 실행하는 단계이므로 계획만 제시한 부분답안과 실행까지 제시한 답안을 구별할 수 있다. 문제 인지 조건은 추가행위의 적용조건이며 별도 점수로 늘리지 않는다.',
  '제한적 확신과 질문·분석만 쓰면3점. 추가절차를 구체적으로 선택해 시행한다고 설명하면 “설계”라는 단어 재진술 없이 해당 두 단계를 인정한다.',
  '10-007은 기대치 계산이 이미 주어져 도출 재득점을 제외한다. 이 물음에는 추가절차 설계·수행 완료가 주어지지 않아 두 단계 모두 답해야 한다.');
add('pilot-19-002','sub1',null,6,'pass',
  '준거기준에 따른 기초대상 측정·평가결과, 결론 표명, 충분하고 적합한 증거, 책임자가 아닌 의도된 이용자, 신뢰 향상 목적, 독립성의6요구다. 대상·방법·산출·증거·이용자·목적 중 실제로 다른 역할을 구분한다. 측정과 평가를 별도로 세거나 충분성/적합성의 세부 평가법까지 새로 요구하지 않는다.',
  '의도된 이용자 신뢰 향상과 독립성만 정확하면 해당3점이며 대상·증거에 관한 독립 누락을 보존한다.',
  '19-002/sub2는 구성요소를, 이 물음은 업무 정의와 독립성을 요구한다. 같은 개념의 반복학습이지만 물음 내부 중복배점은 아니다.');
add('pilot-19-002','sub2',null,8,'pass',
  '상위 구성요소는5개지만 발문이 삼자 당사자와 보고서 형식/업무 적합성을 명시해 삼자3+인증대상1+준거기준1+증거1+서면형식1+업무성격 적합성1=8점이다. 당사자 누락, 구두보고, 확신수준과 보고형식 불일치는 각각 독립 오류다. 인증대상/준거기준/증거의 적합성 수식어를 별도 이름 점수로 더 쪼개지 않는다.',
  '인증인·인증대상책임자만 맞히면2점. 서면이라는 형식만 맞히고 업무에 적합한 결론형태를 빠뜨리면 보고서 부분1/2점이다.',
  '04-006/sub3의 문서기록 필드5점처럼 발문이 명시한 하위 필드의 독립 누락을 허용한다. “다섯 가지”는 상위 범주 수이지 총점 상한이 아니다.');
add('pilot-19-003','sub1',null,3,'pass',
  '작성목적, 의도된 이용자, 경영진의 체계 수용가능성 결정조치라는 ISA800.8의3요소가 발문에 대응한다. 제3요소의 주체/목적은 조치를 특정하는 조건으로 별도 점수를 만들지 않는다.',
  '목적·이용자만 맞히면2점. 감사인 자신의 조치로 주체를 바꾸면 제3기준0점이다.',
  '03-004/sub1의 감사인 전제조건 확인절차와 달리 여기서는 경영진의 체계 선택조치를 감사인이 이해하는 대상이다.',
  '점수 유지의 적절성만 확인. 현재 source_ref/requirements는 국제 ISA800을 직접 근거로 쓰며 국내800 판본 직접 확인 미완료라고 명시한다. C가 국내 근거를 조사 중이므로 2027 국내 기준 적합성은 보류.');
add('pilot-19-003','sub2',null,3,'pass',
  '관련기준 준수원칙, 예외적 이탈의 비효과성 조건, 목적을 달성할 대체절차라는3독립 명제다. 특정목적 감사라는 이유만으로 기준을 면제하지 않는다. 원문에 있는 모든 특별고려사항을 이 한정 발문에 추가하지 않는다.',
  '준수원칙+대체절차만 맞히고 예외조건을 누락하면2점. 시간·비용을 이탈사유로 바꾸면 해당조건0점이다.',
  '03-004/sub2의 수임금지/법규 예외처럼 원칙과 예외의 적용조건을 별도 채점한다.',
  'KGA200.18/.23 직접 근거는 확인되지만 특정목적감사 연결의 ISA800.9 국내 적용 확인이 별도로 남아 있다. 내용 판본의 최종 pass로 표시하지 않는다.');
add('pilot-19-004','sub1',null,3,'pass',
  '감사·인증 의뢰인 제외라는 범위에서 비인증업무 자체의 독립성 일률 요구 부정, 별도 법규·계약 요구 준수, 항상 객관성 유지의3독립 명제다. 합의된 절차7은 비인증업무가 모두 무조건 독립성을 요구한다는 주장의 반례와 계약 예외를, 윤리기준6은 객관성을 뒷받침한다. 모든 비인증업무의 모든 규정이 동일하다는 일반화는 하지 않는다.',
  '독립성 일반원칙과 객관성만 맞히면2점. 법규/계약의 별도 요구를 무시한다는 답은 그1점을 잃는다.',
  '19-002/sub1의 인증업무 독립성1점과 업무 종류·범위가 다르다. 독립성과 객관성은 동일어가 아니다.');
add('pilot-19-004','sub2',null,3,'pass',
  '연간감사, 회사 감사인의 중간검토, 회사 감사인이 아닌 검토인의 역사적재무제표검토에 각각 수행기준을 연결하는3점이다. 업무의 기간과 수행주체는 정답기준을 선택하는 조건이며 별도 점수를 만들지 않는다.',
  '연간감사와 회사 감사인의 중간검토 기준만 정확하면2점.',
  '19-001/sub1의 업무3개 분류와 같은 규모다. 2014 표시된 중간준칙1/1-1은 등록된2015 공식 전사와 비공백 동일함을 별도 확인한다.');
add('pilot-19-005','sub1',null,2,'pass',
  '제한적 확신 수준1과 주어진 전체 형식·K-IFRS·중요성 조건에 맞는 소극적 결론1의2점이다. 재무제표명/준거기준/중요성은 한 결론의 대상·범위를 정하는 조건이며 각각 별도 지식명제로 분해하지 않는다. 적극적 공정표시 의견으로 뒤집으면 결론점수0이다.',
  '확신수준만 맞히면1점. 올바른 소극적 결론을 쓰고 확신수준 설명을 생략하면 결론1점이 독립적으로 남는다.',
  '19-001/sub2는 절차까지 묻기 때문에5점이며, 이 물음은 절차 목록을 요구하지 않는다.');
add('pilot-19-005','sub2',null,1,'pass',
  '“생략 제안의 부적절성”과 “서면진술을 받아야 함”은 이 발문에서 동일한 의무를 정·반대로 표현한 것이다. 별도 이론적 이유나 서면진술 항목을 요구하지 않으므로1점을 유지한다. 판단이라는 단어가 있다고 같은 의미에 점수를 둘로 늘리지 않는다.',
  '“중간검토에서도 서면진술을 받아야 한다”가1점이며 별도의 “갑은 부적절하다” 문장을 요구하지 않는다.',
  '16-011의 독립적인 감사의견 판단과 보고내용은 서로 다른 명제이다. 반면 여기의 생략금지와 입수의무는 같은 이항 결정이다.');
add('pilot-19-005','sub3',null,3,'pass',
  '완화제안 부적절 판단1, 정보·이용자 요구를 바탕으로 하는 중요성 판단1, 낮은 확신/높은 미발견위험과 중요성기준의 구별1이다. 결론만 반복한 문장에는 위험 차이 설명점을 주지 않는다. 판단기준의 정보·이용자는 하나의 목적적 기준을 구성하며 별도 단어점수로 늘리지 않는다.',
  '“중요성 완화는 부적절하며 정보와 이용자 요구로 판단한다”는2점. 더 큰 미발견위험과 기준 동일성 구별을 생략한1점을 남긴다.',
  '19-005/sub2는 같은 의무의 정반대 표현이지만 여기에는 판단을 뒷받침하는 별도의 확신/위험 개념이 있어3점이다.');

const intermediateFile = 'cpa_uploader/data/official/delegated-s06-interim-2015.txt';
const intermediate = fs.readFileSync(intermediateFile, 'utf8');
const oldInterim = entries.find(e => e.set_id === 'pilot-19-004' && e.subquestion_id === 'sub2').sources.find(s => s.id === 'src4').source_quote;
assert(intermediate.replace(/\s/g, '').includes(oldInterim.replace(/\s/g, '')));
const report = {
  version: 1, artifact_type: 'independent_agent_point_crosscheck', reviewer: 'plan_procedures',
  reviewed_at: new Date().toISOString(), api_calls: 0, human_approval: false,
  scope: '지정 A/C 후속7물음과 주제19 selected11물음. 발문·답안·기준·해당 원문 직접 대조. 실제 모델 채점이나 전체 판본 검증을 대신하지 않는다.',
  input_master: identity(D + '/a/execution-all-v9/manifest.json'), input_bank: identity(master.bank_file),
  preservation: '다른 작성자 파일·공통 코드·문항·QA·원자료 변경 없음. 이 보고서 폴더만 작성.',
  summary: { questions: entries.length, topic19_questions: entries.filter(e => e.set_id.startsWith('pilot-19-')).length,
    point_pass: entries.filter(e => e.point_verdict === 'pass').length, point_needs_change: entries.filter(e => e.point_verdict === 'needs_change').length,
    separate_content_holds: entries.filter(e => e.limitation).length },
  resolved_findings: [
    { set_id: 'pilot-16-011', subquestion_id: 'sub1', initial: identity(E + '/c/content-followups-v1/pilot-16-011/initial-four-point-proposal/question.json'),
      finding: '일반 보고영향 고려와 구체 기타정보 단락 설명이 한 행동으로2점이 됨.', resolution: '일반·구체 행동의 중복점을 제거하고 자동 의견거절 부정/기타정보 단락/지배기구 전달3점으로 정리한 현재본을 확인.' },
    { set_id: 'pilot-17-005', subquestion_id: 'sub2', initial: identity(E + '/c/content-followups-v1/pilot-17-005/initial-four-point-proposal/question.json'),
      finding: '다른 진술 평가를 포함한 재무제표감사 영향 설명을 별도 추상문장 없이 인정할 경계가 부족함.', resolution: '일반 영향과 구체 평가의 포함관계를 명시하고3점 유지. 구체 설명의 함축을 인정하는 현재본을 확인.' },
    { set_id: 'pilot-10-007', subquestion_id: 'sub4', initial: identity(E + '/c/content-followups-v1/pilot-10-007/initial-four-question-proposal/question.json'),
      finding: '기준서형 물음의 실제 저장 분리 후속.', resolution: 'pilot-10-007-standards/sub4, facts=[], question_style=standard, topic_ids08/10. 사례6점과 기준서5점 의미·배점은 동일.' },
  ],
  additional_checks: [{ kind: 'interim_scope_edition_text', source: identity(intermediateFile),
    result: 'pilot-19-004의2014표시1/1-1 인용은 등록2015공식전사에 비공백동일하게 포함됨. 선택 범위 문구에 한정하며 모든2014/2015문단 동일 주장이 아님.' }], entries,
};
assert.equal(entries.length, 18);
for (const e of entries) assert.equal(hash(fs.readFileSync(e.input.file)), e.input.sha256, 'input changed while collecting ' + e.set_id);
fs.writeFileSync(out + '/review.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const rows = entries.map(e => '| ' + e.set_id + '/' + e.subquestion_id + ' | ' + (e.before_points ?? '분리 신규') + '→' + e.after_points + ' | ' + (e.point_verdict === 'pass' ? '배점 적절' : '계약 보완 필요') + (e.limitation ? ' / 판본 보류' : '') + ' | ' + e.reason + ' |');
const markdown = [
  '# 지정 후속·주제19 배점 교차검토', '',
  '실제 API 호출 없이18물음의 발문·모범답안·criterion·직접 인용을 대조했다. agent의 독립 검토이며 사람 승인이나 배포 완료가 아니다. [해시·원문·부분답안 장부](review.json)에 입력과 판정 근거를 보존했다.', '',
  '**현재18물음의 배점은 적절하다.** 최초16-011/17-005의4점안에 제기한 일반·구체 행동 중첩과 함축 경계는 작성자의 후속3점안에서 해결되었다. 초기 제안 원본과 현재 해시는 JSON에 각각 남겼다. 주제19는11물음의 점수 유지가 타당하지만19-003의2물음은 국내800 판본 확인이 남아 있어 내용 검증 완료로 표시할 수 없다.', '',
  '| 물음 | 점수 | 판정 | 근거 |', '| --- | ---: | --- | --- |', ...rows, '',
  '## 해결한 정확한 경계', '',
  '- **16-011/sub1:** 초기안은 기타정보 단락에 중요한 미수정왜곡표시를 기술한다는 단일 답안을c1/c2에 중복2점 인정했다. 현재본은 기타정보 단락 처리에1점만 주며 자동 의견거절 부정(c1)과 지배기구 전달(c3)을 독립적으로 유지한다.',
  '- **17-005/sub2:** 재무제표감사 영향으로 다른 진술의 의존능력을 평가한다고 설명한 답은 현재c4를 충족한다. 일반적 영향 고려에 별도점을 추가하거나 추상 문구 반복을 요구하지 않고 의견의 자동 동일 부정은c5로 구별한다.', '',
  '## 부분점수·요구량 비교', '',
  '- 04-007/sub3의4점은04-001/sub2와 같은320.13의 결정4개에 대응한다. 04-006/sub3의5점은 이유·변경자/시기·검토자/시기의 독립 기록이다.',
  '- 10-007의6점+5점 분리는 사례의 판단·보완과 기준서 정보속성 열거를 나눈다. 10-002/sub3의6점은 속성5개에 평가행위를 별도 요구하지만 새10-007/sub4는 그 행위를 전제로 주어5점이다.',
  '- 19-002/sub2의8점은 명시된 삼자관계3, 다른 구성요소3, 보고서의 서면·업무적합성2이다. 충분성/적합성을 다시 단어별로 쪼개거나 모든 조항 예시까지 추가하지 않는다.',
  '- 19-005/sub1의 보고결론 조건들은 한 결론을 특정하고, sub2의 생략부적절/입수의무는 같은 의무의 정·반대 표현이므로 각각2점/1점 유지가 적절하다.', '',
  '현재 결과는 파일에 기록된 해시의 검토이다. 후속 변경 부분은 다시 대조해야 한다. 내용·근거·정답 오류에는 채점 ±1점 허용을 적용하지 않았다.', '',
].join('\n');
fs.writeFileSync(out + '/review.md', markdown, { flag: 'wx' });
console.log(JSON.stringify({ ...report.summary, api_calls: 0, files: [identity(out + '/review.json'), identity(out + '/review.md')] }));
