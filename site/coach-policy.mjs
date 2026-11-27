import {deliveryGate} from './coaching-accountability.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
import {eventContext} from './competition-calendar.mjs';
// Final clock-budget transfer only; no game replacement, no additional minutes.
const skills=['scoring','doubles','checkout','bull'];
export function decideTransfer({report,confirmation,edited=[],memory,session,queue,legacyTransfer,legacyPolicy,priorSessions=[],day,referenceReview=null}){
 const no=reason=>({status:'unchanged',reason});
 if(!dayValid(day))return no('Invalid allocation date');
 if(!report||report.verification?.status!=='passed'||!['balanced','temporary-focus','investigate'].includes(report.decision))return no('Independent recommendation not currently actionable');
 const event=eventContext(memory?.events??[],day);
 if(['competition-day','near-event'].includes(event.phase))return no('Defer additional independent allocation near a recorded competition');
 if(report.active?.mode!=='accepted-temporary-focus')return no('No accepted independent focus');
 const interventions=memory?.state?.interventions;
 if(!Array.isArray(interventions)||interventions.filter(o=>o?.status==='accepted').length!==1)return no('No unique accepted intervention');
 const i=interventions.find(o=>o.id===report.active.intervention&&o.status==='accepted');
 if(!i||edited.includes(i.id)||!skills.includes(i.skill)||i.context!=='practice')return no('Unsupported or corrected intervention baseline');
 if(referenceReview&&(referenceReview.decision==='readiness'||referenceReview.conflicts.some(c=>c.focus.skill===i.skill)||referenceReview.profiles.some(p=>p.skill===i.skill&&p.context===i.context&&p.protocol===i.protocol&&p.status==='recovering')))return no('Current reference review requires resolving competing evidence or recovery before additional allocation');
 if(dayValid(i.responseDay)&&i.responseDay<=day&&deliveryGate({sessions:priorSessions},i,day).defer)return no('Repeated measured delivery shortfall; review existing adjustment');
 if(!dayValid(i.proposedDay)||!dayValid(i.responseDay)||i.responseDay<i.proposedDay||dayGap(i.responseDay,day)<0||!Number.isInteger(i.reviewAfterDays)||i.reviewAfterDays!==14||dayGap(i.responseDay,day)>=i.reviewAfterDays)return no('Accepted focus is outside its active review window');
 if(!confirmation||confirmation.verification?.status!=='passed'||confirmation.decision!=='temporary-focus'||confirmation.focus!==i.skill||confirmation.focusProtocol!==i.protocol||confirmation.focusContext!==i.context)return no('Current measurements no longer support the same focus');
 if(!session||session.quick!==false||session.extra!==false||session.allocated||session.unifiedAudit?.exploration?.trial||!Array.isArray(queue)||queue.some(e=>!e||e.name==='Target Mastery'||e.dc47TrialId))return no('Preserve existing special session or trial');
 if(session.coachDayIntent?.focus||session.coachComplement||legacyTransfer?.status==='transferred'||legacyTransfer?.status!=='no-transfer')return no('Existing coaching adjustment takes priority');
 if(priorSessions.some(s=>s?.date===day&&s.wholeSessionAudit?.idcTransfer?.status==='transferred'))return no('One independent transfer per day');
 const previous=priorSessions.filter(s=>dayValid(s?.date)&&dayGap(s.date,day)>=0&&dayGap(s.date,day)<7&&s.wholeSessionAudit?.idcTransfer?.status==='transferred');
 if(previous.length>=4)return no('Independent weekly allocation cap');
 const categories=legacyPolicy?.categories??{},target=categories[i.skill];
 if(!target||target.policySafety||target.overexposed||target.learning?.protect||target.learning?.permissionToEscalate)return no('Existing workload protection');
 if(new Set(queue).size!==queue.length||queue.some(e=>e.mode==='timed'&&(!Number.isInteger(e.seconds)||e.seconds<300||e.seconds>7200)))return no('Invalid native clock allocation');
 const eligible=queue.map((e,index)=>({e,index})).filter(({e})=>e.mode==='timed'&&e.wholeCoach&&skills.includes(e.wholeCoach.category)&&Number.isInteger(e.seconds)&&e.seconds>=300);
 const receiver=eligible.find(({e})=>e.wholeCoach.category===i.skill&&e.seconds<=900);
 const donor=eligible.filter(({e})=>e.wholeCoach.category!==i.skill&&e.seconds>=600&&categories[e.wholeCoach.category]&&!categories[e.wholeCoach.category].policySafety&&!categories[e.wholeCoach.category].learning?.protect&&!categories[e.wholeCoach.category].learning?.permissionToEscalate).sort((a,b)=>b.e.seconds-a.e.seconds||a.index-b.index)[0];
 if(!receiver||!donor)return no('No eligible five-minute transfer');
 const total=eligible.reduce((n,{e})=>n+e.seconds,0),targetSeconds=eligible.filter(({e})=>e.wholeCoach.category===i.skill).reduce((n,{e})=>n+e.seconds,0);
 if(targetSeconds+300>total*.5)return no('Preserve balanced category exposure');
 return {status:'transferred',reason:'Accepted independent focus; no competing legacy adjustment',intervention:i.id,skill:i.skill,from:donor.index,to:receiver.index,seconds:300,day};
}
export function applyTransfer(queue,decision){
 if(decision.status!=='transferred')return false;
 if(!Array.isArray(queue)||!Number.isInteger(decision.from)||!Number.isInteger(decision.to)||decision.from<0||decision.to<0||!skills.includes(decision.skill)||!dayValid(decision.day))throw Error('Invalid allocation');
 const a=queue[decision.from],b=queue[decision.to];if(!a||!b||a===b||a.mode!=='timed'||b.mode!=='timed'||!skills.includes(a.wholeCoach?.category)||b.wholeCoach?.category!==decision.skill||a.wholeCoach.category===b.wholeCoach.category||typeof a.name!=='string'||typeof b.name!=='string'||a.name===b.name||!Number.isInteger(a.seconds)||!Number.isInteger(b.seconds)||a.seconds<600||a.seconds>7200||b.seconds<300||b.seconds>900||decision.seconds!==300||decision.delivery)throw Error('Invalid allocation');
 decision.delivery={version:1,donor:{name:a.name,before:a.seconds,after:a.seconds-300},receiver:{name:b.name,before:b.seconds,after:b.seconds+300}};
 a.seconds-=300;b.seconds+=300;a.wholeCoach.plannedMinutes=a.seconds/60;b.wholeCoach.plannedMinutes=b.seconds/60;return true;
}
