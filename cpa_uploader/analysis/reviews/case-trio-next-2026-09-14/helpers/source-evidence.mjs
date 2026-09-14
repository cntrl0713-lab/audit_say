import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const R='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14';
export const D='cpa_uploader/drafts/case-trio-next-2026-09-14';
export const read=file=>JSON.parse(fs.readFileSync(file));
export const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
export function verifyIdentity(value){
  assert(value&&typeof value==='object','A source identity object is required');
  const file=value.file??value.original_path;
  assert(typeof file==='string'&&file.trim()&&/^[a-f0-9]{64}$/u.test(value.sha256??''),'Source file and sha256 are required');
  const relative=path.relative(process.cwd(),path.resolve(file));
  assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Source must be a retained repository file');
  const identity=ref(file);assert.equal(identity.sha256,value.sha256,'Source identity changed: '+file);return identity;
}
export function authorSources(agent){
  assert(['a','b','c'].includes(agent));
  const file=D+'/'+agent+'/source-files.json',data=read(file);
  const entries=Array.isArray(data)?data:data.entries??data.files;
  assert(Array.isArray(entries)&&entries.length,'Author must list actual source files: '+agent);
  return [ref(file),...entries.map(verifyIdentity)];
}
export function sourceEvidencePlan(){
  const file=R+'/source-evidence-plan.json',plan=read(file);
  assert.equal(plan.version,1);assert.equal(plan.status,'complete','Root must finish the raw/source evidence plan');
  assert(Array.isArray(plan.raw_collection_manifests)&&plan.raw_collection_manifests.length,'At least one final raw collection manifest is required');
  assert(Array.isArray(plan.source_peer_reviews),'Explicitly list required source peer reviews, or [] when none is required');
  assert(Array.isArray(plan.additional_files),'Explicitly list extra evidence, or []');
  const files=[ref(file)],peers=plan.source_peer_reviews.map(verifyIdentity);
  for(const row of plan.raw_collection_manifests){
    const manifestRef=verifyIdentity(row),manifest=read(manifestRef.file);
    assert.deepEqual(manifest.missing,[],'Raw collection has unresolved missing files');
    assert(Array.isArray(manifest.entries)&&manifest.entries.length,'Raw collection has no preserved files');
    files.push(manifestRef);
    for(const entry of manifest.entries){
      files.push(verifyIdentity(entry));
      assert(typeof entry.archived_path==='string','Raw collection entry must identify preserved bytes');
      files.push(verifyIdentity({file:entry.archived_path,sha256:entry.sha256}));
    }
    for(const name of ['verification.json','index.md']){
      const sibling=path.posix.dirname(manifestRef.file)+'/'+name;
      assert(fs.existsSync(sibling),'Raw collection completion artifact missing: '+sibling);
      files.push(ref(sibling));
    }
  }
  files.push(...peers,...plan.additional_files.map(verifyIdentity));
  const identities=new Map();
  for(const row of files){assert(!identities.has(row.file)||identities.get(row.file)===row.sha256,'Conflicting evidence identity');identities.set(row.file,row.sha256);}
  return {plan,files:[...identities].map(([file,sha256])=>({file,sha256})),peers};
}
