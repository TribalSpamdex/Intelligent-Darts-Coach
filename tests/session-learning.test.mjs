import {extractLearningExposure} from '../site/challenge-exposure.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {exerciseSequences,sequenceLines} from '../site/session-learning.mjs';
import {recordSetting} from '../site/challenge-setting.mjs';
import {precisionRound} from '../site/precision-games.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const stamp=(d,m=0)=>Date.parse(d+'T09:00:00Z')+m*60000;
const base={name:'Scoring Survival',tier:4,target:60,lives:3,ruleVersion:'test-rule'};
const setting=recordSetting(base,base).learningSetting;
function fixture(pattern=[true,true,true,false,false,false],ages=[0,1,7,8,14,15,21,22]){
 const host={sessions:[],games:[]},state={readiness:[]},reflections=[];
 for(const [i,n] of ages.entries()){
  const d=ago(n),sid=i+1,eid='e'+i;
  host.sessions.push({id:sid,date:d,start:stamp(d),quick:false,extra:false,completed:true,activities:[{name:base.name,exerciseId:eid,exerciseIndex:0,seconds:600,rounds:pattern.length,at:stamp(d,10)}]});
  for(const [j,win] of pattern.entries())host.games.push({name:base.name,sessionId:sid,exerciseId:eid,exerciseIndex:0,day:d,at:stamp(d,j+1),quick:false,extra:false,recovery:false,completion:'natural',win,tierAtStart:4,ruleVersion:base.ruleVersion,challengeTuning:null,precision:null,learningSetting:setting});
 }
 return {host,state,reflections};
}
test('within-exercise comparison uses actual chronological identical-setting rounds and independent days',()=>{
 const {host,state,reflections}=fixture();host.games.reverse();
 const r=exerciseSequences(host,state,reflections,day,now),p=r.profiles[0];
 assert.equal(p.days,8);assert.equal(p.roundsPerSide,24);assert.equal(p.early.median,1);assert.equal(p.late.median,0);assert.equal(p.status,'later-lower');
 assert.ok(sequenceLines(r).some(x=>x.includes('investigate conditions')));
});
test('later improvement and stable success are distinct from late deterioration',()=>{
 for(const [pattern,status] of [[[false,false,false,true,true,true],'later-higher'],[[true,false,true,true,false,true],'unclear']]){
  const {host,state,reflections}=fixture(pattern);
  assert.equal(exerciseSequences(host,state,reflections,day,now).profiles[0].status,status);
 }
});
test('odd round count drops only the central round; six rounds minimum',()=>{
 let f=fixture([true,true,true,false,false,false,false]);
 let p=exerciseSequences(f.host,f.state,f.reflections,day,now).profiles[0];
 assert.equal(p.roundsPerSide,24);assert.equal(p.early.median,1);assert.equal(p.late.median,0);
 f=fixture([true,true,false,false,false]);const r=exerciseSequences(f.host,f.state,f.reflections,day,now);
 assert.equal(r.profiles.length,0);assert.equal(r.rejected.tooFew,8);
});
test('mixed settings, partial rounds and changed exact routes do not become a within-exercise comparison',()=>{
 const f=fixture(),g=f.host.games[0];
 const modified=recordSetting(base,precisionRound(base,{scoring:{tier:4,quarter:1}},{eligible:true}));
 f.host.games[0]={...g,learningSetting:modified.learningSetting,precision:modified.precision,challengeTuning:modified.challengeTuning};
 let r=exerciseSequences(f.host,f.state,f.reflections,day,now);assert.equal(r.profiles[0].days,7);assert.equal(r.rejected.partialOrMixed,1);
 f.host.games[0]={...g,completion:'partial',win:null};f.host.sessions[0].activities[0].rounds=5;
 r=exerciseSequences(f.host,f.state,f.reflections,day,now);assert.equal(r.profiles[0].days,7);assert.equal(r.rejected.partialOrMixed,1);
});
test('multiple same-day exercises do not manufacture independent learning days',()=>{
 const f=fixture([true,true,true,false,false,false],[0,0,0,0,0,0,0,0]);
 const p=exerciseSequences(f.host,f.state,f.reflections,day,now).profiles[0];
 assert.equal(p.exercises,8);assert.equal(p.days,1);assert.equal(p.status,'insufficient');
});
test('linked reflection and reported condition remain contextual, not causal or scored',()=>{
 const f=fixture();f.reflections=[{kind:'exercise',sessionId:'1',index:0,name:base.name,day,at:stamp(day,10),answer:'fatigue',note:''},{kind:'exercise',sessionId:'2',index:0,name:'wrong drill',day:ago(1),at:stamp(ago(1),10),answer:'aim',note:''}];
 f.state.readiness=[{day,context:'practice',fatigue:'high',pressure:'normal',pain:false},{day:ago(1),context:'practice',fatigue:'normal',pressure:'normal',pain:false}];
 const p=exerciseSequences(f.host,f.state,f.reflections,day,now).profiles[0];
 assert.deepEqual(p.reflections,{fatigue:1});assert.deepEqual(p.conditions,{'unreported':6,'reported-normal':1,'reported-concern':1});assert.equal(p.status,'later-lower');
});
test('correction and deletion rebuild the within-exercise evidence',()=>{
 const f=fixture();assert.equal(exerciseSequences(f.host,f.state,f.reflections,day,now).profiles[0].days,8);
 f.host.sessions.splice(0,2);const r=exerciseSequences(f.host,f.state,f.reflections,day,now);assert.equal(r.profiles[0].days,6);assert.equal(r.profiles[0].status,'insufficient');
});

test('normal difficulty learner avoids sequence allocation unless explicitly requested',()=>{
 const f=fixture(),standard=extractLearningExposure(f.host,day,now),deep=extractLearningExposure(f.host,day,now,{includeSequence:true});
 assert.ok(standard.exposures.every(x=>!Object.hasOwn(x,'sequence')));
 assert.ok(deep.exposures.every(x=>x.sequence.length===6));
 assert.deepEqual(deep.exposures.map(({sequence,...x})=>x),standard.exposures);
});
test('future and pre-completion reflections do not attach to an exercise sequence',()=>{
 const f=fixture();f.reflections=[{kind:'exercise',sessionId:'1',index:0,name:base.name,day,at:now+1,answer:'fatigue',note:''},{kind:'exercise',sessionId:'2',index:0,name:base.name,day:ago(1),at:stamp(ago(1),1),answer:'aim',note:''}];
 assert.deepEqual(exerciseSequences(f.host,f.state,f.reflections,day,now).profiles[0].reflections,{});
});
