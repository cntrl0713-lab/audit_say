import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {learningUnitId,selectLearningQuestionSet} from '../../../../lib/learningUnits.ts';
import {buildGradingPrompt} from '../../../../lib/questionV3Grading.ts';
import {validateQuestionSetV3} from '../../../../lib/questionV3.ts';
const hash=x=>createHash('sha256').update(x).digest('hex');
const args={};for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i],value=process.argv[i+1];if(!['--output','--expected-bank','--expected-scopes','--expected-scope-sets'].includes(key)||!value||value.startsWith('--')||args[key])throw Error('Invalid audit argument');args[key]=value;}
if(!args['--output'])throw Error('--output <new evidence path> is required to preserve earlier audits');
const output=path.resolve(args['--output']);if(fs.existsSync(output))throw Error('Audit output already exists; use a new path');
const expectedBytes=args['--expected-bank']?fs.readFileSync(args['--expected-bank']):null;
const scopes=set=>Object.fromEntries(set.subquestions.flatMap(q=>q.criteria.flatMap(c=>c.critical_facts
 .filter(f=>typeof f.scope==='string').map(f=>[`${q.id}/${c.id}/${f.id}`,f.scope]))));
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const report={version:1,artifact_type:'db_grading_scope_readonly_audit',performed_at:new Date().toISOString(),database_writes:0,model_calls:0,
 concurrency:1,expected_bank:expectedBytes?{file:args['--expected-bank'],sha256:hash(expectedBytes)}:null,
 code_path:['app/actions.ts: gradeQuestionSetV3Action → gradeLearningSubmission(loadUnit=findDatabaseLearningUnit, grade=gradeQuestionSetV3)',
 'lib/questionV3Repository.ts: findDatabaseLearningUnit → findDatabaseQuestionVersion → RPC cpa_get_question_version → validateQuestionSetV3(raw) → selectLearningQuestionSet',
 'supabase/migrations/20260912060000_cpa_private_source_metadata.sql: cpa_get_question_version → metadata overlay → normalized document with scope restored from immutable source_document',
 'lib/questionV3Grading.ts: buildGradingPrompt serializes criterion.critical_facts directly, including scope'],
 findings:[],sets:[],errors:[]};
try{
 const active=await client.from('cpa_question_bank_releases').select('id,source_document,source_file_hash,status').eq('status','active').single();
 if(active.error||!active.data)throw Error('Active release read failed: '+(active.error?.code??'missing'));
 const release=active.data,bank=JSON.parse(release.source_document);
 report.release={id:release.id,status:release.status,sets:bank.length,source_file_hash:release.source_file_hash,actual_document_sha256:hash(release.source_document)};
 if(report.release.source_file_hash!==report.release.actual_document_sha256)throw Error('Source document hash mismatch');
 if(expectedBytes&&hash(expectedBytes)!==report.release.source_file_hash)throw Error('Active release does not match the expected final bank bytes');
 const [items,classification]=await Promise.all([
  client.from('cpa_question_bank_release_items').select('set_id,set_version_id').eq('release_id',release.id),
  client.rpc('cpa_get_learning_classifications',{p_release_id:release.id,p_classification_version_ids:null})]);
 if(items.error||classification.error)throw Error('Release items/classifications read failed: '+(items.error?.code??classification.error?.code));
 const targets=bank.filter(s=>Object.keys(scopes(s)).length),queue=[...targets];
 report.expected={scope_bearing_sets:targets.length,scope_fields:targets.reduce((n,s)=>n+Object.keys(scopes(s)).length,0),learning_units:0,payload_scope_fields:0};
 for(const [flag,actual]of [['--expected-scopes',report.expected.scope_fields],['--expected-scope-sets',report.expected.scope_bearing_sets]])if(args[flag]&&(!/^\d+$/.test(args[flag])||Number(args[flag])!==actual))throw Error('Scope coverage differs from '+flag);
 async function worker(){while(queue.length){const source=queue.shift(),item=items.data.find(i=>i.set_id===source.id);if(!item)throw Error('Release item missing: '+source.id);
  const read=await client.rpc('cpa_get_question_version',{p_version_id:item.set_version_id});
  if(read.error||!read.data){report.errors.push({set_id:source.id,stage:'private RPC',code:read.error?.code??'missing',message:read.error?.message??null});continue;}
  const dto=read.data,validation=validateQuestionSetV3(dto,{verifySourceQuotes:false,allowStoredAnswerConstraints:true});
  const same=JSON.stringify(scopes(dto))===JSON.stringify(scopes(source)),units=[];
  const metas=classification.data.filter(m=>m.source_set_id===source.id&&m.source_set_version_id===item.set_version_id),groups=new Map();
  for(const m of metas){const id=learningUnitId(source.id,m.question_style,m.subquestion_id);groups.set(id,[...(groups.get(id)??[]),m]);}
  for(const [unitId,members]of groups){
   const expected=selectLearningQuestionSet(source,members,unitId),actual=selectLearningQuestionSet(dto,members,unitId);
   const answers=Object.fromEntries(actual.subquestions.map(q=>[q.id,'범위 메타데이터 전달 여부를 확인하는 격리 답안입니다.']));
   const prompt=buildGradingPrompt(actual,answers),payload=JSON.parse(prompt.split('<<<GRADING_PAYLOAD_START>>>')[1].split('<<<GRADING_PAYLOAD_END>>>')[0]);
   const actualScopes=Object.fromEntries(payload.subquestions.flatMap(q=>q.criteria.flatMap(c=>c.critical_facts.filter(f=>typeof f.scope==='string').map(f=>[`${q.subquestion_id}/${c.criterion_id}/${f.id}`,f.scope]))));
   const expectedScopes=scopes(expected),matches=JSON.stringify(actualScopes)===JSON.stringify(expectedScopes);
   units.push({learning_unit_id:unitId,expected_scope_fields:Object.keys(expectedScopes).length,payload_scope_fields:Object.keys(actualScopes).length,scope_values_equal:matches,prompt_sha256:hash(prompt),expected_scopes_sha256:hash(JSON.stringify(expectedScopes)),payload_scopes_sha256:hash(JSON.stringify(actualScopes))});
   report.expected.learning_units++;report.expected.payload_scope_fields+=Object.keys(actualScopes).length;
   if(!matches)report.errors.push({set_id:source.id,unitId,stage:'actual grading payload scope mismatch'});
  }
  const row={set_id:source.id,set_version_id:item.set_version_id,expected_scope_fields:Object.keys(scopes(source)).length,private_rpc_scope_fields:Object.keys(scopes(dto)).length,scope_values_equal:same,validation_errors:validation.errors,units};
  if(!same||validation.errors.length||groups.size===0)report.errors.push({set_id:source.id,stage:'private DTO or unit coverage mismatch'});
  report.sets.push(row);
 }}
 await worker();
 report.sets.sort((a,b)=>a.set_id.localeCompare(b.set_id));
 if(targets.length){const representative=report.sets[0];const raw=await client.rpc('cpa_get_question_version_document',{p_version_id:representative.set_version_id});report.normalized_document_probe={set_id:representative.set_id,rpc_error_code:raw.error?.code??null,scope_fields:raw.data?Object.keys(scopes(raw.data)).length:null,wrapper_scope_fields:representative.private_rpc_scope_fields};}
 report.findings.push('Normalized cpa_criterion_facts has no scope column and the normalized document builder omits scope. The deployed private getter restores scope through the existing 20260912060000 source metadata overlay.');
 report.findings.push('The overlay validates archived document bytes, exact sealed release/version binding, content hash, unique IDs, ordinary fields, and agreement across every attached release before adding scope. A present invalid document raises an error; only truly document-less legacy versions retain normalized fallback.');
 report.findings.push('TypeScript CriterionV3 critical_facts type omits scope, but runtime validation does not strip it and the actual private RPC → learning projection → grading payload retains the returned property. No runtime patch is required for scope transmission.');
 const end=await client.from('cpa_question_bank_releases').select('id,source_file_hash').eq('status','active').single();
 if(end.error||end.data?.id!==release.id||end.data?.source_file_hash!==release.source_file_hash)throw Error('Active release changed during scope audit');
 if(expectedBytes&&hash(fs.readFileSync(args['--expected-bank']))!==hash(expectedBytes))throw Error('Expected bank changed during scope audit');
 report.limitations=['This is a read-only private-RPC and grading-payload audit, not an additional model grading run.','A document-less legacy version has no scope to restore. Future migrations must keep cpa_get_question_version bound to the metadata overlay.'];
 report.verdict=report.errors.length?'fail':'pass';
}catch(error){report.errors.push({stage:'audit',error:String(error)});report.verdict='fail';}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({verdict:report.verdict,release:report.release,expected:report.expected,checked_sets:report.sets.length,errors:report.errors},null,2));
if(report.errors.length)process.exitCode=1;
