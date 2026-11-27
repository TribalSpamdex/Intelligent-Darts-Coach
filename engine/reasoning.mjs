import {SKILLS, assessments, investigate, plan} from './engine.mjs';
import {relevant} from './knowledge.mjs';
export const categories=['stance','balance','grip','alignment','aiming','drawback','tempo','release','follow-through','shoulder','elbow','wrist','tension','head movement','equipment','fatigue','pressure','target mechanics'];
export function technicalInvestigation({skill, symptom='', conditions=[], pain=false}){
 if(!SKILLS.includes(skill)||typeof symptom!=='string'||!Array.isArray(conditions)||typeof pain!=='boolean')throw Error('Invalid investigation');
 if(pain)return {decision:'stop',action:'Stop the aggravating activity. Seek qualified medical advice for persistent or significant pain.',hypotheses:[],unknowns:['Cause of pain'],sources:[]};
 return {decision:'collect-evidence',symptom,conditions,hypotheses:categories.map(category=>({category,status:'unresolved',support:[],contradictions:[]})),unknowns:['Repeated target-specific measurements','Comparable conditions','Whether a recent change preceded the problem'],action:'Record baseline and test one variable at a time only when supported; do not change equipment or mechanics solely because of a miss direction.',sources:relevant(skill).map(x=>x.id)};
}
export function evaluation(before,after,{adherence=null,confounders=[]}={}){
 if(!before||!after||before.skill!==after.skill||before.context!==after.context||before.protocol!==after.protocol)return {status:'not-comparable'};
 if(before.summary.days<7||after.summary.days<7||before.summary.attempts<60||after.summary.attempts<60)return {status:'insufficient'};
 const delta=after.summary.dayMean-before.summary.dayMean;
 const noise=2*Math.sqrt(before.summary.daySD**2/before.summary.days+after.summary.daySD**2/after.summary.days);
 const threshold=['scoring','firstNine'].includes(before.skill)?3:.05;
 if(adherence===null||adherence<.8||confounders.length)return {status:'confounded',delta,noise,adherence,confounders};
 return {status:delta>=Math.max(threshold,noise)?'observed-improvement':delta<=-Math.max(threshold,noise)?'observed-decline':'unclear',delta,noise,causality:'not established',retention:'requires a later independent follow-up'};
}
export function executive(memory){
 const report=investigate(memory);
 return {...report,issues:report.issues.map(i=>({...i,knowledge:relevant(i.skill).map(k=>k.id)})),knowledgePolicy:'Only official rules and source-labelled research summaries; local policies are not scientific findings.'};
}
