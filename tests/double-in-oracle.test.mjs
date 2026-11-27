import test from 'node:test';
import assert from 'node:assert/strict';
import {visit} from '../site/engine/engine.mjs';
import {runDoubleInOracle} from './double-in-oracle.mjs';
test('Independent 100,000-visit double-in oracle tests entry, prior-open state and terminal scoring',()=>{
 const result=runDoubleInOracle(visit);
 assert.equal(result.checked,100000);assert.equal(result.opened,50000);assert.equal(result.unopened,50000);
 assert.ok(result.bust>1000&&result.finished>1000&&result.noEntry>1000);
 console.log('Independent double-in oracle: '+JSON.stringify(result));
});
