import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
import { validateQuestionAuthoringPlan } from '../../../questionAuthoringPlan.ts';

const root='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const output=`${root}/official-review-plans-v2`;
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const identity=file=>({file,sha256:sha(fs.readFileSync(file))});
if(fs.existsSync(output))throw Error('Previous plans are immutable.');
const bankFile=`${root}/prepared-reviewed-v5/candidate-authoring.json`;
const bank=read(bankFile),corrections=read(`${root}/prepared-reviewed-v5/official-source-corrections.json`);
const priorIndex=read(`${root}/c/review-plans/index.json`),priorOverrides=read(`${root}/prepared-reviewed-v4/plan-overrides.json`);
const catalog=buildSourceCatalog(),entries=[],bodies=[];
for(const setId of [...new Set(corrections.changes.map(row=>row.set_id))]){
    const originalFile=priorIndex.entries.find(row=>row.set_id===setId);
    if(!originalFile||identity(originalFile.file).sha256!==originalFile.sha256)throw Error(`Plan identity changed ${setId}`);
    const plan=read(originalFile.file),set=bank.find(set=>set.id===setId),changed=corrections.changes.filter(row=>row.set_id===setId);
    const oldMappings=plan.metadata.source_mapping_evidence;
    const oldMapped=new Set(oldMappings.flatMap(row=>row.units.map(unit=>unit.id)));
    const mappings=oldMappings.map(mapping=>{
        const correction=changed.find(row=>row.source_ref_id===mapping.source_ref_id);
        if(!correction)return mapping;
        const source=set.source_refs.find(source=>source.id===mapping.source_ref_id);
        return {...mapping,source_file:source.file,source_quote_sha256:sha(source.source_quote),method:'direct_official_pdf_and_exact_registered_file_comparison',
            units:correction.catalog_unit_ids.map(id=>{
                const unit=catalog.units.find(unit=>unit.id===id);
                if(!unit||unit.file!==source.file||unit.authority!=='official_transcription')throw Error(`Invalid official source unit ${id}`);
                return {id:unit.id,file:unit.file,authority:unit.authority,standard:unit.standard,paragraph:unit.paragraph,
                    locator:unit.locator,quote_sha256:sha(unit.quote),
                    quote_relation:source.source_quote.includes(unit.quote)?'source_contains_catalog_quote':unit.quote.includes(source.source_quote)?'catalog_contains_source_quote':'anchor_with_explicit_continuation_in_full_source_quote'};
            }),semantic_comparison:correction.semantic_comparison};
    });
    plan.source_unit_ids=[...new Set([...plan.source_unit_ids.filter(id=>!oldMapped.has(id)),...mappings.flatMap(row=>row.units.map(unit=>unit.id))])];
    plan.metadata.source_mapping_evidence=mappings;
    plan.metadata.source_followup={predecessor:originalFile,bank:identity(bankFile),evidence_file:`${root}/prepared-reviewed-v5/official-source-corrections.json`,
        official_text_comparison:'source_ref and requirement text verified directly against official PDF and byte-preserved registered excerpts; model review pending'};
    plan.scope.conditions=plan.scope.conditions.map(text=>text.startsWith('직접 근거는 현재 후보의 source_refs/requirements')
        ?'직접 근거는 후속 후보의 source_refs/requirements와 실제 공식 PDF·등록 전사이다. 이 세트의 학습자료 또는 미등록 발췌 연결은 공식 원문 직접 대조를 거쳐 교체했다. 원자료·이전 검토 기록은 그대로 보존하며, 출처별 교체 근거와 문구·조건·예외 대조는 source_mapping_evidence와 후속 출처 장부에서 확인한다. 이 계획의 ready는 실제 모델 검수 통과를 뜻하지 않는다.' : text);
    if(setId==='pilot-03-001'){
        const scope=corrections.scope_clarification.proposal;
        plan.scope.required_answers=plan.scope.required_answers.map(text=>text.replace(scope.before_prompt,scope.after_prompt));
        plan.scope.exclusions.push(scope.plan_scope_addition);
    }
    const errors=validateQuestionAuthoringPlan(plan);if(errors.length)throw Error(`${setId}: ${errors.join('; ')}`);
    for(const id of plan.source_unit_ids)if(!catalog.units.some(unit=>unit.id===id))throw Error(`Missing catalog unit ${id}`);
    const file=`${output}/${setId}.json`,body=JSON.stringify(plan,null,2)+'\n';
    entries.push({set_id:setId,file,sha256:sha(body)});bodies.push({file,body});
}
fs.mkdirSync(output);
for(const row of bodies)fs.writeFileSync(row.file,row.body,{flag:'wx'});
const overrides={created_at:new Date().toISOString(),bank:identity(bankFile),entries:[...priorOverrides.entries.filter(row=>!entries.some(entry=>entry.set_id===row.set_id)),...entries]};
fs.writeFileSync(`${output}/index.json`,JSON.stringify({created_at:new Date().toISOString(),entries,api_calls:0},null,2)+'\n',{flag:'wx'});
fs.writeFileSync(`${root}/prepared-reviewed-v5/plan-overrides.json`,JSON.stringify(overrides,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,plans:entries.length,overrides:overrides.entries.length,api_calls:0}));
