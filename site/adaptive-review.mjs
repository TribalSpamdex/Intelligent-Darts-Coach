// Read-only synthesis of independently scoped measurements. Reuses the existing
// confirmation, diagnostic and forecast rules; no second player memory or causal model.
import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {dayGap,dayValid,robustTrend,earlyWarning} from './engine/context.mjs';
import {summarise,serialMargin} from './engine/engine.mjs';
import {confirmCurrentDecline,investigateIssue} from './engine/diagnosis.mjs';
import {FIXED_PROTOCOLS,learningBoundary} from './challenge-episodes.mjs';
import {actualLegObservations} from './match-statistics.mjs';
import {recordedDay} from './v62-evidence.mjs';
import {relevant} from './engine/knowledge.mjs';
const quickFixed={scoring:'IDC V6.2 Quick Play Scoring Challenge fixed 30 darts',bull:'IDC V6.2 Quick Play Bull Accuracy any bull 30'};
const scoring=s=>s==='scoring'||s==='firstNine';
const fmt=(n,s)=>Number.isFinite(n)?(n*(scoring(s)?1:100)).toFixed(1)+(scoring(s)?' average':'%'):'not measured';
const shift=(d,n)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
const fixed=o=>o.context==='practice'&&(FIXED_PROTOCOLS[o.skill]?.includes(o.protocol)||quickFixed[o.skill]===o.protocol);
export function currentReferenceBoundary(host,state,day,now=Date.now()){
 if(!dayValid(day)||!Number.isFinite(now))throw Error('Invalid review date');
 const dates=[learningBoundary(state,day)];
 const a=host?.assessment;
 if(a?.version===6&&a.finished===true&&!a.quickStart&&!a.carriedForward&&Number.isFinite(a.completedAt)&&a.completedAt>0&&a.completedAt<=now){const d=recordedDay(a.completedAt,a.offsetMinutes);if(dayValid(d)&&d<=day)dates.push(d);}
 return dates.filter(Boolean).sort().at(-1)??null;
}
export function currentConditionRows(observations,state,day,host=null,now=Date.now()){
 const boundary=currentReferenceBoundary(host,state,day,now);
 return canonicalRows(observations,day).filter(o=>!boundary||o.day>boundary);
}
function grouped(rows){const m=new Map();for(const o of rows){const k=scopeKey(o),g=m.get(k)??[];g.push(o);m.set(k,g)}return [...m.values()]}
function sourceRows(state,day){return [...canonicalRows(state.observations??[],day).filter(fixed),...actualLegObservations(state.legs??[],day).filter(o=>o.context==='competition')];}
const safeState=(state,day)=>!(state.readiness??[]).some(r=>dayValid(r.day)&&dayGap(r.day,day)>=0&&dayGap(r.day,day)<7&&r.pain)&&!(state.clinic??[]).some(r=>dayValid(r.day)&&dayGap(r.day,day)>=0&&dayGap(r.day,day)<7&&r.pain)&&!(state.readiness??[]).some(r=>r.day===day&&r.context==='practice'&&r.fatigue==='high');
export function adaptiveReview(host,state,day,now=Date.now()){
 const boundary=currentReferenceBoundary(host,state,day,now),all=sourceRows(state,day).filter(o=>!boundary||o.day>boundary),profiles=[];
 for(const rows of grouped(all.filter(o=>dayGap(o.day,day)<56))){
  const {skill,context,protocol}=rows[0],last=rows.map(o=>o.day).sort().at(-1),trend=robustTrend(rows,{asOf:day}),recent=summarise(rows.filter(o=>dayGap(o.day,day)<28));
  // Current confirmation is checked for all fresh declines, including a short
  // recent deterioration that is not yet established across both long windows.
  const scoped={...state,observations:rows},scope={skill,context,protocol},fresh=dayGap(last,day)<=7;
  const confirmation=fresh?confirmCurrentDecline(scoped,scope,day):null;
  const warning=fresh?earlyWarning(rows,{asOf:day}):{status:'insufficient'};
  const status=!fresh?'stale':confirmation?.recovering?'recovering':confirmation?.status==='confirmed'?'confirmed-decline':trend.status==='improving'?'improving':warning.status==='watch'||trend.status==='declining'?'watch':trend.status==='insufficient'?'insufficient':'no-confirmed-change';
  profiles.push({...scope,last,recent,trend,confirmation,warning,status});
 }
 profiles.sort((a,b)=>scopeKey(a).localeCompare(scopeKey(b)));
 const conflicts=[];
 for(const p of profiles.filter(p=>p.status==='confirmed-decline'||p.status==='watch')){
  const opposite=profiles.filter(q=>q!==p&&q.skill===p.skill&&['improving','recovering'].includes(q.status));
  if(opposite.length)conflicts.push({focus:p,opposite});
 }
 const ranked=profiles.filter(p=>['confirmed-decline','watch'].includes(p.status)).sort((a,b)=>Number(b.status==='confirmed-decline')-Number(a.status==='confirmed-decline')||Number(b.context==='practice')-Number(a.context==='practice')||b.recent.days-a.recent.days||scopeKey(a).localeCompare(scopeKey(b)));
 const focus=ranked[0]??null;
 let diagnostic=null,decision='balanced',next='Maintain normal practice and record comparable fixed checks; missing evidence does not prove stable ability.';
 if(!safeState(state,day)){decision='readiness';next='Readiness takes priority. Avoid aggravating practice and review reported fatigue or discomfort before any new change.';}
 else if(focus){
  const conflict=conflicts.find(c=>c.focus===focus);
  if(conflict){decision='disagree';next='Comparable scopes disagree. Repeat the same familiar check and record actual competition separately before generalising or changing training.';}
  else{
   const rows=all.filter(o=>scopeKey(o)===scopeKey(focus)),scoped={...state,observations:rows,exposure:(state.exposure??[]).filter(o=>!boundary||o.day>boundary),readiness:(state.readiness??[]).filter(o=>!boundary||o.day>boundary),answers:(state.answers??[]).filter(o=>!boundary||o.day>boundary),throws:(state.throws??[]).filter(o=>!boundary||o.day>boundary)};
   diagnostic=investigateIssue(scoped,{...focus,evidence:focus.trend},day);
   const question=diagnostic.questions[0];
   if(diagnostic.veto==='comfort'){decision='readiness';next='Do not aggravate discomfort. Review readiness before practising.';}
   else if(diagnostic.veto){decision='investigate';next='Resolve the competing conditions before changing workload or technique. '+(question?.text??'Repeat the same familiar reference task.');}
   else if(focus.status==='watch'){decision='confirm';next='Repeat the same familiar fixed measurement on separate days before any change.';}
   else{decision='review';next='Review the independently confirmed decline using the existing consent and training safeguards. '+(question?.text??'Keep other conditions stable.');}
  }
 }else if(profiles.some(p=>p.status==='recovering')){decision='recovering';next='Recent measurements are recovering. Keep the normal comfortable routine; do not escalate practice on the basis of an older decline.';}
 else if(!profiles.length||profiles.every(p=>['stale','insufficient'].includes(p.status))){decision='collect';next='Collect fresh comparable fixed measurements before choosing a personalised focus.';}
 // Select from the existing corpus by the observed investigation, not fame
 // of a coach or a universal mechanical prescription. Preserve conflicting
 // review findings when attention cues are relevant.
 const ids=['context','retention'];
 const supports=id=>diagnostic?.hypotheses.some(h=>h.id===id&&['supported-possibility','mixed'].includes(h.status));
 if(supports('fatigue'))ids.unshift('fatigue-mental');
 if(supports('equipment'))ids.unshift('equipment-isolation');
 if(supports('technique'))ids.unshift('single-variable','darts-focus-review','attention-reporting-bias');
 if(supports('pressure'))ids.unshift('professional-pressure','pre-performance-routine');
 if(supports('target'))ids.unshift('miss-direction');
 const library=focus?relevant(focus.skill):[];
 const knowledge=ids.map(id=>library.find(k=>k.id===id)).filter(Boolean).slice(0,5).map(k=>({id:k.id,principle:k.principle,source:k.source,limitations:k.limitations}));
 return {boundary,profiles,conflicts,focus,diagnostic,decision,next,knowledge};
}
export function adaptiveReviewLines(r,{detail=false}={}){
 const lines=[...(r.boundary?['Current reference begins after '+r.boundary+'. Older history is retained but excluded from this review.']:[])];
 if(!r.profiles.length)lines.push('No eligible fixed practice or actual competition measurements in the current window.');
 for(const p of (detail?r.profiles.slice(0,16):r.focus?[r.focus]:r.profiles.slice(0,4))){lines.push(p.skill+' · '+p.context+' · '+p.protocol+': '+p.status.replaceAll('-',' ')+'. Recent '+fmt(p.recent?.value,p.skill)+' from '+(p.recent?.attempts??0)+' attempts on '+(p.recent?.days??0)+' days; last measured '+p.last+'.');}
 if(r.conflicts.length)lines.push('Competing directions: '+r.conflicts.map(c=>c.focus.skill+' ('+c.focus.context+' versus '+c.opposite.map(q=>q.context+' '+q.protocol).join(', ')+')').join('; ')+'.');
 if(r.diagnostic){for(const h of r.diagnostic.hypotheses.filter(h=>h.status==='supported-possibility'||h.status==='mixed').slice(0,4))lines.push(h.title+': '+h.status.replaceAll('-',' ')+'. '+[...h.support,...h.against].join(' '));lines.push('No observed association establishes a cause; a mechanical fault cannot be inferred from scoring alone.');}
 lines.push(r.next);
 if(!detail&&r.knowledge.length)lines.push('Relevant existing knowledge, not an individual prescription: '+r.knowledge.map(k=>k.principle+' ('+k.source+'; '+k.limitations+')').join(' '));
 return lines;
}
// Historical warning evaluation. Each anchor uses earlier data only; its
// reference and future outcome use disjoint periods. Anchors 84 days apart
// avoid reusing observations within a scope. No claims of calibrated accuracy.
export function warningReplay(state,day){
 if(!dayValid(day))throw Error('Invalid warning review date');
 const changes=[...(state.changes??[]),...(state.setups??[])].map(c=>c.day).filter(d=>dayValid(d)&&d<=day);
 const result=[];
 for(const rows of grouped(sourceRows(state,day))){
  const {skill,context,protocol}=rows[0],evaluations=[];let excluded=0;
  for(let offset=28;offset+55<365;offset+=84){
   const anchor=shift(day,-offset),start=shift(anchor,-55),end=shift(anchor,28);
   if(changes.some(d=>d>=start&&d<=end)){excluded++;continue}
   const before=rows.filter(o=>o.day>=start&&o.day<=anchor),reference=summarise(before.filter(o=>dayGap(o.day,anchor)>=28)),futureRows=rows.filter(o=>o.day>anchor&&o.day<=end),future=summarise(futureRows),w=earlyWarning(before,{asOf:anchor});
   const blocks=new Set(futureRows.map(o=>Math.floor((dayGap(anchor,o.day)-1)/7)));
   if(w.status==='insufficient'||!reference||!future||future.days<7||future.attempts<60||blocks.size<3)continue;
   const base=reference.dayMean,floor=scoring(skill)?3:.05,margin=serialMargin(reference,future),delta=future.dayMean-base;
   const weekly=[...blocks].map(b=>summarise(futureRows.filter(o=>Math.floor((dayGap(anchor,o.day)-1)/7)===b))).filter(s=>s.days>=2);
   if(weekly.length<3)continue;
   const lower=delta<=-Math.max(floor,margin)&&weekly.filter(s=>s.dayMean<=base-floor).length>=3;
   evaluations.push({anchor,end,warning:w.status==='watch',laterLower:lower,referenceDays:reference.days,outcomeDays:future.days,delta});
  }
  result.push({skill,context,protocol,excluded,evaluations,warnings:evaluations.filter(e=>e.warning).length,continued:evaluations.filter(e=>e.warning&&e.laterLower).length,lowerWithoutWarning:evaluations.filter(e=>!e.warning&&e.laterLower).length});
 }
 return result.sort((a,b)=>scopeKey(a).localeCompare(scopeKey(b)));
}
export function warningReplayLines(rows){
 return [...(rows.length?rows.slice(0,16).map(r=>r.skill+' · '+r.context+' · '+r.protocol+': '+r.evaluations.length+' evaluable non-overlapping historical windows; '+r.warnings+' warnings, '+r.continued+' followed by continued lower measurements; '+r.lowerWithoutWarning+' lower later windows without an earlier warning; '+r.excluded+' skipped after recorded changes.') : ['No eligible history for a retrospective warning review.']), 'Reconstructed historical screens, not a log of messages actually delivered. A warning requests confirmation, not a forecast or treatment; later recovery is not necessarily a failed warning. No automatic policy tuning from these small samples.'];
}
// A fresh conflicting practice or match direction blocks a new learned
// preference, not the ordinary native planner or already accepted plan.
export function reviewMethodChoice(choice,review){
 if(choice?.status!=='selected')return choice;
 if(review.decision==='readiness'||review.conflicts.some(c=>c.focus.skill===choice.skill)||review.focus?.skill===choice.skill&&['investigate','confirm'].includes(review.decision))return {status:'unchanged',reason:'Current reference conditions or conflicting evidence require review; keep the ordinary native choice.'};
 return choice;
}
