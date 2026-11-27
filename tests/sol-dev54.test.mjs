import test from 'node:test';
import assert from 'node:assert/strict';
import {newMemory} from '../site/coach-memory.mjs';
import {currentConditionRows,currentReferenceBoundary,adaptiveReview} from '../site/adaptive-review.mjs';
import {quickDevelopment} from '../site/quick-development.mjs';
import {autonomyAnswer} from '../site/autonomy-dialogue.mjs';
const day='2026-11-27',now=Date.parse(day+'T12:00Z'),ms=86400000;
const ago=n=>new Date(now-n*ms).toISOString().slice(0,10);
const state=()=>newMemory().state;
const rows=()=>Array.from({length:140},(_,i)=>({id:'independent-'+i,day:ago(i),skill:'doubles',context:'practice',protocol:'IDC precision fixed doubles',attempts:60,hits:30}));
const host=()=>({games:[],sessions:[],assessmentHistory:[],bigSingles:[],assessment:{version:6,finished:true,completedAt:now-7*ms,offsetMinutes:0}});
function quick(){const h=host();delete h.assessment;for(let i=55;i>=0;i--){const id='q'+i,at=now-i*ms-1000;h.sessions.push({id,quick:true,quickGame:'Scoring Survival',start:at-1000,date:ago(i)});h.games.push({name:'Scoring Survival',sessionId:id,quick:true,at,day:ago(i),offsetMinutes:0,completion:'natural',benchmark:false,tierAtStart:4,visits:5,points:(i<28?30:90)*5,scores:Array(5).fill(i<28?30:90),skillProtocol:{version:1,name:'Scoring Survival',rules:{tier:4,target:60,lives:3}}});}return h;}
test('DEV54 current forecast rows share the host reassessment boundary',()=>{
 const s={...state(),observations:rows()},h=host();
 assert.equal(currentReferenceBoundary(h,s,day,now),ago(7));
 assert.equal(currentConditionRows(s.observations,s,day,h,now).length,7);
 assert.equal(adaptiveReview(h,s,day,now).boundary,ago(7));
});
test('DEV54 actual dialogue withholds pre-reassessment forecast and retains stored history',()=>{
 const s={...state(),observations:rows()},before=JSON.stringify(s);
 const a=autonomyAnswer(host(),s,'what performance range is realistic',day,now);
 assert.match(a.lines.join(' '),/currently 1\./);
 assert.doesNotMatch(a.lines.join(' '),/Next comparable seven-day daily-mean estimate/);
 assert.equal(JSON.stringify(s),before);
});
test('DEV54 later setup and same-day ambiguity win over an earlier reassessment',()=>{
 const s={...state(),changes:[{day:ago(2)}]};
 assert.equal(currentConditionRows(rows(),s,day,host(),now).length,2);
 s.changes=[{day}];assert.equal(currentConditionRows(rows(),s,day,host(),now).length,0);
});
test('DEV54 Quick Play as-of review ignores a reassessment recorded in its future',()=>{
 const h=quick(),before=quickDevelopment(h,state(),day,now);
 h.assessment={version:6,finished:true,completedAt:now+ms,offsetMinutes:0};
 const after=quickDevelopment(h,state(),day,now+2*ms);
 assert.equal(before.focus?.game,'Scoring Survival');assert.deepEqual(after.profiles,before.profiles);
 assert.equal(after.reassessed,null);
});
test('DEV54 unknown-version assessment cannot discard current Quick Play evidence',()=>{
 const h=quick(),before=quickDevelopment(h,state(),day,now);
 h.assessment={version:5,finished:true,completedAt:now-7*ms,offsetMinutes:0};
 assert.deepEqual(quickDevelopment(h,state(),day,now).profiles,before.profiles);
});
test('DEV54 valid recent reassessment still excludes old Quick Play comparisons',()=>{
 const h=quick();h.assessment=host().assessment;
 const r=quickDevelopment(h,state(),day,now);assert.equal(r.focus,null);
 assert.ok(r.profiles.every(p=>p.days<=7));
});
test('DEV54 future, Quick Start and carried-forward assessments do not reset current reference',()=>{
 for(const patch of [{completedAt:now+ms},{quickStart:true},{carriedForward:true},{version:5}]){
  const h=host();Object.assign(h.assessment,patch);
  assert.equal(currentConditionRows(rows(),state(),day,h,now).length,140);
 }
});

import {targetDevelopment,contextualDrillPreferences} from '../site/host-targets.mjs';
function targets(){const h=quick();for(const g of h.games){g.name='Target Mastery';g.masteryMode='segment';g.thrown=15;g.hits=g.day<ago(27)?12:3;g.targetLog=Array.from({length:15},(_,i)=>({ring:'D',target:16,hit:i<g.hits}));}for(const s of h.sessions)s.quickGame='Target Mastery';return h;}
test('DEV54 target recommendations cannot see a future reassessment',()=>{
 const h=targets(),before=targetDevelopment(h,state(),day,now);assert.equal(before.focus?.target,'D16');
 h.assessment={version:6,finished:true,completedAt:now+ms,offsetMinutes:0};
 assert.deepEqual(targetDevelopment(h,state(),day,now+2*ms),before);
});
test('DEV54 Quick Start and carried-forward assessments preserve measured target adaptations',()=>{
 for(const flag of ['quickStart','carriedForward']){const h=targets();h.assessment={...host().assessment,[flag]:true};assert.equal(contextualDrillPreferences(targetDevelopment(h,state(),day,now)).doubles,'Doubles Streak');}
});
test('DEV54 genuine current target reassessment still requests fresh comparable data',()=>{
 const h=targets();h.assessment=host().assessment;assert.equal(targetDevelopment(h,state(),day,now).focus,null);
});
