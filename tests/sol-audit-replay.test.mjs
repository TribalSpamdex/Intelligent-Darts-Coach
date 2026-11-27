// Exact generator from Sol's independently supplied audit evidence, 26 Nov 2026.
// Replay the random draw sequence, including its preceding 100,000 visits and
// five three-year cohorts; do not compare different seeds to the old report.
import test from 'node:test';
import assert from 'node:assert/strict';
import {visit,routes} from '../site/engine/engine.mjs';
import {robustTrend} from '../site/engine/context.mjs';
import {precisionDecisions} from '../site/progression-evidence.mjs';
import {legalFinishCount} from '../site/finish-validation.mjs';
import {makeCheck} from '../site/precision-checks.mjs';
const day=i=>new Date(Date.UTC(2022,0,1+i)).toISOString().slice(0,10);
test('Sol exact original 100,000-visit, 190 walk-forward and 1,000 stationary-series replay',()=>{
 const values={MISS:0,'25':25,'50':50};
 for(let i=1;i<=20;i++)for(const [s,m] of [['S',1],['D',2],['T',3]])values[s+i]=i*m;
 let seed=14341;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),seg=Object.keys(values);
 let visitErrors=0;
 for(let i=0;i<100000;i++){
  const s=2+Math.floor(random()*500),di=random()<.5,arr=Array.from({length:3},()=>seg[Math.floor(random()*seg.length)]);
  let left=s,open=!di,bust=false,used=0;
  for(const h of arr){
   used++;const double=h==='50'||h.startsWith('D');
   if(!open&&!double)continue;
   open=true;left-=values[h];
   if(left<0||left===1||left===0&&!double){bust=true;left=s;open=!di;break}
   if(left===0)break;
  }
  const v=visit(s,arr,{doubleIn:di});
  if(v.remaining!==left||v.used!==used||v.opened!==open||v.bust!==bust||v.finished!==(left===0))visitErrors++;
 }
 assert.equal(visitErrors,0);
 const days=[];let checkpoints=0;
 for(const [ix,base] of [.10,.25,.42,.59,.75].entries()){
  const rows=[];
  for(let i=0;i<1095;i++){
   if(i%7===0||random()<.2||i%151<11)continue;
   const signal=base+.10*Math.min(i/250,1)-(i>=500&&i<610?.18:0)-(i>=825?.07:0);
   const hits=Array.from({length:60},()=>random()<signal).filter(Boolean).length;
   rows.push(makeCheck('doubles',hits,day(i)));
  }
  days.push(rows.length);
  for(let t=55;t<1095;t+=28){
   const cutoff=day(t),subset=rows.filter(o=>o.day<=cutoff),tiers={doubles:[7,5,3,2,1][ix]};
   assert.deepEqual(precisionDecisions(rows,cutoff,tiers),precisionDecisions(subset,cutoff,tiers));
   checkpoints++;
  }
 }
 assert.deepEqual(days,[699,706,698,680,695]);assert.equal(checkpoints,190);
 assert.equal(seed,1160098967,'random draw sequence before stationary series');
 const nulls={};
 for(const model of ['iid','serial']){
  let flags=0;
  for(let seq=0;seq<500;seq++){
   let noise=0;const rows=[];
   for(let d=0;d<56;d++){
    noise=.90*noise+(random()-.5)*.10;const p=.32+(model==='serial'?noise:0);
    let hits=0;for(let i=0;i<30;i++)hits+=random()<p;
    rows.push({day:day(d),skill:'doubles',protocol:'same',context:'practice',hits,attempts:30});
   }
   if(['improving','declining'].includes(robustTrend(rows,{asOf:day(55)}).status))flags++;
  }
  nulls[model]=flags;
 }
 assert.equal(seed,2582045143,'random draw sequence after stationary series');
 // Engineering regression limits, not calibrated nominal Type-I error.
 assert.ok(nulls.iid<=12);assert.ok(nulls.serial<=25);
 console.log('Sol exact replay: '+JSON.stringify({visitErrors,days,checkpoints,nulls,original:{iid:12,serial:131}}));
});
test('Sol exact route oracle: all returned paths have the correct sum, length and finishing double',()=>{
 const values={MISS:0,'25':25,'50':50};
 for(let i=1;i<=20;i++)for(const [s,m] of [['S',1],['D',2],['T',3]])values[s+i]=i*m;
 const scores=Object.values(values),finish=[50,...Array.from({length:20},(_,i)=>2*i+2)];
 const sets=[new Set(finish)];for(let i=1;i<3;i++)sets.push(new Set([...sets[i-1]].flatMap(x=>scores.map(y=>x+y))));
 let count=0;
 for(let d=1;d<=3;d++)for(let n=2;n<=170;n++){
  assert.equal(legalFinishCount(n,d),sets[d-1].has(n));
  for(const path of routes(n,d)){
   count++;
   assert.equal(path.reduce((a,x)=>a+values[x],0),n);
   assert.ok(/^(D(?:[1-9]|1[0-9]|20)|50)$/.test(path.at(-1)));
   assert.ok(path.length<=d);
  }
 }
 assert.ok(count>=83391);console.log('Sol exact route oracle: '+count+' legal paths checked');
});
