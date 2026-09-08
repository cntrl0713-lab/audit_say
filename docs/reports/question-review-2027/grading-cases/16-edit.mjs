// Topic 16 follow-up; preserve all other in-flight topic edits, IDs and publication states.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const dir='docs/reports/question-review-2027/grading-cases',file='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=JSON.parse(fs.readFileSync(file)),sets=bank.filter(s=>s.id.startsWith('pilot-16-'));
assert.equal(sets.length,7);
const sourceFile='cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt',text=fs.readFileSync(sourceFile,'utf8');
function span(start,end){const i=text.indexOf(start);assert.ok(i>=0,start);const j=text.indexOf(end,i+start.length);assert.ok(j>i,end);return text.slice(i,j).trim();}
const passages={
 '701.9':span('9. 감사인은 지배기구와','10. 감사인은 문단9'),
 '701.11':span('11. 감사인은 문단 14','변형의견 표명을 대체하기'),
 '701.12':span('12. 감사인이 어떤 사항으로','개별 핵심감사사항의 기술'),
 '701.13':span('13. 감사보고서의 핵심감사사항','핵심감사사항으로 결정된 사항이'),
 '701.15':span('15. 감사기준서 705에','다른 상황에서의 핵심감사사항'),
 '706.7':span('7. 감사기준에서 사용하는 용어의 정의는 다음과 같다. ','요구사항'),
 '706.8':span('8. 감사인은 재무제표에 표시되거나','9. 감사인이 감사보고서에 강조사항문단'),
 '706.9':span('9. 감사인이 감사보고서에 강조사항문단','감사보고서의 기타사항문단'),
 '710.2':span('2. 기업의 재무제표에 표시되는','3. 두 가지 접근법'),
 '710.6b':span('(b) 대응수치','(c) 비교재무제표'),
 '710.6c':span('(c) 비교재무제표','이 감사기준서에서 “전기”란'),
 '720.14-15':span('14. 감사인은 기타정보를 열람하여야','PDF PAGE 811'),
 '720.17':span('17. 감사인이 기타정보에 중요한','18. 감사인이 감사보고서일 전에'),
};
const pages={'701.9':'722–723','701.11':'723','701.12':'723','701.13':'723','701.15':'724','706.7':'772','706.8':'772','706.9':'772–773','710.2':'787','710.6b':'788','710.6c':'788','720.14-15':'810','720.17':'811'};
function sources(s,map){s.source_refs=Object.entries(map).map(([id,p])=>({id,file:sourceFile,title:`한국공인회계사회 회계감사기준 전문(2025 개정) / KGA ${p.split('.')[0]} / 문단 ${p.split('.')[1]} / PDF p.${pages[p]}`,page:`KGA ${p.split('.')[0]}`,source_quote:passages[p],role:'standard',content_hash:crypto.createHash('sha256').update(passages[p]).digest('hex')}));for(const q of s.subquestions)for(const r of q.requirements){const src=s.source_refs.find(x=>x.id===r.source_ref_id);assert.ok(src);r.source_quote=src.source_quote;r.source_span=`${map[src.id]} / PDF p.${pages[map[src.id]]} / 2025 개정; 2026 전문 대조`;} }
function contract(q,i,claim){q.criteria[i].claim=claim;q.criteria[i].critical_facts[0].expected=claim;}
for(const s of sets){for(const q of s.subquestions){q.constraints={ordered:false,max_entries:null,overflow_policy:'none'};q.selection={type:'all',n:null};}s.verification.notes=s.verification.notes.filter(n=>!n.startsWith('2026-09-08 주제16 후속 검토:'));s.verification.notes.push('2026-09-08 주제16 후속 검토: 공식 2025 전문 및 2026 개정 전문 직접 근거 대조. 출처·발문·조건·정수 채점 계약 정합화. 기존 게시·검수 상태 유지; 2027 최종 시험 판본 미확정. 상세 실측은 docs/reports/question-review-2027/16.md 참조.');}
let s=sets[0],q=s.subquestions[0];sources(s,{src6:'710.2',src12:'710.6b',src14:'710.6c'});
s.classification.tags=['비교정보','대응수치','비교재무제표','감사인의 보고책임'];
q.prompt='전기의 금액과 기타 공시가 당기재무제표에 포함되는 방식과 목적, 감사를 받은 비교재무제표에 대한 감사의견의 언급을 중심으로 대응수치와 비교재무제표의 차이를 설명하시오.';
q.model_answer=['대응수치는 전기의 금액과 기타 공시가 당기재무제표의 필수적인 부분으로 포함되는 비교정보이다.','대응수치는 당기수치와 관련하여서만 이해되도록 의도된다.','비교재무제표는 전기의 금액과 기타 공시가 당기재무제표와 비교할 목적으로 포함되는 비교정보이다.','비교재무제표가 감사를 받았다면 감사의견에서 언급된다.'];
s.subquestions[1].prompt='주식회사 등의 외부감사에 관한 법률에 따른 감사에서 감사인은 비교정보에 관하여 어떤 방식으로 보고해야 하는지 제시하시오.';
s.subquestions[1].type='descriptive';s.subquestions[1].model_answer=['비교재무제표 방식에 따라 보고해야 한다.'];contract(s.subquestions[1],0,'외부감사법에 따른 감사에서 비교재무제표 방식으로 보고해야 함을 제시함. 방식 명칭만으로도 인정하며 별도 근거는 요구하지 않음');
s=sets[1];sources(s,{src1:'701.9',src2:'701.13'});
s.subquestions[0].prompt='지배기구와 커뮤니케이션한 사항 중 유의적 감사인 주의를 요구한 사항을 결정할 때 감사인이 고려해야 할 세 가지 분야를 모두 제시하시오.';
s.subquestions[1].prompt='감사보고서의 핵심감사사항 단락에 개별 핵심감사사항을 기술할 때 포함하거나 다루어야 할 세 가지 내용을 모두 설명하시오.';
s=sets[2];sources(s,{src1:'720.14-15',src2:'720.17'});
s.shared_context.facts[0].text='감사기준서 720이 적용되는 재무제표감사에서 감사인은 사업보고서에 포함된 기타정보를 입수하여 열람하고 있다.';
q=s.subquestions[0];q.prompt='기타정보를 열람할 때 수행해야 할 두 가지 중요한 불일치 고려와 추가로 유지해야 할 주의를 모두 설명하시오. 재무제표와의 불일치를 고려하는 기초가 되는 비교 절차도 포함하시오.';
q.model_answer[0]='기타정보와 재무제표 간 중요한 불일치가 있는지 고려한다. 그 기초로서 기타정보에서 선택한 금액이나 기타 항목을 재무제표의 해당 금액이나 기타 항목과 비교한다.';
q.model_answer[1]='감사에서 입수한 감사증거와 도달한 결론의 관점에서 기타정보와 감사에서 얻은 감사인의 지식 간 중요한 불일치가 있는지 고려한다.';
contract(q,0,'기타정보와 재무제표 간 중요한 불일치를 고려하고, 그 기초로 기타정보에서 선택한 금액이나 항목을 재무제표의 해당 금액이나 항목과 비교함. 불일치 고려와 비교 절차를 모두 요구하는 1점 명제');
contract(q,1,'감사에서 얻은 감사인의 지식(입수한 증거와 도달한 결론의 관점)과 기타정보 간 중요한 불일치가 있는지 고려함');
q=s.subquestions[1];q.prompt='기타정보에 중요한 왜곡표시가 있다고 결론 내린 경우, 먼저 경영진에게 요구할 조치와 경영진이 수정에 동의하거나 거부할 때 각각 취할 조치를 설명하시오. 지배기구와 커뮤니케이션한 뒤에도 미수정인 경우의 후속 대응은 제외한다.';
s=sets[3];sources(s,{src1:'706.7',src2:'706.9',src3:'706.8'});
s.subquestions[0].type='descriptive';contract(s.subquestions[0],0,'강조사항문단은 재무제표에 적절하게 표시되거나 공시된 사항을 다룬다고 설명함');
q=s.subquestions[1];q.prompt='강조사항문단의 포함 요건이 충족되었다. 작성 시 다음 네 측면의 준수사항을 모두 제시하시오. ① 제목 ② 별도 단락 배치 ③ 강조할 사항·관련 공시 위치의 언급과 언급 가능한 정보의 범위 ④ 강조된 사항과 감사의견의 관계';
q.model_answer[2]='강조할 사항과 이를 상세하게 기술한 재무제표의 관련 공시 위치를 명확히 언급하고, 재무제표에 표시되거나 공시된 정보만 언급한다.';
contract(q,2,'강조할 사항 및 이를 상세히 기술한 재무제표의 관련 공시 위치를 명확히 언급하고, 재무제표에 표시되거나 공시된 정보만 언급함. 위치 언급과 정보 범위를 모두 요구하는 1점 명제');
contract(q,3,'강조된 해당 사항과 관련하여 감사의견이 변형되지 않음을 나타냄. 다른 사유로 인한 변형의견과의 병존을 부정하거나 보고서 전체가 반드시 적정의견이라고 단정하지 않음');
s=sets[4];sources(s,{src1:'701.9',src2:'701.11'});
s.title='핵심감사사항의 고려 분야와 도입 문구';s.classification.tags=['핵심감사사항','유의적 감사인 주의','도입 문구'];
s.subquestions[0].prompt='감사인은 지배기구와 커뮤니케이션한 사항에서 유의적 감사인 주의를 요구한 사항을 결정하려 한다. 이때 고려해야 할 세 가지 분야의 내용을 모두 제시하시오.';
q=s.subquestions[1];q.model_answer=['핵심감사사항은 감사인의 전문가적 판단에 따라 당기 재무제표감사에서 가장 유의적인 사항이라는 점을 기술한다.','해당 사항이 재무제표 전체에 대한 감사의 관점에서 전체 감사의견 형성 시 다루어졌으며, 해당 사항에 대해 별도의 의견을 제공하지 않는다는 점을 기술한다.'];
contract(q,0,'핵심감사사항이 감사인의 전문가적 판단에 따라 당기 재무제표감사에서 가장 유의적인 사항임을 도입 문구에 기술함');
contract(q,1,'재무제표 전체 감사의 관점에서 전체 감사의견 형성 시 다루어졌다는 점과 해당 사항에 별도의 의견을 제공하지 않는다는 점을 모두 도입 문구에 기술함. 둘 중 하나만 쓰면 이 결합 criterion은 미충족');
s=sets[5];sources(s,{src1:'701.12',src2:'701.13',src3:'701.15'});
s.title='변형의견 사항의 보고와 개별 핵심감사사항 기술';s.classification.tags=['핵심감사사항','변형의견','개별 기술'];
s.shared_context.facts[0].text='감사인은 핵심감사사항의 보고 방법을 검토하고 있다. 물음 1은 의견변형을 초래하는 사항을, 물음 2는 그 사항과 별개로 핵심감사사항 단락에 기술할 일반적인 개별 핵심감사사항을 다룬다.';
contract(s.subquestions[0],0,'변형의견을 초래하는 사항을 핵심감사사항 단락에 개별 핵심감사사항으로 기술할 수 없다고 판단함. 판단만으로 인정함. 이 사항이 본질상 핵심감사사항이 아니라고 단정하거나 한정·부적정의견근거 단락에 대한 참조마저 금지한다고 명시하면 불인정');s.subquestions[0].criteria[0].source_ref_ids=['src1','src3'];
s.subquestions[0].model_answer=['할 수 없다. 변형의견을 초래하는 사항을 핵심감사사항 단락에서 개별 핵심감사사항으로 기술해서는 안 된다.'];
s.subquestions[1].prompt='핵심감사사항 단락에 기술하는 일반적인 개별 핵심감사사항에 포함하거나 다루어야 할 세 가지 내용을 모두 제시하시오.';
s=sets[6];s.subquestions[0].requirements.find(r=>r.id==='req2').source_ref_id='src1';s.subquestions[0].criteria[1].source_ref_ids=['src1'];sources(s,{src1:'701.9',src3:'701.11'});
s.classification.tags=['핵심감사사항','유의적 감사인 주의','도입 문구'];
s.shared_context.facts[0].text='감사인은 지배기구와 커뮤니케이션한 사항을 검토하고 핵심감사사항 단락의 도입 문구를 작성하려 한다.';
s.subquestions[0].prompt='지배기구와 커뮤니케이션한 사항 중 유의적 감사인 주의를 요구한 사항을 결정할 때 고려할 분야 중 다음 두 분야의 내용을 모두 제시하시오. ① 중요왜곡표시위험 관련 분야 ② 보고기간의 사건·거래 관련 분야';
contract(s.subquestions[0],0,'중요왜곡표시위험이 더 높게 평가되거나 유의적 위험으로 식별된 분야를 제시함');
contract(s.subquestions[1],0,'핵심감사사항에 별도의 의견을 제공한다고 기술할 수 없다고 판단함. 별도 의견을 제공하지 않는다는 도입 문구로 판단을 분명히 표현해도 인정');
contract(s.subquestions[1],1,'핵심감사사항이 감사인의 전문가적 판단에 따라 당기 재무제표감사에서 가장 유의적인 사항이라는 점과 재무제표 전체 감사의 관점에서 전체 감사의견 형성 시 다루어졌다는 점을 모두 도입 문구에 기술함. 두 내용을 결합한 1점 명제');
for(const idx of [1,4]){q=sets[idx].subquestions[0];contract(q,1,'높은 추정불확실성을 가진 회계추정치를 포함하여 유의적 경영진 판단이 수반된 재무제표 분야와 관련된 유의적 감사인 판단을 고려함');contract(q,2,'보고기간 중 발생한 유의적인 사건이나 거래가 감사에 미치는 영향을 고려함');}
fs.writeFileSync(file,JSON.stringify(bank,null,2)+'\n');fs.writeFileSync(`${dir}/16-source-passages.json`,JSON.stringify(passages,null,2)+'\n');
console.log('Updated 7 sets / 14 questions / 38 criteria / 38 points');
