import test from 'node:test';
import assert from 'node:assert/strict';
import {robustTrend} from '../site/engine/context.mjs';
import {fullReport} from '../site/engine/executive.mjs';
import {newMemory} from '../site/coach-memory.mjs';
const day=i=>new Date(Date.UTC(2022,0,1+i)).toISOString().slice(0,10);
function simulate({seed,rho,drop=0,missing=0,protocols=1,trials=500,base=.32}){
 let stateSeed=seed>>>0;
 const random=()=>((stateSeed=(Math.imul(stateSeed,1664525)+1013904223)>>>0)/4294967296);
 const result={trials,trendFlags:0,interventionFlags:0,wrongDirection:0,insufficient:0};
 for(let seq=0;seq<trials;seq++){
  const state=newMemory().state;let form=0;
  for(let d=0;d<56;d++){
   form=rho*form+(random()-.5)*.10;
   const chance=Math.max(.001,Math.min(.999,base+form+(d>=28?-drop:0)));
   for(let p=0;p<protocols;p++){
    if(missing&&random()<missing)continue;
    let hits=0;for(let i=0;i<30;i++)hits+=random()<chance;
    state.observations.push({id:seq+'/'+p+'/'+d,day:day(d),skill:'doubles',protocol:'same-'+p,context:'practice',hits,attempts:30});
   }
  }
  const trends=Array.from({length:protocols},(_,p)=>robustTrend(state.observations.filter(x=>x.protocol==='same-'+p),{asOf:day(55)}).status);
  if(trends.some(x=>x==='improving'||x==='declining'))result.trendFlags++;
  if(trends.some(x=>x==='improving')&&drop)result.wrongDirection++;
  if(trends.every(x=>x==='insufficient'))result.insufficient++;
  if(fullReport(state,day(55)).decision==='temporary-focus')result.interventionFlags++;
 }
 return result;
}
test('M3: held-out serial nulls and missing clustered histories are measured at trend and intervention layers',()=>{
 // Sol used 56 days, 30 darts/day, mean .32, uniform +/- .05 AR(1) form.
 // Independent seed, separate null and alternative cohorts. Bounds are release
 // engineering targets, not statistical coverage guarantees or clinical cutoffs.
 const cases=[
  {seed:14341,rho:0,trials:500,base:.32},
  {seed:74398,rho:.9,trials:500,base:.32},
  {seed:28901,rho:.95,missing:.20,protocols:3,trials:300,base:.32},
  {seed:81941,rho:.9,drop:.15,trials:500,base:.32},
  {seed:30017,rho:.9,drop:.08,trials:500,base:.32}
 ];
 const results=cases.map(c=>({...c,...simulate(c)}));
 console.log('M3 calibration (held-out synthetic cohorts): '+JSON.stringify(results));
 assert.ok(results[0].trendFlags<=25,JSON.stringify(results[0]));
 assert.ok(results[1].trendFlags<=50,JSON.stringify(results[1]));
 assert.ok(results[1].interventionFlags<=25,JSON.stringify(results[1]));
 assert.ok(results[2].interventionFlags<=30,JSON.stringify(results[2]));
 assert.ok(results[3].trendFlags>=150,JSON.stringify(results[3]));
 assert.ok(results[3].wrongDirection<=15,JSON.stringify(results[3]));
});
