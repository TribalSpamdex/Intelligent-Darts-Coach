import {SKILLS,currentFacts,plan} from './engine.mjs';
import {dayValid,dayGap,exposureSummary} from './context.mjs';
import {variant,difficultyDecision} from './training.mjs';
import {approachHistory,trialOutcome} from './experiments.mjs';
import {abilityProfiles} from '../progression-evidence.mjs';
import {SKILL_THRESHOLDS} from '../progression-bands.mjs';
// The direction of levels in the generic engine is the inverse of the native
// game tier. These are provisional practice-selection bounds, not talent labels.
export function measuredPracticeLevels(observations,day){
 const out={};
 for(const p of abilityProfiles(observations,day)){
  if(p.confirmed===null)continue;
  const thresholds=SKILL_THRESHOLDS[p.skill];
  if(thresholds)out[p.skill]=1+thresholds.filter(v=>p.confirmed>=v).length;
  else if(p.skill==='singles'||p.skill==='trebles'){
   const gates=p.skill==='singles'?[50,65,80]:[10,20,30];out[p.skill]=1+2*gates.filter(v=>p.confirmed>=v).length;
  }
 }
 return out;
}
const preference={
 scoring:['Scoring Survival','Scoring Ladder','Scoring Ladder'],
 doubles:['Doubles Survival','Doubles Streak','Double Double'],
 checkout:['Checkout Climb','Focused Checkouts','Focused Checkouts'],
 bull:['Bull Survival','Bull Bank','Bull Streak']
};
export function measuredGamePreferences(observations,day){
 const levels=measuredPracticeLevels(observations,day),out={};
 for(const [skill,games] of Object.entries(preference)){const n=levels[skill];if(n!==undefined)out[skill]=games[n<=2?0:n<=4?1:2]}
 return out;
}
export const DRILLS=[
 ['singles','large-singles','Big singles around the board','Throw three darts at each large single, 1–20. Count only the large single.','fixed benchmark'],
 ['singles','single-switch','Large-single switching','Alternate large singles 20, 19, 18, 17, 16; record exact hits.','switching'],
 ['doubles','double-prep','Large singles for double preparation','Aim at large singles 1–20; no doubles required.','foundation'],
 ['doubles','double-all','All-board doubles','Three darts per double, 1–20; record hit/miss.','fixed benchmark'],
 ['doubles','double-focus','Selected doubles','Use three darts per assigned double, including less-practised doubles.','targeted'],
 ['doubles','double-recovery','Double recovery','Start at D20 or D16; after an inside single, recalculate and aim at the remaining double if legal.','application'],
 ['checkout','checkout-prep','Single-target setup','Aim at large singles that leave an even finish; no double-out required.','foundation'],
 ['checkout','checkout-low','Low checkout practice','Attempt 41–60 with three darts; record finished visits and misses separately.','application'],
 ['checkout','checkout-high','Mixed checkout practice','Attempt assigned legal finishes 61–100; recalculate after each dart.','application'],
 ['checkout','checkout-route','Route selection','Compare two legal routes for a finish, including recovery after the most common miss.','tactical'],
 ['scoring','scoring-core','Scoring visits','Record points and darts at a consistent target; do not force treble-only scoring.','fixed benchmark'],
 ['scoring','scoring-switch','Scoring switches','Use 20, 19 and 18 as scoring options; switch if blocked; log intended targets.','application'],
 ['firstNine','opening-nine','Opening nine','Record the opening nine darts of repeated 501 legs.','fixed benchmark'],
 ['trebles','treble-prep','Large-single preparation','Aim at a large single; do not require a treble.','foundation'],
 ['trebles','treble-rotation','Treble rotation','Rotate T20, T19, T18, T17 and T16; record exact hits.','targeted'],
 ['bull','bull-outer','Central target','Aim at outer bull; record 25, 50 and miss separately, with no minimum success required.','foundation'],
 ['bull','bull-inner','Inner bull','Aim at inner bull; record 25, 50 and miss separately.','targeted'],
 ['switching','switch-basic','Two large singles','Alternate between two large singles, without time pressure.','foundation'],
 ['switching','switch-mixed','Mixed switching','Aim at three distinct assigned segments in order; log intended and actual segments.','application'],
 ['setup','setup-basic','Large single setup','Choose the specified large single to leave an even score; record exact hits.','foundation'],
 ['setup','setup-bogey','Bogey avoidance','Choose a route leaving a legal finish; verify the arithmetic after each dart.','tactical'],
 ['pressure','pressure-baseline','Familiar task','Repeat a familiar large-single task without consequences.','foundation'],
 ['pressure','pressure-routine','Routine comparison','Use a brief repeatable preparation routine on a familiar task; record results separately.','application'],
 ['grouping','group-large','Large-single grouping','Aim three darts at the same large single; record whether all three land in that region.','foundation'],
 ['grouping','group-small','Smaller-region grouping','Aim three darts at the same smaller region; record all outcomes. No physical spread estimate.','targeted']
].map(([skill,id,name,instructions,kind])=>({skill,id,name,instructions,kind}));
export function drillOptions(skill,level){
 const rows=DRILLS.filter(d=>d.skill===skill);if(!rows.length||!Number.isInteger(level)||level<1||level>7)throw Error('Invalid drill options');
 if(level<=2){const easy=rows.filter(x=>x.kind==='foundation');return easy.length?easy:rows.slice(0,1)}
 if(level<=4)return rows.filter(x=>x.kind!=='tactical'&&x.kind!=='foundation').length?rows.filter(x=>x.kind!=='tactical'&&x.kind!=='foundation'):rows.slice(-1);
 return rows.filter(x=>x.kind!=='foundation').length?rows.filter(x=>x.kind!=='foundation'):rows;
}
export function validateSession(s){
 if(!s||typeof s.id!=='string'||!s.id.trim()||s.id.length>100||!dayValid(s.day)||!Number.isInteger(s.number)||s.number<1||s.number>3||!['completed','partial'].includes(s.status)||!Array.isArray(s.segments)||s.segments.length<1||s.segments.length>15)throw Error('Invalid training session');
 const seen=new Set();for(const g of s.segments){if(!g||!['warmup','application',...SKILLS].includes(g.skill)||typeof g.drill!=='string'||!g.drill.trim()||g.drill.length>100||!Number.isInteger(g.minutes)||g.minutes<1||g.minutes>60||seen.has(g.skill))throw Error('Invalid session segment');if(g.skill==='application'){if(g.drill!=='301-application'||g.minutes>10)throw Error('Invalid application segment')}else if(g.skill!=='warmup'&&!DRILLS.some(d=>d.id===g.drill&&d.skill===g.skill))throw Error('Unknown drill');seen.add(g.skill)}
 const minutes=s.segments.reduce((a,b)=>a+b.minutes,0);if(minutes>60||s.status==='completed'&&minutes!==60||s.status==='partial'&&minutes===60)throw Error('Invalid completed session duration');return s;
}
export function logSession(m,s){s=validateSession(s);const rows=m.sessions??[];if(rows.some(x=>x.id===s.id||x.day===s.day&&x.number===s.number))throw Error('Duplicate training session');return {...m,sessions:[...rows,s]}}
export function historyMinutes(m,day){const rows=(m.sessions??[]).filter(x=>dayGap(x.day,day)>=0&&dayGap(x.day,day)<7);return {minutes:rows.reduce((n,s)=>n+s.segments.reduce((a,g)=>a+g.minutes,0),0),skills:Object.fromEntries(SKILLS.map(skill=>[skill,rows.reduce((n,s)=>n+s.segments.filter(g=>g.skill===skill).reduce((a,g)=>a+g.minutes,0),0)])),days:new Set(rows.map(s=>s.day)).size}}
export function trainingRecommendation(m,report,day,active,number=1){
 if(!dayValid(day)||!Number.isInteger(number)||number<1||number>3)throw Error('Invalid training date/session');
 if(['stop','reduce-load'].includes(report.decision))return {mode:report.decision,segments:[],reason:'Readiness takes priority.'};
 const previous=(m.sessions??[]).filter(s=>s.day===day),used=new Set(previous.flatMap(s=>s.segments.map(g=>g.drill))),history=historyMinutes(m,day);
 if(number>1&&!previous.some(s=>s.number===number-1))return {mode:'not-yet-available',segments:[],reason:'Record the previous session before planning another.'};
 if(previous.some(s=>s.number===number))return {mode:'already-recorded',segments:[],reason:'This session has already been logged.'};
 const focus=active.mode==='accepted-temporary-focus'?m.interventions.find(i=>i.id===active.intervention)?.skill:null;
 const base=plan(focus);
 const rotating=['switching','firstNine','trebles','pressure','grouping'].filter(skill=>skill==='switching'||!base.some(x=>x.skill===skill));
 const slot=base.find(x=>x.skill==='switching'&&x.minutes===5&&focus!=='switching');
 if(slot)slot.skill=[...rotating].sort((a,b)=>history.skills[a]-history.skills[b]||rotating.indexOf(a)-rotating.indexOf(b))[0];
 const measured=measuredPracticeLevels(m.observations??[],day);
 const segments=base.map(g=>{
 if(g.skill==='warmup')return {...g,drill:'warmup',name:'Comfortable warm-up',instructions:'Throw comfortably for 10 minutes.'};
 if(g.skill==='application')return {...g,drill:'301-application',name:'Practical 301 application',instructions:'Play repeated 301 legs, applying scoring, setup and legal double-out finishing. Keep practice familiar; no added workload.'};
 const rows=(m.difficulty??[]).filter(x=>x.skill===g.skill&&x.protocol===g.skill+'-core'&&x.day<=day).sort((a,b)=>b.day.localeCompare(a.day));
 const taskLevel=difficultyDecision(m.difficulty??[],g.skill,g.skill+'-core',rows[0]?.level??1,day).next;
 const level=Object.hasOwn(measured,g.skill)?rows.length?Math.min(measured[g.skill],taskLevel):measured[g.skill]:taskLevel;
 const choices=drillOptions(g.skill,level),fresh=choices.filter(d=>!used.has(d.id)),pool=fresh.length?fresh:choices;
 const last=new Map();for(const s of (m.sessions??[]).filter(s=>s.day<=day))for(const d of s.segments)last.set(d.drill,Math.max(last.get(d.drill)??0,Date.parse(s.day)));
 const fit=d=>!Object.hasOwn(measured,g.skill)?0:level>=5?Number(!['application','targeted','tactical'].includes(d.kind)):level>=3?Number(d.kind==='foundation'):0;
 const drill=[...pool].sort((a,b)=>fit(a)-fit(b)||(last.get(a.id)??0)-(last.get(b.id)??0)||a.id.localeCompare(b.id))[0];
 return {...g,drill:drill.id,name:drill.name,instructions:drill.instructions,level,repeat:used.has(drill.id)};
 });
 return {mode:active.mode,segments,history,focus,limitations:['Recorded sessions guide variety, not complete practice exposure.','No forced increase in workload or skill level based on self-report.','Some beginner drills repeat because the easiest safe version is deliberately stable.']};
}
export function personalApproachReview(m,skill,protocol,context){
 return (m.trials??[]).filter(t=>t.skill===skill&&t.protocol===protocol&&t.context===context&&t.status==='completed').map(t=>({approach:t.approach,baseline:t.baseline,alternative:t.alternative,outcome:trialOutcome(t),history:approachHistory(m,skill,protocol,context,t.approach,t.baseline,t.alternative)}));
}
