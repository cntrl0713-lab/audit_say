import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gradingModelName } from '../../../../lib/questionV3Grading.ts';

// Invocation: node --env-file=.env.local --import tsx <this file> <review CLI args>.
// Keep credentials in the process environment; never persist them in evidence.
process.env.CPA_REVIEW_MODEL ||= gradingModelName();
// The 49-set cohort exceeds the old 200,000-character ceiling with every peer
// and complete source retained. This local run opts in; the CLI default stays.
process.env.CPA_REVIEW_INPUT_MAX_CHARS ||= '500000';
const args=process.argv.slice(2);
const output=args[args.indexOf('--output')+1];
if(!args.includes('--output')||!output)throw Error('--output 필요');
const codeFiles=['lib/questionV3Grading.ts','lib/questionV3Evidence.ts','lib/questionV3Answer.ts','lib/questionV3.ts','lib/ai/openaiStructured.ts',
    'cpa_uploader/questionSemanticReview.ts','cpa_uploader/questionReviewGrading.ts','cpa_uploader/review_question_draft_v3.ts',
    'cpa_uploader/questionBankPublication.ts','cpa_uploader/questionAuthoringPlan.ts','cpa_uploader/questionSourceCatalog.mjs',
    'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/run-review.ts'];
const hashFile=(file:string)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashes=Object.fromEntries(codeFiles.map(file=>[file,hashFile(file)]));
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output+'.runtime.json',JSON.stringify({started_at:new Date().toISOString(),args,code_hashes:hashes,
    review_model:process.env.CPA_REVIEW_MODEL,grading_model:gradingModelName(),max_input_chars:Number(process.env.CPA_REVIEW_INPUT_MAX_CHARS),
    credential_logged:false,transport:'production_review_cli',mock:false},null,2)+'\n',{flag:'wx'});
const result = spawnSync(process.execPath, ['--import', 'tsx', 'cpa_uploader/review_question_draft_v3.ts', ...process.argv.slice(2)], {
    stdio: 'inherit', env: process.env,
});
const changed=codeFiles.filter(file=>hashFile(file)!==hashes[file]);
fs.writeFileSync(output+'.runtime-result.json',JSON.stringify({finished_at:new Date().toISOString(),exit_code:result.status,
    changed_code_files:changed,error:result.error?{name:result.error.name,message:result.error.message}:null},null,2)+'\n',{flag:'wx'});
if (result.error) throw result.error;
process.exitCode = changed.length?1:result.status??1;
