import test from 'node:test';
import assert from 'node:assert/strict';
import {SKILLS,plan,emptyMemory} from '../site/engine/engine.mjs';
import {newPlayer,query} from '../site/engine/coach-api.mjs';
import {fullReport} from '../site/engine/executive.mjs';
import {checkDecision} from '../site/engine/verification.mjs';
import {trainingRecommendation,validateSession,logSession} from '../site/engine/session-intelligence.mjs';
import {drillPlan} from '../site/engine/player-intelligence.mjs';
import {combinedExposure} from '../site/engine/goals.mjs';
import {validateState} from '../site/engine/state.mjs';
const day='2026-11-27';
const shape=p=>{assert.equal(p.reduce((n,x)=>n+x.minutes,0),60);assert.deepEqual([p[0].skill,p[0].minutes],['warmup',10]);assert.deepEqual([p.at(-1).skill,p.at(-1).minutes],['application',10]);assert.equal(p.slice(1,-1).reduce((n,x)=>n+x.minutes,0),40);assert.ok(p.every(x=>x.minutes>=5));assert.equal(new Set(p.map(x=>x.skill)).size,p.length)};
test('All generic focus plans preserve the 10/40/10 contract and focus',()=>{
 for(const skill of [null,...SKILLS]){const p=plan(skill);shape(p);if(skill)assert.ok(p.some(x=>x.skill===skill));shape(drillPlan(emptyMemory(),day,skill));const m={...emptyMemory(),interventions:skill?[{id:'i',skill}]:[]};shape(trainingRecommendation(m,{decision:'balanced'},day,{mode:skill?'accepted-temporary-focus':'balanced',intervention:'i'}).segments)}
});
test('Application is present in the public training API, and old logs remain valid',()=>{
 const m=newPlayer(),r=query(m,{version:1,type:'training',day,payload:{}}).result;shape(r.segments);
 const log={id:'new',day,number:1,status:'completed',segments:r.segments.map(({skill,drill,minutes})=>({skill,drill,minutes}))};
 assert.equal(validateSession(log),log);
 const state=validateState(logSession(m,log));assert.equal(state.sessions.length,1);
 assert.equal(combinedExposure(state).find(x=>x.skill==='application').minutes,10);
 assert.throws(()=>validateSession({...log,segments:log.segments.map(x=>x.skill==='application'?{...x,drill:'unrelated'}:x)}));
 const legacy={id:'old',day:'2026-11-26',number:1,status:'completed',segments:[{skill:'warmup',drill:'warmup',minutes:10},{skill:'doubles',drill:'double-prep',minutes:50}]};
 assert.equal(validateSession(legacy),legacy);
});
test('Verifier rejects a proposed or active plan without the reserved application',()=>{
 const m=newPlayer(),r=fullReport(m,day);assert.equal(r.verification.status,'passed');
 const wrong=r.plan.map(x=>x.skill==='application'?{skill:'setup',minutes:10}:x);
 assert.ok(checkDecision(m,{...r,plan:wrong}).faults.includes('invalid-proposed-plan'));
 assert.ok(checkDecision(m,{...r,active:{...r.active,plan:wrong}}).faults.includes('invalid-active-plan'));
});

test('Five-day rotation keeps setup plus all core skills within the revised budget',()=>{
 const covered=new Set();
 for(let i=0;i<5;i++){
  const d='2026-11-'+String(20+i),p=drillPlan(emptyMemory(),d);
  shape(p);
  for(const skill of ['scoring','doubles','checkout','singles','bull','setup'])assert.ok(p.some(x=>x.skill===skill),skill);
  for(const x of p)covered.add(x.skill);
 }
 for(const skill of SKILLS)assert.ok(covered.has(skill),skill);
 for(const skill of SKILLS){
  const base=plan().find(x=>x.skill===skill)?.minutes??0;
  assert.equal(plan(skill).find(x=>x.skill===skill).minutes,base+5,skill);
 }
});
