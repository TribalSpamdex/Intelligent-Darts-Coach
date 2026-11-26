import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingLedger,ledgerWindows} from '../site/training-ledger.mjs';
import {developmentProfile,developmentAgenda} from '../site/development-review.mjs';
import {stageProfiles,stageTransfer} from '../site/match-stages.mjs';
import {legFromInput} from '../site/match-statistics.mjs';
import {tacticalModel,recoveryAdvice,measuredTargets} from '../site/tactical-learning.mjs';
import {makeTargetSample} from '../site/manual-target-samples.mjs';
import {routes,visit,SEGMENTS} from '../site/engine/engine.mjs';
import {precisionDecisions} from '../site/progression-evidence.mjs';
import {precisionRound,validPrecisionRecord} from '../site/precision-games.mjs';
import {integratedAsk} from '../site/integrated-dialogue.mjs';
import {newMemory} from '../site/coach-memory.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const stamp=(d,m=0)=>Date.parse(d+'T09:00:00Z')+m*60000;
function histories(){
 const host={sessions:[],games:[],assessmentHistory:[],bigSingles:[]},state=newMemory().state;
 const skills=['scoring','doubles','checkout','bull','singles','trebles'];
 for(let age=1095;age>=0;age--){
  if(age%5===0)continue;
  const d=ago(age),id=age+1,minutes=5+age%4*5;
  host.sessions.push({id,date:d,start:stamp(d),quick:false,extra:age%11===0,completed:age%19!==0,activities:[{name:'Scoring Survival',exerciseId:'e'+id,exerciseIndex:0,seconds:minutes*60,plannedSeconds:600,rounds:0,at:stamp(d,minutes)},{name:'Warm-up',exerciseId:'w'+id,exerciseIndex:1,seconds:300,rounds:0,at:stamp(d,minutes+5)}]});
  for(const [i,skill] of skills.entries()){
   if((age+i)%3!==0)continue;
   const attempts=skill==='checkout'?12:skill==='scoring'||skill==='bull'?30:60;
   const hits=skill==='scoring'?Math.min(1800,450+Math.floor((1095-age)/4)+(age%7-3)*10):Math.min(attempts,Math.round(attempts*(.18+i*.08+(1095-age)*.00012)));
   state.observations.push({id:skill+'-'+age,day:d,skill,context:'practice',protocol:'IDC precision fixed '+skill,attempts,hits});
  }
 }
 return {host,state};
}
test('three-year ledger walk-forward equals an independently truncated history at each monthly checkpoint',()=>{
 const {host}=histories();
 for(let age=730;age>=0;age-=28){
  const d=ago(age),t=now-age*86400000,x=trainingLedger(host,d,t),y=trainingLedger({...host,sessions:host.sessions.filter(s=>s.date<=d)},d,t);
  assert.deepEqual(x,y);
  for(const w of ledgerWindows(x,d)){
   assert.equal(w.total,w.direct+w.routine+w.interrupted+w.unclassified);
   assert.equal(w.total,w.scheduled+w.extra);
   assert.equal(w.direct,w.skills.reduce((n,s)=>n+s.seconds,0));
   assert.ok(w.recordedDays<=w.days);
  }
 }
});
test('one-year monthly development replay does not read future skills or practice sessions',()=>{
 const {host,state}=histories();
 for(let age=364;age>=0;age-=28){
  const d=ago(age),t=now-age*86400000;
  const x=developmentProfile(host,state,d,t),y=developmentProfile({...host,sessions:host.sessions.filter(s=>s.date<=d)},{...state,observations:state.observations.filter(o=>o.day<=d)},d,t);
  assert.deepEqual(x,y);
  for(const s of x.skills)for(const p of s.protocols){
   assert.equal(p.windows.length,3);assert.ok(p.windows.every(w=>w.measuredDays<=28&&w.end<=d));
  }
 }
});
test('walk-forward independent difficulty stays bounded on all six measured skills despite missing days',()=>{
 const {state}=histories(),tiers={scoring:4,doubles:5,checkout:5,bull:5};
 for(let age=365;age>=0;age-=7){
  const d=ago(age),p=precisionDecisions(state.observations,d,tiers);
  assert.deepEqual(p,precisionDecisions(state.observations.filter(o=>o.day<=d),d,tiers));
  for(const x of Object.values(p)){
   assert.ok(x.challenge>=0&&x.challenge<=3);assert.ok(x.recentCap>=0&&x.recentCap<=x.challenge);
   assert.equal(x.temporaryFormCap,x.recentCap<x.challenge-1e-8);
  }
 }
});
function actualHistory(){
 const rows=[];
 for(let age=730;age>=0;age-=3){
  const d=ago(age);
  for(const context of ['practice','competition']){
   const visits=context==='practice'?'T20 T20 T20\nT20 S11 50':'S20 S20 S20\nS20 S20 S20\nS20 S20 S20\nT20 S11 50';
   rows.push(legFromInput({id:context+'-'+age,day:d,start:301,doubleIn:false,context,result:'won',visits},day).leg);
  }
 }
 return rows;
}
test('two-year actual-leg analysis conserves phase visits, darts and credited points',()=>{
 const rows=actualHistory(),r=stageProfiles(rows,day);
 for(const p of r.profiles)for(const w of p.windows){
  const a=rows.filter(l=>l.context===p.context&&l.day<=day&&Date.parse(day)-Date.parse(l.day)<w.period*86400000);
  assert.equal(w.legs,a.length);
  assert.equal(w.scoring.points+w.checkout.points+w.bogey.points,301*a.length);
  assert.equal(w.scoring.darts+w.checkout.darts+w.bogey.darts,a.reduce((n,l)=>n+l.visits.reduce((s,v)=>s+v.darts.length,0),0));
  assert.equal(w.checkout.finishes,a.length);
  assert.equal(Object.values(w.finishDarts).reduce((a,b)=>a+b,0),a.length);
 }
});
test('actual competition transfer is as-of reproducible with multiple year boundaries',()=>{
 const rows=actualHistory();
 for(const age of [0,28,84,168,364]){
  const d=ago(age),x=stageProfiles(rows,d),y=stageProfiles(rows.filter(l=>l.day<=d),d);
  assert.deepEqual(x,y);assert.deepEqual(stageTransfer(x,d),stageTransfer(y,d));
 }
});
function measured(){
 const throws=[];
 for(const aim of ['T20','S20','D20','D10','50','S19','D16']){
  for(const age of [0,1,7,8,14,15,21,22]){
   const d=ago(age),actual=[...Array(12).fill(aim),...Array(5).fill(aim==='50'?'25':aim.startsWith('D')?'S'+aim.slice(1):'S20'),...Array(3).fill('MISS')];
   throws.push(...makeTargetSample({id:aim+'-'+age,day:d,aim,actual},d));
  }
 }
 return {throws,facts:[]};
}
test('every checkout score and dart count obeys legal route availability and bounded conditional estimates',()=>{
 const s=measured();
 for(let score=2;score<=170;score++)for(const darts of [1,2,3]){
  const x=tacticalModel(s,score,darts,day),available=routes(score,darts).length>0;
  assert.equal(x.standard!==null,available,score+'/'+darts);
  if(!available){assert.equal(x.status,'no-legal-finish');assert.deepEqual(x.options,[])}
  else{
   assert.ok(visit(score,x.standard).finished&&x.standard.length<=darts);
   assert.ok(x.options.every(o=>[o.estimate,o.early,o.late].every(v=>v>=0&&v<=1)));
   assert.ok(x.options.every(o=>x.coverage.some(c=>c.aim===o.aim)));
  }
 }
});
test('exact recovery agrees with native score and bust semantics across representative scores and all board segments',()=>{
 const state={facts:[]};
 for(const score of [2,40,81,121,170,181])for(const actual of [...SEGMENTS,'MISS']){
  const r=recoveryAdvice(state,score,[actual]),v=visit(score,[actual]);
  assert.equal(r.remaining,v.remaining);
  assert.equal(r.dartsLeft,v.bust||v.finished?0:2);
  if(v.bust)assert.equal(r.status,'bust');
  if(v.finished)assert.equal(r.status,'finished');
  assert.ok(r.options.every(x=>x.length<=2&&visit(r.remaining,x).finished));
 }
});
test('manual target sample duplicate day identity and correction cannot manufacture model coverage',()=>{
 const s=measured(),old=measuredTargets(s.throws,day);
 assert.equal(old.eligible.length,7);
 const duplicate=makeTargetSample({id:'duplicate',day,aim:'D20',actual:Array(20).fill('D20')},day);
 assert.throws(()=>measuredTargets([...s.throws,...duplicate],day),/Duplicate daily/);
 const corrected=s.throws.filter(o=>!o.id.startsWith('idc-fixed20:D20-0:'));
 assert.equal(measuredTargets(corrected,day).eligible.length,6);
});
test('deleting practice sessions recomputes the agenda without rewriting observations',()=>{
 const {host,state}=histories(),original=JSON.stringify(state);
 const a=developmentAgenda(host,state,day,{now});
 const b=developmentAgenda({...host,sessions:[]},state,day,{now});
 assert.equal(JSON.stringify(state),original);
 assert.ok(!b.actions.some(x=>x.kind==='review-stable-training'));
 assert.ok(a.actions.every(x=>typeof x.next==='string'));
});
test('temporary form cap cannot harden existing mixed skill rounds and preserves legal whole-number provenance',()=>{
 const g={name:'Scoring Survival',tier:4,target:60},base={tier:4,quarter:3,challenge:3};
 for(let i=0;i<=300;i++){
  const cap=i/100,r=precisionRound(g,{scoring:{...base,recentCap:cap,temporaryFormCap:true}},{eligible:true});
  assert.ok(r.target>=60&&r.target<=68&&Number.isInteger(r.target));
  if(r.precision)assert.ok(validPrecisionRecord({...r,tierAtStart:4}));
 }
 const mixed={name:'301 Pressure',tier:4,maxDarts:30,maxVisits:10};
 const r=precisionRound(mixed,{scoring:base,checkout:{...base,recentCap:0,temporaryFormCap:true}},{eligible:true});
 assert.equal(r,mixed);
});
test('real-data deep Coach answers remain reproducible after a local correction and do not mutate memory',()=>{
 const {host,state}=histories(),before=JSON.stringify(state),hostBefore=JSON.stringify(host);
 for(const q of ['How much have I actually trained?','How does my training relate to progress?','What should I work on next?','What should I test next?']){
  const r=integratedAsk(host,state,q,day,now);assert.equal(r.kind,'answer');assert.ok(r.lines.length);
 }
 assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(host),hostBefore);
 const q='How much have I actually trained?',a=integratedAsk(host,state,q,day,now),b=integratedAsk({...host,sessions:[]},state,q,day,now);
 assert.notDeepEqual(a,b);assert.ok(b.lines[0].includes('No validated'));
});
