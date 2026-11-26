import test from 'node:test';
import assert from 'node:assert/strict';
import {developmentProfile,developmentAgenda,developmentLines,agendaLines,goalRunwayLines} from '../site/development-review.mjs';
import {precisionDecisions} from '../site/progression-evidence.mjs';
import {precisionRound} from '../site/precision-games.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const stamp=(d,m=0)=>Date.parse(d+'T09:00:00Z')+m*60000;
const ages=[0,2,4,8,10,15,17,23];
const obs=(n,v=70,extra={})=>({id:'r'+n,day:ago(n),skill:'scoring',context:'practice',protocol:'IDC precision fixed scoring',attempts:30,hits:v*10,...extra});
function fixture(values=[70,70,70],dose=true){
 const host={games:[],sessions:[]},state={observations:[],legs:[],goals:[],interventions:[],readiness:[],clinic:[],changes:[]};
 for(let i=0;i<values.length;i++)for(const n of ages){
  const age=n+28*i,d=ago(age);
  state.observations.push(obs(age,values[i]));
  if(dose)host.sessions.push({id:age+1,date:d,start:stamp(d),quick:false,extra:false,completed:true,activities:[{name:'Scoring Survival',exerciseId:'e'+age,exerciseIndex:0,seconds:600,rounds:0,plannedSeconds:600,at:stamp(d,10)}]});
 }
 return {host,state};
}
test('stable repeated skill measurements plus adequate classified dose support a review, not automatic failure',()=>{
 const {host,state}=fixture(),p=developmentProfile(host,state,day,now),s=p.skills.find(x=>x.skill==='scoring');
 assert.equal(s.protocols[0].plateau,'stable-with-recorded-exposure');assert.ok(s.doses.every(d=>d.seconds===4800&&d.days===8&&d.coverage===1));
 assert.ok(developmentAgenda(host,state,day,{now,profile:p}).actions.some(a=>a.kind==='review-stable-training'));
 assert.ok(developmentLines(p).some(x=>x.includes('do not assume failure')));
});
test('stable measurement without dose, confounded history, incomplete sessions or low coverage cannot confirm exposure',()=>{
 for(const reason of ['none','change','partial','mixed']){
  const {host,state}=fixture([70,70,70],reason!=='none');
  if(reason==='change')state.changes=[{day:ago(15),field:'equipment'}];
  if(reason==='partial')host.sessions[0].completed=false;
  if(reason==='mixed')for(const s of host.sessions)s.activities.push({name:'301 Pressure',exerciseId:'m'+s.id,exerciseIndex:1,seconds:600,rounds:0,at:stamp(s.date,20)});
  const s=developmentProfile(host,state,day,now).skills.find(x=>x.skill==='scoring');
  assert.equal(s.protocols[0].plateau,'stable-exposure-unconfirmed',reason);
 }
});
test('current decline, recent form, missing and stale scopes remain distinct',()=>{
 const {host,state}=fixture([50,70,70]);
 let a=developmentAgenda(host,state,day,{now});
 assert.ok(a.actions.some(x=>x.kind==='investigate-decline'&&x.skill==='scoring'));
 assert.ok(a.actions.some(x=>x.kind==='coverage'&&x.skill==='doubles'));
 state.observations=state.observations.filter(o=>o.day<=ago(8));
 a=developmentAgenda(host,state,day,{now});assert.ok(a.actions.some(x=>x.kind==='stale'&&x.skill==='scoring'));
});
test('safety suppresses all competing advice and does not rewrite existing observations',()=>{
 const {host,state}=fixture();state.readiness=[{day,context:'practice',pain:true}];const original=JSON.stringify(state);
 const a=developmentAgenda(host,state,day,{now});assert.equal(a.wellbeing,'stop');assert.equal(a.actions.length,1);assert.equal(JSON.stringify(state),original);
 state.readiness=[{day,context:'practice',fatigue:'high'}];assert.equal(developmentAgenda(host,state,day,{now}).wellbeing,'reduce-load');
 state.readiness=[{day:ago(8),context:'practice',pain:true}];assert.equal(developmentAgenda(host,state,day,{now}).wellbeing,null);
});
test('active intervention and due review outrank new advisory development work',()=>{
 const {host,state}=fixture();state.interventions=[{id:'i',status:'accepted',skill:'doubles',protocol:'fixed',responseDay:ago(15),reviewAfterDays:14}];
 const a=developmentAgenda(host,state,day,{now});
 assert.equal(a.lead.kind,'review-intervention');assert.equal(a.actions[0].kind,'review-intervention');
 assert.ok(agendaLines(a).at(-1).includes('no new automatic allocation'));
});
test('goal runway is actual current gap not an extrapolated completion date',()=>{
 const {host,state}=fixture();state.goals=[{id:'g',skill:'scoring',context:'practice',protocol:'IDC precision fixed scoring',start:ago(27),review:ago(-7),target:80,status:'active'}];
 const a=developmentAgenda(host,state,day,{now}),g=a.goals[0];
 assert.equal(g.current,70);assert.equal(g.gap,10);assert.equal(g.daysToReview,7);assert.equal(g.reviewDue,false);
 assert.ok(goalRunwayLines(a).at(-1).includes('No projected achievement date'));
 state.goals[0].review=day;assert.equal(developmentAgenda(host,state,day,{now}).actions[0].kind,'review-goal');
});
test('future goals and future measurements cannot change an as-of review',()=>{
 const {host,state}=fixture(),base=developmentAgenda(host,state,day,{now});
 state.observations.push(obs(-1,180));state.goals=[{id:'future',skill:'scoring',context:'practice',protocol:'IDC precision fixed scoring',start:ago(-1),review:ago(-15),target:150,status:'active'}];
 assert.deepEqual(developmentAgenda(host,state,day,{now}),base);
});
test('temporary form cap is a downward adjustment only and leaves ability estimate intact',()=>{
 // 12 measured days: recent three low days, other nine high. Both
 // independent chronological halves still need to support ability;
 // use 4 recent days with three moderately lower results and enough usual days.
 const old=[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27].map(n=>obs(n,90));
 const rows=[...old,...[0,1,2].map(n=>obs(n,70))];
 const p=precisionDecisions(rows,day,{scoring:4}).scoring;
 assert.equal(p.temporaryFormCap,true);assert.ok(p.recentCap<p.challenge);assert.ok(p.confirmedAbility>=80);
 const g={name:'Scoring Survival',tier:4,target:60};
 const before=precisionRound(g,{scoring:{...p,temporaryFormCap:false}},{eligible:true});
 const after=precisionRound(g,{scoring:p},{eligible:true});
 assert.ok(after.target<before.target);assert.equal(p.challenge,3);
 const one=precisionDecisions([...old,obs(0,40)],day,{scoring:4}).scoring;
 assert.equal(one.temporaryFormCap,false);
 const high=precisionDecisions([...old,...[0,1,2].map(n=>obs(n,110))],day,{scoring:4}).scoring;
 assert.equal(high.temporaryFormCap,false);assert.equal(high.recentCap,high.challenge);
});
