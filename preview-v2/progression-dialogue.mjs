import {challengeLearning,learningLines} from './challenge-learning.mjs';
import {progressEvidence,progressionLines,abilityProfiles,abilityProfileLines} from './progression-evidence.mjs';
import {actualLegObservations} from './match-statistics.mjs';
import {precisionAudit,precisionAuditLines} from './precision-audit.mjs';
const skills={scoring:'scoring',doubles:'doubles',checkout:'checkout',bull:'bull',singles:'singles',trebles:'trebles','first nine':'firstNine',switching:'switching',setup:'setup',pressure:'pressure',grouping:'grouping'};
export function progressionAnswer(host,state,q,day){
 const m=q.match(/^(?:progression|my milestones|progress milestones)(?: (scoring|doubles|checkout|bull|singles|trebles|first nine|switching|setup|pressure|grouping))?$/);
 if(m)return {kind:'answer',type:'progression',lines:progressionLines(progressEvidence([...state.observations,...actualLegObservations(state.legs??[],day)],day),m[1]?skills[m[1]]:null)};
 if(q==='which difficulty helps me improve?'||q==='which difficulty helps me improve'||q==='difficulty learning')return {kind:'answer',type:'difficulty-learning',lines:learningLines(challengeLearning(host,state,day))};
 if(['my ability profile','ability profile','current form','am i improving?','am i improving'].includes(q))return {kind:'answer',type:'ability-profile',lines:abilityProfileLines(abilityProfiles(state.observations,day))};
 if(q==='challenge progression')return {kind:'answer',type:'challenge-progression',lines:precisionAuditLines(precisionAudit(host.games,day))};
 return null;
}
export const PROGRESSION_QUESTIONS=['My milestones','My ability profile','Progression doubles','Challenge progression','Which difficulty helps me improve?'];
export function milestoneCards(state,day){
 return progressEvidence([...state.observations,...actualLegObservations(state.legs??[],day)],day).filter(r=>r.band).map(r=>{
 const units=['scoring','firstNine'].includes(r.skill)?'':'%',f=v=>v===null?'Not confirmed':v.toFixed(1)+units;
 return {title:r.skill+' · '+r.context+' · '+r.protocol,metrics:[{label:'Recent median',value:f(r.value)},{label:'Confirmed milestone',value:f(r.confirmedMilestone)},{label:'Next milestone target',value:r.confirmedMilestone===null?'Awaiting evidence':r.nextMilestone===null?'Maximum':f(r.nextMilestone)},{label:'Measured days',value:String(r.days)},{label:'Observed range',value:r.band.lower+'–'+r.band.upper+units}],detail:[r.attempts+' attempts on '+r.days+' days across '+r.weeks+' weeks. '+(r.adequate?'Multi-week measurements available.':'More comparable measurements needed.'),...(r.change!==null&&r.change>0?['Earlier comparable median '+f(r.prior)+'; observed improvement '+r.change.toFixed(1)+(units?' percentage points.':' points.')]:[])],bars:[{label:'Position within observed band',value:Math.round(100*r.band.fraction),total:100}]};
 });
}

export function progressHighlights(state,day){
 return progressEvidence([...state.observations,...actualLegObservations(state.legs??[],day)],day).filter(r=>r.adequate&&r.confirmedMilestone!==null&&r.change!==null&&r.change>0&&r.confirmedMilestone>r.prior&&r.confirm(r.confirmedMilestone)).map(r=>({skill:r.skill,protocol:r.protocol,context:r.context,milestone:r.confirmedMilestone,change:r.change,days:r.days})).sort((a,b)=>b.days-a.days||a.skill.localeCompare(b.skill)).slice(0,6);
}
