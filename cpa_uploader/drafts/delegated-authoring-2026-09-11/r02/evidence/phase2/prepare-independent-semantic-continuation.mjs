import fs from 'node:fs';
const own='cpa_uploader/drafts/delegated-authoring-2026-09-11/r02/evidence/phase2';
let code=fs.readFileSync(own+'/run-owned-semantic-diagnostics-refill02.mjs','utf8');
code=code.replace("const config=read(taskFile),control=own+'/semantic-exact-diagnostics-refill02-control';","const config=read(taskFile); config.tasks=config.tasks.filter(t=>['T06-B','T05-B'].includes(t.plan_id)); const control=own+'/semantic-exact-diagnostics-refill02-independent-control';");
code=code.replace('config.tasks.length!==6','config.tasks.length!==2').replace('All6 original unit preflights required','Two independent original unit preflights required').replace('planned_actual_requests:12','planned_actual_requests:4').replace('actual_valid_observations:12,original_valid_observations:6,units_with_three:6','actual_valid_observations:4,original_valid_observations:2,units_with_three:2');
fs.writeFileSync(own+'/run-independent-semantic-diagnostics-refill02.mjs',code,{flag:'wx'});
