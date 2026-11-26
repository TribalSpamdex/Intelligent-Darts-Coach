import test from 'node:test';
import assert from 'node:assert/strict';
import {newMemory,validateMemory} from '../site/coach-memory.mjs';
import {makeCheck} from '../site/precision-checks.mjs';
import {legalFinishCount} from '../site/finish-validation.mjs';
import {projectExposure} from '../site/host-exposure.mjs';
const day='2026-11-15',now=Date.parse(day+'T12:00:00Z');
test('Sol H6: reserved fixed protocol cannot be forged with ordinary identities or inflated denominators',()=>{
 const raw=newMemory();
 raw.state.observations=Array.from({length:21},(_,i)=>({id:'ordinary-'+i,day:new Date(Date.parse(day)-i*86400000).toISOString().slice(0,10),skill:'doubles',protocol:'IDC precision fixed doubles',context:'practice',attempts:1000,hits:1000}));
 assert.throws(()=>validateMemory(raw));
 for(const skill of ['doubles','scoring','checkout','bull','singles','trebles']){
  const m=newMemory(),valid=makeCheck(skill,0,day);
  m.state.observations=[valid];assert.equal(validateMemory(m).state.observations.length,1);
  for(const patch of [{id:'ordinary'},{attempts:valid.attempts+1},{context:'competition'},{protocol:'other'}]){
   assert.throws(()=>validateMemory({...m,state:{...m.state,observations:[{...valid,...patch}]}}));
  }
 }
});
test('Sol M5: missed darts may precede the exact legal finishing dart',()=>{
 for(const [score,darts] of [[2,2],[2,3],[3,3],[50,3]])assert.equal(legalFinishCount(score,darts),true);
 for(const [score,darts] of [[1,3],[3,1],[169,3],[170,2],[171,3],[2,0]])assert.equal(legalFinishCount(score,darts),false);
});
test('Sol M4: future or out-of-activity linked rounds cannot retroactively classify doubles exposure',()=>{
 const s={id:1,date:day,start:now-900000,quick:false,activities:[{name:'Doubles Survival',exerciseId:'e',exerciseIndex:0,seconds:600,at:now}]};
 const g={name:'Doubles Survival',sessionId:1,exerciseId:'e',quick:false,variant:'doubles',day,at:now-1000};
 const h={sessions:[s],games:[]};const original=projectExposure(h,day);
 for(const patch of [{day:'2026-11-16',at:now+86400000},{at:now+1},{at:s.start-1},{day:undefined},{at:undefined}]){
  h.games=[{...g,...patch}];assert.deepEqual(projectExposure(h,day),original);
 }
 h.games=[g];assert.deepEqual(projectExposure(h,day).exposure,[{day,skill:'doubles',minutes:10}]);
});

import {finish} from '../site/engine/interventions.mjs';
import {fullReport} from '../site/engine/executive.mjs';
import {learningLedger} from '../site/engine/strategy.mjs';
import {verifiedLearningState,interventionDelivery} from '../site/intervention-audit.mjs';
import {integratedAsk} from '../site/integrated-dialogue.mjs';
const d=n=>new Date(Date.UTC(2024,0,n)).toISOString().slice(0,10);
function history(hits){
 const state=newMemory().state,scope={skill:'doubles',context:'practice',protocol:'fixed'};
 const row=(n,h)=>({id:'o'+n,day:d(n),...scope,attempts:60,hits:h});
 const baseline=Array.from({length:7},(_,i)=>row(i+1,15));
 state.observations=[...baseline,...Array.from({length:14},(_,i)=>row(i+9,hits))];
 const item={id:'focus',...scope,action:'Temporary additional five minutes per balanced session',responseDay:d(8),proposedDay:d(8),status:'accepted',baselineIds:baseline.map(x=>x.id),reviewAfterDays:14,maximumDays:21};
 state.interventions=[item];
 return {state,item,baseline};
}
test('Sol H3: undelivered intervention cannot reward, penalise or retain a method',()=>{
 for(const hits of [9,15,27]){
  const {state,item,baseline}=history(hits),m=finish(state,item.id,d(22),{adherence:1,confounders:[]});
  const host={sessions:[],games:[]},checked=verifiedLearningState(m,{focus:baseline},d(22),host,Date.parse(d(22)+'T12:00:00Z'));
  const ledger=learningLedger(checked.state,item,d(22));
  assert.equal(ledger.entries.length,1);assert.equal(ledger.entries[0].attributable,false);
  assert.equal(ledger.promising.length,0);assert.equal(ledger.blocked.length,0);assert.equal(ledger.retained.length,0);
  assert.equal(learningLedger(m,item,d(22)).promising.length,0);assert.equal(learningLedger(m,item,d(22)).blocked.length,0);
  host.sessions=[{id:1,date:d(12),completed:false,quick:false,wholeSessionAudit:{idcTransfer:{status:'transferred',intervention:'focus',day:d(12),seconds:300,skill:'doubles'}}}];
  assert.equal(interventionDelivery(host,item,d(22)).sessions,0);
 }
});
test('Sol H4: later review, acceptance or cancellation cannot rewrite an earlier report',()=>{
 const {state,item}=history(27),before=fullReport(state,d(10)).active;
 const reviewed=finish(state,item.id,d(22),{adherence:1,confounders:[]});
 assert.equal(before.mode,'accepted-temporary-focus');assert.deepEqual(fullReport(reviewed,d(10)).active,before);
 const cancelled={...state,interventions:[{...item,status:'declined',cancelledDay:d(15),cancelledFrom:'accepted'}]};
 assert.deepEqual(fullReport(cancelled,d(10)).active,before);
 const proposed={...state,interventions:[{...item,status:'proposed',responseDay:undefined}]};
 assert.deepEqual(fullReport(state,d(7)).active,fullReport(proposed,d(7)).active);
});
test('Sol H4: future facts and setup records never reach historical player memory dialogue',()=>{
 const {state}=history(27),host={sessions:[],games:[]};
 state.facts=[{key:'preferred double',value:'D16',kind:'reported',at:d(1)+'T00:00:00.000Z'},{key:'preferred double',value:'D20',kind:'reported',at:'2035-01-01T00:00:00.000Z'}];
 const result=integratedAsk(host,state,'What do you know about me?',d(10));
 assert.ok(result.lines.some(x=>x.includes('D16')));assert.ok(result.lines.every(x=>!x.includes('D20')));
});

import {measuredPracticeLevels,measuredGamePreferences,trainingRecommendation} from '../site/engine/session-intelligence.mjs';
import {interpret} from '../site/engine/coach-dialogue.mjs';
test('Sol H5: fixed measurements independently personalise difficulty and drill selection',()=>{
 const profiles=[];
 for(const [avg,p] of [[25,.10],[50,.25],[75,.42],[95,.59],[108,.75]]){
  const m=newMemory().state;
  for(let i=1;i<=56;i++)if(i%6!==0)for(const [skill,hits] of [['scoring',avg*10],['doubles',Math.round(p*60)],['checkout',Math.round(p*12)],['bull',Math.round(p*30)],['singles',Math.round((.48+p*.65)*60)],['trebles',Math.round(p*45)]])m.observations.push(makeCheck(skill,hits,d(i)));
  const levels=measuredPracticeLevels(m.observations,d(56)),games=measuredGamePreferences(m.observations,d(56));
  const report=fullReport(m,d(56)),session=trainingRecommendation(m,report,d(56),report.active);
  assert.equal(session.segments.reduce((n,s)=>n+s.minutes,0),60);
  profiles.push({levels,games,drills:session.segments.map(s=>s.drill)});
 }
 assert.equal(new Set(profiles.map(p=>JSON.stringify(p.levels))).size,5);
 assert.ok(new Set(profiles.map(p=>JSON.stringify(p.games))).size>=3);
 assert.ok(new Set(profiles.map(p=>JSON.stringify(p.drills))).size>=3);
 const mixed=[];
 for(let i=1;i<=28;i++)for(const [skill,hits] of [['scoring',1000],['doubles',6]])mixed.push(makeCheck(skill,hits,d(i)));
 const levels=measuredPracticeLevels(mixed,d(28));assert.ok(levels.scoring>levels.doubles);assert.equal(levels.checkout,undefined);
});
test('Sol M7: bounded paraphrases route to read-only coaching queries',()=>{
 for(const [phrase,type] of [['Give me a practice plan','training'],['What should I work on today?','training'],['Am I getting better?','review'],['Where should I focus next?','next-actions'],['How can I check out 81 in 2 darts?','checkout']]){
  const intent=interpret(phrase,day);assert.equal(intent.kind,'query',phrase);assert.equal(intent.request.type,type);
 }
 assert.equal(interpret('Delete all my practice data',day).kind,'unsupported');
});

test('Sol M7: natural checkout paraphrases route to the same verified finish as the canonical command',()=>{
 const state=newMemory().state,host={sessions:[],games:[],bigSingles:[]};
 const ask=q=>integratedAsk(host,state,q,day,now);
 const canonical=ask('Checkout 81 with 2 darts');
 for(const q of ['I have 81 left and two darts in hand. What should I throw?','I have got 81 points remaining with two darts left','Check out 81 with two darts','How can I take out 81 in 2 darts']){
  const response=ask(q);assert.equal(response.type,'checkout',q);assert.deepEqual(response.lines,canonical.lines,q);
 }
 assert.equal(ask('I have 1 left and two darts in hand. What should I throw?').kind,'unsupported');
 assert.equal(ask('I have 81 left and 4 darts in hand. What should I throw?').kind,'unsupported');
});
test('Sol M7: spoken doubles comparison asks for independent days and does not change the player profile',()=>{
 const state=newMemory().state,host={sessions:[],games:[]},before=JSON.stringify(state);
 const result=integratedAsk(host,state,'100 doubles attempts each period; earlier 35/100, recently 20/100; equipment and technique unchanged.',day,now);
 assert.equal(result.type,'reported-comparison');assert.ok(result.lines.some(x=>x.includes('-15.0 percentage points')));
 assert.ok(result.lines.some(x=>x.includes('separate practice days')));
 assert.ok(result.lines.some(x=>x.includes('unchanged equipment and technique')));
 assert.equal(JSON.stringify(state),before);
 const invalid=integratedAsk(host,state,'doubles earlier 101/100, recently 20/100',day,now);
 assert.ok(invalid.lines[0].includes('inconsistent'));
 assert.equal(JSON.stringify(state),before);
});

test('H6: manual observations cannot impersonate authoritative native fixed benchmarks',()=>{
 for(const protocol of ['IDC V6.2 assessment D1-D20 fixed 60','IDC V6.2 assessment scoring 60 darts','IDC V6.2 Bull Accuracy any bull 30']){
  const m=newMemory();m.state.observations=[{id:'ordinary',day,skill:'doubles',context:'practice',protocol,attempts:1000,hits:1000}];
  assert.throws(()=>validateMemory(m),/original host records/);
 }
 const m=newMemory();m.state.observations=[{id:'ordinary',day,skill:'doubles',context:'practice',protocol:'player-reported sample',attempts:1000,hits:500}];
 assert.equal(validateMemory(m).state.observations.length,1);
});

import {asOfState} from '../site/engine/context.mjs';
import {beginTrial,addPair,finishTrial,validateTrial} from '../site/engine/experiments.mjs';
import {currentFacts,setFact} from '../site/engine/engine.mjs';
test('H4: a completed paired experiment cannot influence a report before actual completion',()=>{
 let m=newMemory().state;
 m=beginTrial(m,{id:'replay-trial',skill:'doubles',protocol:'fixed',context:'practice',approach:'routine',baseline:'normal',alternative:'new',start:d(1),firstOrder:'AB'});
 for(let n=1;n<=6;n++)m=addPair(m,'replay-trial',{day:d(n),order:n%2?'AB':'BA',attempts:30,a:6,b:15,comparable:true,discomfort:false});
 const finished=finishTrial(m,'replay-trial',false,d(10));
 assert.equal(validateTrial(finished.trials[0]).finishDay,d(10));
 assert.deepEqual(asOfState(finished,d(7)).trials,asOfState(m,d(7)).trials);
 assert.equal(asOfState(finished,d(10)).trials[0].status,'completed');
 assert.throws(()=>finishTrial(m,'replay-trial',false,d(5)));
 assert.throws(()=>validateTrial({...finished.trials[0],finishDay:d(5)}));
 const cancelled=finishTrial(m,'replay-trial',true,d(12));
 assert.equal(asOfState(cancelled,d(11)).trials[0].status,'active');
 assert.equal(asOfState(cancelled,d(12)).trials[0].status,'cancelled');
});
test('H4: out-of-order fact imports cannot override the latest effective value',()=>{
 let m=newMemory().state;
 m=setFact(m,'grip','middle','reported',d(10)+'T08:00:00Z');
 m=setFact(m,'grip','front','reported',d(2)+'T08:00:00Z');
 assert.equal(currentFacts(m)[0].value,'middle');
 assert.equal(currentFacts(asOfState(m,d(5)))[0].value,'front');
 assert.throws(()=>setFact(m,'grip','rear','reported','invalid'));
});
