import test from 'node:test';
import assert from 'node:assert/strict';
import {coachBrief} from '../site/proactive-coach.mjs';
import {planPreview} from '../site/personal-programme.mjs';
import {deliveryGate} from '../site/coaching-accountability.mjs';
import {newMemory} from '../site/coach-memory.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),shift=n=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
const scope={skill:'doubles',context:'practice',protocol:'IDC precision fixed doubles'};
const item={id:'i',...scope,status:'accepted',proposedDay:shift(-10),responseDay:shift(-9),reviewAfterDays:14};
const make=()=>({...newMemory().state,interventions:[{...item}]});
const report={decision:'temporary-focus',verification:{status:'passed'},active:{mode:'accepted-temporary-focus',intervention:'i'},strategy:{agenda:{questions:[]}}};
const host={games:[],sessions:[],assessmentHistory:[],bigSingles:[]};
function session(n,seconds,id=n){
 const date=shift(-n),start=Date.parse(date+'T08:00:00Z'),name='Doubles Survival',exerciseId=id+':exercise:1';
 return {id,date,start,quick:false,extra:false,completed:true,wholeSessionAudit:{idcTransfer:{status:'transferred',intervention:'i',skill:'doubles',day:date,seconds:300,from:0,to:1,delivery:{version:1,receiverIndex:1,donor:{name:'Scoring Challenge',before:900,after:600},receiver:{name,before:600,after:900}}}},provenanceLocked:{kind:'post-allocation',at:start+60000,exercises:[{},{id:exerciseId,index:1,name,mode:'timed',plannedSeconds:900}]},activities:[{exerciseId,exerciseIndex:1,name,plannedSeconds:900,seconds,at:start+1800000}]};
}
test('three distinct measured shortfalls produce review, not repeated allocation',()=>{
 const h={...host,sessions:[session(1,650),session(2,700),session(3,600)]},s=make();
 assert.equal(deliveryGate(h,item,day,now).defer,true);
 assert.equal(coachBrief(h,s,report,[],[],day,now).kind,'intervention-review');
 const p=planPreview(h,s,report,[],day,now);assert.equal(p.focus,null);assert.match(p.reason,/delivery review/);
 assert.equal(p.segments.reduce((n,x)=>n+x.minutes,0),60);
});
test('missing delivery, same-day repeats and adequate activity do not establish persistent shortfall',()=>{
 for(const sessions of [[session(1,600),session(2,600)],[session(1,600,1),session(1,650,2),session(2,600,3)],[session(1,600),session(2,600),session(3,900)]]){
  const h={...host,sessions},s=make();
  assert.equal(deliveryGate(h,item,day,now).defer,false);
  assert.equal(coachBrief(h,s,report,[],[],day,now).kind,'active');
  assert.equal(planPreview(h,s,report,[],day,now).focus,'doubles');
 }
});
test('unsupported or failed independent confirmation cannot tell player to continue an allocation',()=>{
 const s=make();
 for(const r of [{...report,verification:{status:'failed'}},{...report,active:{mode:'balanced-until-accepted'}},{...report,active:{mode:'accepted-temporary-focus',intervention:'other'}}]){
  assert.equal(coachBrief(host,s,r,[],[],day,now).kind,'intervention-review');
  assert.equal(planPreview(host,s,r,[],day,now).focus,null);
 }
});
test('future-dated acceptance cannot guide a historical session',()=>{
 const s=make();s.interventions[0].responseDay=shift(1);
 assert.notEqual(coachBrief(host,s,report,[],[],day,now).kind,'active');
 assert.equal(planPreview(host,s,report,[],day,now).focus,null);
});
test('pending consent does not silently add a second focus to preview',()=>{
 const s=make();s.interventions.push({...item,id:'pending',status:'proposed',responseDay:null});
 assert.equal(planPreview(host,s,report,[],day,now).focus,null);
});
