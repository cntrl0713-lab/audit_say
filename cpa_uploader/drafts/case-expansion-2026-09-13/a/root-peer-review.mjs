import fs from 'node:fs';
import { createHash } from 'node:crypto';
const b='cpa_uploader/drafts/case-expansion-2026-09-13';
const file=`${b}/root/sets.json`;
const sets=JSON.parse(fs.readFileSync(file,'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const catalog=JSON.parse(fs.readFileSync(`${b}/source-catalog.json`,'utf8'));
const issueFixed=/자동.*분개|정규.*분개/u.test(sets[0].shared_context.facts[1].text)&&/수동|특별/u.test(sets[0].shared_context.facts[1].text)&&/제외|생략/u.test(sets[0].shared_context.facts[1].text);
const nullFixed=sets.every(s=>s.source_refs.every(r=>!r.source_span?.includes('null쪽')));
const sourceIds=['src-1b715c89d513066f1f','src-0f694d630bc4ad46c3','src-136c133b38f8844f95','src-08f220e3e3964d5e40','src-77779b6f06b9fd9e36','src-8d4b10c3f9e8ea2dbd','src-0ed1cb0ce2576d414a','src-22db8d82c8137cc21d','src-156f65591335b4c1ac','src-24814cd1f5353b0386','src-c95a547d765e6b17bf','src-355ccaed90b86691f8','src-e851232ffe83bb6ffd','src-0dc5f3097ae46e8a0a','src-b477090651417dbdcc','src-df70b961045429234a'];
const record={reviewer:'Codex expand_a independent peer agent',review_kind:'agent_semantic_review',not_human_approval:true,model_call_performed:false,reviewed_at:new Date().toISOString(),sets_file:file,sets_sha256:hash(fs.readFileSync(file)),reviewed_source_units:sourceIds.map(id=>{const u=catalog.units.find(u=>u.id===id);return {id,file:u.file,locator:u.locator,quote_sha256:hash(u.quote),file_sha256:hash(fs.readFileSync(u.file))};}),
 scope:'두 신규 사례의 모든 부모 사실·6발문·모범답안·16criterion·12대표 QA와 계획 및 공식/기출/고급연습 실제 원자료를 직접 대조했다. 2025 공식 전사의 해당 요구를 확인했고 2026 전문과의 판본 비교 자체는 총괄 작성자의 별도 근거 범위이다.',
 findings:[{id:'R-A-01',set_id:sets[0].id,subquestion_id:'sub2',severity:'required_content_fix',finding:'초기 fact2에는 이미 12월 말 분개 추출 및 증빙 확인을 수행할 계획이라고 주어져 있어 crit-sub2-2가 발문의 보완 요구에 대한 새 응답이 아니라 주어진 계획의 반복이 되었다.',recommended_change:'원래 계획에서 특별 계정 수동조정을 제외하고 12월 자동 생성 정규분개만 추출하는 것으로 사실을 명확히 하여 수동 조정 포함이 실제 보완이 되게 한다.',status:issueFixed?'resolved':'open'},
 {id:'R-A-02',set_id:sets[1].id,severity:'metadata_clarity',finding:'550.24·A42 source_span에 PDF null쪽이라고 표시되어 있으므로 쪽수를 추정하지 않고 미기록 표시로 고친다.',status:nullFixed?'resolved':'open'}],
 questions:[
 {set_id:sets[0].id,subquestion_id:'sub1',source:'KGA 240.32',facts:'fact1의 일반 승인통제 정상과 CFO 특별계정의 우회권한을 비교해야 한다.',answer_and_points:'통제무력화 위험을 유의적 위험에서 제외할 수 없다는 판단 1점, 특별한 권한·예측 불가능성에 따른 이유 1점. 이유만으로 판단이 분명히 함축되는 답을 허용한다. 다른 거래통제가 정상이라는 사실이 답안을 직접 제공하지 않는다.',qa:'partial은 유의적 위험 판단만 1점이고 권한 이유를 함축하지 않는다. wrong은 제외한다고 명시하여 0점.'},
 {set_id:sets[0].id,subquestion_id:'sub2',source:'KGA 240.33(a)(i)-(iii), 2017 기출 물음3 및 고급연습 23년 제1회 GS 문제3',facts:'fact2의 설명 없는 특별계정 조정은 질문·기간말 대상, 3·6·9월 조정은 전체 기간 테스트 필요성 고려에 이용된다.',answer_and_points:'질문 대상과 부적합 행위 확인, 기간말 특별계정 수동조정의 추출·검사, 다른 분기도 테스트할 필요의 고려는 독립 절차 각 1점. 모든 분개의 무조건 전수검사나 이미 수행한 업무의 반복 점수로 바꾸지 않는다. 초기 R-A-01 지적 후 자동 정규분개만 추출하고 특별계정 수동분개를 제외하는 최종 사실을 직접 다시 읽었으며, 이제 수동분개 추가가 실제 보완 요구가 되어 결함이 해소되었다.',qa:'partial 질문 절차만 1점. wrong은 대상추출·관여자 질문·기중 검토 모두 생략하므로 0점.'},
 {set_id:sets[0].id,subquestion_id:'sub3',source:'KGA 240.33(b)(i)-(ii)',facts:'fact3의 개별 합리적 범위, 동일 이익방향, 전기 제품보증 추정과 당기 지급 차이가 각각 편의 및 소급검토 조건이다.',answer_and_points:'동일 방향을 근거로 편의가능성·부정위험 평가 1점, 그러한 가능성 시 전반적 재평가 1점, 전기 유의적 제품보증의 판단·가정 소급검토 1점. 제안의 적절성이라는 추가 판단점수를 숨겨 넣지 않는다. 모든 추정이 틀렸다거나 사후 결과만으로 전기 오류 확정이라고 단정하지 않는다.',qa:'partial은 편의·위험 평가만 1점이며 재평가와 소급검토를 함축하지 않는다. wrong은 개별 합리성만으로 검토 종료하므로 0점.'},
 {set_id:sets[1].id,subquestion_id:'sub1',source:'KGA 550.22(a)(b), 2018 기출 문제6 물음3',facts:'fact1의 미공개 사실 확정, 팀 미전달, 보증 외 거래 부인, 신고서 취합 통제가 모두 물음에 이용된다.',answer_and_points:'업무팀 신속 공유 1점·경영진의 모든 거래 식별 요청 1점·통제가 왜 식별/공개에 실패했는지 질문 1점. 발문에서 제외한 후속 실증·기타 누락위험·고의성 판단을 득점에 넣지 않은 한정이 적합하다.',qa:'partial 정보전달만 1점; wrong은 요청·질문·공유를 모두 생략하므로 0점. 이미 특수관계자임이 확정된 사실을 다시 정의하게 하지 않는다.'},
 {set_id:sets[1].id,subquestion_id:'sub2',source:'KGA 550.23(a)(i)(ii),(b)',facts:'fact2의 금융업 아님, 정상과정 밖 유의적 보증, 보증료 설명·초안 불일치, 임원서명만 있는 상태가 각 감사절차의 대상이다.',answer_and_points:'사업상 이유/결여와 부정·유용 은폐 가능성 평가 1점·설명과 최종조건 일관성 평가 1점·인가승인의 증거 확보 1점. 계약 초안만으로 부정이나 승인 미달을 확정하지 않는다. 회계처리·공시는 발문에서 제외되어 원문 전체 목록을 숨은 요구로 확대하지 않는다.',qa:'partial 사업상 이유 검토만 1점; wrong은 임원서명을 근거로 모든 검사 생략이라 0점.'},
 {set_id:sets[1].id,subquestion_id:'sub3',source:'KGA 550.24,A42; 고급연습 정상거래조건 요구와 인접 관계',facts:'fact3의 같은 4%와 다른 담보·만기조건을 비교해야 하며 금리 일치만으로 주장을 증명할 수 없다.',answer_and_points:'충분하다는 판단의 부적절성 1점·금리 외 조건 차이를 연결한 증거 검토 1점. 담보·신용·만기·상환은 비교해야 할 조건의 예시로 읽으며 각각 모두를 별도 미충족 감점하는 채점은 지양해야 한다. 모범답안은 실제 차이를 충분히 적용했다.',qa:'partial은 금리만으로 부족하다는 판단 1점이며 구체 차이의 이유가 없다. wrong은 담보·만기를 검토할 필요 없다고 하여 0점.'}
 ],
 result:issueFixed&&nullFixed?'pass_after_author_revision':'requires_revision',
 unresolved:(!issueFixed?['R-A-01']:[]).concat(!nullFixed?['R-A-02']:[])};
fs.writeFileSync(`${b}/a/root-peer-review.json`,JSON.stringify(record,null,2)+'\n');
console.log({result:record.result,unresolved:record.unresolved,sets_sha256:record.sets_sha256});
