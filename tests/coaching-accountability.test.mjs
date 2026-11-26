import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryEvidence,coachingAccountability,accountabilityLines} from '../site/coaching-accountability.mjs';
import {applyTransfer} from '../site/coach-policy.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),start=now-3600000,ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const item={id:'i',skill:'doubles',context:'practice',protocol:'fixed',status:'accepted',responseDay:ago(14),proposedDay:ago(15),reviewAfterDays:14,baselineIds:['b']};
function fixture(){
 const queue=[{name:'Scoring Challenge',seconds:900,wholeCoach:{plannedMinutes:15}},{name:'Doubles Survival',seconds:600,wholeCoach:{plannedMinutes:10}}];
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
