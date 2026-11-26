import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseLearnedMethod} from '../site/personal-programme.mjs';
import {trainingOutcomes} from '../site/training-outcomes.mjs';
import {recordSetting} from '../site/challenge-setting.mjs';
import {newMemory,validateMemory} from '../site/coach-memory.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10),stamp=(d,m=0)=>Date.parse(d+'T09:00:00Z')+m*60000;
const normal={name:'Scoring Survival',tier:4,target:60,lives:3},alternative={name:'Scoring Ladder',tier:4,targets:[55,59,63],lives:3};
function fixture({count=6,age=90,base=60,benefit=7,spacing=7}={}){
 const host={sessions:[],games:[],assessmentHistory:[],bigSingles:[]},memory=newMemory();memory.learnedMethods=true;
 for(let i=0;i<count*2;i++){
  const from=ago(age-i*spacing),practice=ago(age-i*spacing-1),to=ago(age-i*spacing-3),better=i%4===1||i%4===2,g=better?alternative:normal,setting=recordSetting(g,g).learningSetting,id=i+1,eid=id+':exercise:0',start=stamp(practice);
  host.sessions.push({id,date:practice,start,quick:false,extra:false,completed:true,activities:[{name:g.name,exerciseId:eid,exerciseIndex:0,seconds:600,rounds:3,at:stamp(practice,10)},{name:'Warm-up',exerciseId:id+':exercise:1',exerciseIndex:1,seconds:600,rounds:0,at:stamp(practice,20)}]});
  for(let j=1;j<=3;j++)host.games.push({name:g.name,sessionId:id,exerciseId:eid,exerciseIndex:0,day:practice,at:stamp(practice,j),quick:false,extra:false,recovery:false,completion:'natural',win:j!==3,tierAtStart:4,ruleVersion:null,learningSetting:setting});
  for(const [d,value,kind] of [[from,base,'b'],[to,base+(better?benefit:0),'a']])memory.state.observations.push({id:kind+i,day:d,skill:'scoring',context:'practice',protocol:'IDC precision fixed scoring',attempts:30,hits:value*10});
 }
 return {host,memory};
}
const opts=[{normal:normal.name,alternative:alternative.name,skill:'scoring',normalTier:4,alternativeTier:4,seconds:600,normalScore:10,alternativeScore:11}];
const policy={categories:{scoring:{}}},report={decision:'balanced',verification:{status:'passed'}};
const choose=(f,d=day,t=now)=>chooseLearnedMethod(f.host,{memory:f.memory,state:f.memory.state,report},opts,policy,d,t);
test('real reconstructed native exercise history reaches learned choice without fabricated comparison summaries',()=>{
 const f=fixture(),before=JSON.stringify(f),r=trainingOutcomes(f.host,f.memory.state,day,now);
 assert.equal(r.episodes.length,12);assert.equal(r.comparisons.length,1);assert.equal(r.comparisons[0].pairs,6);
 assert.equal(choose(f).status,'selected');assert.equal(choose(f).alternative,alternative.name);
 assert.equal(JSON.stringify(f),before);
 const roundtrip={host:structuredClone(f.host),memory:validateMemory(JSON.parse(JSON.stringify(f.memory)))};
 assert.deepEqual(choose(roundtrip),choose(f));
});
test('native evidence deletion, correction, conflicting rounds and consent revocation remove the preference',()=>{
 for(const mutate of [f=>f.host.sessions.pop(),f=>f.memory.state.observations.pop(),f=>{const g=f.host.games[0];f.host.games.push({...g,win:!g.win})},f=>{f.memory.learnedMethods=false},f=>{f.memory.state.setups.push({day:ago(1)})}]){
  const f=fixture();assert.equal(choose(f).status,'selected');mutate(f);assert.equal(choose(f).status,'unchanged');
 }
});
test('beginner through elite synthetic benchmark ranges preserve scope, dates and conservative matching',()=>{
 for(const base of [20,35,55,75,100,120]){
  const f=fixture({base});assert.equal(choose(f).status,'selected',String(base));
  for(const n of [91,70,40,0]){
   const d=ago(n),t=now-n*86400000,all=choose(f,d,t);
   const past={host:{...f.host,sessions:f.host.sessions.filter(x=>x.date<=d),games:f.host.games.filter(x=>x.day<=d)},memory:{...f.memory,state:{...f.memory.state,observations:f.memory.state.observations.filter(o=>o.day<=d)}}};
   assert.deepEqual(all,choose(past,d,t));
   if(n>0)assert.equal(all.status,'unchanged');
  }
 }
});
