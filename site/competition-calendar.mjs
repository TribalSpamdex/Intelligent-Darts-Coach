// Local competition intentions; no calendar account, network or automatic
// training changes. A dated event is a player-reported plan, not a result.
import {dayValid,dayGap} from './engine/context.mjs';
import {stageProfiles,stageTransfer} from './match-stages.mjs';
export function validateEvents(rows=[]){
 if(!Array.isArray(rows)||rows.length>5000)throw Error('Invalid competition history');
 const seen=new Set();
 return rows.map(x=>{
  if(!x||typeof x.id!=='string'||!/^[A-Za-z0-9-]{1,100}$/.test(x.id)||seen.has(x.id)||!dayValid(x.day)||!dayValid(x.recordedDay)||x.recordedDay>x.day||dayGap(x.recordedDay,x.day)>366||typeof x.name!=='string'||!x.name.trim()||x.name.length>100||!['league','tournament','friendly','other'].includes(x.kind))throw Error('Invalid competition event');
  seen.add(x.id);return {id:x.id,day:x.day,recordedDay:x.recordedDay,name:x.name.trim(),kind:x.kind};
 });
}
export function addEvent(rows,event,today){
 if(!dayValid(today)||!dayValid(event?.day)||event.day<today||dayGap(today,event.day)>366)throw Error('Choose a competition date within the next year');
 return validateEvents([...validateEvents(rows),{...event,recordedDay:today}]);
}
export function removeEvent(rows,id){
 const events=validateEvents(rows);if(!events.some(x=>x.id===id))throw Error('Unknown competition');
 return events.filter(x=>x.id!==id);
}
export function eventContext(rows,day){
 if(!dayValid(day))throw Error('Invalid review date');
 const events=validateEvents(rows).filter(x=>x.day>=day&&x.recordedDay<=day).sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id));
 const event=events[0]??null,days=event?dayGap(day,event.day):null;
 return {event,days,upcoming:events.slice(0,10),phase:days===null?'ordinary':days===0?'competition-day':days<=2?'near-event':days<=7?'event-week':'ordinary'};
}
export function eventLines(rows,day){
 const r=eventContext(rows,day);
 if(!r.event)return ['No upcoming competition recorded. Maintain your normal agreed practice.'];
 const guidance={'competition-day':'Prioritise a comfortable familiar warm-up and your normal match routine. No extra demanding session is prescribed.','near-event':'Keep equipment and technique familiar. Avoid introducing a demanding new experiment just before the event.','event-week':'Use familiar finishing and scoring practice, review your routine and allow recovery. Do not force extra practice.','ordinary':'Maintain normal balanced practice; review preparation closer to the event.'};
 return [...r.upcoming.map(e=>e.day+' · '+e.name+' ('+e.kind+')'),guidance[r.phase],'Player-entered schedule only. These preparation suggestions are advisory; no session is automatically added, cancelled or extended.'];
}

// Match-specific preparation uses actual comparable legs, not bot games,
// inferred intent, fixed-drill scores or a predicted tournament outcome.
const stageAdvice={
 'scoring-stage average':{floor:3,skill:'scoring',action:'Use a familiar scoring routine in ordinary legs and compare actual first-stage scoring. Avoid chasing individual high visits.'},
 'checkout visit conversion':{floor:.05,skill:'checkout',action:'Rehearse familiar legal finishing routes and recovery after a missed first dart, then record actual checkout visits.'},
 'setup leave conversion':{floor:.08,skill:'setup',action:'Practise leaving legal finishes from 171–350 in normal legs; review choices rather than assuming poor mechanics.'},
 'checkout bust rate':{floor:.05,skill:'checkout',action:'Review remaining score, legal routes and bust decisions in familiar legs.'},
 'explicit finishing doubles':{floor:.05,skill:'doubles',action:'Use familiar finishing doubles and record intended targets consistently in real legs. Do not infer missed doubles from total scores.'}
};
export function competitionPreparation(state,events,day,{report=null}={}){
 const event=eventContext(events,day),limit='Advisory only. Event format and opponent strength are not assumed. No extra practice, technique change or predicted match result.';
 const base={event,focus:null,alternatives:[],limitation:limit};
 const recent=(x,n)=>dayValid(x?.day)&&dayGap(x.day,day)>=0&&dayGap(x.day,day)<n;
 const pain=[...(state.clinic??[]),...(state.readiness??[])].some(x=>recent(x,7)&&x.pain===true);
 const fatigue=(state.readiness??[]).some(x=>recent(x,1)&&x.fatigue==='high');
 if(pain||fatigue||['stop','reduce-load'].includes(report?.decision))return {...base,status:'wellbeing',action:pain||report?.decision==='stop'?'Avoid aggravating throwing; seek qualified advice for significant or persistent discomfort.':'Review readiness and allow recovery before demanding practice.'};
 if(report?.verification?.status!=='passed')return {...base,status:'unverified',action:'Keep preparation familiar while the coaching evidence is reviewed.'};
 if(event.phase==='competition-day'||event.phase==='near-event')return {...base,status:'familiar-routine',action:'Use a comfortable familiar warm-up, known equipment and normal match routine. No new experiment close to competition.'};
 if((state.interventions??[]).some(x=>x.status==='accepted'||x.status==='proposed')||(state.trials??[]).some(x=>x.status==='active')||report.decision!=='balanced')return {...base,status:'existing-priority',action:'Review the existing coaching priority; do not introduce a second competing adjustment.'};
 const profiles=stageProfiles(state.legs??[],day),comparisons=stageTransfer(profiles,day);
 const candidates=[];
 for(const c of comparisons){
  const spec=stageAdvice[c.metric];if(!spec||c.status!=='observed-gap'||!Number.isFinite(c.difference))continue;
  const worse=c.metric==='checkout bust rate'?c.difference:-c.difference;if(worse<spec.floor)continue;
  const p=profiles.profiles.find(x=>x.start===c.start&&x.context==='practice'),q=profiles.profiles.find(x=>x.start===c.start&&x.context==='competition');
  // Both contexts must still have recent actual records for this metric.
  const attempts=(x)=>c.metric==='scoring-stage average'?x.scoring.darts:c.metric==='setup leave conversion'?x.setup.attempts:c.metric==='explicit finishing doubles'?x.aim.completeLegAttempts:x.checkout.visits;
  const recentDays=x=>x.daily.filter(d=>dayGap(d.day,day)<28&&attempts(d)>0).length;
  if(recentDays(p)<2||recentDays(q)<2)continue;
  // An opposing clear gap at another start score vetoes generalising the
  // metric. Preserve rule-specific differences rather than pooling them.
  if(comparisons.some(x=>x.metric===c.metric&&x.start!==c.start&&x.status==='observed-gap'&&Math.sign(x.difference)!==Math.sign(c.difference)))continue;
  candidates.push({start:c.start,metric:c.metric,skill:spec.skill,difference:c.difference,units:c.units,pairedWeeks:c.pairedWeeks,daysA:c.daysA,daysB:c.daysB,attemptsA:c.attemptsA,attemptsB:c.attemptsB,severity:worse/spec.floor,action:spec.action});
 }
 candidates.sort((a,b)=>b.pairedWeeks-a.pairedWeeks||b.severity-a.severity||a.start-b.start||a.metric.localeCompare(b.metric));
 if(!candidates.length)return {...base,status:'insufficient',action:'No fresh, supported adverse practice-to-competition stage gap is established. Keep normal balanced preparation and record comparable real legs.'};
 const focus=candidates[0];
 return {...base,status:'measured-priority',focus,alternatives:candidates.slice(1),action:focus.action};
}
// Shared planning constraint for the actual native scheduler. A dated
// competition can change eligible choices, not create a second session.
export function competitionSchedulePolicy(state,events,day,report){
 const event=eventContext(events,day),phase=event.phase;
 if(phase==='ordinary')return {phase,focus:null,familiar:false,deferEscalation:false,eventId:null};
 const prep=competitionPreparation(state,events,day,{report});
 const close=phase==='near-event'||phase==='competition-day';
 const focus=phase==='event-week'&&prep.status==='measured-priority'?(prep.focus.skill==='setup'?'checkout':prep.focus.skill):null;
 return {phase,focus,familiar:close,deferEscalation:close,eventId:event.event.id,reason:prep.action};
}
export function competitionPreparationLines(p){
 const x=p.focus;
 return [...(p.event.event?['Next competition: '+p.event.event.day+' · '+p.event.event.name+'.']:['No upcoming competition recorded.']),...(x?[x.start+' straight-in · '+x.metric+': competition minus practice '+(x.units==='points'?x.difference:100*x.difference).toFixed(1)+' '+x.units+' across '+x.pairedWeeks+' matched weeks and '+x.daysA+'/'+x.daysB+' measured days. The logged leg format may differ from the next event.']:[]),p.action,p.limitation,'Observed context differences do not establish pressure or technique as the cause.'];
}
