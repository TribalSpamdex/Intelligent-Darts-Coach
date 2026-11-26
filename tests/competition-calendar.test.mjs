import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEvents,addEvent,removeEvent,eventContext,eventLines} from '../site/competition-calendar.mjs';
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
