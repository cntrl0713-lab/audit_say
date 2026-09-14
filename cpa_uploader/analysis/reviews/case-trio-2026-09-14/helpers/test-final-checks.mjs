import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {parseFinalChecksArgs,parseReportArgs,assertFinalChecksPassed} from './final-check-paths.mjs';
import {runFinalChecks} from './final-checks.mjs';

const H='cpa_uploader/analysis/reviews/case-trio-2026-09-14/helpers';
const fixtureRoot=path.resolve(H,'test-fixtures');fs.mkdirSync(fixtureRoot,{recursive:true});
const fixture=fs.mkdtempSync(path.join(fixtureRoot,'preserve-run-'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const verify=identity=>assert.equal(hash(identity.file),identity.sha256);
const list=directory=>fs.readdirSync(directory).map(name=>({name,sha256:hash(path.join(directory,name))}));

test('check/report directory arguments reject escaping paths, duplicates and overwritten attempts',()=>{
 assert.deepEqual(parseFinalChecksArgs([]),{outputName:'final-checks-v1',priorOutputNames:[]});
 assert.deepEqual(parseReportArgs(['--final-checks','final-checks-v2']),{finalChecksName:'final-checks-v2'});
 for(const value of ['../final-checks-v2','final-checks-v1/child','C:\\temp\\final-checks-v2','helpers','final-checks-']){
  assert.throws(()=>parseFinalChecksArgs(['--output',value]));assert.throws(()=>parseReportArgs(['--final-checks',value]));
 }
 for(const args of [['--output'],['--unknown','final-checks-v2'],['--output','final-checks-v2','--output','final-checks-v3'],['--output','final-checks-v1','--prior-output','final-checks-v1'],['--prior-output','final-checks-v0','--prior-output','final-checks-v0']])assert.throws(()=>parseFinalChecksArgs(args));
 assert.throws(()=>parseReportArgs(['--final-checks','final-checks-v2','--final-checks','final-checks-v3']));
});

test('a failing fixture run stops and retains original log/results when a new attempt passes',()=>{
 let calls=0;
 const first=runFinalChecks({batchRoot:fixture,runner:(_command,_args,options)=>{calls++;fs.writeSync(options.stdio[1],'Fixture-only filesystem UNKNOWN/open failure. No analysis or model command ran.\n');return {status:1,signal:null};}});
 assert.equal(calls,1);assert.equal(first.summary.status,'failed');assert.equal(first.summary.failed_check,'analysis-build');assert.equal(first.summary.remaining_checks.length,4);
 assert.equal(JSON.parse(fs.readFileSync(path.join(first.output,'summary.json'))).status,'failed');
 const before=list(first.output);
 assert.throws(()=>runFinalChecks({batchRoot:fixture,runner:()=>{throw new Error('must not run');}}));
 const second=runFinalChecks({batchRoot:fixture,argv:['--output','final-checks-v2','--prior-output','final-checks-v1'],runner:(_command,args,options)=>{calls++;fs.writeSync(options.stdio[1],'Fixture-only success for '+args.join(' ')+'\n');return {status:0,signal:null};}});
 assert.equal(calls,6);assert.equal(second.summary.status,'passed');assert.equal(second.summary.checks.length,5);assert.equal(second.summary.prior_outputs.length,1);assert.deepEqual(list(first.output),before);
 assertFinalChecksPassed(second.summary,verify);
 assert.throws(()=>assertFinalChecksPassed(first.summary,verify));
 assert.throws(()=>assertFinalChecksPassed({...second.summary,checks:second.summary.checks.slice(1)},verify));
 const wrongIdentity=structuredClone(second.summary);wrongIdentity.checks[0].log.sha256='0'.repeat(64);
 assert.throws(()=>assertFinalChecksPassed(wrongIdentity,verify));
});

test('a spawn exception is recorded as execution failure, never a successful zero-code check',()=>{
 const result=runFinalChecks({batchRoot:fixture,argv:['--output','final-checks-spawn-exception'],runner:()=>{throw Object.assign(new Error('Fixture spawn failed'),{code:'UNKNOWN'});}});
 assert.equal(result.summary.status,'failed');assert.equal(result.summary.checks[0].exit_code,null);assert.equal(result.summary.checks[0].execution_error.code,'UNKNOWN');
 assert.equal(result.summary.remaining_checks.length,4);
});
