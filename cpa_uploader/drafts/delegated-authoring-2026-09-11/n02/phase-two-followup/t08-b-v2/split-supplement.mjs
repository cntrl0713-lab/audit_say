import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(n,v)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(v,null,2)+'\n');
const prior=path.join(dir,'pre-supplement-split');
fs.mkdirSync(prior);
for(const name of ['qa-cases-t08-b.json','lineage-and-change-record.json','README.md']) fs.copyFileSync(path.join(dir,name),path.join(prior,name),fs.constants.COPYFILE_EXCL);
const qa=read('qa-cases-t08-b.json');
const ids=new Set(['sub2-original-all-paraphrases-missing-precondition','sub2-original-single-paraphrase-missing-precondition']);
const supplemental=qa.cases.filter(c=>ids.has(c.id));
qa.cases=qa.cases.filter(c=>!ids.has(c.id));
if(qa.cases.length!==55||supplemental.length!==2) throw Error('Required/supplement counts must be 55/2');
const qualification='이 기대값은 자료 이용 전제를 명시한 새 v2 발문에 대한 후속 판정이다. 확인 전제 요구가 명확하지 않았던 옛 발문의 원 QA를 소급하여 오답으로 취급하지 않는다.';
for(const c of supplemental)c.note=(c.note||'')+' '+qualification;
qa.followup_interpretation=qualification;
write('qa-cases-t08-b.json',qa);
write('qa-supplement-t08-b-original-expressions.json',{...qa,artifact_role:'supplement_not_required_QA_count',interpretation:qualification,cases:supplemental});
const lineage=read('lineage-and-change-record.json');
lineage.updated_at=new Date().toISOString();
lineage.QA_count_after=55;
lineage.QA_count_required=55;
lineage.QA_count_supplement=2;
lineage.QA_count_total_available=57;
lineage.nonretroactive_interpretation=qualification;
lineage.additional_expected_changes_for_review='총괄이 2026-09-11 후속 메시지에서 surface-omission-implicit 및 crit4-paraphrase의 crit3 not_met 기대 정정을 수용했다. 원 답안과 옛 기대는 원 QA 및 prior-inputs, 최초 후속안은 pre-supplement-split에 보존했다.';
for(const c of lineage.QA_changes) if(c.parent_review_requested) {c.parent_review_requested=false;c.parent_review_status='accepted';}
lineage.pre_split_artifacts=['qa-cases-t08-b.json','lineage-and-change-record.json','README.md'].map(n=>({file:path.relative(process.cwd(),path.join(prior,n)),sha256:sha(path.join(prior,n))}));
lineage.followup_files=['pilot-08-007.json','pilot-08-007.authoring-plan.json','qa-cases-t08-b.json','qa-supplement-t08-b-original-expressions.json'].map(n=>({file:path.relative(process.cwd(),path.join(dir,n)),sha256:sha(path.join(dir,n))}));
write('lineage-and-change-record.json',lineage);
fs.writeFileSync(path.join(dir,'README.md'),'# T08-B v2 후속 초안\n\n자료 이용의 전제를 sub2 발문에 명시하여 기존 crit3의 조건이 숨은 요구가 되지 않게 했다. 실제 후속 문항·version1 계획·필수 55개 작성자 QA와 별도 보충 2개를 이 폴더에 두었다. 기존 문항 파일과 153 비교은행은 수정하지 않았다.\n\n원 QA의 동의 표현 2개에 관련성·신뢰성 확인 전제를 복구했다. 추적 방향만으로 그 전제를 자동 충족시키던 2개 기대는 총괄이 수용한 대로 새 발문에서 crit3 미충족으로 정리했다. 원 표현 2개는 [별도 보충 QA](qa-supplement-t08-b-original-expressions.json)에 보존했다. '+qualification+' 문항 배점은 3물음 8점 그대로다.\n\n[변경·해시 장부](lineage-and-change-record.json)에 원본/보존 복사본/후속 파일과 변경 범위를 기록했다. 첫 57개 혼합 후속안의 바이트도 pre-supplement-split에 보존했다. 현재는 후속 초안이며 새 비교은행 연결·실제 의미검수·v4 채점은 총괄 연결 뒤 수행한다.\n');
const set=read('pilot-08-007.json')[0];
const checks=[];
for(const file of ['qa-cases-t08-b.json','qa-supplement-t08-b-original-expressions.json']){
 const value=read(file);if(value.version!==1||value.artifact_type!=='author_expected_judgments'||value.set_id!==set.id)throw Error('QA contract');
 if(new Set(value.cases.map(c=>c.id)).size!==value.cases.length)throw Error('duplicate cases');
 for(const c of value.cases){const q=set.subquestions.find(q=>q.id===c.subquestion_id);if(!q||q.criteria.length!==c.expected_verdicts.length||new Set(c.expected_verdicts.map(v=>v.criterion_id)).size!==q.criteria.length)throw Error(c.id+' criteria');const sum=c.expected_verdicts.reduce((s,v)=>{const crit=q.criteria.find(x=>x.id===v.criterion_id);if(!crit||!Object.hasOwn(crit.scores,v.verdict))throw Error(c.id+' verdict');return s+crit.scores[v.verdict]},0);if(sum!==c.expected_points)throw Error(c.id+' sum');}
 checks.push({file,cases:value.cases.length,status:'pass',sha256:sha(path.join(dir,file))});
}
for(const old of lineage.original_files)if(sha(old.file)!==old.sha256||sha(old.preserved_copy)!==old.sha256)throw Error('Original hash changed');
write('split-static-check.json',{created_at:new Date().toISOString(),status:'pass',checks,original_bytes_preserved:true,question_file_sha256:sha(path.join(dir,'pilot-08-007.json')),plan_file_sha256:sha(path.join(dir,'pilot-08-007.authoring-plan.json')),actual_model_calls:0});
console.log(JSON.stringify({status:'pass',required:55,supplement:2,checks}));
