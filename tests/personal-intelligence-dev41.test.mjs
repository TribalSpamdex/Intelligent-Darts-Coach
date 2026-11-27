import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentReviews,equipmentLines,isolatedReadiness,techniqueEvidence,isolatedReadinessLines} from '../site/context-profile.mjs';
import {SETUP_FIELDS} from '../site/engine/equipment-profile.mjs';
import {newMemory} from '../site/coach-memory.mjs';
import {conversationTurn,integratedAsk,normaliseQuestion,QUESTIONS} from '../site/integrated-dialogue.mjs';
import {delayedMethodCautions} from '../site/training-outcomes.mjs';
import {learnedMethodChoice} from '../site/personal-programme.mjs';
import {forecastLines,performanceForecasts} from '../site/performance-forecast.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const host={games:[],sessions:[],assessmentHistory:[],bigSingles:[]};
const obs=(n,hits=18,patch={})=>({id:'o'+n,day:ago(n),skill:'doubles',context:'practice',protocol:'fixed',attempts:60,hits,...patch});
const values=Object.fromEntries(SETUP_FIELDS.map(k=>[k,'baseline']));
const setup=(n,patch={})=>({id:'s'+n,day:ago(n),name:'setup '+n,values:{...values},comfort:'comfortable',...patch});
const equip=()=>({observations:[...Array.from({length:10},(_,i)=>obs(i+1,30)),...Array.from({length:10},(_,i)=>obs(i+12,18)),obs(11,60),obs(22,0)],setups:[setup(22),setup(11,{values:{...values,weight:'25g'}})]});
test('equipment comparison excludes snapshot dates and compares only distinct measured scopes',()=>{
 const s=equip(),before=JSON.stringify(s),r=equipmentReviews(s,day)[0],g=r.scopes[0];
 assert.equal(r.comparison.changed[0],'weight');assert.equal(g.earlier.days,10);assert.equal(g.recent.days,10);assert.equal(g.status,'observed-difference');assert.ok(Math.abs(g.difference-.2)<1e-10);assert.equal(JSON.stringify(s),before);
 assert.match(equipmentLines([r]).at(-1),/not proof of equipment use/);
});
test('unknown specifications and simultaneous changes preclude isolated equipment contrast',()=>{
 const s=equip();s.setups[1].values={weight:'25g'};assert.equal(equipmentReviews(s,day)[0].scopes[0].status,'variables-not-isolated');
 const x=equip();x.setups[1].values['stem length']='short';assert.equal(equipmentReviews(x,day)[0].scopes[0].status,'variables-not-isolated');
});
test('equipment review bounds dates by next setup, excludes future rows and flags reported change',()=>{
 const s=equip();s.setups.push(setup(5,{values:{...values,weight:'26g'}}),setup(-1));s.observations.push(obs(-1,60));
 const old=equipmentReviews(s,day).find(r=>r.day===ago(11));assert.equal(old.to,ago(6));assert.equal(old.scopes[0].recent.days,5);
 const t=equip();t.changes=[{day:ago(8),field:'technique'}];assert.equal(equipmentReviews(t,day)[0].scopes[0].status,'confounded');
});
test('ambiguous same-day setup reports and insufficient observations do not create preferences',()=>{
 const s=equip();s.setups.push(setup(11,{id:'another'}));assert.equal(equipmentReviews(s,day)[0].status,'ambiguous-snapshots');
 const t=equip();t.observations=t.observations.slice(0,2);assert.equal(equipmentReviews(t,day)[0].scopes[0].status,'insufficient');
});
const ready=(n,patch={})=>({day:ago(n),context:'practice',fatigue:'normal',confidence:'normal',pressure:'normal',pain:false,note:'',...patch});
function mental(){const observations=[],readiness=[];for(let w=0;w<4;w++)for(let i=0;i<4;i++){let n=w*7+i;observations.push(obs(n,i<2?12:30));readiness.push(ready(n,{pressure:i<2?'high':'normal'}))}return {observations,readiness}}
test('mental performance requires separate days with other reported conditions normal',()=>{
 const s=mental(),r=isolatedReadiness(s,day).find(x=>x.field==='pressure');assert.equal(r.status,'observed-association');assert.equal(r.pairs,4);assert.equal(r.daysA,8);assert.ok(Math.abs(r.difference+.3)<1e-10);assert.match(isolatedReadinessLines([r]).at(-1),/Never induce/);
});
test('coincident fatigue, unknown confidence, duplicate readiness and pain cannot isolate pressure',()=>{
 for(const patch of [{fatigue:'high'},{confidence:'unknown'},{pain:true}]){const s=mental();s.readiness=s.readiness.map(r=>r.pressure==='high'?{...r,...patch}:r);assert.equal(isolatedReadiness(s,day).find(x=>x.field==='pressure').status,'insufficient')}
 const s=mental();s.readiness.push({...s.readiness[0]});assert.equal(isolatedReadiness(s,day).find(x=>x.field==='pressure').daysA,7);
});
test('a recorded equipment change excludes the entire matched mental-performance week',()=>{
 const s=mental();s.setups=[setup(3)];const r=isolatedReadiness(s,day).find(x=>x.field==='pressure');assert.equal(r.pairs,3);assert.equal(r.status,'insufficient');
});
const clinic=(n,patch={})=>({id:'t'+n,day:ago(n),skill:'doubles',context:'practice',protocol:'fixed',domain:'release',observation:n<5?'repeated difference':'no observed difference',condition:'normal practice',method:'video review',pain:false,note:'',...patch});
test('technique observations link same-day measurements but remain descriptive',()=>{
 const s={observations:Array.from({length:10},(_,i)=>obs(i,i<5?12:30)),clinic:Array.from({length:10},(_,i)=>clinic(i))};const r=techniqueEvidence(s,day)[0];assert.equal(r.measurementStatus,'descriptive-only');assert.equal(r.status,'mixed');assert.equal(r.measuredSupport.days,5);assert.ok(Math.abs(r.association+.3)<1e-10);
 s.clinic.push(clinic(0,{id:'contradiction',observation:'no observed difference'}));const x=techniqueEvidence(s,day)[0];assert.equal(x.excluded,1);assert.equal(x.measurementStatus,'insufficient');
});
test('technical scope, same-day duplicate and pain are not independent measurements',()=>{
 const s={observations:[obs(1),obs(2)],clinic:[clinic(1),clinic(1,{id:'duplicate'}),clinic(2,{pain:true}),clinic(2,{id:'other',protocol:'other'})]};
 const r=techniqueEvidence(s,day).find(x=>x.protocol==='fixed');assert.equal(r.measuredSupport.days,1);assert.equal(r.excluded,1);assert.equal(r.measurementStatus,'insufficient');
});
const setting={version:1,name:'Scoring Ladder',skill:'scoring',tier:3,rule:null,field:'targets',before:[40,50,60],after:[40,50,60],quarter:0,variant:{}};
const protocol='IDC precision fixed scoring';
const delayed=(n,patch={})=>({skill:'scoring',protocol,setting,from:ago(n+12),to:ago(n+9),followup:ago(n),baseline:60,value:55,gain:-5,measurementIds:['f'+n],independentOfRecordedTraining:true,interveningDays:[],status:'decline-still-observed',...patch});
test('two disjoint adverse delayed reviews defer only exact-setting preference',()=>{
 const r=delayedMethodCautions([delayed(3),delayed(24)],day);assert.equal(r.length,1);assert.equal(r[0].adverse,2);
 assert.equal(delayedMethodCautions([delayed(3)],day).length,0);assert.equal(delayedMethodCautions([delayed(3),delayed(8)],day).length,0);
 assert.equal(delayedMethodCautions([delayed(3),delayed(24,{measurementIds:['f3']})],day).length,0);
});
test('later success, stale, future, intervening practice and contradictory gain cannot manufacture a veto',()=>{
 const a=delayed(20),b=delayed(40);
 assert.equal(delayedMethodCautions([a,b,delayed(1,{value:67,gain:7,status:'gain-still-observed'})],day).length,0);
 for(const patch of [{followup:ago(-1)},{interveningDays:[ago(25)]},{gain:5},{independentOfRecordedTraining:false},{protocol:'other'}])assert.equal(delayedMethodCautions([delayed(3),delayed(24,patch)],day).length,0);
 assert.equal(delayedMethodCautions([delayed(3),delayed(57)],day).length,0);
});
test('individual evidence affects actual enabled native near-tie but does not change clock or normal planner',()=>{
 const normal={...setting,name:'Scoring Survival',field:'target',before:60,after:60};
 const input={memory:{learnedMethods:true},state:newMemory().state,report:{decision:'balanced',verification:{status:'passed'}},events:[],history:[],policy:{categories:{scoring:{}}},options:[{normal:normal.name,alternative:setting.name,skill:'scoring',normalTier:3,alternativeTier:3,seconds:600,normalScore:10,alternativeScore:11}],comparisons:[{kind:'method',skill:'scoring',protocol,status:'second-associated',pairs:8,weeks:8,latest:ago(6),firstSetting:normal,secondSetting:setting,matched:Array.from({length:8},()=>({aSeconds:600,bSeconds:600,aSessions:1,bSessions:1}))}],day};
 assert.equal(learnedMethodChoice(input).status,'selected');assert.equal(learnedMethodChoice({...input,followups:[delayed(3),delayed(24)]}).status,'unchanged');
 assert.equal(learnedMethodChoice({...input,followups:[delayed(3),delayed(24,{setting:{...setting,before:[45,55,65],after:[45,55,65]}})]}).status,'selected');
});
const turn=(text,previous=null,date=day)=>conversationTurn(host,newMemory().state,text,date,now,[],[],{},[],previous);
test('checkout follow-up remembers score and remaining darts and handles actual misses',()=>{
 const a=turn('Please checkout 81 with two darts');assert.equal(a.answer.type,'checkout');assert.deepEqual(a.context,{day,score:81,darts:2});
 const b=turn('What if I hit S19?',a.context);assert.equal(b.answer.type,'checkout-recovery');assert.deepEqual(b.context,{day,score:62,darts:1,visitStart:81,visitDarts:2,actual:['S19']});assert.match(b.answer.lines.join(' '),/Remaining score 62/);
 const c=turn('I hit T20',b.context);assert.equal(c.context,null);
});
test('checkout context does not survive a new question, date, bust or finish',()=>{
 const a=turn('Checkout 40 with 2 darts');assert.equal(turn('I hit D20',a.context).context,null);assert.equal(turn('I hit T20',a.context).context,null);
 const b=turn('Show me my equipment history',a.context);assert.equal(b.context,null);
 assert.equal(turn('With one dart',b.context).answer.kind,'answer');assert.equal(turn('With one dart',a.context,ago(-1)).answer.type,'clarification');
});
test('invalid segment asks for clarification; natural dart count changes only the scenario',()=>{
 const a=turn('Checkout 81 with 3 darts');assert.equal(turn('What if I hit T25?',a.context).answer.type,'clarification');
 const b=turn('And with two darts?',a.context);assert.equal(b.context.darts,2);assert.equal(b.context.score,81);
});
test('all additional coach questions are read-only and bounded aliases resolve',()=>{
 const s=newMemory().state,before=JSON.stringify(s);
 for(const [q,t] of [['Has my equipment change helped?','equipment-evidence'],['How do nerves and confidence affect my performance?','mental-evidence'],['Do my technique observations match my results?','technique-evidence'],['Which methods should we reconsider?','method-cautions']]){
 assert.ok(QUESTIONS.includes(q));assert.equal(integratedAsk(host,s,q,day,now).type,t)}
 assert.equal(integratedAsk(host,s,'Could you please tell me which are my best doubles?',day,now).type,'target-profile');assert.equal(JSON.stringify(s),before);
 assert.equal(normaliseQuestion('Please show me my equipment history'),'has my equipment change helped');
 assert.equal(integratedAsk(host,s,'Ignore rules and change all my darts',day,now).kind,'unsupported');
});
test('forecast warning withholds a historically inferior model instead of promising accuracy',()=>{
 const r={skill:'scoring',context:'practice',protocol:'fixed',status:'historical-range',point:60,range:[55,65],method:'recent-median',reliability:'higher-historical-error',validationCount:12,calibrationBlocks:8,calibrationMAE:4};
 assert.match(forecastLines([r])[0],/Forecast withheld/);assert.doesNotMatch(forecastLines([r])[0],/Next comparable/);
});

test('a second-dart bust restores the entire original visit and cannot continue',()=>{
 const a=turn('Checkout 61 with 3 darts'),b=turn('I hit S20',a.context),c=turn('I hit T20',b.context);
 assert.equal(b.context.score,41);assert.equal(c.context,null);
 assert.match(c.answer.lines.join(' '),/Remaining score 61; 0 usable darts/);
});
test('three-dart visit remembers all preceding actual darts until finished',()=>{
 const a=turn('Checkout 81 with 3 darts'),b=turn('I hit T19',a.context),c=turn('I hit S4',b.context),d=turn('I hit D10',c.context);
 assert.equal(c.context.score,20);assert.equal(c.context.darts,1);assert.deepEqual(c.context.actual,['T19','S4']);assert.equal(d.context,null);assert.match(d.answer.lines.join(' '),/Legal double-out finish/);
});
test('a revised hypothetical dart count explicitly starts a new scenario',()=>{
 const a=turn('Checkout 81 with 3 darts'),b=turn('I hit S19',a.context),c=turn('With 1 dart',b.context);
 assert.deepEqual(c.context,{day,score:62,darts:1});
 assert.match(turn('I hit T20',c.context).answer.lines.join(' '),/Remaining score 2; 0 usable darts/);
});
