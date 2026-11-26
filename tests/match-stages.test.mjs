import test from 'node:test';
import assert from 'node:assert/strict';
import {minimumFinishDarts,stageProfiles,stageTransfer,stageLines,transferLines} from '../site/match-stages.mjs';
import {legFromInput} from '../site/match-statistics.mjs';
import {routes} from '../site/engine/engine.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const leg=(id,visits,extra={})=>legFromInput({id,day,start:301,doubleIn:false,context:'practice',result:'won',visits,...extra},day).leg;
test('minimum legal finish count agrees with exhaustive route engine for all checkout scores',()=>{
 for(let n=2;n<=170;n++){const r=routes(n,3);assert.equal(minimumFinishDarts(n),r.length?Math.min(...r.map(x=>x.length)):null,String(n))}
 for(const n of [0,1,159,162,163,165,166,168,169,171,501,NaN])assert.equal(minimumFinishDarts(n),null);
});
test('actual straight-in stages retain credited score, setup leaves and finish length',()=>{
 const l=leg('one','T20 T20 T20\nT20 S11 50');
 // 301 -> 121 -> 50 -> 0; second visit has a legal 3-dart checkout.
 const p=stageProfiles([l],day).profiles[0].windows[0];
 assert.equal(p.scoring.visits,1);assert.equal(p.scoring.average,180);assert.equal(p.setup.leaves,1);
 assert.equal(p.checkout.visits,1);assert.equal(p.checkout.finishes,1);assert.equal(p.bands['121–170'].finishes,1);
 assert.equal(p.shortest[3].attempts,1);assert.equal(p.finishDarts[3],1);
 assert.equal(p.aim.known,0);assert.equal(p.aim.completeLegRate,null);
});
test('bogey escape and setup double leave are separate measured opportunities',()=>{
 const b=leg('bogey','T20 T20 S19\nT20 T20 S2\nD20',{start:301});
 // 301-139=162 bogey; 162-122=40; then D20.
 const p=stageProfiles([b],day).profiles[0].windows[0];
 assert.equal(p.bogey.visits,1);assert.equal(p.escape.leaves,1);assert.equal(p.setup.attempts,1);assert.equal(p.setup.leaves,0);
 assert.equal(p.checkout.visits,1);assert.equal(p.shortest[1].finishes,1);
});
test('bust rollback and actual dart count remain intact at checkout',()=>{
 const l=leg('bust','T20 S1 MISS\nD20>T20',{start:101,result:'lost'});
 // start 101 -> 40, then T20 bust (one dart). Result is lost, not a finish.
 const p=stageProfiles([l],day).profiles[0].windows[0];
 assert.equal(p.checkout.visits,2);assert.equal(p.checkout.busts,1);assert.equal(p.checkout.darts,4);assert.equal(p.checkout.points,61);
});
test('explicit finishing attempts require actual aim and distinguish same-number misses',()=>{
 const l=leg('aim','T20>T20 S1>S1 S1>MISS\nD20>S20 D10>D10',{start:101});
 const p=stageProfiles([l],day).profiles[0].windows[0];
 assert.equal(p.aim.coverage,1);assert.equal(p.aim.completeLegAttempts,2);assert.equal(p.aim.completeLegHits,1);
 assert.equal(p.aim.misses['same-number-different-ring'],1);assert.equal(p.aim.targets.D20.attempts,1);
 const partial=leg('partial','T20 S1 MISS\nD20>S20 D10>D10',{start:101});
 const q=stageProfiles([partial],day).profiles[0].windows[0];
 assert.equal(q.aim.knownFinishAttempts,2);assert.equal(q.aim.completeLegAttempts,0);assert.equal(q.aim.completeLegRate,null);
});
test('double-in and abandoned legs excluded explicitly, not silently combined',()=>{
 const double=leg('double','D20 S20 S1',{start:101,doubleIn:true,result:'lost'});
 const abandoned=leg('abandoned','S20',{start:101,result:'abandoned'});
 const r=stageProfiles([double,abandoned],day);
 assert.equal(r.doubleInExcluded,1);assert.equal(r.abandonedExcluded,1);assert.equal(r.profiles.length,0);
 assert.ok(stageLines(r).some(l=>l.includes('1 double-in and 1 abandoned')));
});
test('matched practice and competition stages require multiple days, weeks and opportunity volume',()=>{
 const rows=[];
 for(const age of [0,1,7,8,14,15,21,22])for(let i=0;i<5;i++){
  rows.push(leg('p'+age+'-'+i,'T20 T20 T20\nT20 S11 50',{day:ago(age)}));
  // 301 -> 241 -> 181 -> 121 -> 0
  rows.push(leg('c'+age+'-'+i,'S20 S20 S20\nS20 S20 S20\nS20 S20 S20\nT20 S11 50',{day:ago(age),context:'competition'}));
 }
 const report=stageProfiles(rows,day),r=stageTransfer(report,day),scoring=r.find(x=>x.metric==='scoring-stage average');
 assert.equal(scoring.status,'observed-gap');assert.equal(scoring.difference,-120);assert.equal(scoring.pairedWeeks,4);
 assert.ok(transferLines(r).some(l=>l.includes('-120.0 points')));
 assert.equal(stageTransfer(stageProfiles(rows.slice(0,2),day),day).find(x=>x.metric==='scoring-stage average').status,'insufficient');
});
test('future and old actual legs are excluded from stage windows and duplicated IDs rejected',()=>{
 const a=leg('one','T20 T20 T20\nT20 S11 50');
 const old={...a,id:'old',day:ago(365)},future={...a,id:'future',day:ago(-1)};
 const r=stageProfiles([a,old,future],day);
 assert.ok(r.profiles[0].windows.every(w=>w.legs===1));
 assert.throws(()=>stageProfiles([a,a],day),/Duplicate/);
});
