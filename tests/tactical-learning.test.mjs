import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTargetSample} from '../site/manual-target-samples.mjs';
import {measuredTargets,tacticalModel,tacticalLines,recoveryAdvice,tacticalAnswer} from '../site/tactical-learning.mjs';
import {visit} from '../site/engine/engine.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
function samples(aim,actual,ages=[0,1,7,8,14,15,21,22]){
 return ages.flatMap((n,i)=>makeTargetSample({id:aim+'-'+n,day:ago(n),aim,actual:typeof actual==='function'?actual(i):actual},ago(n)));
}
const darts=(a,n,b='MISS')=>[...Array(n).fill(a),...Array(20-n).fill(b)];
test('eight independent complete target samples required; stale, future, and noncanonical aims excluded',()=>{
 assert.equal(measuredTargets(samples('D20',darts('D20',10),[0,1,2,3,4,5,6]),day).eligible.length,0);
 assert.equal(measuredTargets(samples('D20',darts('D20',10)),day).eligible[0].attempts,160);
 assert.equal(measuredTargets(samples('D20',darts('D20',10),[15,16,17,18,19,20,21,22]),day).eligible.length,0);
 assert.equal(measuredTargets(samples('L20',darts('L20',10)),day).eligible.length,0);
 assert.equal(measuredTargets(samples('D20',darts('D20',10),[-1,0,1,2,3,4,5,6]),day).eligible.length,0);
});
test('actual region outcomes are canonicalized and full/half distributions normalize',()=>{
 const r=measuredTargets(samples('S20',darts('L20',10,'I20')),day).eligible[0];
 for(const k of ['full','first','second'])assert.deepEqual(r[k],[{score:20,double:false,p:1}]);
});
test('known target distribution yields restricted model estimate and legal standard route',()=>{
 const state={throws:samples('D20',darts('D20',10)),facts:[]};
 const r=tacticalModel(state,40,1,day);
 assert.equal(r.status,'no-stable-alternative');assert.equal(r.options[0].estimate,.5);
 assert.equal(r.options[0].early,.5);assert.equal(r.options[0].late,.5);
 assert.equal(visit(40,r.standard).finished,true);
 assert.ok(tacticalLines(r).at(-1).includes('Not a calibrated'));
});
test('measured miss recovery includes only observed outcomes and legal double-out',()=>{
 const state={throws:[...samples('D20',darts('D20',10,'S20')),...samples('D10',darts('D10',10))],facts:[]};
 const r=tacticalModel(state,40,2,day);
 // D20 hit half; on S20 the next D10 hits half. D10 can only score 20 or miss.
 assert.equal(r.options.find(x=>x.aim==='D20').estimate,.75);
 assert.equal(r.options.find(x=>x.aim==='D10').estimate,.5);
});
test('candidate comparison requires measured standard and agreement across both chronological halves',()=>{
 const state={throws:[...samples('D20',darts('D20',4)),...samples('D10',darts('D20',16))],facts:[]};
 const r=tacticalModel(state,40,1,day);
 assert.equal(r.status,'candidate-for-comparison');assert.equal(r.candidate,'D10');
 const mixed={throws:[...samples('D20',darts('D20',10)),...samples('D10',i=>darts('D20',i<4?20:2))],facts:[]};
 assert.equal(tacticalModel(mixed,40,1,day).status,'no-stable-alternative');
 assert.equal(tacticalModel({throws:samples('D10',darts('D20',16)),facts:[]},40,1,day).status,'standard-unmeasured');
});
test('unmeasured and mathematically impossible finishes never create estimates',()=>{
 const state={throws:[],facts:[]};
 assert.equal(tacticalModel(state,40,1,day).status,'insufficient');
 assert.equal(tacticalModel(state,159,3,day).status,'no-legal-finish');
 assert.equal(tacticalModel({throws:samples('S20',darts('S20',20)),facts:[]},40,2,day).status,'no-measured-path');
 assert.throws(()=>tacticalModel(state,171,3,day),/2–170/);
});
test('exact recovery accepts actual segments, preserves bust rollback and legal setup',()=>{
 const state={facts:[]};
 const a=recoveryAdvice(state,81,['S19']);assert.equal(a.remaining,62);assert.equal(a.dartsLeft,2);
 assert.ok(a.options.every(x=>visit(62,x).finished&&x.length<=2));
 const b=recoveryAdvice(state,40,['T20']);assert.equal(b.status,'bust');assert.equal(b.remaining,40);assert.equal(b.dartsLeft,0);
 const c=recoveryAdvice(state,40,['D20']);assert.equal(c.status,'finished');assert.equal(c.dartsLeft,0);
 const d=recoveryAdvice(state,170,['MISS','MISS']);assert.equal(d.status,'setup-required');assert.equal(d.dartsLeft,1);
 assert.throws(()=>recoveryAdvice(state,40,['D20','MISS']),/continue/);
});
test('tactical sandbox answers remain read-only and bounded',()=>{
 const state={throws:[],facts:[]},before=JSON.stringify(state);
 assert.equal(tacticalAnswer(state,'model checkout 81 with 2 darts',day).type,'tactical-model');
 assert.equal(tacticalAnswer(state,'recovery from 81 after s19',day).type,'checkout-recovery');
 assert.equal(tacticalAnswer(state,'change my technique',day),null);
 assert.equal(JSON.stringify(state),before);
});
