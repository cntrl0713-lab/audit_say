import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const dir='docs/reports/question-review-2027/grading-cases',file='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=JSON.parse(fs.readFileSync(file)),sets=bank.filter(s=>s.id.startsWith('pilot-15'));
assert.deepEqual(sets,JSON.parse(fs.readFileSync(`${dir}/15-before.json`)),'Topic15 changed; merge explicitly');
const quotes=JSON.parse(fs.readFileSync(`${dir}/15-source-quotes.json`));
function sources(s,spec){s.source_refs=Object.entries(spec).map(([id,[key,page]])=>({id,file:'cpa_uploader/data/official/kga700-705-2025-review15.txt',title:'한국공인회계사회 회계감사기준 전문(2025 개정)',page:'KGA '+key.slice(0,3),source_quote:quotes[key],role:'standard',content_hash:crypto.createHash('sha256').update(quotes[key]).digest('hex')}));for(const q of s.subquestions)for(const r of q.requirements){r.source_quote=s.source_refs.find(x=>x.id===r.source_ref_id).source_quote;r.source_span=spec[r.source_ref_id].join(', PDF p.');}}
function claim(q,i,t){q.criteria[i].claim=t;q.criteria[i].critical_facts[0].expected=t;}
function req(q,id,src){q.requirements.push({id,source_ref_id:src});}
function extra(q,id,text,requirement,source){const c={...structuredClone(q.criteria[0]),id,requirement_id:requirement,claim:text,critical_facts:[{id:'cf'+id.slice(4),type:'action',expected:text}],source_ref_ids:[source]};q.criteria.push(c);}
const [s1,s2,s3,s4]=sets;
s1.subquestions[0].prompt='적정의견을 표명하는 감사보고서에서 감사의견 단락과 감사의견근거 단락의 배치 및 제목에 관한 요구사항을 설명하시오.';
s1.subquestions[1].type='descriptive';s1.subquestions[1].prompt='감사의견이 변형된 경우, 감사기준서 705 문단 20에 따라 감사의견근거 단락의 제목을 어떻게 수정하고 어떤 사항의 설명을 포함해야 하는지 서술하시오.';
s1.subquestions[1].model_answer=['의견 유형에 따라 제목을 한정의견근거, 부적정의견근거 또는 의견거절근거로 수정하고, 해당 단락에 의견변형을 발생시킨 사항에 대한 설명을 포함한다.'];
claim(s1.subquestions[1],0,'의견 유형에 맞는 한정의견근거·부적정의견근거·의견거절근거 제목으로 수정하고 의견변형 발생 사항의 설명을 포함함. 제목 변경과 원인 설명을 모두 충족해야 하며 띄어쓰기는 감점하지 않음');
sources(s1,{src3:['705.20',746],src8:['700.28',678],src9:['700.23',677]});
s2.subquestions[0].prompt='재무제표가 해당 재무보고체계에 따라 작성되었는지 평가할 때, 감사기준서 700 문단 13의 여섯 가지 평가사항을 모두 제시하시오. 회계정책의 공시와 표시된 정보의 평가 시 고려사항도 포함하시오.';
s2.subquestions[0].model_answer[0]='경영진이 선택·적용한 유의적인 회계정책이 적절히 공시되었는지 평가하고, 기업과의 관련성 및 이해가능한 방식으로 표시되었는지 고려한다.';
s2.subquestions[0].model_answer[3]='재무제표 정보의 목적적합성·신뢰성·비교가능성·이해가능성을 평가한다. 필요한 정보의 포함, 적합한 분류·합산 또는 세분화와 특징의 표시, 관련 없거나 이해를 어렵게 하는 정보로 전체 표시가 훼손되었는지도 고려한다.';
s2.subquestions[0].model_answer[5]='단위재무제표의 명칭을 포함하여 재무제표에 사용된 용어의 적합성을 평가한다.';
claim(s2.subquestions[0],0,'유의적인 회계정책의 적절한 공시 여부를 평가하며 기업과의 관련성과 이해가능한 표시를 고려함');
claim(s2.subquestions[0],3,'정보의 목적적합성·신뢰성·비교가능성·이해가능성을 평가하고, 필요한 정보의 포함·적합한 분류와 합산 또는 세분화·특징 표시 및 무관하거나 이해를 어렵게 하는 정보의 전체 표시 훼손 여부를 고려함');
claim(s2.subquestions[0],5,'단위재무제표 명칭을 포함한 재무제표 용어의 적합성을 평가함');
s2.subquestions[1].prompt='공정표시체계에 따른 재무제표에 대해 추가로 평가할 사항과 그 평가 시 고려할 두 가지 사항을 설명하시오. 또한 재무제표가 해당 재무보고체계를 언급하거나 기술하는 것과 관련하여 수행할 평가를 제시하시오.';
s2.subquestions[1].model_answer[0]='공정한 표시의 달성 여부를 평가하며, 재무제표의 전반적인 표시·구조·내용과 기초가 되는 거래·사건이 공정한 표시를 달성하는 방식으로 표시되었는지를 고려한다.';
claim(s2.subquestions[1],0,'공정한 표시 달성 여부를 평가하며 전반적인 표시·구조·내용과 기초 거래·사건의 공정한 표시 방식을 모두 고려함');
req(s2.subquestions[1],'req3','src3');s2.subquestions[1].criteria[1].requirement_id='req3';s2.subquestions[1].criteria[1].source_ref_ids=['src3'];
sources(s2,{src1:['700.13','675–676'],src2:['700.14',676],src3:['700.15',676]});
s3.subquestions[0].prompt='감사기준서 705 문단 7~9에 따라, 충분하고 적합한 감사증거로 확인된 왜곡표시의 영향이 중요한 경우와 증거를 입수하지 못해 발견되지 않은 왜곡표시의 가능한 영향이 중요한 경우를 구분하시오. 각각 영향이 전반적이지 않은 경우와 전반적인 경우에 표명할 감사의견을 네 조합에 대응하여 모두 제시하시오.';
s3.subquestions[0].model_answer=['충분하고 적합한 감사증거로 확인된 왜곡표시의 영향이 중요하지만 전반적이지 않으면 한정의견이다.','확인된 왜곡표시의 영향이 중요하고 전반적이면 부적정의견이다.','충분하고 적합한 감사증거를 입수할 수 없고 발견되지 않은 왜곡표시의 가능한 영향이 중요하지만 전반적이지 않으면 한정의견이다.','증거를 입수할 수 없고 발견되지 않은 왜곡표시의 가능한 영향이 중요하고 전반적이면 의견거절이다.'];
for(let i=0;i<4;i++)claim(s3.subquestions[0],i,s3.subquestions[0].model_answer[i]+' 해당 조건과 의견의 대응이 분명해야 함. 별도 이유 설명은 요구하지 않음');
req(s3.subquestions[0],'req3','src2');for(const i of [1,3]){s3.subquestions[0].criteria[i].requirement_id='req3';s3.subquestions[0].criteria[i].source_ref_ids=['src2'];}
s3.subquestions[1].requirements[0].source_ref_id='src3';for(const c of s3.subquestions[1].criteria)c.source_ref_ids=['src3'];
s3.subquestions[1].model_answer[1]='재무제표의 특정 요소·계정과목·항목에 국한되지만 재무제표의 상당 부분을 나타내거나 나타낼 수 있는 경우이다.';
claim(s3.subquestions[1],1,'특정 요소·계정과목·항목에 국한되지만 재무제표의 상당 부분을 나타내거나 나타낼 수 있는 경우를 제시함');
claim(s3.subquestions[1],2,'공시와 관련하여 이용자가 재무제표를 이해하는 데 근본적인 경우를 제시함');
sources(s3,{src1:['705.7',743],src2:['705.8-9',744],src3:['705.5a',743]});
const q41=s4.subquestions[0],q42=s4.subquestions[1];
q41.prompt='의견변형의 원인이 특정 금액(양적 공시 포함)의 중요한 왜곡표시, 요구되는 공시의 누락 또는 충분하고 적합한 감사증거의 미입수인 경우, 감사의견근거 단락에 포함할 내용을 원인별로 모두 제시하시오. 계량화가 실행불가능한 경우의 기술과 누락된 공시를 포함하는 조건도 설명하시오.';
q41.model_answer=['특정 금액(양적 공시 포함)의 중요한 왜곡표시는 재무적 영향을 설명하고 실행불가능하지 않으면 계량화한 내용을 포함한다. 계량화가 실행불가능하면 그 사실을 기술한다.','공시 누락이 원인이면 누락된 정보의 성격을 감사의견근거 단락에 기술한다.','누락된 공시를 포함하는 것이 실행가능하고 해당 정보에 대한 충분하고 적합한 감사증거를 입수한 경우, 법규상 금지되지 않는 한 누락된 공시를 포함한다.','충분하고 적합한 감사증거의 미입수가 원인이면 그 이유를 감사의견근거 단락에 포함한다.'];
claim(q41,0,'특정 금액의 중요왜곡표시에 대한 재무적 영향의 설명과 실행불가능하지 않은 한 계량화, 계량화가 실행불가능하면 그 사실의 기술을 모두 제시함');
claim(q41,2,'누락 공시의 포함이 실행가능하고 누락 정보의 충분하고 적합한 증거를 입수한 경우 법규상 금지되지 않는 한 공시를 포함함. 세 조건을 모두 보존함');
req(q41,'req4','src4');req(q41,'req5','src5');for(const i of [1,2]){q41.criteria[i].requirement_id='req4';q41.criteria[i].source_ref_ids=['src4'];}q41.criteria[3].requirement_id='req5';q41.criteria[3].source_ref_ids=['src5'];
q42.prompt='충분하고 적합한 감사증거를 입수하지 못해 의견을 거절할 때, 감사인의 책임 단락에 포함할 내용과 핵심감사사항·기타정보 단락의 포함 여부 및 예외를 설명하시오. 또한 의견변형이 예상될 때 지배기구와 커뮤니케이션할 사항을 모두 제시하시오.';
q42.model_answer=['감사인의 책임 단락에는 감사기준에 따라 기업의 재무제표를 감사하고 감사보고서를 발행하는 것이 감사인의 책임임을 기술한다.','의견거절근거 단락의 사항 때문에 감사의견의 근거를 제공할 충분하고 적합한 감사증거를 입수할 수 없었다고 기술한다.','감사인의 독립성과 기타 윤리적 책임에 관한 기술을 포함한다. 이 세 내용만으로 감사인의 책임 단락을 구성한다.','법규가 요구하는 경우를 제외하고 핵심감사사항 단락과 기타정보 단락을 포함해서는 안 된다.','예상되는 의견변형을 발생시킨 상황을 지배기구와 커뮤니케이션한다.','의견변형 문안을 지배기구와 커뮤니케이션한다.'];
claim(q42,0,'감사인의 책임 단락에 감사기준에 따른 재무제표 감사 수행과 감사보고서 발행 책임을 기술함');
extra(q42,'crit8','감사인의 책임 단락에 의견거절근거 사항 때문에 충분하고 적합한 감사증거를 입수할 수 없었다는 기술을 포함함','req2','src2');
extra(q42,'crit9','감사인의 책임 단락에 독립성 및 기타 윤리적 책임을 기술함. 책임 단락은 문단28의 세 내용만 포함하며 통상적 책임 기술을 모두 유지한다는 명시적 반대 설명은 불인정','req2','src2');
req(q42,'req6','src6');extra(q42,'crit10','법규가 요구하는 경우를 제외하고 의견거절 보고서에 핵심감사사항 단락과 기타정보 단락을 포함하지 않음. 두 단락과 법규 예외를 모두 보존함','req6','src6');
// The existing bank caps each linked set at 8 points. Paragraph28 is one combined
// responsibility criterion; paragraph29 is a separate criterion. No cap/schema change.
q42.criteria=[q42.criteria[0],q42.criteria[5],q42.criteria[1],q42.criteria[2]];
claim(q42,0,'감사인의 책임 단락을 감사기준에 따른 감사 수행·보고서 발행 책임, 의견거절근거 사항 때문에 충분하고 적합한 감사증거를 입수할 수 없었다는 기술, 독립성 및 기타 윤리적 책임의 세 내용만으로 구성함. 세 내용을 모두 제시해야 하며 통상적 책임 기술을 모두 유지한다는 답안은 불인정');
q42.model_answer=[q42.model_answer.slice(0,3).join(' '),...q42.model_answer.slice(3)];
sources(s4,{src1:['705.21',747],src2:['705.28',748],src3:['705.30',748],src4:['705.23',747],src5:['705.24',747],src6:['705.29',748]});
for(const s of sets){for(const q of s.subquestions){q.constraints={ordered:false,max_entries:null,overflow_policy:'none'};q.selection={type:'all',n:null};}s.verification.notes.push('2026-09-08 주제15 검토: 공식2025 전문 직접 인용과2026 전문 대상 문단 대조, 발문·정답·조건·채점요소·해시 수정. 기존 게시·검수 상태 유지(승급 아님). 2027 시험 판본 지정 및 실측 한계는 docs/reports/question-review-2027/15.md 참조.');}
fs.writeFileSync(file,JSON.stringify(bank,null,2)+'\n');fs.writeFileSync(`${dir}/15-after.json`,JSON.stringify(sets,null,2)+'\n');console.log('4 sets / 8 questions / '+sets.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).length+' criteria');
