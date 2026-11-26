import {deliveryGate,methodReviews,methodReviewGate,methodFollowupGate} from './coaching-accountability.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
import {trainingOutcomes} from './training-outcomes.mjs';
import {FIXED_PROTOCOLS,recordedConfounder} from './challenge-episodes.mjs';
import {validSetting} from './challenge-setting.mjs';
import {eventContext,validateEvents} from './competition-calendar.mjs';
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
export function planPreview(host,state,report,events,day,now=Date.now(),existingAgenda=null){
 if(!dayValid(day))throw Error('Invalid planning date');
 const agenda=existingAgenda??developmentAgenda(host,state,day,{report,now}),event=eventContext(events,day);
 if(agenda.wellbeing)return {status:'wellbeing',segments:[],reason:agenda.actions[0].next,focus:null,event};
 if(event.phase==='competition-day')return {status:'competition',segments:[],reason:'Competition day. Use a comfortable familiar warm-up and normal match routine rather than prescribing extra training.',focus:null,event};
 const rows=base(),open=(state.interventions??[]).find(i=>i.status==='accepted'&&dayValid(i.responseDay)&&i.responseDay<=day);
 const pending=(state.interventions??[]).some(i=>i.status==='proposed'&&i.proposedDay<=day);
 const shortfall=open?deliveryGate(host,open,day,now):null;
 // Preview only. Use an accepted focus, not a descriptive association or
 // forecast, and only while the existing engine independently supports it.
 let focus=null;
 if(event.phase!=='near-event'&&open&&!shortfall.defer&&!pending&&core.has(open.skill)&&open.context==='practice'&&report?.verification?.status==='passed'&&report.active?.mode==='accepted-temporary-focus'&&report.active.intervention===open.id&&dayGap(open.responseDay,day)>=0&&dayGap(open.responseDay,day)<open.reviewAfterDays){
  const to=rows.find(x=>x.skill===open.skill),from=rows.filter(x=>x.skill!==open.skill&&x.minutes>=10&&core.has(x.skill)).sort((a,b)=>b.minutes-a.minutes||a.skill.localeCompare(b.skill))[0];
  if(to&&from){to.minutes+=5;from.minutes-=5;to.reason='Accepted focus preview; native allocation safeguards still decide actual session.';focus=open.skill}
 }
 // Prefer no additional changes while a focus or comparison is active.
 const blocked=open||pending||report?.decision!=='balanced'||report?.verification?.status!=='passed'||(state.trials??[]).some(x=>x.status==='active'&&x.start<=day)||event.phase!=='ordinary';
 if(!blocked){
  const learning=personalLearning(host,state,day,now),reviews=methodReviews(host,state,day,now),deferred=methodReviewGate(reviews,day),awaiting=methodFollowupGate(reviews,day);
  for(const row of rows){
   if(awaiting.some(r=>r.skill===row.skill))continue;
   const evidence=learning.find(x=>x.skill===row.skill)?.supported.filter(x=>x.kind==='method'&&dayValid(x.latest)&&dayGap(x.latest,day)>=0&&dayGap(x.latest,day)<=28)??[];
   const distinct=[...new Set(evidence.map(x=>x.favoured.name))];
   // Different methods or protocol disagreements are reasons not to select.
   if(distinct.length===1&&!deferred.some(r=>r.skill===row.skill&&r.alternative===distinct[0])&&evidence.every(x=>x.other.name!==distinct[0])&&evidence.every(x=>x.protocol===evidence[0].protocol)){
    row.drill=distinct[0];row.reason='Candidate drill from repeated matched observations; confirm suitability and normal game settings before using it. Not an automatic replacement.';
   }
  }
 }
 return {status:'preview',segments:[{skill:'warmup',minutes:10,drill:'Comfortable warm-up',reason:'Keep routine familiar.'},...rows,{skill:'application',minutes:10,drill:'301 or 101 application',reason:'Apply skills in normal play.'}],focus,event,reason:'Illustrative 60-minute scheduled-session preview only. Existing native planner, readiness, consent, benchmark and workload rules remain authoritative.'+(shortfall?.defer?' Existing adjustment needs delivery review before further allocation.':'')+(pending?' A proposed adjustment is awaiting consent.':'')};
}
const shift=(day,n)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
function checkpoints(agenda,state,events,day,count){
 const known=validateEvents(events).filter(e=>e.recordedDay<=day);
 const reviews=(state.interventions??[]).filter(i=>i.status==='accepted'&&dayValid(i.responseDay)&&i.responseDay<=day&&Number.isInteger(i.reviewAfterDays)&&i.reviewAfterDays>=0).map(i=>({day:shift(i.responseDay,i.reviewAfterDays),label:i.skill+' accepted adjustment review'}));
 const goals=agenda.goals.filter(g=>dayValid(g.review)).map(g=>({day:g.review,label:g.skill+' goal review'}));
 return Array.from({length:count},(_,i)=>{
  const start=shift(day,i*7),end=shift(day,i*7+6);
  const due=[...reviews,...goals].filter(r=>r.day<=end&&(i===0||r.day>=start)).sort((a,b)=>a.day.localeCompare(b.day)||a.label.localeCompare(b.label));
  const competitions=known.filter(e=>e.day>=start&&dayGap(end,e.day)<=2).sort((a,b)=>a.day.localeCompare(b.day));
  return {week:i+1,start,end,reviews:due,competitions};
 });
}
export function blockPreview(host,state,report,events,day,now=Date.now()){
 const agenda=developmentAgenda(host,state,day,{report,now}),p=planPreview(host,state,report,events,day,now,agenda);
 const lead=report?.verification?.status==='passed'?agenda.lead:null;
 const focus=lead?.skill?lead.skill+(lead.protocol?' · '+lead.protocol:''):null;
 const actions=[
  lead?lead.next:'Establish or maintain comparable benchmarks and comfortable routine.',
  'Review repeated measurements; use only an already approved eligible adjustment.',
  'Review actual training delivery and later comparable measurements before changing the method.',
  'Repeat the same comparable benchmarks; review retention and decide whether to retain or revise the next block.'
 ];
 const weeks=checkpoints(agenda,state,events,day,4).map((w,i)=>({...w,action:agenda.wellbeing?'Review readiness before planning practice; no training prescription while the current concern remains.':w.competitions.length?'Keep familiar match preparation and avoid introducing a demanding experiment around recorded competition.':actions[i]}));
 return {session:p,focus,weeks,limitation:'Four-week review framework, not a calendar booking or fixed prescription. Recompute after each measured change. No extra sessions or projected improvement dates.'};
}
export function longProgramme(host,state,report,events,day,now=Date.now()){
 const first=blockPreview(host,state,report,events,day,now);
 const agenda=developmentAgenda(host,state,day,{report,now});
 const later=checkpoints(agenda,state,events,day,12).slice(4);
 const phases=[{weeks:'1–4',action:'Use the current four-week review framework.'},{weeks:'5–8',action:'Reassess actual benchmark change, practice delivery and current readiness before retaining or revising one adjustment.'},{weeks:'9–12',action:'Check retention on the same benchmarks and review the next development priority; do not extrapolate a promised result.'}];
 return {first,later,phases,limitation:'Twelve-week rolling development framework. Later phases are conditional, not fixed prescriptions. Refresh after each review and competition.'};
}
export function planLines(p){
 return [p.reason,...p.segments.map(x=>x.minutes+' min · '+x.drill+' · '+x.reason),...(p.event.event?['Next reported competition: '+p.event.event.day+' · '+p.event.event.name+'.']:[])];
}
const weekLine=w=>'Week '+w.week+' ('+w.start+' to '+w.end+'): '+w.action+(w.reviews.length?' · Review: '+w.reviews.map(r=>r.day+' '+r.label).join('; '):'')+(w.competitions.length?' · Competition: '+w.competitions.map(e=>e.day+' '+e.name).join('; '):'');
export function blockLines(b){return [...planLines(b.session),...(b.focus?['Current review priority: '+b.focus]:[]),...b.weeks.map(weekLine),b.limitation]}
export function longProgrammeLines(p){return [...blockLines(p.first),...p.phases.slice(1).map(x=>'Weeks '+x.weeks+': '+x.action),...p.later.filter(w=>w.reviews.length||w.competitions.length).map(w=>weekLine({...w,action:'Review planned commitments; reassess current evidence before prescribing practice.'})),p.limitation]}

 // A bounded prospective choice between already eligible native near-ties.
 // This does not learn a universal optimal drill, choose a difficulty, or
 // attribute a causal effect. Historical exact settings remain descriptive.
 export function learnedMethodChoice({memory,state,report,events,history,policy,options,comparisons,day,reviews=[]}){
  const no=reason=>({status:'unchanged',reason});
  if(memory?.learnedMethods!==true)return no('Player has not enabled learned method selection');
  if(!dayValid(day)||!Array.isArray(history)||!Array.isArray(options)||!Array.isArray(comparisons))return no('Invalid planning evidence');
  if(report?.verification?.status!=='passed'||report.decision!=='balanced')return no('Current coaching decision takes priority');
  if(eventContext(events??[],day).phase!=='ordinary')return no('Keep familiar practice near competition');
  if((state.interventions??[]).some(i=>['proposed','accepted'].includes(i.status))||(state.trials??[]).some(i=>i.status==='active'))return no('Existing intervention or trial takes priority');
  if(recordedConfounder(state,day,day))return no('Current practice conditions need review');
  if(history.some(s=>dayValid(s?.date)&&dayGap(s.date,day)>=0&&dayGap(s.date,day)<7&&s.wholeSessionAudit?.idcMethod?.status==='selected'))return no('One learned method selection per rolling seven days');
  const supported=comparisons.filter(c=>c?.kind==='method'&&core.has(c.skill)&&['first-associated','second-associated'].includes(c.status)&&dayValid(c.latest)&&dayGap(c.latest,day)>=0&&dayGap(c.latest,day)<=28&&Number.isInteger(c.pairs)&&c.pairs>=6&&Number.isInteger(c.weeks)&&c.weeks>=6&&FIXED_PROTOCOLS[c.skill]?.includes(c.protocol)&&validSetting(c.firstSetting)&&validSetting(c.secondSetting)&&c.firstSetting.skill===c.skill&&c.secondSetting.skill===c.skill&&c.firstSetting.name!==c.secondSetting.name)
   .map(c=>({...c,favoured:c.status==='first-associated'?c.firstSetting:c.secondSetting,other:c.status==='first-associated'?c.secondSetting:c.firstSetting}));
  const deferred=methodReviewGate(reviews,day),followup=methodFollowupGate(reviews,day);
  const eligible=[];
  for(const o of options){
   if(!o||!core.has(o.skill)||typeof o.normal!=='string'||typeof o.alternative!=='string'||o.normal===o.alternative||!Number.isFinite(o.normalScore)||!Number.isFinite(o.alternativeScore)||o.alternativeScore<o.normalScore||o.alternativeScore-o.normalScore>2.5||!Number.isInteger(o.seconds)||o.seconds<300||o.seconds>1200||!Number.isInteger(o.normalTier)||!Number.isInteger(o.alternativeTier)||o.normalTier<1||o.normalTier>7||o.alternativeTier<1||o.alternativeTier>7)continue;
   const c=policy?.categories?.[o.skill];
   if(!c||c.policySafety||c.overexposed||c.learning?.protect||c.learning?.permissionToEscalate)continue;
   const rows=supported.filter(r=>r.skill===o.skill);
   // Conflicting favoured names, protocols or exact settings veto a switch.
   if(!rows.length||rows.some(r=>r.favoured.name!==o.alternative||r.protocol!==rows[0].protocol||r.favoured.tier!==o.alternativeTier))continue;
   const pair=rows.filter(r=>r.other.name===o.normal&&r.other.tier===o.normalTier);
   if(!pair.length||rows.some(r=>recordedConfounder(state,r.latest,day))||deferred.some(r=>r.skill===o.skill&&r.protocol===rows[0].protocol&&r.alternative===o.alternative)||followup.some(r=>r.skill===o.skill))continue;
   const exact=JSON.stringify(pair[0].favoured);
   if(rows.some(r=>JSON.stringify(r.favoured)!==exact)||pair.some(r=>JSON.stringify(r.other)!==JSON.stringify(pair[0].other)))continue;
   // A supported difference between methods at one dose cannot justify a
   // substantially different dose. Require most recorded matched durations
   // on BOTH arms to be close to the actual final native clock budget.
   const compatibleDose=c=>Array.isArray(c.matched)&&c.matched.length===c.pairs&&c.matched.every(m=>m&&Number.isInteger(m.aSeconds)&&Number.isInteger(m.bSeconds)&&m.aSeconds>=300&&m.bSeconds>=300&&m.aSeconds<=7200&&m.bSeconds<=7200)&&c.matched.filter(m=>m.aSessions===1&&m.bSessions===1&&[m.aSeconds,m.bSeconds].every(n=>Math.abs(n-o.seconds)<=.25*Math.max(n,o.seconds))).length>=Math.ceil(.75*c.pairs);
   const doseMatched=pair.filter(compatibleDose);
   if(!doseMatched.length)continue;
   // Adequately sampled, recent uncertainty in the exact same comparison
   // is a veto, not permission to cherry-pick a favourable duplicate.
   if(comparisons.some(c=>c?.kind==='method'&&c.skill===o.skill&&c.protocol===rows[0].protocol&&c.status==='unclear'&&c.pairs>=6&&c.weeks>=6&&dayValid(c.latest)&&dayGap(c.latest,day)>=0&&dayGap(c.latest,day)<=28&&validSetting(c.firstSetting)&&validSetting(c.secondSetting)&&[c.firstSetting.name,c.secondSetting.name].includes(o.normal)&&[c.firstSetting.name,c.secondSetting.name].includes(o.alternative)))continue;
   const best=[...doseMatched].sort((a,b)=>b.pairs-a.pairs||b.weeks-a.weeks||b.latest.localeCompare(a.latest))[0];
   eligible.push({status:'selected',normal:o.normal,alternative:o.alternative,skill:o.skill,seconds:o.seconds,protocol:best.protocol,pairs:best.pairs,weeks:best.weeks,latest:best.latest,expectedSetting:JSON.parse(JSON.stringify(best.favoured)),scoreGap:o.alternativeScore-o.normalScore,day,reason:'Player-enabled native near-tie; matched observational evidence supports trying this method. Native rules and minutes are unchanged.'});
  }
  return eligible.sort((a,b)=>a.scoreGap-b.scoreGap||b.pairs-a.pairs||a.normal.localeCompare(b.normal)||a.alternative.localeCompare(b.alternative))[0]??no('No sufficiently supported native near-tie');
 }
 export function chooseLearnedMethod(host,context,options,policy,day,now=Date.now()){
  if(context.memory?.learnedMethods!==true||!options.length)return {status:'unchanged',reason:'No enabled eligible candidates'};
  // The history is reconstructed on demand: correction/deletion cannot
  // leave a cached preference behind.
  const comparisons=trainingOutcomes(host,context.state,day,now).comparisons;
  return learnedMethodChoice({...context,events:context.memory.events,history:host.sessions,policy,options,comparisons,day,reviews:methodReviews(host,context.state,day,now)});
 }
