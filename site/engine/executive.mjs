import {plan} from './engine.mjs';
import {dayGap,dayValid} from './context.mjs';
import {executive} from './reasoning.mjs';
import {selectCoaching} from './player-intelligence.mjs';
import {deepenReport} from './diagnosis.mjs';
import {clinicReview} from './clinic.mjs';
import {resolvePriorities,developmentReview} from './strategy.mjs';
import {combinedExposure} from './goals.mjs';
import {currentPlan} from './interventions.mjs';
import {knowledge} from './knowledge.mjs';
import {enforceDecision} from './verification.mjs';
import {followupReview} from './followup.mjs';
import {legEvidence,legSummary} from './match.mjs';
import {targetComparison,directionReview} from './target-analysis.mjs';
const same=(a,b)=>a.skill===b.skill&&a.protocol===b.protocol&&a.context===b.context;
export function safetyReview(m,day){
 const flags=[];
 for(const o of (m.clinic??[]).filter(x=>x.pain&&dayGap(x.day,day)>=0&&dayGap(x.day,day)<7))flags.push({source:'technical observation',day:o.day,id:o.id});
 for(const t of (m.trials??[]))for(const p of t.pairs.filter(x=>x.discomfort&&dayGap(x.day,day)>=0&&dayGap(x.day,day)<7))flags.push({source:'controlled experiment',day:p.day,id:t.id});
 return {stop:flags.length>0,flags};
}
const knowledgeMap={
 practice:['challenge-point','learning-performance','interleaving-retention','coach-balanced-routine'],
 fatigue:['fatigue-mental','fatigue-muscular','warmup-calibration'],
 pressure:['professional-pressure','pre-performance-routine','process-goals'],
 confidence:['self-directed-feedback','process-goals'],
 equipment:['dart-flight','equipment-isolation','single-variable'],
 technique:['release-coordination','joint-torque','motor-strategies','single-variable'],
 target:['miss-direction','individual-aiming'],
 measurement:['context','warmup-calibration','learning-performance']
};
export function actionOptions(m,i,day){
 const hypotheses=i.investigation.hypotheses;
 const rows=[{id:'benchmark',title:'Repeat a comparable benchmark',kind:'measure',why:'Confirm that the deterioration persists on the same task.',risk:'low',sources:['context','retention'],condition:'Keep protocol, target and conditions stable.'}];
 for(const h of hypotheses.filter(h=>['supported-possibility','mixed'].includes(h.status))){
 const configs={
 practice:['Compare practice allocation','training','Record actual minutes and repeat the original benchmark.'],
 fatigue:['Compare rested and affected days','measure','Do not deliberately induce fatigue; use naturally occurring conditions.'],
 pressure:['Compare practice and match contexts','measure','Keep each context separate; do not deliberately increase distress.'],
 confidence:['Compare a comfortable routine','experiment','Try one optional cue only when comfortable.'],
 equipment:['Compare the known comfortable setup','experiment','One known variable; stop if uncomfortable.'],
 technique:['Observe the existing throw first','observe','A matched technical observation precedes any mechanical change.'],
 target:['Repeat specific target samples','measure','Use the same number of darts and same target definitions.'],
 measurement:['Standardise measurement conditions','measure','Do not treat the previous incompatible samples as a trend.']
 };
 const c=configs[h.id];if(c)rows.push({id:h.id,title:c[0],kind:c[1],why:h.support.join(' '),condition:c[2],risk:c[1]==='experiment'?'controlled-change':'low',sources:knowledgeMap[h.id]??[]})
 }
 if(i.action==='temporary-focus')rows.push({id:'focus',title:'Consider a temporary practice adjustment',kind:'training',why:'Current deterioration passed the confirmation gate.',risk:'controlled-change',sources:['challenge-point','retention'],condition:'One accepted focus only, with a review deadline.'});
 if(i.clinic?.priority)rows.push({id:'clinic',title:'Investigate '+i.clinic.priority,kind:'observe',why:'A relevant structured observation was recorded.',risk:'low',condition:i.clinic.next,sources:['release-coordination','single-variable']});
 const prior=i.strategy?.ledger?.blocked??[];
 const filtered=rows.filter(a=>!(a.id==='focus'&&prior.some(p=>p.kind==='training-allocation')));
 return filtered.map(a=>({...a,sources:a.sources.map(id=>knowledge.find(k=>k.id===id)).filter(Boolean).map(k=>({id:k.id,principle:k.principle,limitation:k.limitations,level:k.level}))}));
}
export function fullReport(m,day){
 if(!dayValid(day))throw Error('Invalid report date');
 const derived=legEvidence(m,day),reserved=new Set(derived.map(o=>o.id));const observations=[...m.observations.filter(o=>!reserved.has(o.id)),...derived];
 const visible={...m,observations:observations.filter(o=>dayGap(o.day,day)>=0&&dayGap(o.day,day)<84),exposure:combinedExposure(m).filter(o=>o.day<=day),interventions:m.interventions.filter(i=>i.proposedDay<=day||!i.proposedDay)};
 let report=deepenReport(visible,selectCoaching(visible,executive(visible),day),day);
 const safety=safetyReview(visible,day);
 const issues=report.issues.map(i=>{const clinic=clinicReview(visible,i,day);const hasObservation=clinic.hypotheses.some(h=>['corroborated-observation','mixed'].includes(h.status));const targets=i.investigation?.targets??[],targetEvidence=targets.length>=2?targetComparison(visible,{first:targets[0].aim,second:targets.at(-1).aim,context:i.context,protocol:i.protocol,day}):null;const directions=targets.slice(0,3).map(t=>directionReview(visible,{aim:t.aim,context:i.context,protocol:i.protocol,day}));return {...i,clinic,targetEvidence,directions,action:hasObservation||clinic.decision==='stop'||i.protocol.startsWith('Leg log ')?'investigate':i.action}});
 if(safety.stop)report={...report,decision:'stop',review:{...report.review,wellbeing:{decision:'stop',action:'Recent recorded discomfort takes priority. Stop aggravating practice and seek qualified advice for persistent or significant pain.'}}};
 report=resolvePriorities(visible,{...report,issues},day);
 report={...report,issues:report.issues.map(i=>({...i,actions:report.decision==='stop'?[]:actionOptions(visible,i,day)})),safety};
 // Use complete history for progress and learning, never pool unlike benchmarks.
 const development=developmentReview({...m,observations},report,day);
 const active=verifiedPlan(m,report,day);
 return enforceDecision(m,{...report,development,active,match:legSummary(m,day),learning:(m.trials??[]).filter(t=>t.status==='completed'&&t.pairs.every(p=>p.day<=day)).map(t=>({id:t.id,skill:t.skill,approach:t.approach,reviews:followupReview(m,t,day)})),trace:{decision:report.decision,primary:report.strategy.primary,safetyFlags:safety.flags,issues:report.issues.map(i=>({skill:i.skill,protocol:i.protocol,context:i.context,action:i.action,confirmation:i.confirmation?.status,veto:i.investigation?.veto??null,priorOutcome:i.strategy?.ledger?.policy??null})),policy:'Deterministic decision trace; no scientific probability assigned.'}});
}
export function verifiedPlan(m,report,day){
 const active=currentPlan(m,report,day);
 if(active.mode!=='accepted-temporary-focus')return active;
 const i=m.interventions.find(x=>x.id===active.intervention);
 const issue=report.issues.find(x=>same(x,i));
 const recentAnswers=(m.answers??[]).filter(x=>same(x,i)&&x.day>=i.responseDay&&x.day<=day).sort((a,b)=>a.day.localeCompare(b.day));
 const latest=new Map();for(const o of recentAnswers)latest.set(o.question,o.answer);
 const conflicting=latest.get('protocol')==='no'||['equipment','technique','fatigue','pressure'].some(q=>latest.get(q)==='yes');
 const changes=(m.changes??[]).some(x=>['equipment','technique','injury or discomfort'].includes(x.field)&&x.day>=i.responseDay&&x.day<=day);
 if(conflicting||changes||issue?.investigation?.veto||issue?.clinic?.decision==='investigate-one-variable'&&issue.clinic.hypotheses.some(h=>h.status==='corroborated-observation'))return {mode:'review-new-evidence',plan:plan(),intervention:i.id};
 return active;
}
export function canAccept(m,i,day){
 const report=fullReport(m,day);
 if(i.status!=='proposed'||dayGap(i.proposedDay,day)<0||dayGap(i.proposedDay,day)>7)return {allowed:false,reason:'Proposal is stale or no longer awaiting consent.'};
 if(report.decision!=='temporary-focus'||!same(report.strategy.primary??{},i)||!report.issues.some(x=>same(x,i)&&x.action==='temporary-focus'))return {allowed:false,reason:'New evidence no longer supports this focus. Reassess before accepting.'};
 return {allowed:true,reason:'Current evidence still supports consideration of this focus.'};
}
