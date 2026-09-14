import assert from 'node:assert/strict';

export function assertPublicationEnvironment(execArgv,env){
 assert(execArgv.includes('--env-file=.env.local'),'Invoke both stage and install with node --env-file=.env.local --import tsx');
 assert(typeof env.CPA_QUESTION_V3_ENCRYPTION_KEY==='string'&&env.CPA_QUESTION_V3_ENCRYPTION_KEY.trim(),'Encryption key must be loaded before stage or install; its value is never recorded');
}
