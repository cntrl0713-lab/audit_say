// 게시 전 운영 문제은행이 현재 정본과 같은지 읽기 전용으로 확인한다. DB 쓰기 없음.
//   node --env-file=.env.local --import tsx cpa_uploader/drafts/standard-priority-2026-09-14/publication-v1/db-baseline.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {publicLearningSet} from '../../../../lib/learningPublic.ts';
import {compilePublicQuestionSet} from '../../../../lib/questionV3.ts';
import {canonicalJson} from '../../../../lib/learningSubmission.ts';
const P='cpa_uploader/drafts/standard-priority-2026-09-14/publication-v1';
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;assert(url&&key,'운영 DB 접속 설정 필요');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const{data,error}=await client.rpc('cpa_get_active_question_bank');assert(!error&&Array.isArray(data),'운영 문제은행 조회 실패');
const projected=data.map(publicLearningSet).map(s=>{delete s.release_id;delete s.set_version_id;for(const q of s.subquestions)delete q.logical_subquestion_id;return s;});
const bytes=fs.readFileSync(bankFile),original=JSON.parse(bytes.toString('utf8'));
assert.equal(canonicalJson(projected),canonicalJson(original.map(compilePublicQuestionSet)),'운영 은행이 현재 정본과 다름. 동시 게시 여부 재확인 필요');
const releaseIds=[...new Set(data.map(s=>s.release_id))];assert.equal(releaseIds.length,1);
const{data:release,error:releaseError}=await client.from('cpa_question_bank_releases').select('id,source_file_hash,bank_content_hash').eq('id',releaseIds[0]).single();assert(!releaseError&&release);
const out={checked_at:new Date().toISOString(),project_host:new URL(url).hostname,release,canonical:{file:bankFile,sha256:createHash('sha256').update(bytes).digest('hex')},sets:data.length,questions:data.map(publicLearningSet).flatMap(s=>s.subquestions).length,public_matches_canonical:true,db_writes:0};
fs.writeFileSync(P+'/db-baseline.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(out));
