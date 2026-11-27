import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalRows,longitudinal,investigationQueue,profileLines} from '../site/longitudinal.mjs';
import {interventionDelivery,baselineIntegrity,outcomeAudit,outcomeLines,reviewReproduction,verifiedLearningState,verifiedRetention} from '../site/intervention-audit.mjs';
import {contextualQuestions} from '../site/contextual-questions.mjs';
import {saveReflection} from '../site/reflections.mjs';
import {newMemory,assemble} from '../site/coach-memory.mjs';
import {integratedAsk} from '../site/integrated-dialogue.mjs';
import {REVIEW_UNVERIFIED,ALLOCATION_PROOF} from '../site/engine/engine.mjs';
import {learningLedger} from '../site/engine/strategy.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z');
const ago=n=>new Date(Date.parse(day+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
const row=(n,extra={})=>({id:'r'+n,day:ago(n),skill:'doubles',context:'practice',protocol:'fixed',attempts:60,hits:18,...extra});
const empty=()=>({sessions:[],games:[],assessmentHistory:[],bigSingles:[]});
const item={id:'focus',skill:'doubles',protocol:'fixed',context:'practice',status:'accepted',responseDay:ago(14),baselineIds:['r20']};
const saved=(id,n,extra={})=>({id,date:ago(n),quick:false,completed:true,wholeSessionAudit:{idcTransfer:{status:'transferred',intervention:item.id,skill:item.skill,seconds:300,day:ago(n)}},...extra});
const boundary=(id,n,name='Doubles Streak')=>({kind:'exercise',sessionId:String(id),name,index:1,at:Date.parse(ago(n)+'T10:00:00Z'),day:ago(n),quick:false});
const sessions=(...ns)=>ns.map(n=>({id:n,date:ago(n),quick:false,activities:[{name:'Doubles Streak',exerciseIndex:1}]}));
test('longitudinal empty data and invalid dates',()=>{assert.deepEqual(longitudinal([],day),[]);assert.throws(()=>longitudinal([],'bad'));assert.equal(profileLines([]).length,1)});
test('future records excluded and conflicting duplicate ids excluded',()=>{assert.deepEqual(canonicalRows([row(-1),row(1),row(1,{hits:1})],day),[]);assert.equal(canonicalRows([row(2),row(2)],day).length,1)});
test('separate skill protocol and competition context',()=>{assert.equal(longitudinal([row(1),row(2,{protocol:'another'}),row(3,{context:'competition'}),row(4,{skill:'bull'})],day).length,4)});
test('exact calendar boundaries 7 28 84 and 365 days',()=>{const p=longitudinal([0,6,7,27,28,83,84,364,365].map(n=>row(n)),day)[0];assert.deepEqual(p.windows.map(x=>x.observedDays),[2,4,6,8]);assert.equal(p.age,0)});
test('missing practice days are not misses or zero scores',()=>{const p=longitudinal([row(20)],day)[0];assert.equal(p.windows[0].dayMean,null);assert.equal(p.windows[1].dayMean,.3);assert.equal(p.windows[1].observedDays,1)});
test('pooled and day weighted estimates are distinct',()=>{const p=longitudinal([row(1,{attempts:10,hits:10}),row(2,{attempts:90,hits:0})],day)[0];assert.equal(p.windows[0].dayMean,.5);assert.equal(p.windows[0].pooled,.1)});
test('scoring profiles use three-dart average',()=>{const p=longitudinal([row(1,{skill:'scoring',hits:1200})],day)[0];assert.equal(p.windows[0].dayMean,60)});
test('consistent 56 day decline and improvement',()=>{for(const direction of ['declining','improving']){const p=longitudinal(Array.from({length:56},(_,i)=>row(i,{hits:(i<28)===(direction==='declining')?12:30})),day)[0];assert.equal(p.trend.status,direction)}});
test('stable data and small sample are not decisive trends',()=>{assert.equal(longitudinal(Array.from({length:56},(_,i)=>row(i)),day)[0].trend.status,'unclear');assert.equal(longitudinal([row(1)],day)[0].trend.status,'insufficient')});
test('stale and sparse evidence requests fresh data not mechanical changes',()=>{const profiles=longitudinal([row(40),row(1,{protocol:'new'})],day);const q=investigationQueue(profiles);assert.deepEqual(q.map(x=>x.kind),['stale','coverage']);assert.ok(q.every(x=>!x.question.includes('change your grip')))});
test('recorded concerns remain separate from measured trends',()=>{const p=longitudinal([row(1)],day);assert.equal(investigationQueue(p,[{topic:'timing',days:1,question:'test'}]).length,1);assert.equal(investigationQueue(p,[{topic:'timing',days:2,question:'test'}])[0].kind,'reported')});
test('audit only counts eligible saved transfer allocations',()=>{const r=interventionDelivery({sessions:[saved(1,8),saved(2,7),saved(3,6,{quick:true}),saved(4,15),saved(5,-1),saved(6,6,{completed:false})]},item,day);assert.equal(r.sessions,2);assert.equal(r.plannedMinutes,10);assert.equal(r.days,2)});
test('duplicate session identity excludes rather than double counts',()=>{const r=interventionDelivery({sessions:[saved(1,8),saved('1',8)]},item,day);assert.equal(r.sessions,0);assert.equal(r.excluded,1)});
test('transfer audit rejects mismatched skill seconds and dates',()=>{for(const patch of [{skill:'bull'},{seconds:600},{day:ago(5)}]){const s=saved(1,8);Object.assign(s.wholeSessionAudit.idcTransfer,patch);assert.equal(interventionDelivery({sessions:[s]},item,day).sessions,0)}});
test('review date freezes allocation reporting',()=>{assert.equal(interventionDelivery({sessions:[saved(1,10),saved(2,2)]},{...item,reviewDay:ago(5)},day).sessions,1)});
test('baseline audit detects deletion correction and duplicate conflict',()=>{const b=[row(20)];assert.equal(baselineIntegrity(item,b,b,day).status,'intact');for(const rows of [[],[row(20,{hits:3})],[row(20),row(20,{hits:3})]])assert.equal(baselineIntegrity(item,b,rows,day).status,'baseline-edited')});
test('historical audit labels corrected baseline, not improvement',()=>{const x={...item,status:'completed',outcome:{status:'observed-improvement'}};const r=outcomeAudit(empty(),{interventions:[x],observations:[]},{focus:[row(20)]},day);assert.equal(r[0].status,'baseline-edited');assert.ok(outcomeLines(r).join(' ').includes('not proof'))});
test('no audit of declined or future interventions',()=>{assert.deepEqual(outcomeAudit(empty(),{interventions:[{...item,status:'declined'},{...item,responseDay:ago(-1)}],observations:[]},{},day),[])});
test('context questions require two earlier distinct days of same exercise',()=>{const h={sessions:sessions(2,3)};const history=[2,3].reduce((r,n)=>saveReflection(r,boundary(n,n),'timing'),[]);assert.equal(contextualQuestions(history,h,boundary(9,0))[0].days,2);assert.deepEqual(contextualQuestions(history,h,boundary(9,0,'Bull Accuracy')),[])});
test('same-day or future concerns do not drive earlier prompts',()=>{const h={sessions:sessions(0,2)};const history=[0,2].reduce((r,n)=>saveReflection(r,boundary(n,n),'aim'),[]);assert.deepEqual(contextualQuestions(history,h,boundary(9,0)),[])});
test('edited, quick or duplicate session histories are excluded',()=>{const history=[2,3].reduce((r,n)=>saveReflection(r,boundary(n,n),'pressure'),[]);for(const s of [[...sessions(2),...sessions(2),...sessions(3)],[...sessions(2),{...sessions(3)[0],quick:true}],[...sessions(2),{...sessions(3)[0],activities:[]}]])assert.deepEqual(contextualQuestions(history,{sessions:s},boundary(9,0)),[])});
test('skip and comfortable never create concern prompts',()=>{for(const topic of ['skip','comfortable','unknown','other']){const history=[2,3].reduce((r,n)=>saveReflection(r,boundary(n,n),topic),[]);assert.deepEqual(contextualQuestions(history,{sessions:sessions(2,3)},boundary(9,0)),[])}});
test('one year multi-player simulation maintains valid counts and scope separation',()=>{let seed=17;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);for(const p of [.12,.25,.40,.55]){const records=[];for(let n=729;n>=0;n--)if(rand()<.65){const rate=Math.min(.95,p+(729-n)*.0002);const hits=Array.from({length:60},()=>rand()<rate).filter(Boolean).length;records.push(row(n,{hits}));if(n%9===0)records.push(row(n,{id:'competition'+n,context:'competition',hits:Math.floor(hits*.8)}))}const groups=longitudinal(records,day);assert.equal(groups.length,2);for(const g of groups){assert.ok(g.windows.every(w=>w.observedDays<=w.days&&w.attempts>=w.observedDays&&w.dayMean>=0&&w.dayMean<=1));assert.ok(g.windows[3].attempts>=g.windows[0].attempts)}}});
test('new dialogue works with empty host and leaves existing memory unchanged',()=>{const h=empty(),m=newMemory(),s=assemble(h,m,day,now).state,before=JSON.stringify(m);assert.equal(integratedAsk(h,s,'How have I progressed this year?',day,now).type,'longitudinal');assert.equal(integratedAsk(h,s,'What happened to my interventions?',day,now).type,'intervention-audit');assert.equal(JSON.stringify(m),before)});

test('reproduction of intervention review detects changed follow-up while intact baseline remains',()=>{
 const before=Array.from({length:7},(_,i)=>row(20+i));
 const after=Array.from({length:7},(_,i)=>row(5+i,{hits:30}));
 const i={...item,baselineIds:before.map(o=>o.id),reviewDay:day,adherence:1,confounders:[],outcome:{status:'observed-improvement',delta:.2,noise:0}};
 assert.equal(reviewReproduction(i,before,[...before,...after],day).status,'reproduced');
 assert.equal(reviewReproduction(i,before,[...before,...after.slice(0,6)],day).status,'outcome-changed');
 assert.equal(reviewReproduction(i,before,[...before,...after.map(o=>({...o,hits:24}))],day).status,'outcome-changed');
 assert.equal(reviewReproduction(i,before,[...before,...after],ago(1)).status,'not-reviewed');
});
test('historical outcome audit marks corrected follow-up results unverified',()=>{
 const before=Array.from({length:7},(_,i)=>row(20+i));
 const after=Array.from({length:7},(_,i)=>row(5+i,{hits:30}));
 const i={...item,baselineIds:before.map(o=>o.id),status:'completed',reviewDay:day,adherence:1,confounders:[],outcome:{status:'observed-improvement',delta:.2,noise:0}};
 const r=outcomeAudit(empty(),{interventions:[i],observations:[...before,...after.slice(1)]},{focus:before},day);
 assert.equal(r[0].status,'review-needs-verification');
 assert.equal(r[0].integrity.status,'intact');
});
test('no empty baseline or invalid historical adherence can be treated as verified',()=>{
 assert.equal(baselineIntegrity({...item,baselineIds:[]},[],[],day).status,'baseline-edited');
 assert.equal(reviewReproduction({...item,reviewDay:day,adherence:-1,outcome:{status:'observed-improvement'}},[],[],day).status,'unverifiable');
});

test('invalid historical outcomes are downgraded in transient view only',()=>{
 const before=Array.from({length:7},(_,i)=>row(20+i));
 const after=Array.from({length:7},(_,i)=>row(5+i,{hits:30}));
 const i={...item,baselineIds:before.map(o=>o.id),status:'completed',reviewDay:day,adherence:1,confounders:[],outcome:{status:'observed-improvement',delta:.2,noise:0},retentionHistory:[{status:'observed-retention',reviewDay:day}]};
 const state={interventions:[i],observations:[...before,...after.slice(1)]};
 const snapshot=JSON.stringify(state),v=verifiedLearningState(state,{focus:before},day);
 assert.equal(v.questionable[0].reason,'outcome-changed');
 assert.equal(v.state.interventions[0][REVIEW_UNVERIFIED],true);
 assert.notEqual(v.state.interventions[0][ALLOCATION_PROOF],true);
 assert.equal(learningLedger(v.state,i,day).promising.length,0);
 assert.equal(learningLedger(v.state,i,day).blocked.length,0);
 assert.equal(v.state.interventions[0].outcome.status,'observed-improvement');
 assert.deepEqual(v.state.interventions[0].retentionHistory,[]);
 assert.equal(JSON.stringify(state),snapshot);
 const valid=verifiedLearningState({...state,interventions:[{...i,retentionHistory:[]}],observations:[...before,...after]},{focus:before},day);
 assert.equal(valid.questionable.length,0);assert.equal(valid.state.interventions[0].outcome.status,'observed-improvement');
});
test('two later comfortable days retire a recurring prompt, but a new report can reopen it',()=>{
 const h={sessions:sessions(1,2,3,4,5,6)};
 const history=[6,5].reduce((r,n)=>saveReflection(r,boundary(n,n),'timing'),[]);
 const improved=[4,3].reduce((r,n)=>saveReflection(r,boundary(n,n),'comfortable'),history);
 assert.equal(contextualQuestions(history,h,boundary(9,0)).length,1);
 assert.equal(contextualQuestions(improved,h,boundary(9,0)).length,0);
 const recurring=saveReflection(improved,boundary(2,2),'timing');
 assert.equal(contextualQuestions(recurring,h,boundary(9,0))[0].topic,'timing');
});

test('baseline evidence cannot come from another task, competition context or after proposal',()=>{
 for(const b of [row(20,{protocol:'different'}),row(20,{context:'competition'}),row(20,{skill:'bull'}),row(20,{day:ago(12)})]){
 const i={...item,baselineIds:[b.id]};assert.equal(baselineIntegrity(i,[b],[b],day).status,'baseline-edited');
 }
});
test('outcomes cannot be reproduced before minimum agreed review interval',()=>{
 const i={...item,reviewDay:ago(1),adherence:1,confounders:[],outcome:{status:'observed-improvement',delta:.2,noise:0}};
 assert.equal(reviewReproduction(i,[row(20)],[row(20)],day).status,'unverifiable');
});

test('retention audit reproduces delayed benefit and invalidates corrected follow-up',()=>{
 const before=Array.from({length:7},(_,i)=>row(40+i));
 const after=Array.from({length:7},(_,i)=>row(22+i,{hits:30}));
 const delayed=Array.from({length:7},(_,i)=>row(2+i,{hits:30}));
 const i={...item,responseDay:ago(36),reviewDay:ago(18),status:'completed',baselineIds:before.map(o=>o.id),adherence:1,confounders:[],outcome:{status:'observed-improvement',delta:.2,noise:0},retentionHistory:[{reviewDay:day,status:'observed-retention',delta:.2,noise:0}]};
 const state={interventions:[i],observations:[...before,...after,...delayed]};
 assert.equal(verifiedRetention(state,i,before,day).valid.length,1);
 const edited={...state,observations:[...before,...after,...delayed.slice(1)]};
 assert.equal(verifiedRetention(edited,i,before,day).invalid,1);
 assert.equal(verifiedLearningState(edited,{focus:before},day).questionable[0].reason,'retention-changed');
 assert.equal(verifiedLearningState(state,{focus:before},day).questionable.length,0);
 assert.equal(i.retentionHistory.length,1);
});
