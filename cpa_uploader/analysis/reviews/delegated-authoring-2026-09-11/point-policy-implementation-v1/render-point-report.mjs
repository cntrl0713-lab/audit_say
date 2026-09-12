import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {studyTopics} from '../../../../wiki/scripts/ox-study-order.mjs';
const [manifestFile,outputFile,sampleFile]=process.argv.slice(2);
if(!manifestFile||!outputFile||fs.existsSync(outputFile))throw Error('Manifest and new report file required');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest=read(manifestFile),validation=read(manifest.point_policy.report_file);
const sample=sampleFile?read(sampleFile):null;
if(manifest.errors.length||validation.errors.length||validation.audits.length!==131)throw Error('Complete local validation required');
const folder=path.dirname(outputFile);
const link=file=>path.relative(folder,file).replaceAll('\\','/');
const clean=text=>String(text).replaceAll('|','\\|').replace(/\r?\n/g,' ');
const oldPoints=validation.audits.reduce((n,q)=>n+q.old_points,0);
const lines=['# 요소별 배점·서술 부분점수 적용 결과','',
 `49세트·131물음을 전수 대조하여 배점을 ${oldPoints}점에서 ${manifest.collected_points}점으로 조정했다. ${validation.totals.changed_sets}세트의 문항 파일을 수정했고, 물음 내용·채점기준이 달라진 곳은 ${validation.totals.changed_questions}개, 실제 배점이 바뀐 물음은 ${validation.totals.reweighted_questions}개다. 모든 채점기준은 독립 명제당 1점이며 충족한 명제 점수를 합산한다.`, '',
 '사용자가 승인한 열거 요소별 배점과 서술의 독립 내용별 부분점수를 적용했다. 세 담당자의 전수 대조와 총괄 교차검토를 거쳐 물음마다 수정 또는 유지 이유를 남겼다. 기존 주제·세트·물음 ID를 유지하고, 새 세부 기준은 이전 기준과의 대응표를 보존했다.', '',
 `작성자 QA의 원래 답안 ${validation.totals.preserved_qa_answers.toLocaleString('en-US')}개를 모두 보존하고 ${validation.totals.added_qa_cases.toLocaleString('en-US')}개를 추가하여 ${validation.totals.qa_cases.toLocaleString('en-US')}개로 준비했다. 원문의 복합 기준을 나눈 경우 각 원답안의 새 기대값을 대조했다. 이는 작성자 기대값과 로컬 형상·합산 확인이며 실제 모델 채점 결과가 아니다.`, '',
 sample?`사용자가 이후 최소 API 채점을 허용하여 대표 ${sample.planned_cases}개를 선정했다. 생산 채점 시도 ${sample.actual_attempts}회 중 결과를 얻은 답안은 ${sample.observed_cases}개이며, ${sample.matched_cases}개 일치·${sample.mismatched_cases}개 불일치·실행 오류 ${sample.execution_error_cases}개다. ${sample.execution_error_cases?'첫 대표 호출에서 HTTP 429 오류가 발생해 후속 호출을 중지했다. 실제 채점 결과가 없어 배점 동작의 통과로 인정하지 않는다. ':''}[대표 실측 기록](${link(sampleFile)})에서 원시 결과를 확인할 수 있다. 전체 의미검수·전수 QA 채점은 재개하지 않았다.`:'**API는 사용자 요청에 따라 중지 상태를 유지했다. 이 후속 배점으로 수행한 API 호출은 0회이며 실제 의미검수·모델 재채점은 미실행이다.**', '',
 '과거 433점 계약의 실측과 실패를 새 배점의 통과로 바꾸지 않았다. 정본·공개본·운영 DB·배포는 변경하지 않았다.', '',
 `[현재 선택·비교 은행 장부](${link(manifestFile)}) · [131물음 검토·검사 JSON](${link(manifest.point_policy.report_file)}) · [수정 전 제안](${link('docs/archive/과거-검토-증거/reports/question-authoring-by-topic-2026-09-11/열거-요소별-배점과-서술-부분점수-검토안.md')})`, '',
 '## 세트별 배점 변화','', '아래 총점은 학습용 문제 묶음의 독립 정답 요소 합계다. 한 회차 시험의 100점 배분표가 아니며, 세트마다 같은 점수로 맞추지 않았다.', '', '| 주제 | 세트 | 기존 물음별 점수 | 적용 물음별 점수 | 기존 합계 | 적용 합계 |', '|---|---|---|---|---:|---:|'];
for(const topic of studyTopics){
 for(const entry of manifest.entries.filter(e=>e.topic_id===topic.id)){
  const qs=validation.audits.filter(q=>q.plan_id===entry.plan_id);
  lines.push(`| ${topic.id} | [${entry.plan_id}](${link(entry.file)}) | ${qs.map(q=>q.old_points).join(' / ')} | ${qs.map(q=>q.new_points).join(' / ')} | ${qs.reduce((n,q)=>n+q.old_points,0)} | ${entry.points} |`);
 }
}
const topic19=validation.audits.filter(q=>q.plan_id==='T19-A');
lines.push('', '## 주제 19와 서술량의 처리','',
 `주제 19의 T19-A는 물음별 ${topic19.map(q=>q.old_points).join(' / ')}점에서 ${topic19.map(q=>q.new_points).join(' / ')}점으로 조정했다. 중요성 완화 제안의 판단, 중요성 판단의 기초, 확신 수준과 미발견위험의 관계를 구별했다.`, '',
 '검토 결론 문구는 길어도 대상 재무제표·재무보고체계가 이미 지문에 주어져 있다. 이 명칭을 옮겨 쓰는 데 점수를 추가하지 않고, 확신 수준과 소극적 결론이라는 실제 요구를 평가한다. 서면진술 생략 불가와 입수 의무는 같은 의무를 반대로 표현한 것이므로 중복 점수를 만들지 않았다.', '',
 '반대로 T08-C의 전문가 업무 평가처럼 발문이 여러 평가특성을 모두 요구하는 경우에는 각 특성을 따로 배점했다. 짧은 하나의 답안 안에서 여러 정확한 특성이 드러나면 그만큼 인정한다. 이 물음은 요구량 자체가 큰 연습이므로 다른 세트와 같은 총점에 맞추지 않는다.', '',
 '## 물음별 타당성 점검','', '유지한 물음에도 이유를 적었다. 원문 범위·핵심 조건·대안 관계를 보존하고 이미 주어진 사실과 같은 의미의 반복을 별도 점수로 늘리지 않았다.','');
for(const topic of studyTopics){
 const group=validation.audits.filter(q=>q.topic_id===topic.id);
 if(!group.length)continue;
 lines.push(`### 주제 ${topic.id}`,'','| 물음 | 이전 → 적용 | 결정 | 배점 근거 |','|---|---:|---|---|');
 for(const q of group){lines.push(`| ${q.plan_id} / ${q.id} | ${q.old_points} → ${q.new_points} | ${q.decision==='retain'?'유지':q.decision==='split'?'분리':'명료화'} | ${clean(q.rationale)} |`);}
 lines.push('');
}
lines.push('## 검증 범위','',
 '- 로컬 확인: 49/131 전수성, 원문 인용 실존, 문항·계획 형상, 비교 은행 153세트의 ID·발문 충돌, 기존 ID 보존, 원답안 보존, 기대 판정의 정수 합계, 빈답안·모범답안 및 명제별 충족·누락·반대 사례.',
 sample?`- 제한 실측: 대표 ${sample.observed_cases}개 답안의 실제 모델 채점, ${sample.actual_attempts}회 실행. 미실행: 새 비교 은행의 전체 실제 의미검수와 전체 QA 채점. 대표 결과로 전체 검증 완료를 선언하지 않는다.`:'- 미실행: 새 비교 은행과 후속 문항에 대한 실제 모델 의미검수·채점·불일치 반복 실측. API 중지 지시를 유지했다.',
 '- 사람 승인·정본 편입·게시·운영 배포는 수행하지 않았다. 문항은 needs_review / needs_human_review 상태다.', '',
 `선택 manifest SHA-256: \`${hash(manifestFile)}\``, '');
fs.mkdirSync(folder,{recursive:true});
fs.writeFileSync(outputFile,lines.join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({outputFile,sets:manifest.entries.length,questions:validation.audits.length,points:manifest.collected_points,local_validation_model_calls:0,representative_grading_attempts:sample?.actual_attempts||0}));
