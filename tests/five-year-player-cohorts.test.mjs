import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyMemory} from '../site/engine/engine.mjs';
import {fullReport} from '../site/engine/executive.mjs';
import {measuredPracticeLevels,measuredGamePreferences,trainingRecommendation} from '../site/engine/session-intelligence.mjs';
import {abilityProfiles,precisionDecisions} from '../site/progression-evidence.mjs';
import {makeCheck} from '../site/precision-checks.mjs';
import {asOfState} from '../site/engine/context.mjs';
const date=i=>new Date(Date.UTC(2021,0,1+i)).toISOString().slice(0,10);
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const ages=[29,90,182,364,1094,1825];
function player(index,avg){
 let seed=(0x82e18be3+index*7919)>>>0;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const state={...emptyMemory(),readiness:[],changes:[]};
 let form=0,trainingDays=0;
 // Distinct synthetic profiles, including scoring/finishing imbalance,
 // periodic travel, a prolonged decline, a recovery and a later plateau.
 const doubleBase=clamp((avg-15)/150+(index===7?-.23:index===3?.18:0),.06,.72);
 const binomial=(n,p)=>{let hits=0;for(let j=0;j<n;j++)hits+=Number(random()<clamp(p,.01,.98));return hits};
 for(let i=0;i<=1825;i++){
  form=.78*form+(random()-.5)*.075;
  const injured=i>=720&&i<=735;
  if(injured){state.readiness.push({day:date(i),context:'practice',fatigue:'normal',pressure:'normal',confidence:'normal',pain:true,note:''});continue}
  if(i%365>=150&&i%365<=163||i%7===0||random()<.22)continue;
  trainingDays++;
  const gain=Math.min(i/365,1)*.05,slump=i>=850&&i<950?-.14:0;
  const scoringAverage=clamp(avg+gain*90+form*35+slump*75,10,150);
  // A real discrete 30-dart score, not an impossible aggregate.
  let points=0;for(let dart=0;dart<30;dart++){
   const p=clamp((scoringAverage/3-12)/48,0,.8);
   points+=random()<p?60:random()<.65?20:5;
  }
  state.observations.push(makeCheck('scoring',points,date(i)));
  state.observations.push(makeCheck('doubles',binomial(60,doubleBase+gain+form+slump),date(i)));
  state.observations.push(makeCheck('checkout',binomial(12,clamp(doubleBase*.95+gain+form+slump,.02,.9)),date(i)));
  state.observations.push(makeCheck('bull',binomial(30,clamp(doubleBase*1.18+.04+gain+form+slump,.03,.95)),date(i)));
 }
 state.changes.push({id:'equipment-'+index,day:date(850),field:'equipment',description:'Synthetic setup change'});
 return {state,trainingDays};
}
test('eleven five-year player histories: walk-forward coaching, ability, safety and conserved training budget',()=>{
 const results=[];
 for(const [index,avg] of [18,25,35,45,55,65,75,85,95,105,115].entries()){
  const {state,trainingDays}=player(index,avg),before=JSON.stringify(state);
  const checkpoints=[];
  for(const age of ages){
   const day=date(age),known=asOfState(state,day);
   const full=fullReport(state,day),past=fullReport(known,day);
   assert.deepEqual(full,past,'future measurements and wellbeing cannot alter historical decisions');
   assert.equal(full.verification.status,'passed',JSON.stringify({avg,age,verification:full.verification}));
   const abilities=abilityProfiles(state.observations,day),levels=measuredPracticeLevels(state.observations,day);
   const tiers=Object.fromEntries(Object.entries(levels).filter(([k])=>['scoring','doubles','checkout','bull'].includes(k)).map(([k,v])=>[k,8-v]));
   const precision=precisionDecisions(state.observations,day,tiers);
   assert.deepEqual(precision,precisionDecisions(known.observations,day,tiers));
   const session=trainingRecommendation(known,full,day,full.active);
   if(['stop','reduce-load'].includes(full.decision))assert.equal(session.segments.length,0);
   else assert.equal(session.segments.reduce((a,s)=>a+s.minutes,0),60);
   checkpoints.push({age,decision:full.decision,scoring:abilities.find(x=>x.skill==='scoring').confirmed,doubles:abilities.find(x=>x.skill==='doubles').confirmed,levels,drills:measuredGamePreferences(state.observations,day)});
  }
  const injury=fullReport(state,date(725));assert.equal(injury.decision,'stop');
  assert.equal(trainingRecommendation(asOfState(state,date(725)),injury,date(725),injury.active).segments.length,0);
  assert.equal(JSON.stringify(state),before,'review must not write synthetic history');
  results.push({avg,trainingDays,observations:state.observations.length,checkpoints});
 }
 assert.ok(new Set(results.map(x=>JSON.stringify(x.checkpoints.at(-1).levels))).size>=5);
 assert.ok(results[0].checkpoints.at(-1).scoring<results.at(-1).checkpoints.at(-1).scoring);
 assert.ok(results[7].checkpoints.at(-1).doubles<results[6].checkpoints.at(-1).doubles,'weaker doubles despite higher scoring');
 console.log('Five-year player audit: '+JSON.stringify(results));
});
