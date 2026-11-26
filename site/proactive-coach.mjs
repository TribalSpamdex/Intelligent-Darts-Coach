// A single actionable coaching prompt, not an extra automatic planner.
import {dayValid,dayGap} from './engine/context.mjs';
import {developmentAgenda} from './development-review.mjs';
import {eventContext} from './competition-calendar.mjs';
import {reflectionInsights} from './reflections.mjs';
import {deliveryGate,methodReviews,methodReviewGate} from './coaching-accountability.mjs';
const same=(a,b)=>a.skill===b.skill&&a.context===b.context&&a.protocol===b.protocol;
export function coachBrief(host,state,report,events,reflections,day,now=Date.now()){
 if(!dayValid(day))throw Error('Invalid coaching brief date');
 const event=eventContext(events,day),agenda=developmentAgenda(host,state,day,{report,now});
 const safety=agenda.wellbeing;
 const response=(kind,title,detail,extra={})=>({kind,title,detail,event,...extra});
 if(safety)return response('wellbeing','Readiness takes priority',agenda.actions[0].next);
 const open=(state.interventions??[]).find(i=>i.proposedDay<=day&&((i.status==='proposed'&&(!i.responseDay||i.responseDay>day))||(i.status==='accepted'&&dayValid(i.responseDay)&&i.responseDay<=day)));
 const shortfall=open?.status==='accepted'?deliveryGate(host,open,day,now):null;
 if(open){
  const due=open.status==='accepted'&&dayGap(open.responseDay,day)>=open.reviewAfterDays;
  if(due||report?.active?.mode==='baseline-edited'||report?.active?.mode?.startsWith('review-'))return response('intervention-review','Review your existing coaching adjustment','Review the original benchmark, actual delivery, reported adherence and changes before another adjustment.',{intervention:open.id});
  if(shortfall?.defer)return response('intervention-review','Review how the adjustment fits your practice',shortfall.reason+' Check whether the planned drill fits your available time and routine. Nothing is extended automatically.',{intervention:open.id});
  if(open.status==='proposed')return response('consent','A coaching adjustment is awaiting your decision','Review its current evidence before accepting or declining. Nothing changes without consent.',{intervention:open.id});
 }
 if(event.phase==='competition-day'||event.phase==='near-event')return response('competition','Prepare for '+event.event.name,'Keep the normal comfortable routine and avoid introducing a new experiment just before competition.');
 if(report?.verification?.status==='passed'&&report.decision!=='stop'){
  const questions=(report.strategy?.agenda?.questions??[]).filter(q=>{
   const previous=(state.answers??[]).filter(a=>same(a,q.scope)&&a.question===q.id&&dayGap(a.day,day)>=0&&dayGap(a.day,day)<7);
   return !previous.length;
  });
  // At most one new diagnostic prompt per day across all skills. A yes/no
  // answer remains player report; it must not become a measured outcome.
  const answeredToday=(state.answers??[]).some(a=>a.day===day);
  if(!answeredToday&&questions.length){
   const q=questions[0];return response('question','One useful check',q.text,{question:{id:q.id,scope:q.scope,answers:[...q.answers]},why:q.why});
  }
 }
 if(open?.status==='accepted'){
  const supported=report?.verification?.status==='passed'&&report.active?.mode==='accepted-temporary-focus'&&report.active.intervention===open.id;
  return supported?response('active','Continue the agreed training adjustment','Keep the rest of practice stable and review on the agreed date.',{intervention:open.id}):response('intervention-review','Check the existing adjustment','The current independent recommendation does not confirm continued allocation. Keep practice balanced and review the evidence before repeating the change.',{intervention:open.id});
 }
 const due=agenda.actions.find(a=>a.kind==='review-goal');
 if(due)return response('goal','A measured goal is due for review',due.reason+' '+due.next);
 if(report?.verification?.status==='passed'&&report.decision==='temporary-focus')return response('focus','Review a supported training focus','The independent engine has confirmed a change worth investigating. Review the evidence before making an optional adjustment.');
 const concern=reflectionInsights(reflections??[],host,day).repeated[0];
 if(concern)return response('reflection','A recurring practice observation',concern.question+' This is player-reported context, not a diagnosis.');
 const deferred=methodReviewGate(methodReviews(host,state,day,now),day)[0];
 if(deferred)return response('method-review','Review a personalised drill choice',deferred.reason+' Keep the ordinary planner for this method while its evidence is reviewed.');
 const lead=agenda.actions.find(a=>['investigate-decline','recent-form','review-stable-training','stale','goal-evidence','review-coverage'].includes(a.kind));
 if(lead)return response('development','Current development priority',lead.skill+': '+lead.reason+' '+lead.next);
 if(event.phase==='event-week')return response('competition','Competition this week','Keep familiar scoring and finishing practice and allow recovery. No additional workload is prescribed.');
 return response('balanced','Maintain your balanced practice','Continue your usual session and record comparable checks when practical. No new adjustment is justified.');
}
export function briefLines(b){return [b.title,b.detail,...(b.why?[b.why]:[]),'One priority at a time. The coach has not altered your session or created a new player fact.'];}
