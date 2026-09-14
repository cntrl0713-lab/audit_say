import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRelationship} from './coverage-contract.mjs';

test('coverage accepts only the actual relationship field and known values',()=>{
 for(const relationship of ['direct','partial','broader','adjacent','excluded'])assertRelationship({relationship,reason:'Evidence reviewed.'});
 for(const row of [{relation:'direct',reason:'Old field.'},{relationship:'direct',relation:'direct',reason:'Duplicate old field.'},{relationship:'unknown',reason:'Wrong value.'},{relationship:'direct',reason:' '}])assert.throws(()=>assertRelationship(row));
});
