import {dayValid,dayGap} from './context.mjs';
import {trialOutcome} from './experiments.mjs';
import {fullReport} from './executive.mjs';
import {SKILLS} from './engine.mjs';
const scope=i=>({skill:i.skill,context:i.context,protocol:i.protocol});
export function nextActions(m,day,report=fullReport(m,day)){
 if(!dayValid(day))throw Error('Invalid review date');
 if(report.decision==='stop')return [{id:'wellbeing',kind:'safety',title:'Pause throwing practice',why:report.review.wellbeing.action}];
 if(report.decision==='reduce-load')return [{id:'wellbeing',kind:'safety',title:'Consider rest or reduced load',why:report.review.wellbeing.action}];
 const actions=[];
 const q=report.strategy.agenda.next;
 if(q)actions.push({id:'question',kind:'question',title:q.text,why:q.why,scope:q.scope,question:q.id,answers:q.answers});
 const active=m.interventions.find(i=>i.status==='accepted'&&i.responseDay<=day);
 if(active&&report.active.mode!=='accepted-temporary-focus')actions.push({id:'intervention:'+active.id,kind:'review',title:'Review the current '+active.skill+' intervention',why:'The existing focus is paused or its review is due. Do not start another intervention.',scope:scope(active)});
 const proposed=m.interventions.find(i=>i.status==='proposed'&&i.proposedDay<=day);
 if(proposed)actions.push({id:'intervention:'+proposed.id,kind:'review',title:'Review the outstanding '+proposed.skill+' proposal',why:'Explicit acceptance or decline is required; current evidence must still support it.',scope:scope(proposed)});
 for(const i of report.issues){
 const ordered=[...i.actions].sort((a,b)=>Number(a.kind==='experiment')-Number(b.kind==='experiment')||Number(a.id==='focus')-Number(b.id==='focus'));
 const option=ordered.find(a=>a.id!=='benchmark'&&a.id!=='focus')??ordered.find(a=>a.id==='benchmark');
 if(option)actions.push({id:'investigate:'+JSON.stringify(scope(i)),kind:'investigation',title:option.title,why:option.why+' '+option.condition,scope:scope(i),sources:option.sources.map(s=>s.id)});
 }
 if(report.decision==='temporary-focus'&&!active&&!proposed)actions.push({id:'consider-focus',kind:'proposal',title:'Consider a temporary focus on '+report.focus,why:'Current comparable measurements support consideration. Player consent is required.',scope:report.strategy.primary});
 for(const g of report.development.goals.filter(g=>g.progress.reviewDue))actions.push({id:'goal:'+g.id,kind:'review',title:'Review '+g.skill+' goal',why:'The planned review date has arrived. Compare with the fixed benchmark.',scope:scope(g)});
 for(const t of (m.trials??[]).filter(t=>t.status==='active'&&t.start<=day)){const result=trialOutcome(t);actions.push({id:'trial:'+t.id,kind:'experiment-review',title:result.status==='insufficient'?'Collect the next comparable paired result':'Review the controlled experiment',why:'Compare one variable; do not deliberately provoke discomfort.',scope:scope(t)})}
 if(!report.issues.length&&!actions.length)for(const skill of report.development.missingBenchmarks.slice(0,3))actions.push({id:'benchmark:'+skill,kind:'benchmark',title:'Establish a '+skill+' benchmark',why:'Insufficient recent comparable measurements. Keep training balanced.',skill});
 return actions.slice(0,12);
}
