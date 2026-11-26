import test from 'node:test';
import assert from 'node:assert/strict';
import {legFromInput,matchProfiles,actualLegObservations} from '../site/match-statistics.mjs';
import {recordedAimProfile} from '../site/actual-target-statistics.mjs';
import {makeTargetSample,addTargetSample,removeTargetSample,manualSamples,manualTargetRows,manualMissProfile} from '../site/manual-target-samples.mjs';
import {newMemory,changeMemory,assemble,memorySummary,validateMemory} from '../site/coach-memory.mjs';
import {statisticsAnswer} from '../site/statistics-dialogue.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z');
const ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const empty=()=>({sessions:[],games:[],assessmentHistory:[],bigSingles:[]});
const input=(extra={})=>({id:'leg1',day,start:101,doubleIn:false,context:'competition',result:'won',visits:'T20 S1 D20',...extra});
const sample=(extra={})=>({id:'sample1',day,aim:'D16',actual:[...Array(8).fill('D16'),...Array(7).fill('S16'),...Array(4).fill('D8'),'MISS'].join(' '),...extra});
test('actual legs require legal score, outcome, date and visit length',()=>{
 const x=legFromInput(input(),day);assert.equal(x.average,101);assert.equal(x.thrown,3);assert.equal(x.remaining,0);
 for(const patch of [{day:ago(-1)},{visits:'T20 S1 D20 MISS'},{visits:'T20 S1 S20'},{visits:'T20 S1 D20',result:'lost'},{doubleIn:true}])assert.throws(()=>legFromInput(input(patch),day));
});
test('actual match rates distinguish unknown aim, explicit attempts and checkout visits',()=>{
 const x=legFromInput(input(),day).leg,y=legFromInput(input({id:'leg2',visits:'T20>T20 S1>S1 D20>D20'}),day).leg;
 const w=matchProfiles([x,y],day)[0].windows[0];assert.equal(w.legs,2);assert.equal(w.wins,2);assert.equal(w.average,101);assert.equal(w.firstNine,null);assert.equal(w.checkoutVisits,2);assert.equal(w.checkoutVisitRate,1);assert.equal(w.finishAttempts,1);assert.equal(w.finishHits,1);assert.equal(w.fullyAimedLegs,1);assert.equal(w.unknownIntent,3);
});
test('abandoned legs are visible but excluded from measured performance',()=>{
 const x=legFromInput(input({result:'abandoned',visits:'S20'}),day).leg;
 const w=matchProfiles([x],day)[0].windows[0];assert.equal(w.abandoned,1);assert.equal(w.legs,0);assert.equal(w.average,null);assert.deepEqual(actualLegObservations([x],day),[]);
});
test('bust rollback and actual dart denominators reconcile scoring',()=>{
 const x=legFromInput(input({visits:'T20 T20\nT20 S1 D20'}),day).leg,w=matchProfiles([x],day)[0].windows[0];
 assert.equal(w.darts,5);assert.equal(w.points,101);assert.equal(w.average,60.6);assert.equal(w.busts,1);assert.equal(w.firstNine,null);
});
test('long term leg statistics keep rules and context separate and exclude future dates',()=>{
 const l=[legFromInput(input({id:'a',day:ago(100)}),day).leg,legFromInput(input({id:'b',context:'practice'}),day).leg];
 const r=matchProfiles(l,day);assert.equal(r.length,2);assert.equal(r.find(x=>x.context==='competition').windows[2].legs,0);assert.equal(r.find(x=>x.context==='competition').windows[3].legs,1);
 assert.equal(actualLegObservations(l,day).filter(x=>x.context==='competition').length,2);assert.throws(()=>matchProfiles([l[0],l[0]],day));
});
test('actual miss profiles include only fully aimed completed legs',()=>{
 const x=legFromInput(input(),day).leg,y=legFromInput(input({id:'known',visits:'T20>T20 S1>S1 D20>D20'}),day).leg;
 const r=recordedAimProfile([x,y],day);assert.equal(r.excluded,1);assert.equal(r.unknown,3);assert.equal(r.groups.length,3);assert.equal(r.groups.find(x=>x.aim==='D20').hits,1);
});
test('fixed target samples require exactly 20 real segments and preserve miss classes',()=>{
 const rows=makeTargetSample(sample(),day);assert.equal(rows.length,20);assert.throws(()=>makeTargetSample(sample({actual:'D16'}),day));assert.throws(()=>makeTargetSample(sample({actual:Array(20).fill('T25').join(' ')}),day));
 const r=manualMissProfile(rows,day).groups[0];assert.equal(r.hits,8);assert.equal(r.directions['same-number-different-ring'],7);assert.equal(r.directions['off-board'],1);
});
test('manual sample backup validation rejects partial groups and duplicate daily target',()=>{
 const state=addTargetSample({throws:[]},sample(),day);assert.throws(()=>manualSamples(state.throws.slice(1)));assert.throws(()=>addTargetSample(state,sample({id:'other'}),day));
 const next=addTargetSample(state,sample({id:'other',aim:'D20'}),day);assert.equal(manualSamples(next.throws).length,2);assert.equal(manualTargetRows(next.throws,day).length,2);assert.equal(removeTargetSample(next,'sample1').throws.length,20);
});
test('actual legs and manual samples persist in coach memory without creating native host observations',()=>{
 const h=empty();let m=changeMemory(h,newMemory(),day,'leg',input(),now);m=changeMemory(h,m,day,'target-sample',sample(),now);const saved=validateMemory(JSON.parse(JSON.stringify(m)));
 assert.equal(memorySummary(saved).legs.length,1);assert.equal(memorySummary(saved).manualSamples[0].hits,8);assert.equal(assemble(h,saved,day,now).state.observations.length,0);
 const s=assemble(h,saved,day,now).state;assert.equal(statisticsAnswer(h,s,'actual match statistics',day,now).type,'actual-matches');assert.equal(statisticsAnswer(h,s,'detailed target statistics d16',day,now).type,'detailed-targets');
 assert.equal(memorySummary(changeMemory(h,saved,day,'remove-leg',{id:'leg1'},now)).legs.length,0);
 assert.equal(memorySummary(changeMemory(h,saved,day,'remove-target-sample',{id:'sample1'},now)).manualSamples.length,0);
 const corrupted=JSON.parse(JSON.stringify(saved));corrupted.state.throws.pop();assert.throws(()=>validateMemory(corrupted));
});
