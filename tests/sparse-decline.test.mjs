import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,query} from '../site/engine/coach-api.mjs';
import {ask} from '../site/engine/coach-dialogue.mjs';
import {fullReport} from '../site/engine/executive.mjs';
const day='2026-11-27';
const row=(id,day,hits,over={})=>({id,day,skill:'doubles',context:'practice',protocol:'Fixed doubles',attempts:100,hits,...over});
const memory=(rows)=>({...newPlayer(),observations:rows});
const review=m=>query(m,{version:1,type:'review',day,payload:{}}).result;
const old=row('a','2026-11-01',35),recent=row('b',day,20);
test('Sparse observed doubles decline is explained without an intervention',()=>{
 const m=memory([old,recent]),before=JSON.stringify(m),r=review(m);
 assert.equal(r.decision,'balanced');assert.equal(r.focus,null);assert.equal(r.verification.status,'passed');
 assert.match(r.reason,/35% to 20%/);assert.match(r.reason,/-15 percentage points/);
 assert.match(r.reason,/two measured days/);assert.match(r.reason,/not a confirmed trend/);
 assert.match(r.reason,/additional separate days/);
 assert.match(ask(m,'review my performance',day).lines.join(' '),/35% to 20%/);
 assert.equal(JSON.stringify(m),before);
});
test('Sparse descriptive screen never pools unlike protocols, contexts or same-day results',()=>{
 for(const rows of [[old,{...recent,protocol:'Different'}],[old,{...recent,context:'competition'}],[old,{...recent,day:old.day}],[old,{...recent,hits:34}],[old,{...recent,day:'2026-11-15'}],[old,{...recent,attempts:10,hits:2}],[old,{...recent,hits:50}]]){
  assert.equal(fullReport(memory(rows),day).sparseDeclines.length,0);
 }
});
test('Sparse descriptive screen respects retrospective dates and distinct-day grouping',()=>{
 const m=memory([old,recent,row('future','2026-11-28',80)]);
 assert.deepEqual(fullReport(m,day).sparseDeclines,fullReport(memory([old,recent]),day).sparseDeclines);
 const sameDay=memory([old,row('a2',old.day,35),recent]);
 assert.deepEqual(fullReport(sameDay,day).sparseDeclines[0].attempts,[200,100]);
 assert.equal(fullReport(memory([old,row('middle','2026-11-15',55),recent]),day).sparseDeclines.length,0);
});
