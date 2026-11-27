import test from 'node:test';
import assert from 'node:assert/strict';
import {projectEvidence,trainingParentIndex,trainingParentEligible} from '../site/v62-evidence.mjs';
import {projectTargets} from '../site/host-targets.mjs';
import {gameProfile} from '../site/game-profile.mjs';
import {trainingLedger} from '../site/training-ledger.mjs';
import {projectExposure} from '../site/host-exposure.mjs';
import {practiceProfile} from '../site/practice-statistics.mjs';
import {calibrationReview,calibrationGuard,calibrationReviewLines} from '../site/progression-evidence.mjs';
import {conversationTurn} from '../site/integrated-dialogue.mjs';
import {newMemory} from '../site/coach-memory.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const session={id:1,quick:false,date:day,start:now-3600000,extra:false,completed:true,activities:[{name:'Scoring Challenge',exerciseIndex:0,seconds:600,at:now-600000,rounds:0}]};
const score={name:'Scoring Challenge',day,at:now-200000,sessionId:1,quick:false,completion:'natural',benchmark:true,visits:10,points:600,scores:Array(10).fill(60)};
const double={name:'Doubles Streak',variant:'doubles',day,at:now-100000,sessionId:1,quick:false,completion:'natural',tierAtStart:4,thrown:3,hits:2,targetLog:[{ring:'D',target:16,hit:true},{ring:'D',target:16,hit:true},{ring:'D',target:20,hit:false}]};
const host=()=>({sessions:[structuredClone(session)],games:[structuredClone(score),structuredClone(double)],bigSingles:[],assessmentHistory:[]});
test('cross-layer parent provenance prevents recreation entering fixed measurements, targets, and visits',()=>{
 const h=host(),before=JSON.stringify(h);
 assert.equal(projectEvidence(h,{today:day,now}).observations.length,1);assert.equal(projectTargets(h,day,now).rows.length,2);assert.equal(gameProfile(h,day,now).scoring.visits,10);assert.equal(JSON.stringify(h),before);
 for(const patch of [{quick:true},{quick:undefined},{start:now}]){
  const x=host();Object.assign(x.sessions[0],patch);
  assert.equal(projectEvidence(x,{today:day,now}).observations.length,0);assert.equal(projectTargets(x,day,now).rows.length,0);assert.equal(gameProfile(x,day,now).scoring.visits,0);
 }
});
test('duplicate numeric/string parent identities veto evidence including conflicting recreational copies',()=>{
 for(const quick of [true,false]){
  const h=host();h.sessions.push({...h.sessions[0],id:'1',quick});
  assert.equal(projectEvidence(h,{today:day,now}).observations.length,0);assert.equal(projectTargets(h,day,now).rows.length,0);assert.equal(gameProfile(h,day,now).scoring.visits,0);
  assert.equal(trainingLedger(h,day,now).sessions.length,0);assert.equal(projectExposure(h,day,now).exposure.length,0);assert.equal(practiceProfile(h,day,now).windows[0].sessions,0);
 }
});
test('orphan legacy rounds retain previous eligibility while strict parent mode rejects them',()=>{
 const h=host();h.sessions=[];const i=trainingParentIndex(h.sessions);
 assert.equal(trainingParentEligible(score,i),true);assert.equal(trainingParentEligible(score,i,true),false);
 assert.equal(projectEvidence(h,{today:day,now}).observations.length,1);
});
test('daily singles require a single nonrecreational parent and valid chronology across projections',()=>{
 const h=host();h.bigSingles=[{day,at:now-1000,sessionId:1,complete:true,hits:40,perNumber:Array(20).fill(2)}];
 assert.equal(projectTargets(h,day,now).rows.filter(x=>x.protocol==='Daily large singles benchmark').length,20);
 for(const patch of [{date:ago(1)},{start:now},{quick:true}]){
  const x=structuredClone(h);Object.assign(x.sessions[0],patch);
  assert.equal(projectTargets(x,day,now).rows.filter(x=>x.protocol==='Daily large singles benchmark').length,0);
  assert.equal(projectEvidence(x,{today:day,now}).observations.filter(x=>x.skill==='singles').length,0);
 }
});
test('stored timezone offsets control measurement day consistently; impossible dates excluded',()=>{
 const stamp=Date.parse(day+'T00:30:00Z'),date=ago(1),h={...host(),sessions:[],games:[{...score,at:stamp,day:date,offsetMinutes:60},{...double,at:stamp,day:date,offsetMinutes:60}]};
 assert.equal(projectEvidence(h,{today:day,now}).observations.length,1);assert.equal(gameProfile(h,day,now).scoring.visits,10);assert.equal(projectTargets(h,day,now).rows.length,2);
 h.games=h.games.map(g=>({...g,offsetMinutes:900}));assert.equal(projectEvidence(h,{today:day,now}).observations.length,0);assert.equal(gameProfile(h,day,now).scoring.visits,0);assert.equal(projectTargets(h,day,now).rows.length,0);
});
const ages=[0,1,7,8,14,15,21,22];
const row=(n,v,patch={})=>({id:'r'+n,day:ago(n),skill:'scoring',context:'practice',protocol:'IDC precision fixed scoring',attempts:30,hits:v*10,...patch});
const sample=(v,patch={})=>ages.map(n=>row(n,v,patch));
test('fresh independent fixed evidence can veto unsupported native promotion or demotion',()=>{
 assert.equal(calibrationGuard(sample(40),day,'scoring',5,4).status,'defer');
 assert.equal(calibrationGuard(sample(75),day,'scoring',4,5).status,'defer');
 assert.equal(calibrationGuard(sample(75),day,'scoring',5,4).status,'clear');
 assert.equal(calibrationGuard(sample(40),day,'scoring',4,5).status,'clear');
});
test('a single exceptional day, stale measurements and different protocols cannot veto native adjustment',()=>{
 for(const rows of [sample(40).slice(0,1),sample(40,{context:'competition'}),sample(40,{protocol:'adaptive'}),ages.map(n=>row(n+28,40)),sample(60),ages.map(n=>row(n,n<10?40:80))])assert.equal(calibrationGuard(rows,day,'scoring',5,4).status,'clear');
 assert.equal(calibrationGuard(sample(40),day,'scoring',5,2).status,'unchanged');
});
test('calibration review keeps contrary protocols separate without exposing internal tiers',()=>{
 const mixed=[...sample(40),...ages.map(n=>row(n,85,{id:'other'+n,protocol:'IDC V6.2 Scoring Challenge fixed 30 darts'}))],r=calibrationReview(mixed,day)[0];
 assert.equal(r.status,'mixed-evidence');assert.equal(r.confirmed,null);assert.equal(r.protocols.length,2);
 assert.equal(calibrationGuard(mixed,day,'scoring',5,4).status,'defer');
 assert.match(calibrationReviewLines([r]).join(' '),/does not reset difficulty/);
});
test('calibration guard uses correct independent binary-skill units',()=>{
 const d=ages.map(n=>row(n,0,{skill:'doubles',protocol:'IDC precision fixed doubles',attempts:60,hits:6}));
 assert.equal(calibrationGuard(d,day,'doubles',5,4).status,'defer');
 const e=d.map(o=>({...o,hits:30}));assert.equal(calibrationGuard(e,day,'doubles',4,5).status,'defer');
});
test('contextual coaching follow-up recomputes evidence and does not write player data',()=>{
 const h=host(),state=newMemory().state,before=JSON.stringify(state);
 const turn=(text,previous=null,date=day)=>conversationTurn(h,state,text,date,now,[],[],{},[],previous);
 const a=turn('Is my difficulty calibrated correctly?');assert.equal(a.answer.type,'calibration-review');assert.deepEqual(a.context,{day,topic:'calibration-review'});
 const b=turn('What should I do about that?',a.context);assert.equal(b.answer.type,'review-followup');assert.match(b.answer.lines[0],/same fixed benchmark/);
 assert.equal(turn('Why?',a.context,ago(-1)).answer.type,'clarification');
 const c=turn('How do nerves and confidence affect my performance?',a.context);assert.equal(c.context.topic,'mental-evidence');
 assert.match(turn('How do I test that?',c.context).answer.lines[0],/naturally occurring/);
 assert.equal(turn('Checkout 81 with 2 darts',c.context).context.score,81);
 assert.equal(JSON.stringify(state),before);
});
