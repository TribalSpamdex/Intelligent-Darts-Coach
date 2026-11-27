import {knowledge} from './knowledge.mjs';
import {personalApproachReview} from './session-intelligence.mjs';
export const skillName=s=>({firstNine:'First-nine scoring',bull:'Bull accuracy',warmup:'Warm-up'}[s]??(typeof s==='string'?s.charAt(0).toUpperCase()+s.slice(1):'Unknown'));
const scoring=s=>['scoring','firstNine'].includes(s);
const fmt=n=>Number.isFinite(n)?Number(n.toFixed(1)).toString():'Not available';
const value=(skill,n)=>Number.isFinite(n)?fmt(scoring(skill)?n:n*100)+(scoring(skill)?' average':'%'):'Not available';
export function relevantPrinciples(issue,m){
 const ids=new Set(['context','retention','learning-performance']);
 const hypotheses=issue.investigation?.hypotheses??[];
 for(const h of hypotheses){
 if(h.status==='unresolved'||h.status==='less-supported')continue;
 const map={practice:['challenge-point','professional-doubles-bunting','coach-balanced-routine'],fatigue:['coach-balanced-routine','fatigue-mental','fatigue-muscular'],pressure:['professional-pressure','pre-performance-routine'],confidence:['process-goals','pre-performance-routine','self-directed-feedback'],equipment:['equipment-isolation','single-variable','dart-flight'],technique:['motor-strategies','darts-focus-review','single-variable','release-coordination','joint-torque'],target:['miss-direction','professional-doubles-bunting'],measurement:['context']};
 for(const id of map[h.id]??[])ids.add(id);
 }
 return knowledge.filter(k=>ids.has(k.id)&&k.skill.includes(issue.skill)).map(k=>({id:k.id,principle:k.principle,application:k.intervention,limitation:k.limitations,sourceType:k.level}));
}
export function issueExplanation(issue,m){
 const e=issue.evidence,a=e?.earlier,b=e?.recent,investigation=issue.investigation;
 const evidence=a&&b?{earlier:value(issue.skill,a.value),recent:value(issue.skill,b.value),difference:fmt((b.value-a.value)*(scoring(issue.skill)?1:100))+(scoring(issue.skill)?' average points':' percentage points'),samples:[a.attempts,b.attempts],days:[a.days,b.days]}:null;
 return {title:skillName(issue.skill)+' · '+issue.context,protocol:issue.protocol,evidence,summary:evidence?'The recorded result changed from '+evidence.earlier+' to '+evidence.recent+' ('+evidence.difference+').':'There is not enough comparable measured evidence.',hypotheses:(investigation?.hypotheses??[]).map(h=>({...h,statusLabel:({'supported-possibility':'Evidence supports investigating this','mixed':'Conflicting evidence','less-supported':'Less supported by current evidence','unresolved':'Not yet established'})[h.status]})),questions:investigation?.questions??[],principles:relevantPrinciples(issue,m),personal:personalApproachReview(m,issue.skill,issue.protocol,issue.context),followUp:issue.confirmation?.status!=='confirmed'&&!investigation?.veto?'Recent deterioration is not yet confirmed across multiple subperiods. Maintain balanced practice and repeat the fixed benchmark before changing workload.':investigation?.veto==='comfort'?'Stop the aggravating activity.':investigation?.veto==='measurement'?'Repeat the same benchmark under matched conditions before changing training.':issue.action==='temporary-focus'?'Consider a temporary five-minute reallocation within balanced practice, with consent and a matched review.':'Collect the missing evidence and preserve the current comfortable setup until the cause is better understood.',confirmation:issue.confirmation?.status??'unknown',allocation:investigation?.exposure,targets:investigation?.targets??[]};
}
export function explainReport(report,m){
 let reason={balanced:'Maintain balanced practice. No sufficiently supported current decline requires a focused intervention.',investigate:'Investigate the evidence before changing training.', 'temporary-focus':'Consider temporary focused practice on '+skillName(report.focus)+'. Balanced practice continues until you accept a recommendation.',stop:'Stop normal throwing practice for now.', 'reduce-load':'Consider rest or reduced practice today.'}[report.decision]??'Collect more evidence.';
 if(report.decision==='balanced'&&report.sparseDeclines?.length){
  const descriptions=report.sparseDeclines.slice(0,3).map(o=>skillName(o.skill)+' ('+o.context+'; '+o.protocol+'): '+value(o.skill,o.earlier)+' to '+value(o.skill,o.recent)+' ('+fmt(o.change*(scoring(o.skill)?1:100))+(scoring(o.skill)?' average points':' percentage points')+'); '+o.attempts[0]+' and '+o.attempts[1]+' attempts on two measured days.');
  reason=descriptions.join(' ')+' This is an observed decline, not a confirmed trend or diagnosis. Were the target mix and conditions comparable? Any unusual fatigue or pressure? Repeat the same familiar benchmark on additional separate days within normal practice. Do not change equipment, technique or training allocation solely on these two results.';
 }
 return {reason,decision:report.decision,issues:report.issues.map(i=>issueExplanation(i,m)),wellbeing:report.review?.wellbeing?.action??null,limitations:['Measured associations do not prove a cause.','Difficulty and decision thresholds are provisional engineering policies.']};
}
