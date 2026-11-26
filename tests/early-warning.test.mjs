import test from 'node:test';
import assert from 'node:assert/strict';
import {earlyWarning,robustTrend} from '../site/engine/context.mjs';
import {newMemory} from '../site/coach-memory.mjs';
import {makeCheck} from '../site/precision-checks.mjs';
import {fullReport} from '../site/engine/executive.mjs';
import {developmentAgenda,recoveryPlan} from '../site/development-review.mjs';
import {coachBrief} from '../site/proactive-coach.mjs';
import {planPreview} from '../site/personal-programme.mjs';
import {addEvent} from '../site/competition-calendar.mjs';
const date=i=>new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10);
const day=date(55),now=Date.parse(day+'T12:00:00Z'),host={sessions:[],games:[],assessmentHistory:[],bigSingles:[]};
const fixture=()=>Array.from({length:56},(_,i)=>makeCheck('doubles',[12,48,12,48,12,48,30][i%7]-(i>=28?4:0),date(i)));
test('weekly screen identifies a six-point persistent deficit without a confirmed trend',()=>{
 const rows=fixture(),w=earlyWarning(rows,{asOf:day});
 assert.equal(robustTrend(rows,{asOf:day}).status,'unclear');assert.equal(w.status,'watch');
 assert.equal(w.supportingWeeks,4);assert.ok(Math.abs(w.change+4/60)<1e-10);
 assert.deepEqual(earlyWarning([...rows,makeCheck('scoring',900,date(56))],{asOf:day}),w);
 assert.equal(earlyWarning(rows.filter(o=>o.day<date(52)),{asOf:day}).status,'insufficient');
 const recovered=rows.map((o,i)=>i>=53?makeCheck('doubles',48,o.day):o);
 assert.equal(earlyWarning(recovered,{asOf:day}).status,'no-warning');
 const mixed=[...rows,{...rows[0],id:'other',protocol:'different'}];
 assert.equal(earlyWarning(mixed,{asOf:day}).status,'not-comparable');
 const sparse=rows.filter((_,i)=>i%7===0);
 assert.equal(earlyWarning(sparse,{asOf:day}).status,'insufficient');
});
test('early warning is surfaced as a read-only advisory and cannot allocate a new focus',()=>{
 const state=newMemory().state;state.observations=fixture();const original=JSON.stringify(state);
 const r=fullReport(state,day);assert.equal(r.decision,'balanced');assert.equal(r.focus,null);
 const a=developmentAgenda(host,state,day,{report:r,now});
 assert.equal(a.lead.kind,'early-watch');assert.equal(a.lead.skill,'doubles');
 assert.ok(a.lead.reason.includes('not a confirmed decline'));
 assert.ok(a.lead.next.includes('no extra workload'));
 const b=coachBrief(host,state,r,[],[],day,now);
 assert.equal(b.kind,'development');assert.ok(b.detail.includes('Early watch'));
 const recovery=recoveryPlan(host,state,day,{report:r,now});
 assert.equal(recovery.status,'early-watch');assert.ok(recovery.steps.at(-1).includes('Do not treat this as evidence of a slump'));
 const p=planPreview(host,state,r,[],day,now);
 assert.equal(p.focus,null);assert.equal(p.segments.reduce((n,x)=>n+x.minutes,0),60);
 assert.deepEqual(p.segments,planPreview(host,newMemory().state,r,[],day,now).segments);
 assert.equal(JSON.stringify(state),original);
 assert.ok(!developmentAgenda(host,state,day,{report:{verification:{status:'failed'}},now}).actions.some(a=>a.kind==='early-watch'));
 const events=addEvent([],{id:'next',day:date(56),name:'League',kind:'league'},day);
 assert.equal(coachBrief(host,state,r,events,[],day,now).kind,'competition');
 state.readiness=[{day,context:'practice',pain:true,fatigue:'normal',pressure:'normal',confidence:'normal',note:''}];
 assert.equal(coachBrief(host,state,fullReport(state,day),events,[],day,now).kind,'wellbeing');
});
test('early warning held-out calibration: 5,000 histories, separate seed and variable denominators',()=>{
 const cases=[['stable-beginner',.12,.8,0,.15],['stable-elite',.72,.8,0,.15],['clustered-elite',.72,.96,0,.25],['small-decline',.48,.8,-.08,.15],['large-decline',.48,.8,-.18,.15],['gradual-improve',.30,.85,.16,.15],['recovered-slump',.42,.8,-.2,.15],['missing-stable',.42,.9,0,.45],['gradual-decline',.48,.85,-.16,.15],['recent-decline',.48,.8,-.10,.15]];
 const results=[];
 for(const [scenario,base,rho,delta,missing] of cases){
  let seed=(0x4f69d1a7+results.length*7919)>>>0;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const out={scenario,confirmed:0,watch:0,additional:0,either:0,insufficient:0};
  for(let i=0;i<500;i++){
   let noise=0;const rows=[];
   for(let d=0;d<56;d++){
    noise=rho*noise+(random()-.5)*.10;
    const shift=scenario.startsWith('gradual')?delta*d/55:scenario==='recovered-slump'?(d>=14&&d<28?delta:0):d>=(scenario==='recent-decline'?42:28)?delta:0;
    if(random()<missing)continue;
    const p=Math.min(.999,Math.max(.001,base+noise+shift)),attempts=[15,30,60,90][Math.floor(random()*4)];
    let hits=0;for(let j=0;j<attempts;j++)hits+=Number(random()<p);
    rows.push({id:'r'+d,day:date(d),skill:'doubles',context:'practice',protocol:'fixed',hits,attempts});
   }
   const w=earlyWarning(rows,{asOf:day}),t=robustTrend(rows,{asOf:day}),a=t.status==='declining',b=w.status==='watch';
   out.confirmed+=Number(a);out.watch+=Number(b);out.additional+=Number(b&&!a);out.either+=Number(a||b);out.insufficient+=Number(w.status==='insufficient');
  }
  results.push(out);
 }
 console.log('Held-out early-warning screen: '+JSON.stringify(results));
 // Engineering bounds for advisory prompts, not clinical or inferential
 // guarantees; retain the unmodified stronger trend and allocation gates.
 for(const i of [0,1,7])assert.ok(results[i].watch<=50,JSON.stringify(results[i]));
 assert.ok(results[2].watch<=85,JSON.stringify(results[2]));
 assert.ok(results[3].additional>=125);
 assert.ok(results[4].either>=425);
 assert.ok(results[8].additional>=125);
 assert.ok(results[9].additional>=60);
 assert.ok(results[5].watch<=10);assert.ok(results[6].watch<=5);
});
