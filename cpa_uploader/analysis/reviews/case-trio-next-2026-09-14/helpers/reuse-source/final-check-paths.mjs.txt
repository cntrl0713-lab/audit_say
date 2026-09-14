import path from 'node:path';
import assert from 'node:assert/strict';

export function finalChecksDirectory(batchRoot,name){
 assert(typeof name==='string'&&/^final-checks-[a-zA-Z0-9][a-zA-Z0-9-]*$/u.test(name),'Final checks must use a direct-child final-checks-* directory name');
 const root=path.resolve(batchRoot),target=path.resolve(root,name);
 assert.equal(path.dirname(target),root,'Final checks directory escaped this batch');
 return target;
}
export function parseFinalChecksArgs(argv){
 let outputName='final-checks-v1',explicitOutput=false;const priorOutputNames=[];
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];assert(value&&!value.startsWith('--'),'Missing final checks argument value');
  if(key==='--output'){assert(!explicitOutput,'Duplicate --output');explicitOutput=true;outputName=value;}
  else if(key==='--prior-output'){assert(!priorOutputNames.includes(value),'Duplicate --prior-output');priorOutputNames.push(value);}
  else throw new Error('Unknown final checks argument: '+key);
 }
 for(const name of [outputName,...priorOutputNames])finalChecksDirectory('.',name);
 assert(!priorOutputNames.includes(outputName),'Prior output and new output must differ');
 return {outputName,priorOutputNames};
}
export function parseReportArgs(argv){
 assert(argv.length===0||(argv.length===2&&argv[0]==='--final-checks'),'Use only --final-checks <final-checks-directory>');
 const finalChecksName=argv.length?argv[1]:'final-checks-v1';finalChecksDirectory('.',finalChecksName);
 return {finalChecksName};
}
export function assertFinalChecksPassed(checks,assertIdentity){
 assert.equal(checks.status,'passed','Selected final check run did not pass');
 assert.deepEqual(checks.checks.map(check=>check.name),['analysis-build','analysis-check','analysis-preservation','wiki-build','wiki-check'],'Final check sequence is incomplete');
 assert(checks.checks.every(check=>check.exit_code===0),'Final check exit code is nonzero');
 for(const check of checks.checks)assertIdentity(check.log);
 for(const prior of checks.prior_outputs??[])for(const file of prior.files)assertIdentity(file);
}
