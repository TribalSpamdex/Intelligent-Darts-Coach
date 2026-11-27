// Engineering timing only: manual coach observations, no physical-device or native storage claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {newMemory,assemble,assess,validateMemory} from '../site/coach-memory.mjs';
import {integratedAsk} from '../site/integrated-dialogue.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z');
const host={games:[],sessions:[],assessmentHistory:[],bigSingles:[]};
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
const stamp=age=>new Date(now-age*86400000).toISOString().slice(0,10);
for(const years of [1,5,10])test('synthetic '+years+'-year manual-observation review timing, no automatic pruning',()=>{
 const raw=newMemory();
 for(let age=years*365-1;age>=0;age--)if(age%7<5)for(const [i,skill] of ['scoring','doubles','checkout','bull'].entries()){
  const attempts=skill==='checkout'?12:60,hits=skill==='scoring'?Math.round(attempts*(50+i+(age%9))/3):Math.round(attempts*(.25+(age%7)*.02));
  raw.state.observations.push({id:'perf-'+age+'-'+skill,day:stamp(age),skill,context:'practice',protocol:'Synthetic '+skill+' benchmark',attempts,hits});
 }
 const serialized=JSON.stringify(raw),times={assemble:[],review:[],dialogue:[],restore:[]};
 // Warm up once; record actual wall-clock times, not artificial targets.
 assemble(host,raw,day,now);assess(host,raw,day,now);
 for(let i=0;i<7;i++){
  let t=performance.now();const x=assemble(host,raw,day,now);times.assemble.push(performance.now()-t);
  assert.equal(x.state.observations.length,raw.state.observations.length);
  t=performance.now();const review=assess(host,raw,day,now);times.review.push(performance.now()-t);assert.ok(review.report);
  t=performance.now();const a=integratedAsk(host,x.state,'How have I progressed this year?',day,now);times.dialogue.push(performance.now()-t);assert.equal(a.type,'longitudinal');
  t=performance.now();const restored=validateMemory(JSON.parse(serialized));times.restore.push(performance.now()-t);assert.equal(restored.state.observations.length,raw.state.observations.length);
 }
 assert.equal(JSON.stringify(raw),serialized);
 const metrics=Object.fromEntries(Object.entries(times).map(([key,values])=>[key,{p50:Number(percentile(values,.5).toFixed(2)),p95:Number(percentile(values,.95).toFixed(2))}]));
 console.log('IDC manual-history benchmark '+JSON.stringify({years,observations:raw.state.observations.length,jsonBytes:Buffer.byteLength(serialized),repeats:7,ms:metrics,limitation:'Node CI only, synthetic manual history; p95 is maximum of 7 samples, no iPhone, DOM, save or Undo timing'}));
});
