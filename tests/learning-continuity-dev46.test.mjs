import test from 'node:test';
import assert from 'node:assert/strict';
import {currentLearningEpisodes,learningBoundary} from '../site/challenge-episodes.mjs';
import {trainingOutcomes} from '../site/training-outcomes.mjs';
import {currentMethodReviews,methodFollowupGate} from '../site/coaching-accountability.mjs';
import {newMemory} from '../site/coach-memory.mjs';
import {coachBrief} from '../site/proactive-coach.mjs';
import {reflectionInsights} from '../site/reflections.mjs';
import {integratedAsk} from '../site/integrated-dialogue.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const host={sessions:[],games:[],assessmentHistory:[],bigSingles:[]};
const scope={skill:'doubles',protocol:'IDC precision fixed doubles',context:'practice'};
const question={id:'protocol',scope,text:'Same conditions?',answers:['yes','no','unknown'],why:'Comparability'};
const report={decision:'balanced',verification:{status:'passed'},strategy:{agenda:{questions:[question]}}};
const e=(a,b)=>({from:ago(a),to:ago(b)});
test('only whole episodes strictly after the latest known change are current; dates are retrospective',()=>{
 const rows=[e(20,18),e(10,8),e(9,7),e(6,4),e(2,-1)],s={setups:[{day:ago(12)},{day:ago(-2)}],changes:[{day:ago(9)}]};
 const before=JSON.stringify([rows,s]),r=currentLearningEpisodes(rows,s,day);
 assert.equal(r.boundary,ago(9));assert.deepEqual(r.episodes,[rows[3]]);assert.equal(JSON.stringify([rows,s]),before);
 assert.equal(learningBoundary(s,ago(11)),ago(12));
 assert.equal(learningBoundary({changes:[{day:ago(-1)}]},day),null);
});
test('retention follow-up blocks competing optional choices only during an active review window',()=>{
 const r={...scope,status:'eligible-exposure',day:ago(15),outcome:'observed-higher',followupDays:[ago(13),ago(11)],retention:'insufficient-delayed-checks'};
 assert.equal(methodFollowupGate([r],day).length,1);assert.equal(methodFollowupGate([r],day)[0].reviewUntil,ago(-10));
 assert.match(methodFollowupGate([r],day)[0].reason,/delayed benchmark/);
 assert.equal(methodFollowupGate([r],ago(-11)).length,0);
 for(const patch of [{retention:'gain-still-observed'},{retention:'confounded'},{followupDays:[ago(13),ago(-1)]},{followupDays:[ago(16),ago(11)]}])assert.equal(methodFollowupGate([{...r,...patch}],day).length,0);
});
test('old reviews remain available for historical inspection but not current selection',()=>{
 const r={day:ago(10),baselineDays:[ago(14),ago(12)]},a={day:ago(7),baselineDays:[ago(10),ago(9)]},b={day:ago(3),baselineDays:[ago(6),ago(5)]},c={day:ago(2),baselineDays:[]};
 const rows=[r,a,b,c],before=JSON.stringify(rows);
 assert.deepEqual(currentMethodReviews(rows,ago(8)),[b,c]);assert.deepEqual(currentMethodReviews(rows,null),rows);assert.equal(JSON.stringify(rows),before);
});
test('new setup reference prompt precedes optional questions but not safety or failed verification',()=>{
 const s=newMemory().state;s.setups=[{day:ago(2)}];
 const b=coachBrief(host,s,report,[],[],day,now);assert.equal(b.kind,'changed-conditions');assert.match(b.detail,/old learned preferences/);
 assert.equal(coachBrief(host,s,{...report,verification:{status:'failed'}},[],[],day,now).kind,'balanced');
 s.readiness=[{day,context:'practice',pain:true}];assert.equal(coachBrief(host,s,report,[],[],day,now).kind,'wellbeing');
});
test('reflections from contradictory parent identities cannot drive a coach concern',()=>{
 const s={id:1,date:day,quick:false,activities:[{exerciseIndex:0,name:'Doubles Streak'}]};
 const r={kind:'exercise',sessionId:'1',index:0,name:'Doubles Streak',day,at:now-1,answer:'timing',note:''};
 assert.equal(reflectionInsights([r],{sessions:[s]},day).count,1);
 assert.equal(reflectionInsights([r],{sessions:[s,{...s,id:'1',quick:true}]},day).count,0);
});
test('empty post-change learning is explicit and current method review remains read-only',()=>{
 const s=newMemory().state;s.changes=[{day:ago(2)}];const before=JSON.stringify(s),r=trainingOutcomes(host,s,day,now);
 assert.equal(r.boundary,ago(2));assert.equal(r.currentEpisodes,0);assert.deepEqual(r.currentComparisons,[]);assert.deepEqual(r.currentFollowups,[]);assert.equal(JSON.stringify(s),before);
});
