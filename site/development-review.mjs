// Advisory development agenda, not a second automatic session planner.
import {dayValid,dayGap,robustTrend} from './engine/context.mjs';
import {goalProgress} from './engine/goals.mjs';
import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {abilityProfiles,progressEvidence} from './progression-evidence.mjs';
import {trainingLedger,ledgerWindows,LEDGER_SKILLS} from './training-ledger.mjs';
import {recordedConfounder} from './challenge-episodes.mjs';
import {actualLegObservations} from './match-statistics.mjs';
const shift=(d,n)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
const min=(x)=>x/60;
const sum=xs=>xs.reduce((n,x)=>n+x.seconds,0);
const core=['scoring','doubles','checkout','bull','singles','trebles'];
const score=s=>['scoring','firstNine'].includes(s);
function periodDose(ledger,skill,day,from,to){
 const inWindow=d=>{const age=dayGap(d,day);return age>=from&&age<to};
 const rows=ledger.rows.filter(r=>inWindow(r.day)),focused=rows.filter(r=>r.skill===skill&&r.sessionCompleted&&!r.interrupted);
 const nonroutine=rows.filter(r=>r.kind!=='routine'),classified=rows.filter(r=>r.skill&&r.sessionCompleted&&!r.interrupted);
 const coverage=sum(nonroutine)>0?sum(classified)/sum(nonroutine):null;
 return {from,to,start:shift(day,1-to),end:shift(day,-from),seconds:sum(focused),days:new Set(focused.map(r=>r.day)).size,weeks:new Set(focused.map(r=>Math.floor(dayGap(r.day,day)/7))).size,coverage,blocked:ledger.blockedDays.filter(inWindow).length};
}
export function developmentProfile(host,state,day,now=Date.now()){
 if(!dayValid(day)||!Array.isArray(state?.observations))throw Error('Invalid development review');
 const ledger=trainingLedger(host,day,now),abilities=abilityProfiles(state.observations,day),obs=canonicalRows(state.observations,day),groups=new Map();
 for(const o of obs){const k=scopeKey(o),g=groups.get(k)??[];g.push(o);groups.set(k,g)}
 const bySkill=LEDGER_SKILLS.map(skill=>{
  const doses=[0,28,56].map(n=>periodDose(ledger,skill,day,n,n+28));
  const protocols=(abilities.find(a=>a.skill===skill)?.protocols??[]).map(p=>{
   const windows=p.stability.periods.map((w,i)=>({start:doses[i].start,end:doses[i].end,median:w.median,attempts:w.attempts,measuredDays:w.days,adequate:w.adequate,training:doses[i]}));
   // Sufficient logged practice is only a screening condition. A lack of
   // measured change does not prove that practice is ineffective.
   const doseAdequate=doses.every(d=>d.seconds>=3600&&d.days>=4&&d.weeks>=3&&d.coverage>=.7&&d.blocked===0);
   const confounded=recordedConfounder(state,shift(day,-83),day);
   const plateau=p.stability.status!=='stable-measurements'?p.stability.status:doseAdequate&&!confounded?'stable-with-recorded-exposure':'stable-exposure-unconfirmed';
   const trend=robustTrend(groups.get(JSON.stringify([skill,'practice',p.protocol]))??[],{asOf:day});
   return {protocol:p.protocol,last:p.last,form:p.form.status,trend:trend.status,change:trend.change??null,plateau,windows,doseAdequate,confounded};
  });
  return {skill,doses,protocols,confirmed:abilities.find(a=>a.skill===skill)?.confirmed??null};
 });
 return {skills:bySkill,ledger,windows:ledgerWindows(ledger,day),limitation:'Recorded training volume and comparable performance are displayed together, not converted to improvement per minute. No inference about unlogged training or causation.'};
}
function goalRows(state,day){
 const goals=(state.goals??[]).filter(g=>g.status==='active'&&g.start<=day);if(!goals.length)return [];
 const observations=canonicalRows([...state.observations,...actualLegObservations(state.legs??[],day)],day);
 return goals.map(g=>{
  const p=goalProgress({...state,observations},g,day);
  const remaining=p.current===null?null:Math.max(0,g.target-p.current);
  return {id:g.id,skill:g.skill,protocol:g.protocol,context:g.context,review:g.review,status:p.status,reviewDue:p.reviewDue,days:p.days,current:p.current,target:g.target,gap:remaining,daysToReview:Math.max(0,dayGap(day,g.review))};
 }).sort((a,b)=>Number(b.reviewDue)-Number(a.reviewDue)||a.review.localeCompare(b.review)||a.id.localeCompare(b.id));
}
export function developmentAgenda(host,state,day,{now=Date.now(),report=null,profile=null}={}){
 profile=profile??developmentProfile(host,state,day,now);
 const actions=[],add=(rank,kind,skill,protocol,reason,next)=>actions.push({rank,kind,skill,protocol,reason,next});
 const recent=(o,n=7)=>dayValid(o.day)&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<n;
 const pain=(state.clinic??[]).some(o=>recent(o)&&o.pain)||(state.readiness??[]).some(o=>recent(o)&&o.pain);
 const fatigue=(state.readiness??[]).some(o=>recent(o,1)&&o.context==='practice'&&o.fatigue==='high');
 const wellbeing=pain||report?.decision==='stop'?'stop':fatigue||report?.decision==='reduce-load'?'reduce-load':null;
 if(wellbeing){
  add(100,'wellbeing',null,null,wellbeing==='stop'?'Recent reported discomfort or a stop recommendation takes priority.':'High fatigue reported today or a reduced-load recommendation is active.',wellbeing==='stop'?'Avoid aggravating practice; seek qualified advice if pain is significant or persistent.':'Do not add demanding practice today; review how you feel first.');
  return {wellbeing,actions,goals:goalRows(state,day),limitation:'Safety guidance supersedes the development agenda.'};
 }
 for(const i of (state.interventions??[]).filter(i=>i.status==='accepted'&&dayValid(i.responseDay)&&i.responseDay<=day)){
  const age=dayGap(i.responseDay,day);
  if(age>=i.reviewAfterDays)add(95,'review-intervention',i.skill,i.protocol,'Accepted focus has reached its review date.','Review actual adherence, comparable outcomes and any changes before repeating or extending it.');
  else add(82,'active-intervention',i.skill,i.protocol,'An accepted focus is still active.','Keep other training changes isolated and review at the agreed date.');
 }
 const goals=goalRows(state,day);
 for(const g of goals){
  if(g.reviewDue)add(90,'review-goal',g.skill,g.protocol,'Your recorded goal is due for review.','Review the same benchmark and decide whether to retain, revise or close the goal.');
  else if(g.status==='insufficient')add(73,'goal-evidence',g.skill,g.protocol,'An active goal has insufficient comparable measured days.','Repeat its exact benchmark before estimating progress.');
  else if(g.status==='target-observed')add(45,'goal-observed',g.skill,g.protocol,'Your target has been observed on repeated measured days.','Check later performance before treating it as retained.');
 }
 // Respect the existing validated coaching policy; never generate an
 // independent automatic allocation from descriptive method associations.
 if(report?.verification?.status==='passed'&&report.decision==='temporary-focus')add(85,'confirmed-focus',report.focus,report.focusProtocol,'The existing independent coach has confirmed a focus.','Use the normal consent and workload safeguards before changing the plan.');
 for(const s of profile.skills.filter(s=>core.includes(s.skill))){
  if(!s.protocols.length){add(40,'coverage',s.skill,null,'No eligible fixed benchmark recorded.','Record a complete fixed skill check; do not infer this skill from another average.');continue}
  for(const p of s.protocols){
   if(dayGap(p.last,day)>7){add(50,'stale',s.skill,p.protocol,'Latest comparable measurement is more than seven days old.','Repeat the same benchmark when practical.');continue}
   if(p.trend==='declining')add(80,'investigate-decline',s.skill,p.protocol,'Two separately measured periods show a sustained lower result.','Confirm conditions, technique/equipment changes and logged practice before changing training.');
   else if(p.form==='below-usual')add(68,'recent-form',s.skill,p.protocol,'Recent measured form is below the preceding window.','Use a comfortable challenge and repeat comparable checks; do not assume ability has permanently changed.');
   else if(p.plateau==='stable-with-recorded-exposure')add(62,'review-stable-training',s.skill,p.protocol,'Stable measured results across three periods with substantial classified exposure.','Review drill choice, challenge and practice conditions; test one change at a time.');
   else if(p.plateau==='stable-exposure-unconfirmed')add(48,'review-coverage',s.skill,p.protocol,'Stable measurements, but practice dose or conditions are not sufficiently verified.','Improve training records before diagnosing a plateau.');
   else if(s.confirmed===null)add(42,'coverage',s.skill,p.protocol,'Independent recent-day confirmation is incomplete.','Repeat the same fixed check on separate days.');
   else if(p.trend==='improving')add(30,'maintain',s.skill,p.protocol,'Comparable longer-term results are improving.','Keep the current training stable and check that gains persist.');
  }
 }
 // One most useful item per scope and kind; do not overload the player
 // with multiple competing changes. A goal may still have its own review.
 const seen=new Set(),ranked=actions.sort((a,b)=>b.rank-a.rank||String(a.skill).localeCompare(String(b.skill))||String(a.protocol).localeCompare(String(b.protocol))||a.kind.localeCompare(b.kind)).filter(a=>{const k=JSON.stringify([a.kind,a.skill,a.protocol]);if(seen.has(k))return false;seen.add(k);return true});
 const lead=ranked.find(x=>['review-intervention','active-intervention','confirmed-focus'].includes(x.kind));
 return {wellbeing:null,actions:ranked,goals,lead:lead??ranked[0]??null,limitation:'Advisory engineering priorities, not calibrated probabilities. Existing approved session policy remains authoritative; no new automatic allocation.'};
}
const f=(v,s)=>v===null?'not measured':v.toFixed(1)+(score(s)?'':'%');
export function developmentLines(p){
 const lines=[];
 for(const s of p.skills){
  if(!s.protocols.length&&!s.doses.some(d=>d.seconds))continue;
  lines.push(s.skill+': '+s.doses.map(d=>d.start+' to '+d.end+' '+min(d.seconds).toFixed(1)+' min / '+d.days+' recorded days').join(' · ')+'.');
  for(const r of s.protocols){
   lines.push(r.protocol+' · '+r.windows.map(w=>f(w.median,s.skill)+' ('+w.measuredDays+' benchmark days, '+w.attempts+' attempts)').join(' / ')+'. '+({ 'stable-with-recorded-exposure':'Stable measured results with adequate recorded exposure; investigate, do not assume failure.', 'stable-exposure-unconfirmed':'Stable measured results; exposure or conditions not confirmed.', 'variable':'Variable results.', 'changing':'Changing results.', 'insufficient':'More measured history needed.'}[r.plateau]??'More evidence needed.'));
  }
 }
 if(!lines.length)lines.push('No classified training or fixed benchmark history yet.');
 return [...lines,p.limitation];
}
export function agendaLines(a,limit=5){
 const lines=a.actions.slice(0,limit).map(x=>(x.skill?x.skill+' · ':'')+x.reason+' '+x.next);
 if(!lines.length)lines.push('Maintain balanced training and regular comparable measurements.');
 return [...lines,a.limitation];
}
export function goalRunwayLines(a){
 if(!a.goals.length)return ['No active measurable goals.'];
 const format=(v,s)=>v===null?'not measured':score(s)?v.toFixed(1):(100*v).toFixed(1)+'%';
 return [...a.goals.map(g=>g.skill+' · '+g.context+' · '+g.protocol+': observed '+format(g.current,g.skill)+'; target '+format(g.target,g.skill)+'; remaining gap '+(g.gap===null?'not measured':score(g.skill)?g.gap.toFixed(1)+' points':(100*g.gap).toFixed(1)+' percentage points')+'; '+g.days+' measured days. '+(g.reviewDue?'Review due '+g.review:g.daysToReview+' days until review '+g.review)+'. '+g.status.replaceAll('-',' ')+'.'),'No projected achievement date: a remaining numerical gap does not establish a future learning rate.'];
}

export function recoveryPlan(host,state,day,{now=Date.now(),report=null,agenda=null}={}){
 const a=agenda??developmentAgenda(host,state,day,{now,report});
 const limitation='Advisory recovery review only: no causal diagnosis, automatic technique change, extra workload or promised recovery date.';
 if(a.wellbeing)return {status:'wellbeing',skill:null,steps:[a.actions[0].next],limitation};
 if(report?.verification?.status!=='passed')return {status:'unverified',skill:null,steps:['Keep ordinary practice and collect comparable fixed benchmarks before making a recovery decision.'],limitation};
 if(a.lead&&['review-intervention','active-intervention','confirmed-focus','review-goal'].includes(a.lead.kind))return {status:'existing-priority',skill:a.lead.skill,steps:[a.lead.next,'Do not introduce a competing recovery adjustment.'],limitation};
 const issue=a.actions.find(x=>['investigate-decline','recent-form'].includes(x.kind));
 if(!issue)return {status:'no-confirmed-slump',skill:null,steps:['No current supported practice slump was established. A poor visit, leg or session is not sufficient evidence.','Keep comparable fixed checks and review again when enough separate measured days are available.'],limitation};
 const p=abilityProfiles(state.observations,day).find(x=>x.skill===issue.skill)?.protocols.find(x=>x.protocol===issue.protocol);
 const change=p?.form,confounded=recordedConfounder(state,shift(day,-27),day);
 const steps=[
  issue.reason,
  confounded?'Recent recorded conditions or training changes may affect comparison; investigate these before attributing the drop to ability.':'Check whether equipment, routine, health, fatigue or practice conditions changed; absence of a saved change does not establish identical conditions.',
  'Use familiar comfortable practice within your normal workload; do not add volume or rebuild your throw in response to the result.',
  'Repeat '+issue.protocol+' on separate days under comparable conditions. Review once enough independent days satisfy the existing evidence rules.',
  'If the lower results persist, review the cause and consider one bounded consented adjustment. If normal form returns, maintain the ordinary routine and confirm retention.'
 ];
 return {status:issue.kind==='investigate-decline'?'sustained-decline':'recent-form',skill:issue.skill,protocol:issue.protocol,confounded,recent:change?.short?.median??null,previous:change?.usual?.median??null,steps,limitation};
}
export function recoveryLines(p){
 return [...(p.skill?['Recovery focus: '+p.skill+(p.protocol?' · '+p.protocol:'')]:[]),...(p.recent!==null&&p.recent!==undefined&&p.previous!==null&&p.previous!==undefined?['Recent measured median '+f(p.recent,p.skill)+'; preceding measured median '+f(p.previous,p.skill)+'. These are review references, not recovery targets.']:[]),...p.steps,p.limitation];
}
