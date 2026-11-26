import {deliveryGate} from './coaching-accountability.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
import {trainingOutcomes} from './training-outcomes.mjs';
import {eventContext} from './competition-calendar.mjs';
import {developmentAgenda} from './development-review.mjs';
const slots=[['scoring',10,'Scoring Challenge'],['doubles',10,'Doubles Survival'],['checkout',10,'Focused Checkouts'],['bull',5,'Bull Accuracy'],['singles',5,'Big Singles']];
const base=()=>slots.map(([skill,minutes,drill])=>({skill,minutes,drill,reason:'Familiar balanced practice; use your existing appropriate game rules.'}));
const core=new Set(['scoring','doubles','checkout','bull']);
export function personalLearning(host,state,day,now=Date.now()){
 const r=trainingOutcomes(host,state,day,now);
 const bySkill=new Map();
 for(const c of r.comparisons){
  const g=bySkill.get(c.skill)??{skill:c.skill,comparisons:0,supported:[],uncertain:0};
  g.comparisons++;
  if(['first-associated','second-associated'].includes(c.status)){
   const first=c.status==='first-associated';
   g.supported.push({kind:c.kind,protocol:c.protocol,favoured:first?c.firstSetting:c.secondSetting,other:first?c.secondSetting:c.firstSetting,pairs:c.pairs,weeks:c.weeks,latest:c.latest,first:c.first,second:c.second,status:c.status});
  }else g.uncertain++;
  bySkill.set(c.skill,g);
 }
 for(const x of r.followups){const g=bySkill.get(x.skill)??{skill:x.skill,comparisons:0,supported:[],uncertain:0};g.followups=(g.followups??[]).concat({name:x.setting.name,protocol:x.protocol,status:x.status,followup:x.followup,delay:x.delay,recordedPractice:x.interveningDays.length});bySkill.set(x.skill,g)}
 return [...bySkill.values()].sort((a,b)=>a.skill.localeCompare(b.skill));
}
export function learningLines(rows){
 if(!rows.length)return ['No supported individual learning contrasts or delayed follow-ups yet.'];
 return [...rows.flatMap(r=>[r.skill+': '+r.comparisons+' recorded comparisons; '+r.uncertain+' uncertain or insufficient.',...r.supported.slice(0,5).map(x=>x.kind+' · '+x.protocol+' · '+(x.status==='first-associated'?x.first:x.second)+' associated with better later results in '+x.pairs+' matched pairs across '+x.weeks+' weekly blocks.'),...(r.followups??[]).slice(-5).map(x=>x.name+' · '+x.status.replaceAll('-',' ')+' after '+x.delay+' days; '+x.recordedPractice+' saved intervening training days.')]),'Individual learning evidence is observational and may conflict across protocols. No universal learning style or causal improvement rate is assigned.'];
}
export function planPreview(host,state,report,events,day,now=Date.now()){
 if(!dayValid(day))throw Error('Invalid planning date');
 const agenda=developmentAgenda(host,state,day,{report,now}),event=eventContext(events,day);
 if(agenda.wellbeing)return {status:'wellbeing',segments:[],reason:agenda.actions[0].next,focus:null,event};
 if(event.phase==='competition-day')return {status:'competition',segments:[],reason:'Competition day. Use a comfortable familiar warm-up and normal match routine rather than prescribing extra training.',focus:null,event};
 const rows=base(),open=(state.interventions??[]).find(i=>i.status==='accepted'&&i.responseDay<=day);
 // Preview only. Use an accepted focus, not a descriptive association or
 // forecast, and only while the existing engine independently supports it.
 let focus=null;
 if(event.phase!=='near-event'&&open&&dayValid(open.responseDay)&&!deliveryGate(host,open,day,now).defer&&core.has(open.skill)&&open.context==='practice'&&report?.verification?.status==='passed'&&report.active?.mode==='accepted-temporary-focus'&&report.active.intervention===open.id&&dayGap(open.responseDay,day)>=0&&dayGap(open.responseDay,day)<open.reviewAfterDays){
  const to=rows.find(x=>x.skill===open.skill),from=rows.filter(x=>x.skill!==open.skill&&x.minutes>=10&&core.has(x.skill)).sort((a,b)=>b.minutes-a.minutes||a.skill.localeCompare(b.skill))[0];
  if(to&&from){to.minutes+=5;from.minutes-=5;to.reason='Accepted focus preview; native allocation safeguards still decide actual session.';focus=open.skill}
 }
 // Prefer no additional changes while a focus or comparison is active.
 const blocked=open||(state.trials??[]).some(x=>x.status==='active'&&x.start<=day)||event.phase!=='ordinary';
 if(!blocked){
  const learning=personalLearning(host,state,day,now);
  for(const row of rows){
   const evidence=learning.find(x=>x.skill===row.skill)?.supported.filter(x=>x.kind==='method'&&dayGap(x.latest,day)<=28)??[];
   const distinct=[...new Set(evidence.map(x=>x.favoured.name))];
   // Different methods or protocol disagreements are reasons not to select.
   if(distinct.length===1&&evidence.every(x=>x.other.name!==distinct[0])&&evidence.every(x=>x.protocol===evidence[0].protocol)){
    row.drill=distinct[0];row.reason='Candidate drill from repeated matched observations; confirm suitability and normal game settings before using it. Not an automatic replacement.';
   }
  }
 }
 return {status:'preview',segments:[{skill:'warmup',minutes:10,drill:'Comfortable warm-up',reason:'Keep routine familiar.'},...rows,{skill:'application',minutes:10,drill:'301 or 101 application',reason:'Apply skills in normal play.'}],focus,event,reason:'Illustrative 60-minute scheduled-session preview only. Existing native planner, readiness, consent, benchmark and workload rules remain authoritative.'};
}
export function blockPreview(host,state,report,events,day,now=Date.now()){
 const p=planPreview(host,state,report,events,day,now);
 return {session:p,weeks:[
 {week:1,action:'Establish or maintain comparable benchmarks and comfortable routine.'},
 {week:2,action:'Review repeated measurements; use only an already approved eligible adjustment.'},
 {week:3,action:'Review any due intervention and compare observed training delivery and subsequent measurements.'},
 {week:4,action:'Repeat the same comparable benchmarks; review retention and decide whether to retain or revise the next block.'}
 ],limitation:'Four-week review framework, not a calendar booking or fixed prescription. Recompute after each measured change. No extra sessions or projected improvement dates.'};
}
export function planLines(p){
 return [p.reason,...p.segments.map(x=>x.minutes+' min · '+x.drill+' · '+x.reason),...(p.event.event?['Next reported competition: '+p.event.event.day+' · '+p.event.event.name+'.']:[])];
}
export function blockLines(b){return [...planLines(b.session),...b.weeks.map(w=>'Week '+w.week+': '+w.action),b.limitation]}
