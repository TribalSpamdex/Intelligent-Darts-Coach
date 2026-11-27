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
 assert.ok(results[3].interventionFlags>=100,JSON.stringify(results[3]));
 assert.ok(results[3].wrongDirection<=15,JSON.stringify(results[3]));
});

test('Independent varied-volume and ability stationary/alternative cohorts: 2,400 new series',()=>{
 const cases=[['stable-beginner',.12,.8,0,.15],['stable-elite',.72,.8,0,.15],['clustered-elite',.72,.96,0,.25],['small-decline',.48,.8,-.08,.15],['large-decline',.48,.8,-.18,.15],['gradual-improve',.30,.85,.16,.15],['recovered-slump',.42,.8,-.2,.15],['missing-stable',.42,.9,0,.45]];
 const results=[];
 for(const [scenario,base,rho,delta,missing] of cases){
  let seed=(0x1334f789+results.length*9817)>>>0;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const out={scenario,improving:0,declining:0,unclear:0,insufficient:0};
  for(let i=0;i<300;i++){
   let noise=0;const rows=[];
   for(let d=0;d<56;d++){
    noise=rho*noise+(random()-.5)*.10;
    const shift=scenario==='gradual-improve'?delta*d/55:scenario==='recovered-slump'?(d>=14&&d<28?delta:0):d>=28?delta:0;
    if(random()<missing)continue;
    const p=Math.min(.999,Math.max(.001,base+noise+shift)),attempts=[15,30,60,90][Math.floor(random()*4)];
    let hits=0;for(let j=0;j<attempts;j++)hits+=Number(random()<p);
    rows.push({id:'r'+d,day:day(d),skill:'doubles',context:'practice',protocol:'fixed',hits,attempts});
   }
   const result=robustTrend(rows,{asOf:day(55)});
   out[result.status]=(out[result.status]??0)+1;
  }
  results.push(out);
 }
 console.log('Varied-volume trend sensitivity audit: '+JSON.stringify(results));
 for(const i of [0,1,2,7])assert.ok(results[i].improving+results[i].declining<=30,JSON.stringify(results[i]));
 assert.ok(results[4].declining>=150);
 for(const i of [3,4])assert.ok(results[i].improving<=5);
 assert.ok(results[5].declining<=5);
 assert.ok(results[6].declining<=10);
 // Mild and gradual signals are deliberately measured rather than declared
 // resolved: a conservative long-window flag is not the entire coaching
 // decision and these cohorts are not prospective human outcomes.
});
