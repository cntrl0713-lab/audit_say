import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref=file=>({file,sha256:sha(file)});
const read=file=>JSON.parse(fs.readFileSync(file));
const completion=read(R+'/completion.json');
assert.equal(completion.status,'complete');
assert.equal(sha(completion.bank.file),completion.bank.sha256);
const reviews='cpa_uploader/analysis/reviews/README.md',log='cpa_uploader/wiki/log.md';
const before=[reviews,log].map(ref);
const row='| 기준서형 분리·통합·부분정답 기준의 정본·운영 반영 | [standard-points-implementation-2026-09-14](standard-points-implementation-2026-09-14/README.md) | [반영·검증 결과](../../../docs/reports/standard-points-implementation-2026-09-14.md) |';
const reviewText=fs.readFileSync(reviews,'utf8');
assert(!reviewText.includes('standard-points-implementation-2026-09-14'));
const anchor='| --- | --- | --- |';assert(reviewText.includes(anchor));
const entry='## 2026-09-14 — 기준서형 배점 전수 검토의 운영 반영\n\n- 기준서형 354물음을 전수 재검토하여 분리·통합 후 372물음·1,400점으로 반영했다. 1점 물음은 24개에서 4개로 줄었고 최대 배점은 12점에서 8점으로 바뀌었다.\n- 독립적으로 인정할 의미마다 1점씩 합산하며 판단과 근거를 구별한다. [반영 보고서](../../docs/reports/standard-points-implementation-2026-09-14.md)와 [실행 장부](../analysis/reviews/standard-points-implementation-2026-09-14/README.md)에 물음별 변경 계보와 부분정답 근거를 연결했다.\n- 정본·공개본·암호화본·운영 DB를 반영하고 전체 공개·비공개 조회, 19세트의 부분정답 범위 조건 44개, 기존 이력을 검증했다. 재편한 원세트 55개의 과거 버전과 풀이 기록을 보존했다.\n- 최종 판본의 대표 답안 579개는 모두 기대점수의 ±1점 이내였으며 567개가 정확히 일치했다. 최초 실패를 포함한 전체 582개 관측과 후속 수정 근거를 보존했다. 실제 채점 모델은 Luna를 유지했다.\n\n';
const logText=fs.readFileSync(log,'utf8');assert(!logText.includes('기준서형 배점 전수 검토의 운영 반영'));
const heading=logText.match(/^# Wiki 갱신 기록\r?\n\r?\n/);assert(heading);
const report='docs/reports/standard-points-implementation-2026-09-14.md';
for(const [file,text] of [[report,fs.readFileSync(report,'utf8')],[R+'/README.md',fs.readFileSync(R+'/README.md','utf8')],[reviews,row],[log,entry]]){
  for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
    if(/^(https?:|#)/.test(match[1]))continue;
    const target=path.resolve(path.dirname(file),decodeURIComponent(match[1].split('#')[0]));
    assert(fs.existsSync(target),'Missing link from '+file+': '+match[1]);
  }
}
fs.writeFileSync(reviews,reviewText.replace(anchor,anchor+'\n'+row));
fs.writeFileSync(log,heading[0]+entry+logText.slice(heading[0].length));
const output=R+'/documentation-final-check.log',fd=fs.openSync(output,'wx');let checked;
try{checked=spawnSync(process.execPath,['cpa_uploader/wiki/scripts/check-wiki.mjs'],{shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
const result={checked_at:new Date().toISOString(),status:checked.status===0?'passed':'failed',exit_code:checked.status,before,after:[reviews,log,report,R+'/README.md'].map(ref),log:ref(output),new_document_links_valid:true};
fs.writeFileSync(R+'/documentation-final-check.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
assert.equal(checked.status,0,'Final documentation wiki check failed');
assert.equal(sha(completion.bank.file),completion.bank.sha256);
console.log(JSON.stringify({status:result.status,release_id:completion.release_id}));
