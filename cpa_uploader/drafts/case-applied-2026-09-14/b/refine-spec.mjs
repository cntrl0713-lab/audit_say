import fs from 'node:fs';
import original from './authoring-spec.mjs';
const dir='cpa_uploader/drafts/case-applied-2026-09-14/b';
const specs=structuredClone(original),boundaries=[];
specs[0].facts[2]=specs[0].facts[2].replace('보고서에는 다른 통제에 대한 테스트 결과도 함께 기록되어 있고, 현재 정보만으로 다온회사의 급여가 실제 잘못 지급되었다거나 모든 통제가 실패하였다고 결론 내릴 수는 없다.','보고서에는 다른 통제에 대한 테스트 결과도 함께 기록되어 있다. 다온회사의 실제 급여 지급 오류에 대한 별도 검사결과는 아직 없다.');
specs[1].comparison.find(c=>c[0]==='pilot-06-008')[1]='기존은 고유위험요소와 회사 위험평가절차의 누락을 검토하고, 신규는 새 정보에 따른 감사인 자신의 위험평가와 감사절차 수정을 다룬다.';
for(const [i,j,answer]of [[0,2,'예외가 한 건이라도 있으면 보고서 전체를 반드시 배제하고, 다온의 승인통제나 급여 지급 위험과 연결해서 평가할 필요는 없다.'],[1,1,'사업보고서에서 발견한 문제이므로 기타정보 단락에만 설명하고 재무제표에는 적정의견을 유지한다.'],[2,2,'주석에 오류수정이 공시되어 있으므로 감사보고서에서는 의견 차이를 설명하지 않는다. 그 차이가 생긴 이유는 다른 전임감사인이 전기를 감사했기 때문이다.']]){
 const q=specs[i].questions[j];const [prior,met,reason]=q.wrong;
 boundaries.push({set_id:specs[i].id,subquestion_id:q.id,kind:'explicit_opposite_with_independent_correct_basis',answer:prior,expected_points:met.length,met_criterion_ids:met.map(k=>`${q.id}.c${k}`),reason,model_grading:'not_run',selection:'보조 내용 검토·회귀 경계로 보존. 0점 wrong 대표에 사용하지 않는다.'});
 q.wrong=[answer,[],'판단·보고조치를 반대로 제시하며 독립적인 올바른 근거도 제시하지 않은 0점 대표 오답이다.'];
}
const q=specs[2].questions[0];
q.prompt='이번 비교재무제표 감사보고서에서 2025년과 2026년 재무제표에 각각 표명할 감사의견을 제시하시오. 각 의견의 이유나 보고서 문단의 작성은 여기서는 요구하지 않는다.';
q.criteria=[q.criteria[0],q.criteria[2]];
q.criteria[0][0]='이번에 제시된 2025년 재무제표에 대해서는 적정의견을 표명한다.';
q.criteria[1][2]='당기 2026년에 대한 한정의견 판단 1점. 부적정의견·의견거절·적정의견 등 명시적 반대 의견은 0점이며 다른 기간의 의견 점수와 구분한다. 이 물음에서는 의견의 이유를 별도로 요구하거나 배점하지 않는다.';
q.partial=['2025년 재무제표에 대해서는 적정의견을 표명한다.',[1],'전기에 대한 올바른 의견만 제시했으므로 1점. 당기의 한정의견은 제시하지 않았다.'];
q.rationale='동일 감사인이 이번에 보고하는 수정된 전기와 미수정 오류가 남은 당기의 사실을 각각 해석하여 의견만 결정한다. 710.A9·700.16·705.7(a)를 대조했으며, 전기 변경의 실제 이유는 물음3에만 배점하여 중복하지 않는다.';
q.point='조정: 원설계의 기간별 판단·근거 4점을 두 기간의 의견만 묻는 2점으로 축소했다. 2025년 적정의견과 2026년 한정의견에 각각 1점을 두며 이유는 숨은 요건으로 평가하지 않는다. 전기 의견변경의 이유는 물음3에서만 배점한다.';
specs[0].learning[2][0]='src-cad12050d3d887157f';specs[1].learning[1][0]='src-a8f6a9d3321c6c246b';specs[0].latest[1]=[15739,15758,'402.17 본문, PDF367'];
specs[1].latest.push([11905,11916,'315.A236 의존문맥, PDF288'],[14853,14886,'330.A4-A8 의존문맥, PDF346'],[35246,35255,'720.A51 의존문맥, PDF851']);
fs.writeFileSync(`${dir}/authoring-spec-final.mjs`,'export default '+JSON.stringify(specs,null,2)+';\n');
fs.writeFileSync(`${dir}/qa-boundaries.json`,JSON.stringify(boundaries,null,2)+'\n');
fs.writeFileSync(`${dir}/correction-history.json`,JSON.stringify({version:1,prior_file:`${dir}/authoring-spec.mjs`,current_file:`${dir}/authoring-spec-final.mjs`,authority:'root content review and independent source peer review before any model grading',changes:[{set_id:specs[2].id,subquestion_id:'sub1',before_points:4,after_points:2,reason:'두 기간의 의견만 판단하도록 좁혀 전기 오류해소의 이유가 sub3과 중복 배점되지 않게 했다. 원문·원설계는 덮어쓰지 않았다.'},{scope:'three wrong representatives',reason:'독립적으로 맞는 근거로 1점이 남는 반대판단 경계는 원답안·기대값을 qa-boundaries.json에 보존하였다. QA wrong 역할에는 새 0점 대표 답안을 별도 작성했다. 실제 점수에 맞춘 기대값 조정이 아니며 모델 채점 전 수정이다.'},{set_id:specs[0].id,fact_id:'fact3',before:'현재 정보만으로 다온회사의 급여가 실제 잘못 지급되었다거나 모든 통제가 실패하였다고 결론 내릴 수는 없다.',after:'다온회사의 실제 급여 지급 오류에 대한 별도 검사결과는 아직 없다.',reason:'독립 교차검토에서 판단 방향을 미리 주는 문장을 확인하여 root 승인으로 관찰 가능한 증거 상태로 바꿨다. 보고서에 다른 통제 테스트 결과가 있다는 사실은 유지하며 정답·발문·배점·QA 기대값은 바꾸지 않았다.'}],actual_model_grading:'not_run'},null,2)+'\n');
