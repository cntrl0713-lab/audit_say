import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const batch='cpa_uploader/drafts/standard-additional-2026-09-13';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const output=`${batch}/completion-checks.json`;
const research=read(`${batch}/research.json`),receipt=read(`${batch}/verification-receipt.json`);
assert.equal(sha('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),research.bank_sha256,'조사 이후 정본 변경: 새 비교 필요');
const guards=read(`${batch}/grading/run-v1/manifest.json`).inputs;
for(const g of guards)assert.equal(sha(g.file),g.sha256);
assert.equal(receipt.status,'reviewed_draft');
assert.equal(receipt.final.unique_cases,39);assert.equal(receipt.final.within_tolerance,39);
assert.equal(receipt.final.strict,38);
const registry=read('cpa_uploader/analysis/coverage/registry.json');
const links=registry.links.filter(l=>l.id.startsWith('standard-additional-20260913-'));
assert.equal(links.length,3);
for(const l of links){assert.equal(l.freshness,'current');assert.equal(l.effective_review_status,'reviewed');}
const raw=read('cpa_uploader/raw/collections/2026-09-13-standard-additional/verification.json');
assert.deepEqual(raw.errors,[]);assert.equal(raw.original_paths,3);assert.equal(raw.unique_files,2);
const result={date:'2026-09-13',checks:{preflight:'passed; 6세트·13물음·39대표답안, 인메모리 병합만 검사',actual_grading:'passed; 39/39 ±1점, 38/39 정확 일치',request_response_replay:'passed; finalize.ts에서 실제 요청·판정·점수 재생',raw:'passed; collect.mjs --check --against-originals, 3경로·2파일',analysis_build:'passed; links 187, errors 0',analysis_check:'passed; 분석 보존 371파일 검사 포함',wiki_build:'passed; 155세트·364물음',wiki_check:'passed; errors 0, drift 0',new_coverage_links:'3개 모두 current/reviewed',bank_unchanged:true,grading_inputs_unchanged:true},external_check_evidence:'해당 명령의 실제 종료코드 0 및 도구 출력 확인 후 기록. 이 스크립트는 이미 수행한 분석·wiki 검사를 재실행하지 않는다.',warning_note:'기존 wiki 긴 페이지 경고 10개. 기존의 다른 관계 97개 stale은 이번 신규 관계와 구별하여 보존.',bank_sha256:research.bank_sha256,frozen_input_count:guards.length,links_checked:[],link_errors:[],human_review:false,canonical_publication:false,app_deployment:false};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
for(const name of ['README.md','문제.md','모범답안-배점.md']){
 const f=`${batch}/${name}`,text=fs.readFileSync(f,'utf8');
 for(const m of text.matchAll(/\]\(([^)]+)\)/g)){
  const target=m[1];if(/^(?:https?:|#)/.test(target))continue;
  const resolved=path.resolve(path.dirname(f),decodeURIComponent(target.split('#')[0]));
  result.links_checked.push({from:name,target,exists:fs.existsSync(resolved)});
  if(!fs.existsSync(resolved))result.link_errors.push({from:name,target});
 }
}
assert.deepEqual(result.link_errors,[]);
for(const f of ['문제.md','모범답안-배점.md'])assert.equal((fs.readFileSync(`${batch}/${f}`,'utf8').match(/^## \d+\./gm)||[]).length,13);
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({bank_unchanged:true,frozen_inputs:guards.length,new_links:links.length,artifact_links:result.links_checked.length,errors:result.link_errors}));
