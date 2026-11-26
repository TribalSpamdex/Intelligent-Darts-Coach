import test from 'node:test';
import assert from 'node:assert/strict';
import {performanceForecasts,forecastValidation} from '../site/performance-forecast.mjs';
import {addEvent,eventContext} from '../site/competition-calendar.mjs';
import {newMemory} from '../site/coach-memory.mjs';
import {planPreview,blockPreview} from '../site/personal-programme.mjs';
import {coachBrief} from '../site/proactive-coach.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const host={games:[],sessions:[],assessmentHistory:[],bigSingles:[]};
const report={decision:'balanced',verification:{status:'passed'},strategy:{agenda:{questions:[]}},active:{mode:'balanced-until-accepted'}};
function history(){
 const out=[];
 for(let age=1095;age>=0;age--)for(const [i,skill] of ['scoring','doubles','checkout','bull','singles','trebles'].entries()){
  if((age+i)%3!==0)continue;
  const attempts=skill==='checkout'?30:60,rate=skill==='scoring'?(35+(1095-age)*.035+(age%7-3)):(.12+i*.07+(1095-age)*.00015+(age%7-3)*.005);
  out.push({id:skill+'-'+age,day:ago(age),skill,context:'practice',protocol:'IDC precision fixed '+skill,attempts,hits:Math.round(skill==='scoring'?rate*attempts/3:rate*attempts)});
 }
 return out;
}
test('three-year six-skill histories reproduce forecasts and validation at independent monthly checkpoints',()=>{
 const rows=history();
 for(let age=336;age>=0;age-=28){
  const d=ago(age),known=rows.filter(o=>o.day<=d);
  const a=performanceForecasts(rows,d),b=performanceForecasts(known,d);
  assert.deepEqual(a,b);assert.equal(a.length,6);
  assert.deepEqual(forecastValidation(rows,d),forecastValidation(known,d));
  for(const p of a){assert.equal(p.status,'historical-range');assert.ok(p.range[0]<=p.point&&p.point<=p.range[1])}
 }
});
test('monthly previews remain read-only and conserve time through a year of event dates and evidence corrections',()=>{
 const state=newMemory().state;state.observations=history();
 const before=JSON.stringify(state);
 let events=[];
 for(let age=336;age>=0;age-=28){
  const date=ago(age),at=now-age*86400000,eventDay=ago(age-3);
  events=addEvent(events,{id:'event-'+age,day:eventDay,kind:'league',name:'League'},date);
  const p=planPreview(host,state,report,events,date,at);
  assert.equal(p.status,'preview');assert.equal(p.segments.reduce((n,x)=>n+x.minutes,0),60);
  assert.equal(eventContext(events,date).phase,'event-week');
  assert.equal(blockPreview(host,state,report,events,date,at).weeks.length,4);
  assert.ok(coachBrief(host,state,report,events,[],date,at).title);
 }
 assert.equal(JSON.stringify(state),before);
});
test('future event intentions do not affect historical planning and current competition suppresses extra preview',()=>{
 const state=newMemory().state,events=addEvent([],{id:'e',day,kind:'tournament',name:'Tournament'},day);
 const earlier=ago(1),p=planPreview(host,state,report,events,earlier,now-86400000);
 assert.equal(p.event.event,null);
 assert.equal(planPreview(host,state,report,events,day,now).segments.length,0);
});
