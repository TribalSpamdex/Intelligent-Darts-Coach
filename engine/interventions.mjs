import {SKILLS,summarise,plan} from './engine.mjs';
import {evaluation} from './reasoning.mjs';
const dateOk=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const daysBetween=(a,b)=>(Date.parse(b)-Date.parse(a))/86400000;
export function propose(memory,report,id,day){
 if(!dateOk(day)||typeof id!=='string'||!id.trim()||memory.interventions.some(x=>x.id===id))throw Error('Invalid intervention identity');
 if(memory.interventions.some(x=>['proposed','accepted'].includes(x.status)))throw Error('Resolve existing intervention first');
 const issue=report.issues.find(i=>i.skill===report.focus&&i.action==='temporary-focus'&&(!report.focusProtocol||i.protocol===report.focusProtocol)&&(!report.focusContext||i.context===report.focusContext));
 if(!issue||report.decision!=='temporary-focus')throw Error('No supported focus recommendation');
 const obs=memory.observations.filter(o=>o.skill===issue.skill&&o.context===issue.context&&o.protocol===issue.protocol&&o.day<day);
 const days=[...new Set(obs.map(o=>o.day))].sort().slice(-7);
 const baseline=obs.filter(o=>days.includes(o.day));
 if(days.length<7||baseline.reduce((a,o)=>a+o.attempts,0)<60)throw Error('Not enough baseline before intervention date');
 return {...memory,interventions:[...memory.interventions,{id,skill:issue.skill,context:issue.context,protocol:issue.protocol,action:'Temporary additional five minutes per balanced session',status:'proposed',proposedDay:day,baselineIds:baseline.map(o=>o.id),reason:issue.hypotheses,reviewAfterDays:14,maximumDays:21}]};
}
export function respond(memory,id,decision,day){
 if(!dateOk(day)||!['accepted','declined'].includes(decision))throw Error('Invalid response');
 const item=memory.interventions.find(i=>i.id===id);
 if(!item||item.status!=='proposed'||day<item.proposedDay)throw Error('Intervention is not awaiting response');
 if(decision==='accepted'&&memory.interventions.some(i=>i.status==='accepted'))throw Error('Another intervention is active');
 return {...memory,interventions:memory.interventions.map(i=>i.id===id?{...i,status:decision,responseDay:day}:i)};
}
export function review(memory,id,day,{adherence,confounders=[]}={}){
 const item=memory.interventions.find(i=>i.id===id);
 if(!item||item.status!=='accepted'||!dateOk(day)||day<item.responseDay||!Number.isFinite(adherence)||adherence<0||adherence>1||!Array.isArray(confounders)||confounders.some(c=>typeof c!=='string'||c.length>500))throw Error('Invalid intervention review');
 const age=daysBetween(item.responseDay,day);
 if(age<item.reviewAfterDays)return {status:'too-early',daysRemaining:item.reviewAfterDays-age};
 const before=memory.observations.filter(o=>item.baselineIds.includes(o.id)),after=memory.observations.filter(o=>o.skill===item.skill&&o.context===item.context&&o.protocol===item.protocol&&o.day>item.responseDay&&o.day<=day);
 if(before.length!==item.baselineIds.length)return {status:'baseline-edited'};
 if(!before.length||!after.length)return {status:'insufficient'};
 const fields={skill:item.skill,context:item.context,protocol:item.protocol};
 return evaluation({...fields,summary:summarise(before)},{...fields,summary:summarise(after)},{adherence,confounders});
}
export function finish(memory,id,day,details){
 const result=review(memory,id,day,details);
 if(!['observed-improvement','observed-decline','unclear','confounded'].includes(result.status))throw Error('Review incomplete: '+result.status);
 return {...memory,interventions:memory.interventions.map(i=>i.id===id?{...i,status:result.status==='observed-decline'||result.status==='unclear'?'unsuccessful':'completed',reviewDay:day,outcome:result,adherence:details.adherence,confounders:details.confounders??[]}:i)};
}
export function currentPlan(memory,report,day){
 if(['stop','reduce-load'].includes(report.decision))return {mode:report.decision,plan:[]};
 const i=memory.interventions.find(x=>x.status==='accepted');
 if(!i)return {mode:'balanced-until-accepted',plan:plan(),proposed:report.focus};
 const age=daysBetween(i.responseDay,day);
 if(!Number.isFinite(age)||age<0||age>=i.maximumDays)return {mode:'review-required',plan:plan(),intervention:i.id};
 const p=report.review?.profiles.find(p=>p.skill===i.skill&&p.context===i.context&&p.protocol===i.protocol);
 if(p?.hypotheses.some(h=>['fatigue','pressure','confidence'].includes(h.id)&&h.status==='supported-as-possibility'))return {mode:'review-context',plan:plan(),intervention:i.id};
 if(age>=i.reviewAfterDays)return {mode:'review-due',plan:plan(),intervention:i.id};
 return {mode:'accepted-temporary-focus',plan:plan(i.skill),intervention:i.id,daysUntilReview:i.reviewAfterDays-age};
}
