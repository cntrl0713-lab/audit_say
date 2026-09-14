import fs from 'node:fs';
import assert from 'node:assert/strict';
import {assembleCoverage,resolveDraftFile} from '../../../coverage/build-coverage.mjs';

export function assertRelationship(row){
 assert(!Object.hasOwn(row,'relation'),'Use the coverage contract field relationship; legacy relation is not accepted');
 assert(['direct','partial','broader','adjacent','excluded'].includes(row.relationship),'Unknown coverage relationship');
 assert(typeof row.reason==='string'&&row.reason.trim(),'A directly reviewed relation reason is required');
}
export function checkCoverageBeforeWrite({overlay,dataset,bank,catalog,addedIds}){
 const drafts=[...new Set(overlay.links.filter(link=>link.target?.scope==='draft').map(link=>link.target.file))].flatMap(file=>{
  const raw=JSON.parse(fs.readFileSync(resolveDraftFile(process.cwd(),file)));
  return (Array.isArray(raw)?raw:[raw]).map(set=>({file,set}));
 });
 const registry=assembleCoverage({dataset,bank,catalog,overlay,inputs:{},drafts});
 const checked=registry.links.filter(link=>addedIds.includes(link.id));
 assert.equal(checked.length,addedIds.length,'Every new relationship must be assembled exactly once');
 assert(checked.every(link=>link.freshness==='current'&&link.effective_review_status==='reviewed'),'New relationships must retain reviewed current inputs');
 return checked.map(({id,relationship,freshness,effective_review_status})=>({id,relationship,freshness,effective_review_status}));
}
