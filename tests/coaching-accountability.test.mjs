import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryEvidence,coachingAccountability,accountabilityLines,deliveryGate} from '../site/coaching-accountability.mjs';
import {decideTransfer,applyTransfer} from '../site/coach-policy.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),start=now-3600000,ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const item={id:'i',skill:'doubles',context:'practice',protocol:'fixed',status:'accepted',responseDay:ago(14),proposedDay:ago(15),reviewAfterDays:14,baselineIds:['b']};
function fixture(){
 const queue=[{name:'Scoring Challenge',mode:'timed',seconds:900,wholeCoach:{category:'scoring',plannedMinutes:15}},{name:'Doubles Survival',mode:'timed',seconds:600,wholeCoach:{category:'doubles',plannedMinutes:10}}];
 const decision={status:'transferred',skill:'doubles',intervention:'i',from:0,to:1,seconds:300,day};
 assert.equal(applyTransfer(queue,decision),true);
 decision.delivery.receiverIndex=3;
 const s={id:1,date:day,start,quick:false,extra:false,completed:true,wholeSessionAudit:{idcTransfer:decision},provenanceLocked:{kind:'post-allocation',at:start+60000,exercises:[{}, {}, {},{id:'1:exercise:3',index:3,name:'Doubles Survival',mode:'timed',plannedSeconds:900}]},activities:[{exerciseId:'1:exercise:3',exerciseIndex:3,name:'Doubles Survival',plannedSeconds:900,seconds:850,at:start+1800000}]};
 return {host:{sessions:[s]},s,decision,queue};
}
test('actual transfer records immediate budgets before later scheduler changes',()=>{
 const {decision,queue}=fixture();assert.equal(queue[0].seconds,600);assert.equal(queue[1].seconds,900);
 assert.deepEqual(decision.delivery.donor,{name:'Scoring Challenge',before:900,after:600});
 assert.deepEqual(decision.delivery.receiver,{name:'Doubles Survival',before:600,after:900});
});
test('locked receiver identity, not queue index, matches elapsed activity',()=>{
 const {host}=fixture(),r=deliveryEvidence(host,item,day,now);
 assert.equal(r.matched,1);assert.equal(r.plannedSeconds,300);assert.equal(r.observedBeyondOriginal,250);
 assert.equal(r.rows[0].actualSeconds,850);
});
test('elapsed beyond original budget is bounded and short practice is not delivered extra time',()=>{
 const {host,s}=fixture();
 for(const [seconds,expected] of [[600,0],[300,0],[900,300],[1500,300]]){
  s.activities[0].seconds=seconds;assert.equal(deliveryEvidence(host,item,day,now).observedBeyondOriginal,expected);
 }
});
test('missing, duplicated, malformed or future receiver activities remain planned only',()=>{
 for(const mutate of [s=>s.activities=[],s=>s.activities.push({...s.activities[0]}),s=>s.activities[0].exerciseId='wrong',s=>s.activities[0].at=now+1,s=>s.activities[0].plannedSeconds=800]){
  const {host,s}=fixture();mutate(s);const r=deliveryEvidence(host,item,day,now);
  assert.equal(r.plannedSeconds,300);assert.equal(r.matched,0);assert.equal(r.observedBeyondOriginal,0);assert.equal(r.rows[0].status,'planned-only');
 }
});
test('old records, contradictory transfer budgets and invalid locked exercise identity fail closed',()=>{
 for(const mutate of [s=>delete s.wholeSessionAudit.idcTransfer.delivery,s=>s.wholeSessionAudit.idcTransfer.delivery.donor.before=800,s=>s.provenanceLocked.exercises[3].plannedSeconds=800,s=>s.wholeSessionAudit.idcTransfer.delivery.receiverIndex=1,s=>s.provenanceLocked.at=now+1]){
  const {host,s}=fixture();mutate(s);const r=deliveryEvidence(host,item,day,now);assert.equal(r.unverified,1);assert.equal(r.matched,0);
 }
});
test('quick, extra, future and duplicate sessions cannot manufacture delivered minutes',()=>{
 const {host,s}=fixture();host.sessions.push({...s,id:2,quick:true},{...s,id:3,extra:true},{...s,id:4,date:'2026-11-27'});
 assert.equal(deliveryEvidence(host,item,day,now).matched,1);
 host.sessions.push({...s});assert.equal(deliveryEvidence(host,item,day,now).unverified,1);
});
test('accountability separates baseline integrity and due review from delivery',()=>{
 const {host}=fixture(),b={id:'b',day:ago(16),skill:'doubles',context:'practice',protocol:'fixed',attempts:60,hits:20};
 const state={interventions:[item],observations:[b]};
 let r=coachingAccountability(host,state,{i:[b]},day,now);assert.equal(r[0].status,'review-due');assert.equal(r[0].observedOutcome,null);
 assert.ok(accountabilityLines(r).at(-1).includes('no causal success rate'));
 r=coachingAccountability(host,{...state,observations:[]},{i:[b]},day,now);assert.equal(r[0].status,'baseline-edited');
});

function shortfallHistory(){
 const sessions=[];
 for(const [i,n] of [0,2,4].entries()){
  const {s}=fixture(),id=i+1,date=ago(n);
  s.id=id;s.date=date;s.start-=n*86400000;s.wholeSessionAudit.idcTransfer.day=date;s.provenanceLocked.at-=n*86400000;
  s.provenanceLocked.exercises[3].id=id+':exercise:3';s.activities[0].exerciseId=id+':exercise:3';s.activities[0].at-=n*86400000;s.activities[0].seconds=700;
  sessions.push(s);
 }
 return {sessions};
}
test('three separate measured delivery shortfalls defer repeated adjustment; unknown records do not',()=>{
 const host=shortfallHistory();assert.equal(deliveryGate(host,item,day,now).defer,true);
 host.sessions[1].activities=[];assert.equal(deliveryGate(host,item,day,now).defer,false);
});
test('one successful recent measured delivery removes repeated-shortfall gate',()=>{
 const host=shortfallHistory();host.sessions[2].activities[0].seconds=900;
 assert.equal(deliveryGate(host,item,day,now).defer,false);
});
test('multiple sessions on the same date are not independent shortfall days',()=>{
 const host=shortfallHistory(),s=host.sessions[1];s.date=day;s.wholeSessionAudit.idcTransfer.day=day;
 assert.equal(deliveryGate(host,item,day,now).defer,false);
});

test('measured shortfall actually blocks the optional transfer in native policy',()=>{
 const host=shortfallHistory(),i={...item,status:'accepted'};
 const report={decision:'balanced',verification:{status:'passed'},active:{mode:'accepted-temporary-focus',intervention:i.id}};
 const confirmation={decision:'temporary-focus',verification:{status:'passed'},focus:i.skill,focusProtocol:i.protocol,focusContext:i.context};
 const r=decideTransfer({report,confirmation,memory:{state:{interventions:[i]},events:[]},session:{quick:false,extra:false},queue:[],priorSessions:host.sessions,day});
 assert.equal(r.status,'unchanged');assert.ok(r.reason.includes('delivery shortfall'));
});
test('malformed transfer cannot mutate either clock budget',()=>{
 const q=[{name:'Scoring',seconds:900,wholeCoach:{}},{name:'Doubles',seconds:NaN,wholeCoach:{}}],d={status:'transferred',from:0,to:1,seconds:300};
 assert.throws(()=>applyTransfer(q,d),/Invalid allocation/);assert.equal(q[0].seconds,900);assert.ok(Number.isNaN(q[1].seconds));assert.equal(d.delivery,undefined);
});

import {attributableAllocation} from '../site/coaching-accountability.mjs';
// Positive path through the same native provenance used by production. Each
// session is independently dated, with matched locked exercise, actual
// elapsed allocation and a completed recorded round before the activity end.
function provenAllocation(){
 const host={sessions:[],games:[]};
 for(const [i,n] of [0,2,4].entries()){
  const {s}=fixture(),id=i+1,date=ago(n),offset=n*86400000;
  s.id=id;s.date=date;s.start-=offset;
  s.wholeSessionAudit.idcTransfer.day=date;s.provenanceLocked.at-=offset;
  s.provenanceLocked.exercises[3].id=id+':exercise:3';
  const a=s.activities[0];a.exerciseId=id+':exercise:3';a.at-=offset;a.seconds=900;
  host.sessions.push(s);
  host.games.push({name:a.name,sessionId:id,exerciseId:a.exerciseId,exerciseIndex:3,day:date,at:a.at-1000,quick:false,extra:false,recovery:false,completion:'natural',thrown:30});
 }
 return host;
}
test('H3: actual round evidence is necessary and sufficient for allocation eligibility under the current conservative dose rule',()=>{
 const h=provenAllocation();
 assert.equal(attributableAllocation(h,item,day,now),true);
 const variants=[
  h=>{h.games=[]},
  h=>{h.games.pop()},
  h=>{h.sessions[0].completed=false},
  h=>{h.sessions[0].activities[0].seconds=839},
  h=>{h.games[0].thrown=0},
  h=>{h.games[0].at=h.sessions[0].activities[0].at+1},
  h=>{h.games[0].at=h.sessions[0].provenanceLocked.at-1},
  h=>{h.games[0].day=ago(-1)},
  h=>{h.games[0].exerciseId='different'},
  h=>{h.games[0].extra=true},
  h=>{h.games[0].quick=true},
  h=>{h.games[0].recovery=true},
  h=>{h.games.push({...h.games[0]})},
  h=>{h.sessions.push({...h.sessions[0]})},
 ];
 for(const change of variants){const candidate=structuredClone(h);change(candidate);assert.equal(attributableAllocation(candidate,item,day,now),false,change.toString())}
 assert.equal(attributableAllocation(h,{...item,reviewDay:ago(1)},day,now),false,'later practice cannot validate earlier review');
 assert.equal(attributableAllocation(h,item,ago(1),now-86400000),false,'future session is excluded during replay');
});
