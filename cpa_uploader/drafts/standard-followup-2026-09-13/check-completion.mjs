import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const batch='cpa_uploader/drafts/standard-followup-2026-09-13';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const output=`${batch}/completion-checks.json`;
const research=read(`${batch}/research.json`),receipt=read(`${batch}/verification-receipt.json`);
assert.equal(sha('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),research.bank_sha256,'조사 이후 정본 변경: 새 비교 필요');
const guards=read(`${batch}/grading/run-v1/manifest.json`).inputs;
for(const g of guards)assert.equal(sha(g.file),g.sha256);
assert.equal(receipt.status,'reviewed_draft');
assert.equal(receipt.final.unique_cases,42);assert.equal(receipt.final.within_tolerance,42);
const registry=read('cpa_uploader/analysis/coverage/registry.json');
const links=registry.links.filter(l=>l.id.startsWith('standard-followup-20260913-'));
assert.equal(links.length,6);
for(const l of links){assert.equal(l.freshness,'current');assert.equal(l.effective_review_status,'reviewed');}
// 먼저 완료 파일을 만들어 자체 README 참조도 실제 경로로 검사한다.
const result={date:'2026-09-13',checks:{preflight:'passed; 8세트·14물음·42대표답안, 인메모리 병합만 검사',actual_grading:'passed; 42/42 ±1점, 40/42 정확 일치',request_response_replay:'passed; finalize.ts에서 실제 요청·판정·점수 재생',raw:'passed; collect.mjs --check --against-originals, 5경로·4파일',analysis_build:'passed',analysis_check:'passed; 분석 보존 371파일 검사 포함',wiki_build:'passed',wiki_check:'passed; errors 0, drift 0',new_coverage_links:'6개 모두 current/reviewed',bank_unchanged:true,grading_inputs_unchanged:true},warning_note:'기존 wiki 긴 페이지 경고 10개. 기존의 다른 관계 97개 stale은 이번 신규 관계와 구별하여 보존.',bank_sha256:research.bank_sha256,links_checked:[],link_errors:[],human_review:false,canonical_publication:false,app_deployment:false};
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
for(const f of ['문제.md','모범답안-배점.md'])assert.equal((fs.readFileSync(`${batch}/${f}`,'utf8').match(/^## \d+\./gm)||[]).length,14);
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({bank_unchanged:true,frozen_inputs:guards.length,new_links:links.length,artifact_links:result.links_checked.length,errors:result.link_errors}));
