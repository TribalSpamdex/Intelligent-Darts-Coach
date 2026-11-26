import {deliveryGate} from './coaching-accountability.mjs';
import {eventContext} from './competition-calendar.mjs';
// Final clock-budget transfer only; no game replacement, no additional minutes.
const skills=['scoring','doubles','checkout','bull'];
export function decideTransfer({report,confirmation,edited=[],memory,session,queue,legacyTransfer,legacyPolicy,priorSessions=[],day}){
 const no=reason=>({status:'unchanged',reason});
 if(!report||report.verification?.status!=='passed'||['stop','reduce-load'].includes(report.decision))return no('Independent recommendation not currently actionable');
 const event=eventContext(memory?.events??[],day);
 if(['competition-day','near-event'].includes(event.phase))return no('Defer additional independent allocation near a recorded competition');
 if(report.active?.mode!=='accepted-temporary-focus')return no('No accepted independent focus');
 const i=memory.state.interventions.find(o=>o.id===report.active.intervention&&o.status==='accepted');
 if(!i||edited.includes(i.id)||!skills.includes(i.skill)||i.context!=='practice')return no('Unsupported or corrected intervention baseline');
 if(deliveryGate({sessions:priorSessions},i,day).defer)return no('Repeated measured delivery shortfall; review existing adjustment');
 if(!confirmation||confirmation.verification?.status!=='passed'||confirmation.decision!=='temporary-focus'||confirmation.focus!==i.skill||confirmation.focusProtocol!==i.protocol||confirmation.focusContext!==i.context)return no('Current measurements no longer support the same focus');
 if(!session||session.quick||session.extra||session.allocated||session.unifiedAudit?.exploration?.trial||queue.some(e=>e.name==='Target Mastery'||e.dc47TrialId))return no('Preserve existing special session or trial');
 if(session.coachDayIntent?.focus||legacyTransfer?.status==='transferred'||legacyTransfer?.status!=='no-transfer')return no('Existing coaching adjustment takes priority');
 if(priorSessions.some(s=>s.date===day&&s.wholeSessionAudit?.idcTransfer?.status==='transferred'))return no('One independent transfer per day');
 const previous=priorSessions.filter(s=>s.date<=day&&Date.parse(day)-Date.parse(s.date)<7*86400000&&s.wholeSessionAudit?.idcTransfer?.status==='transferred');
 if(previous.length>=4)return no('Independent weekly allocation cap');
 const categories=legacyPolicy?.categories??{},target=categories[i.skill];
 if(!target||target.policySafety||target.overexposed||target.learning?.protect)return no('Existing workload protection');
 const eligible=queue.map((e,index)=>({e,index})).filter(({e})=>e.mode==='timed'&&e.wholeCoach&&skills.includes(e.wholeCoach.category)&&Number.isFinite(e.seconds)&&e.seconds>=300);
 const receiver=eligible.find(({e})=>e.wholeCoach.category===i.skill&&e.seconds<=900);
 const donor=eligible.filter(({e})=>e.wholeCoach.category!==i.skill&&e.seconds>=600&&categories[e.wholeCoach.category]&&!categories[e.wholeCoach.category].policySafety&&!categories[e.wholeCoach.category].learning?.protect&&!categories[e.wholeCoach.category].learning?.permissionToEscalate).sort((a,b)=>b.e.seconds-a.e.seconds||a.index-b.index)[0];
 if(!receiver||!donor)return no('No eligible five-minute transfer');
 const total=eligible.reduce((n,{e})=>n+e.seconds,0),targetSeconds=eligible.filter(({e})=>e.wholeCoach.category===i.skill).reduce((n,{e})=>n+e.seconds,0);
 if(targetSeconds+300>total*.5)return no('Preserve balanced category exposure');
 return {status:'transferred',reason:'Accepted independent focus; no competing legacy adjustment',intervention:i.id,skill:i.skill,from:donor.index,to:receiver.index,seconds:300,day};
}
export function applyTransfer(queue,decision){
 if(decision.status!=='transferred')return false;
 const a=queue[decision.from],b=queue[decision.to];if(!a||!b||a===b||a.seconds<600||b.seconds<300||b.seconds>900||decision.seconds!==300)throw Error('Invalid allocation');
 decision.delivery={version:1,donor:{name:a.name,before:a.seconds,after:a.seconds-300},receiver:{name:b.name,before:b.seconds,after:b.seconds+300}};
 a.seconds-=300;b.seconds+=300;a.wholeCoach.plannedMinutes=a.seconds/60;b.wholeCoach.plannedMinutes=b.seconds/60;return true;
}
