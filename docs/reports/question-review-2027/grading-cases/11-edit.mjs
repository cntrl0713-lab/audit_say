import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir='docs/reports/question-review-2027/grading-cases',file='cpa_uploader/data/cpa_question_sets_v3.authoring.json',sourceFile='cpa_uploader/data/official/kga540-550-2025-review11.txt';
const bank=JSON.parse(fs.readFileSync(file)),sets=bank.filter(s=>s.classification.topic_id==='11');
const beforeFile=`${dir}/11-before.json`;
if(!fs.existsSync(beforeFile))fs.writeFileSync(beforeFile,JSON.stringify(sets,null,2)+'\n');
else assert.deepEqual(sets,JSON.parse(fs.readFileSync(beforeFile)),'Topic 11 changed since baseline');
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const pages=JSON.parse(fs.readFileSync('tmp/question-review-11/pages-2025.json')),next=JSON.parse(fs.readFileSync('tmp/question-review-11/pages-2026.json'));
const specs={
 '540.2':[446,'2. 회계추정치는','3. 이 감사기준서는'],
 '540.8':[447,'8. 회계추정치와','9. 이 감사기준서에서는'],
 '540.10':[448,'10. 이 감사기준서는','목적'],
 '540.18':[451,'18. 감사기준서','\n9 감사기준서'],
 '540.19-20':[452,'19. 감사기준서','감사보고서일까지 발생한 사건으로부터 감사증거 입수'],
 '540.32':[455,'32. 감사인은',null],
 '540.A133':[495,'A133.','A134.'],
 '540.A134-tail':[496,' 낙관적','A135.'],
 '550.8':[511,'8. 이 감사기준서는','목적'],
 '550.18':[514,'18. 중요왜곡표시위험을','19. 감사인이'],
 '550.22':[515,'22. 만약 경영진','\n10 감사기준서'],
 '550.24':[516,'24. 경영진이','식별된 특수관계'],
 '550.A42':[530,'A42.',null],
};
function extract(pages,page,start,end){const t=pages[page],i=t.indexOf(start);assert.ok(i>=0,start);const j=end===null?t.length:t.indexOf(end,i+start.length);assert.ok(j>i,end);return t.slice(i,j).trim();}
const quotes={},comparison=[];
for(const [key,[p,start,end]]of Object.entries(specs)){quotes[key]=extract(pages,p,start,end);const newer=extract(next,p+26,start,end);comparison.push({key,page2025:p,page2026:p+26,equal_ignoring_whitespace:quotes[key].replace(/\s/g,'')===newer.replace(/\s/g,''),quote2026:newer});}
fs.writeFileSync(`${dir}/11-source-quotes.json`,JSON.stringify(quotes,null,2)+'\n');
fs.writeFileSync(`${dir}/11-source-comparison.json`,JSON.stringify(comparison,null,2)+'\n');
fs.writeFileSync(sourceFile,['# 한국공인회계사회 회계감사기준 전문(2025 개정) 주제11 직접 발췌','확인일: 2026-09-08. 기준 문단의 PDF 텍스트를 보존했다. 페이지 머리말·꼬리말과 문단 외 각주만 제외했다.','공식 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06',...['540','550'].map(std=>`\n## KGA ${std}: 공식 원문\n`+Object.entries(quotes).filter(([k])=>k.startsWith(std)).map(([k,t])=>`\n### ${k} / PDF ${specs[k][0]}\n${t}`).join('\n'))].join('\n')+'\n');
function sources(s,mapping){s.source_refs=Object.entries(mapping).map(([id,key])=>({id,file:sourceFile,title:`한국공인회계사회 회계감사기준 전문(2025 개정) — ${key}, PDF ${specs[key][0]}`,page:'KGA '+key.slice(0,3),source_quote:quotes[key],role:'standard',content_hash:hash(quotes[key])}));for(const q of s.subquestions)for(const r of q.requirements){const src=s.source_refs.find(x=>x.id===r.source_ref_id);r.source_quote=src.source_quote;r.source_span=src.title;}}
function claim(q,i,t){q.criteria[i].claim=t;q.criteria[i].critical_facts[0].expected=t;}
const [s1,s2,s3,s4]=sets;
sources(s1,{src1:'540.2',src6:'550.18',src8:'540.8'});
s1.classification.tags=['회계추정','추정불확실성','주관성','복잡성','특수관계자','전문가적 의구심'];
s1.subquestions[0].prompt='회계추정치 측정에서 왜곡표시 가능성에 영향을 미치는 주요 고유위험요소 세 가지를 제시하고, 각 요소가 측정 과정에서 나타나는 양상을 설명하시오.';
s1.subquestions[0].model_answer=['추정불확실성은 지식과 정보의 고유한계 때문에 측정결과가 불확실해지는 성질이다.','주관성은 방법·가정·데이터의 선택과 적용 등 측정 과정에 경영진의 판단이 개입되는 성질이다.','복잡성은 가정과 데이터를 사용하는 기법의 선택·적용 등 회계추정치 도출 과정이 복잡해질 수 있는 성질이다.'];
claim(s1.subquestions[0],0,'추정불확실성과 지식·정보의 한계에 따른 측정의 불확실성을 함께 설명함. 명칭만 나열하면 불충족');
claim(s1.subquestions[0],1,'주관성과 측정 과정에서 경영진의 판단이 개입되는 양상을 함께 설명함. 명칭만 나열하면 불충족');
claim(s1.subquestions[0],2,'복잡성과 가정·데이터를 사용하는 기법의 선택·적용 등 도출 과정의 복잡한 양상을 함께 설명함. 명칭만 나열하면 불충족');
s1.subquestions[1].prompt='다음 두 상황을 각각 설명하시오.\n① 기업의 정상적인 사업과정을 벗어난 유의적인 특수관계자 거래를 식별한 경우, 이를 유의적 위험으로 취급해야 하는지 판단하시오.\n② 회계추정치의 추정불확실성이 높거나 복잡성 또는 주관성의 영향이 커질 때, 전문가적 의구심의 중요성이 어떻게 달라지는지 설명하시오.';
s1.subquestions[1].model_answer[1]='회계추정치의 추정불확실성이 높거나 복잡성 또는 주관성의 영향이 커질수록 전문가적 의구심의 중요성이 증가한다.';
claim(s1.subquestions[1],1,'회계추정치의 추정불확실성이 높거나 복잡성 또는 주관성의 영향이 커질수록 전문가적 의구심의 중요성이 증가함을 설명함. 세 요소가 동시에 높아야만 증가한다고 제한하지 않음');
sources(s2,{src1:'540.18',src2:'540.32',src3:'540.A133',src4:'540.A134-tail'});
s2.subquestions[0].prompt='평가된 회계추정치의 중요왜곡표시위험에 대응하는 추가감사절차를 설계할 때 선택할 수 있는 세 가지 접근방법을 모두 제시하시오.';
s2.subquestions[1].prompt='회계추정치를 도출할 때 내린 경영진의 판단과 결정이 개별적으로 합리적이라는 이유로 경영진 편의가능성의 징후에 대한 평가를 생략해도 되는지 판단하고, 개별 판단의 합리성만으로 평가를 생략할 수 있는지에 대한 근거를 설명하시오.';
s2.subquestions[1].model_answer=['개별 판단과 결정이 합리적이더라도 경영진 편의가능성의 징후에 대한 평가를 생략할 수 없다.','편의는 개별 계정 수준에서 드러나지 않고 회계추정치의 집합이나 전체, 또는 여러 회계기간에 걸쳐 관찰할 때 드러날 수 있으므로 개별 판단의 합리성만으로 경영진의 중립성이 확보되었다고 볼 수 없다.'];
s2.subquestions[1].requirements.push({id:'req3',source_ref_id:'src3',source_quote:quotes['540.A133'],source_span:'540.A133, PDF 495'},{id:'req4',source_ref_id:'src4',source_quote:quotes['540.A134-tail'],source_span:'540.A134 후반, PDF 496'});
claim(s2.subquestions[1],1,'개별적으로 합리적인 판단도 추정치의 집합·전체 또는 여러 기간에서 중립성이 결여된 방향으로 나타날 수 있다는 이유를 설명함. 평가 의무의 반복만으로는 불충족. 편의가능성 징후 자체가 확정된 왜곡표시라는 설명은 인정하지 않음');
s2.subquestions[1].criteria[1].requirement_id='req3';s2.subquestions[1].criteria[1].source_ref_ids=['src3','src4'];
sources(s3,{src1:'550.22',src2:'550.24',src3:'550.A42'});
s3.subquestions[0].prompt='경영진이 이전에 식별하지 못했거나 감사인에게 공개하지 않았던 특수관계자 또는 유의적인 특수관계자 거래를 감사인이 식별한 경우, 수행해야 할 절차를 해당되는 조건과 함께 모두 제시하시오.';
s3.subquestions[0].model_answer[6]='경영진의 미공개가 고의적이어서 부정으로 인한 중요왜곡표시위험을 나타내는 경우, 해당 감사에 대한 시사점을 평가한다.';
claim(s3.subquestions[0],6,'경영진의 미공개가 고의적이어서 부정으로 인한 중요왜곡표시위험을 나타내는 경우 해당 감사에 대한 시사점을 평가함');
claim(s3.subquestions[1],0,'독립된 당사자 간 거래에 통용되는 조건과 동등하다는 경영진의 재무제표상 주장에 대해 충분하고 적합한 감사증거를 입수함. 가격만 같으면 기타 거래조건의 증거는 필요 없다는 답안은 불충족');
s3.subquestions[1].criteria[0].source_ref_ids=['src2','src3'];
s3.subquestions[1].requirements.push({id:'req3',source_ref_id:'src3',source_quote:quotes['550.A42'],source_span:'550.A42, PDF 530'});
sources(s4,{src1:'540.18',src2:'540.19-20'});
s4.subquestions[0].prompt='평가된 회계추정치의 중요왜곡표시위험에 대응하는 추가감사절차에는 접근방법을 최소 몇 가지 포함해야 하는지 제시하고, 선택할 수 있는 접근방법 세 가지를 모두 쓰시오.';
s4.subquestions[0].model_answer=['추가감사절차에는 접근방법 중 하나 이상을 포함해야 한다.','감사보고서일까지 발생한 사건으로부터 감사증거를 입수한다.','경영진의 회계추정치 도출방법을 테스트한다.','감사인의 점추정치 또는 범위추정치를 도출한다.'];
claim(s4.subquestions[0],1,'감사보고서일까지 발생한 사건으로부터 감사증거를 입수하는 접근방법을 제시함');
claim(s4.subquestions[0],2,'경영진의 회계추정치 도출방법을 테스트하는 접근방법을 제시함');
const added=structuredClone(s4.subquestions[0].criteria[2]);added.id='crit7';added.critical_facts[0].id='cf7';s4.subquestions[0].criteria.push(added);claim(s4.subquestions[0],3,'감사인의 점추정치 또는 범위추정치를 도출하는 접근방법을 제시함. 둘 중 하나를 제시하면 이 접근방법을 충족');
s4.shared_context.facts[0].text='회계추정치의 중요왜곡표시위험에 대응하는 추가감사절차의 설계를 검토한다. 각 물음과 물음 안의 두 상황은 제시된 조건에 따라 독립적으로 판단한다.';
s4.subquestions[1].prompt='회계추정치와 관련된 유의적 위험에 대한 다음 두 상황을 각각 답하시오.\n① 관련 통제에 의존할 계획이 없고 실증절차만으로 충분하고 적합한 감사증거를 얻을 수 있는 경우, 실증절차만으로 접근방법을 설계해도 되는지 판단하고 그 절차에 반드시 포함할 것을 제시하시오.\n② 관련 통제에 의존할 계획인 경우, 추가감사절차에 포함해야 할 테스트와 그 수행 기간을 제시하시오.';
s4.subquestions[1].model_answer=['① 허용된다. 관련 통제에 의존할 계획이 없고 실증절차만으로 충분하고 적합한 감사증거를 얻을 수 있다는 전제에서 실증절차만으로 설계할 수 있다.','다만 유의적 위험에 대한 접근방법을 실증절차만으로 구성하는 경우에는 세부테스트를 포함해야 한다.','② 관련 통제에 의존할 계획이면 당기에 해당 통제에 대한 테스트를 포함해야 한다.'];
claim(s4.subquestions[1],0,'①의 전제에서 실증절차만으로 구성한 접근방법이 허용됨을 판단함. 세부테스트를 포함해 실증절차만으로 설계한다는 조치로 판단이 분명해도 인정하되 명시적 금지는 인정하지 않음');
for(const s of sets){for(const q of s.subquestions){q.constraints={ordered:false,max_entries:null,overflow_policy:'none'};q.selection={type:'all',n:null};}s.verification.notes.push('2026-09-08 주제11 후속 검토: 공식2025 전문 직접 인용·실제 SHA-256, 발문/정답/독립 criterion 정합화. 기존 게시·검수 상태 유지(승급 아님). 2026 전문 대조·채점 실측·2027 최종 판본 미확정은 docs/reports/question-review-2027/11.md 참조.');}
fs.writeFileSync(file,JSON.stringify(bank,null,2)+'\n');
fs.writeFileSync(`${dir}/11-after.json`,JSON.stringify(sets,null,2)+'\n');
console.log(JSON.stringify({sets:sets.length,questions:sets.flatMap(s=>s.subquestions).length,criteria:sets.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).length,comparison:comparison.map(({quote2026,...r})=>r)}));
