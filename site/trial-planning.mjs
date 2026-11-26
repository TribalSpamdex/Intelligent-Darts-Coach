// Advisory one-variable comparison design. Does not schedule, record,
// accept, start or alter a training trial.
import {dayValid,dayGap} from './engine/context.mjs';
import {trainingOutcomes} from './training-outcomes.mjs';
import {developmentAgenda} from './development-review.mjs';
import {settingKey} from './challenge-setting.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const format=s=>s.name+' · '+s.field+' '+(Array.isArray(s.after)?s.after.join('/'):s.after);
export function nextComparison(host,state,day,now=Date.now(),provided=null){
 if(!dayValid(day))throw Error('Invalid comparison date');
 const agenda=developmentAgenda(host,state,day,{now});
 if(agenda.wellbeing)return {status:'wellbeing',reason:agenda.actions[0].next};
 if((state.interventions??[]).some(i=>['proposed','accepted'].includes(i.status)&&i.proposedDay<=day)||(state.trials??[]).some(t=>t.status==='active'&&t.start<=day))return {status:'existing-change',reason:'Review the existing intervention or trial before introducing another variable.'};
 const report=provided??trainingOutcomes(host,state,day,now);
 const goals=agenda.goals.filter(g=>g.context==='practice'&&g.status!=='target-observed');
 const relevant=c=>goals.some(g=>g.skill===c.skill&&g.protocol===c.protocol);
 const current=report.comparisons.filter(c=>c.pairs>=2&&c.latest&&dayGap(c.latest,day)<=28&&dayGap(c.latest,day)>=0);
 // Coverage and relevance, never outcome magnitude, decide which one
 // investigation is most informative. No extrapolated effect size.
 const candidates=current.sort((a,b)=>Number(relevant(b))-Number(relevant(a))||b.pairs-a.pairs||b.weeks-a.weeks||b.latest.localeCompare(a.latest)||a.first.localeCompare(b.first)||a.second.localeCompare(b.second));
 const c=candidates[0];
 if(!c){
  const lead=agenda.actions.find(a=>['coverage','stale','goal-evidence','review-coverage'].includes(a.kind));
  return {status:'collect-baseline',reason:'Not enough comparable training contrasts to choose a specific experiment.',skill:lead?.skill??null,protocol:lead?.protocol??null,next:lead?.next??'Keep normal training and repeat a fixed skill check on separate days.'};
 }
 const dose=c.kind==='dose';
 const durations=c.matched.map(m=>[m.aSeconds,m.bSeconds]);
 const observed={first:[Math.min(...durations.map(x=>x[0])),Math.max(...durations.map(x=>x[0]))],second:[Math.min(...durations.map(x=>x[1])),Math.max(...durations.map(x=>x[1]))]};
 return {status:'comparison-candidate',skill:c.skill,protocol:c.protocol,kind:c.kind,first:c.firstSetting,second:c.secondSetting,observed,existingPairs:c.pairs,existingWeeks:c.weeks,priorStatus:c.status,goalRelevant:relevant(c),variable:dose?'recorded duration at the same exact rule':'exercise choice at comparable recorded duration',reason:'This is a recent, repeatable comparison with recorded coverage'+(relevant(c)?' and relevance to an active measured goal.':'.'),constraints:['Keep the rest of normal scheduled practice, equipment and routine unchanged where practical.','Repeat the identical fixed benchmark on separate days before and 2–8 days after the exercise; do not reuse benchmark endpoints.','Alternate chronological order across independent comparable periods; keep actual measured dose, rule, conditions and any other practice recorded.','Do not force fatigue, extra training time, a change in technique or an uncomfortable challenge. Stop or postpone if needed.','Review at least six matched pairs across six weekly blocks, including both orders; this is an evidence target, not a deadline.'],limitation:'Suggested one-variable comparison only. The coach has not started a trial or changed the session plan. Observational results remain confounded; no guarantee of improvement.'};
}
export function comparisonPlanLines(p){
 if(p.status!=='comparison-candidate')return [p.reason,...(p.skill?['Suggested measured skill: '+p.skill+(p.protocol?' · '+p.protocol:'')+'.']:[]),...(p.next?[p.next]:[])];
 const minutes=x=>(x[0]/60).toFixed(1)+'–'+(x[1]/60).toFixed(1)+' min observed';
 return [p.reason,p.skill+' · '+p.protocol,'Compare '+p.variable+'.','A: '+format(p.first)+' · '+minutes(p.observed.first)+'.','B: '+format(p.second)+' · '+minutes(p.observed.second)+'.',p.existingPairs+' existing matched pairs over '+p.existingWeeks+' weekly blocks; prior evidence '+p.priorStatus.replaceAll('-',' ')+'.',...p.constraints,p.limitation];
}
