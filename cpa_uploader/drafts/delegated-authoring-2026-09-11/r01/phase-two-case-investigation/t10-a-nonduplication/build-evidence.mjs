import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const folder=path.dirname(fileURLToPath(import.meta.url));
const prefix='cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/';
const files={receipt:prefix+'phase-two-v4/draft-10-530-freq01/semantic-cohort-v4-01-2/review/semantic.json',bank:'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v2/comparison-bank.json',draft:prefix+'draft-10-530-freq01.json',plan:prefix+'draft-10-530-freq01.json.authoring-plan.json'};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const review=read(files.receipt).reviews[0],bank=read(files.bank),draft=read(files.draft),plan=read(files.plan);
const sets=Array.isArray(bank)?bank:bank.question_sets||bank.sets;
const ids=['pilot-07-002','pilot-07-004'];
const comparisons=[
 {existing:'pilot-07-002/sub1/crit1',target:'draft-10-530-freq01/q1/q1.c1-q1.c2',relationship:'adjacent',reason:'기존은 통제테스트 수행의 충분조건(운영효과성 의존 계획)을 열거한다. 후속은 이미 수행할 통제테스트에서 의존 정도가 증가할 때 표본규모 방향과 그 확신 근거를 요구한다. 수행 조건을 답하는 것만으로 후속의 표본규모 증가를 답한 것은 아니다.'},
 {existing:'pilot-07-002/sub1/crit2',target:'draft-10-530-freq01/q1',relationship:'adjacent',reason:'기존은 실증절차만으로 증거가 불충분할 때 통제테스트가 요구됨을 묻는다. 후속은 실증절차만의 불충분 여부나 수행 필요성을 묻지 않는다.'},
 {existing:'pilot-07-004/sub1/crit1-crit2',target:'draft-10-530-freq01/q1',relationship:'adjacent',reason:'같은 통제테스트 수행조건 명제이며 위 07-002/sub1과 같은 차이가 있다.'},
 {existing:'pilot-07-004/sub2/crit3',target:'draft-10-530-freq01/q1/q1.c2',relationship:'partial',reason:'통제 의존이 커지면 더 설득력 있는 증거가 필요하다는 기존 요구는 후속의 더 많은 운영효과성 확신이라는 이유와 일부 공유한다. 그러나 기존은 표본 규모라는 증거의 범위, 다른 사항 동일이라는 조건, 규모 증가 방향을 요구하지 않는다. 증거 설득력은 표본 크기와 동일 개념이 아니다.'},
 {existing:'pilot-07-002 및 pilot-07-004의 모든 subquestion',target:'draft-10-530-freq01/q1/q1.c3-q1.c4',relationship:'adjacent',reason:'두 기존 세트 어느 발문·claim도 실제 이탈률이 허용이탈률을 초과하지 않을 확신 요구수준의 증가와 그에 따른 표본규모·이유를 묻지 않는다.'}
];
const selected=sets.filter(s=>ids.includes(s.id));
if(selected.length!==2)throw Error('Missing reference sets');
const evidence={recorded_at:new Date().toISOString(),scope:'두 지목 기존 세트와 T10-A q1의 실제 요구 대조. 전체 은행의 무중복 인증 또는 의미검수 판정 덮어쓰기가 아니다.',api_calls:0,files:Object.fromEntries(Object.entries(files).map(([k,file])=>[k,{file,sha256:hash(file)}])),original_unit:review.units.find(u=>u.id==='subquestion:q1'),criterion_units:review.units.filter(u=>u.id.startsWith('criterion:q1:')).map(u=>({id:u.id,checks:u.checks,rationale:u.rationale})),current_plan:plan,shared_context:draft.shared_context,target:draft.subquestions.find(s=>s.id==='q1'),existing_sets:selected.map(s=>({id:s.id,title:s.title,shared_context:s.shared_context,subquestions:s.subquestions})),comparisons,conclusion:'지목된 기존 두 세트에 대해 q1 전체의 직접 중복이라는 판정은 근거가 부족하다. 일부 설명 개념의 공유는 인정하되 수행 필요성, 증거의 설득력, 일정 조건에서의 표본규모 방향·이유는 구별한다. 복습 라벨 추가로 정당화하지 않으며 기존 계획의 구체 요구 차이도 원형대로 보존한다.',limits:['동일 subquestion 입력 3회 재현은 총괄 수행 범위이며 이 보고서에는 아직 없는 결과를 만들어 넣지 않는다.','공식 인용 줄 범위 문제는 별도 source_support 쟁점이다. 이 nonduplication 대조만으로 source_support uncertain을 pass로 바꾸지 않는다.','후속 q1.c2와 기존 07-004/sub2의 부분 공유는 숨기지 않는다. 전체 물음의 직접 중복 여부와 구별한다.']};
fs.writeFileSync(path.join(folder,'evidence.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({comparisons:comparisons.length,existing_sets:selected.map(s=>s.id),original_nonduplication:evidence.original_unit.checks.nonduplication,criterion_nonduplication:evidence.criterion_units.map(u=>u.checks.nonduplication),api_calls:0}));
