import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const extract=name=>{const i=html.indexOf('function '+name+'(');assert.ok(i>=0,name);const end=html.indexOf('\nfunction ',i+1);assert.ok(end>i,name);return html.slice(i,end)};
const line=name=>html.split('\n').find(x=>x.startsWith('const '+name+'='));
const factory=new Function([line('DART_SCORES'),line('POSSIBLE_VISITS'),line('FINISH_DOUBLE_SCORES'),...['validVisit','possibleVisitIn','possibleCheckoutIn','dc591OpeningValid'].map(extract)].join('\n')+'\nreturn {validVisit,possibleVisitIn,possibleCheckoutIn,dc591OpeningValid}');
const api=factory();
test('Native keypad exhaustive independent visit, finish and opening-double legality',()=>{
 const scores=new Set([0,25,50]),doubles=new Set([50]);for(let i=1;i<=20;i++){scores.add(i);scores.add(2*i);scores.add(3*i);doubles.add(2*i)}
 const totals=[new Set([0])],finishes=[new Set()];
 for(let i=1;i<=3;i++){totals.push(new Set([...totals[i-1]].flatMap(a=>[...scores].map(b=>a+b))));finishes.push(new Set([...totals[i-1]].flatMap(a=>[...doubles].map(b=>a+b))))}
 let checked=0;
 for(let n=-2;n<=182;n++){
  assert.equal(api.validVisit(n),totals[3].has(n));checked++;
  for(let d=0;d<=3;d++){assert.equal(api.possibleVisitIn(n,d),totals[d].has(n));assert.equal(api.possibleCheckoutIn(n,d),finishes[d].has(n));checked+=2}
  for(let room=1;room<=3;room++)for(let allowance=1;allowance<=6;allowance++)for(let dart=1;dart<=3;dart++)for(const opening of doubles){
   assert.equal(api.dc591OpeningValid(n,opening/2,dart,allowance,room),dart<=room&&dart<=allowance&&totals[room-dart].has(n-opening));checked++;
  }
 }
 for(const bad of [-1,4,2.5,NaN,Infinity])assert.equal(api.possibleVisitIn(60,bad),false);
 console.log('Native keypad oracle checks: '+checked);
});
test('Initial native drill budget preserves exact time, minimum and mastery allowance across 5000 plans',()=>{
 const allocate=new Function('const num=x=>Number(x)||0;\n'+extract('dc62InitialDrillBudget')+'\nreturn dc62InitialDrillBudget')();
 let seed=19301;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<5000;i++){
  const budget=i%2?2400:3000,count=1+Math.floor(random()*6),mastery=i%3===0&&count>1;
  const rows=Array.from({length:count},(_,j)=>({name:mastery&&j===0?'Target Mastery':'Game '+j,seconds:300+60*Math.floor(random()*16),wholeCoach:{}}));
  const desired=rows[0].seconds;allocate(rows,budget);
  assert.equal(rows.reduce((n,x)=>n+x.seconds,0),budget);assert.ok(rows.every(x=>Number.isInteger(x.seconds)&&x.seconds>=300));
  for(const r of rows.filter(x=>x.name!=='Target Mastery'))assert.equal(r.wholeCoach.plannedMinutes,r.seconds/60);
  if(mastery)assert.equal(rows[0].seconds,Math.min(desired,budget-(count-1)*300));
 }
});
test('Native legacy allocation ledger blocks overlapping, duplicate and malformed session days',()=>{
 const ledger=new Function('data','DAY_MS','dateKey','dc28GameCategory','dc29MasteryCategory',extract('dc28ReliableTimeline')+'\n'+extract('dc28CategoryLedger')+'\nreturn dc28CategoryLedger') ;
 const now=Date.parse('2026-11-27T12:00Z'),day=86400000,start=now-3600000;
 const row={id:1,start,quick:false,completed:true,activities:[{name:'Scoring Survival',seconds:600,exerciseIndex:0,at:start+1800000},{name:'Bull Accuracy',seconds:600,exerciseIndex:1,at:start+2400000}]};
 const read=rows=>ledger({sessions:rows},day,x=>new Date(x).toISOString().slice(0,10),n=>n==='Scoring Survival'?'scoring':'bull',()=>null)(now);
 assert.equal(read([row])[0].minutes.scoring,10);
 for(const bad of [{...row,activities:[row.activities[0],{...row.activities[1],at:start+1860000}]},{...row,activities:[row.activities[0],{...row.activities[1],exerciseIndex:0}]},{...row,activities:[row.activities[0],{...row.activities[1],at:undefined}]}]){
  assert.deepEqual(read([bad]),[]);assert.deepEqual(read([bad,{...row,id:2}]),[]);
 }
 assert.deepEqual(read([row,{...row,id:'1',start:start-day,activities:row.activities.map(a=>({...a,at:a.at-day}))}]),[]);
});

const isolatedAllocation=seconds=>new Function('sessionRemaining','const num=x=>Number(x)||0;const window={};const data={sessions:[]};const DAY_MS=86400000;const QUICK_GAMES=[];const DC10_MEASUREMENT_GAMES=new Set();const dc43LearningTransfer=()=>({status:"no-transfer"});const dc22GamesPlayedToday=()=>new Set();const dc45LockAllocation=s=>{s.provenanceLocked={exercises:s.plan.map(e=>({name:e.name,plannedSeconds:e.seconds}))}};\n'+extract('allocateRemaining')+'\nreturn allocateRemaining')(()=>seconds);
function allocationBoundaryChecks(allocate){
 let count=0;
 for(let seconds=0;seconds<=3600;seconds++){
  for(let drills=1;drills<=6;drills++)for(const mastery of [false,true]){
   const warm={name:'Warm-up',mode:'timed',seconds:600};
   const plan=[warm,...Array.from({length:drills},(_,i)=>({name:mastery&&i===0?'Target Mastery':'Drill '+i,mode:'timed',seconds:600,wholeCoach:{category:'scoring'}})),{name:'301 Pressure',mode:'timed',seconds:600,application:true}];
   const s={plan,index:1,allocated:false,quick:false,extra:false,wholeSessionAudit:{}};
   allocate(seconds)(s);
   const remaining=s.plan.slice(1),sum=remaining.reduce((n,e)=>n+e.seconds,0);
   if(!s.allocated||s.plan[0]!==warm||!s.provenanceLocked)throw Error('Lock or warm-up changed');
   if(seconds<300){if(remaining.length)throw Error('Subminimum time admitted')}
   else{
    if(!remaining.at(-1)?.application||remaining.at(-1).seconds!==Math.min(seconds,600))throw Error('Application reserve changed at '+seconds);
    if(remaining.some(e=>!Number.isInteger(e.seconds)||e.seconds<300)||sum>seconds)throw Error('Overtime or subminimum exercise');
    if(seconds>=900&&sum!==seconds)throw Error('Lost usable time at '+seconds);
    if(seconds<900&&sum!==Math.min(seconds,600))throw Error('Short session time mismatch');
   }
   count++;
  }
 }
 return count;
}
test('Actual post-warm-up allocator handles every second of the remaining clock',()=>{
 const count=allocationBoundaryChecks(isolatedAllocation);
 assert.equal(count,43212);
 console.log('Native remaining-clock boundary cases: '+count);
});
