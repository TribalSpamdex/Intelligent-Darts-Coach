import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEvents,addEvent,removeEvent,eventContext,eventLines,competitionPreparation,competitionPreparationLines} from '../site/competition-calendar.mjs';
import {newMemory,validateMemory,changeMemory} from '../site/coach-memory.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),shift=n=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
const event=(n,id='event')=>({id,day:shift(n),name:'League night',kind:'league'});
const host={sessions:[],games:[],assessmentHistory:[],bigSingles:[]};
test('competition phases use local calendar day boundaries',()=>{
 for(const [n,phase] of [[0,'competition-day'],[1,'near-event'],[2,'near-event'],[3,'event-week'],[7,'event-week'],[8,'ordinary']]){
  const events=addEvent([],event(n),day),r=eventContext(events,day);assert.equal(r.phase,phase);assert.equal(r.days,n);
 }
});
test('calendar orders events deterministically and excludes past and not-yet-recorded intentions',()=>{
 const rows=[...addEvent([],event(5,'z'),day),...addEvent([],event(2,'a'),day)];
 assert.equal(eventContext(rows,day).event.id,'a');assert.equal(eventContext(rows,shift(3)).event.id,'z');
 assert.equal(eventContext(rows,shift(-1)).event,null);assert.equal(eventContext(rows,shift(6)).event,null);
});
test('invalid event dates, duplicate identities, invalid names and kinds are rejected',()=>{
 for(const x of [event(-1),event(367),{...event(0),day:'2026-02-30'},{...event(0),name:' '},{...event(0),kind:'invalid'},{...event(0),id:'__proto__'}]){
  assert.throws(()=>addEvent([],x,day));
 }
 const rows=addEvent([],event(2),day);assert.throws(()=>addEvent(rows,event(3),day));assert.throws(()=>removeEvent(rows,'missing'));
 assert.throws(()=>validateEvents([{...rows[0],recordedDay:shift(3)}]));
});
test('competition memory migrates old backups, round trips and supports deletion',()=>{
 const old=newMemory();delete old.events;assert.deepEqual(validateMemory(old).events,[]);
 const saved=changeMemory(host,old,day,'competition-event',event(2),now);
 assert.equal(saved.events.length,1);assert.equal(saved.events[0].recordedDay,day);
 assert.deepEqual(validateMemory(JSON.parse(JSON.stringify(saved))),saved);
 const deleted=changeMemory(host,saved,day,'remove-competition-event',{id:'event'},now);
 assert.deepEqual(deleted.events,[]);assert.deepEqual(deleted.state,old.state);
});
test('preparation advice does not prescribe extra workload or create a result',()=>{
 const events=addEvent([],event(0),day),lines=eventLines(events,day);
 assert.ok(lines.some(l=>l.includes('No extra demanding session')));
 assert.ok(lines.at(-1).includes('no session is automatically'));
 assert.ok(eventLines([],day)[0].includes('No upcoming'));
});

import {legFromInput} from '../site/match-statistics.mjs';
const report={decision:'balanced',verification:{status:'passed'}};
function competitionFixture(ages=[0,1,7,8,14,15,21,22]){
 const legs=[];
 for(const age of ages)for(let i=0;i<5;i++){
  const base={day:shift(-age),start:301,doubleIn:false,result:'won'};
  legs.push(legFromInput({...base,id:'p'+age+'-'+i,context:'practice',visits:'T20 T20 T20\\nT20 S11 50'.replace('\\n','\n')},day).leg);
  legs.push(legFromInput({...base,id:'c'+age+'-'+i,context:'competition',visits:['S20 S20 S20','S20 S20 S20','S20 S20 S20','T20 S11 50'].join('\n')},day).leg);
 }
 return {...newMemory().state,legs};
}
test('competition preparation identifies fresh actual same-rule stage gaps without promising outcomes',()=>{
 const s=competitionFixture(),before=JSON.stringify(s),e=addEvent([],event(5),day),p=competitionPreparation(s,e,day,{report});
 assert.equal(p.status,'measured-priority');assert.equal(p.focus.skill,'scoring');assert.equal(p.focus.start,301);assert.equal(p.focus.difference,-120);
 assert.ok(competitionPreparationLines(p).some(x=>x.includes('format may differ')));assert.equal(JSON.stringify(s),before);
});
test('stale, sparse, future-only and absent actual legs are insufficient',()=>{
 for(const s of [competitionFixture([35,36,42,43,49,50,56,57]),competitionFixture([0,1]),newMemory().state,{...newMemory().state,legs:competitionFixture().legs.map(x=>({...x,day:shift(1)}))}])assert.equal(competitionPreparation(s,[],day,{report}).status,'insufficient');
});
test('competition day, safety, accepted priorities and unverified evidence prevent new preparation focus',()=>{
 const s=competitionFixture();
 for(const n of [0,1,2])assert.equal(competitionPreparation(s,addEvent([],event(n),day),day,{report}).status,'familiar-routine');
 assert.equal(competitionPreparation({...s,readiness:[{day,pain:true}]},[],day,{report}).status,'wellbeing');
 assert.equal(competitionPreparation({...s,readiness:[{day,fatigue:'high'}]},[],day,{report}).status,'wellbeing');
 assert.equal(competitionPreparation({...s,interventions:[{status:'accepted'}]},[],day,{report}).status,'existing-priority');
 assert.equal(competitionPreparation(s,[],day,{report:{decision:'balanced',verification:{status:'failed'}}}).status,'unverified');
});

import {competitionSchedulePolicy} from '../site/competition-calendar.mjs';
test('native competition constraints vary by phase and actual match evidence',()=>{
 const s=competitionFixture();
 for(const n of [0,1,2]){
  const p=competitionSchedulePolicy(s,addEvent([],event(n),day),day,report);
  assert.equal(p.familiar,true);assert.equal(p.deferEscalation,true);assert.equal(p.focus,null);
 }
 const p=competitionSchedulePolicy(s,addEvent([],event(5),day),day,report);
 assert.equal(p.focus,'scoring');assert.equal(p.deferEscalation,false);
 assert.equal(competitionSchedulePolicy(newMemory().state,addEvent([],event(5),day),day,report).focus,null);
 assert.equal(competitionSchedulePolicy(s,addEvent([],event(5),day),day,{decision:'stop',verification:{status:'passed'}}).focus,null);
 assert.equal(competitionSchedulePolicy(s,addEvent([],event(8),day),day,report).focus,null);
 assert.equal(competitionSchedulePolicy(s,addEvent([],event(5),day),shift(-1),report).phase,'ordinary');
});
