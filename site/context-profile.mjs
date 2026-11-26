// Read-only contextual profiles. Readiness associations use the pinned engine's
// within-week matching, never mixed protocols or inferred mechanical diagnoses.
import {dayGap,dayValid} from './engine/context.mjs';
import {matchedWithinWeeks} from './engine/diagnosis.mjs';
import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {validateClinic} from './engine/clinic.mjs';
const fields=[['fatigue','high'],['pressure','high'],['confidence','low']];
export function readinessProfiles(state,day){
 const rows=canonicalRows(state.observations,day).filter(o=>dayGap(o.day,day)<56);
 const groups=new Map();
 for(const o of rows){const k=scopeKey(o);if(!groups.has(k))groups.set(k,{skill:o.skill,context:o.context,protocol:o.protocol});}
 const result=[];
 for(const scope of groups.values()){
  const observations=rows.filter(o=>scopeKey(o)===scopeKey(scope));
  const view={observations,readiness:state.readiness??[]};
  for(const [field,condition] of fields)result.push({...scope,field,condition,...matchedWithinWeeks(view,scope,day,field,condition)});
 }
 return result;
}
export function techniqueProfiles(state,day){
 if(!dayValid(day))throw Error('Invalid date');
 const rows=(state.clinic??[]).map(validateClinic).filter(o=>dayGap(o.day,day)>=0&&dayGap(o.day,day)<28);
 const groups=new Map();
 for(const o of rows){
  const k=JSON.stringify([scopeKey(o),o.domain,o.condition]);
  if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);
 }
 return [...groups.values()].map(g=>{
  const support=g.filter(o=>['changed','repeated difference'].includes(o.observation));
  const contrary=g.filter(o=>o.observation==='no observed difference');
  const a=new Set(support.map(o=>o.day)),b=new Set(contrary.map(o=>o.day));
  const {skill,context,protocol,domain,condition}=g[0];
  const status=a.size&&b.size?'mixed':a.size>=2&&support.some(o=>o.method!=='self report')?'corroborated-observation':a.size?'reported-observation':b.size>=2?'less-supported':'unresolved';
  return {skill,context,protocol,domain,condition,status,supportDays:a.size,contraryDays:b.size,pain:g.some(o=>o.pain&&dayGap(o.day,day)<7),methods:[...new Set(g.map(o=>o.method))]};
 }).sort((a,b)=>Number(b.pain)-Number(a.pain)||b.supportDays-a.supportDays||a.domain.localeCompare(b.domain));
}
export function contextLines(state,day){
 const rows=readinessProfiles(state,day);
 const format=(n,skill)=>['scoring','firstNine'].includes(skill)?n.toFixed(1)+' average points':(100*n).toFixed(1)+' percentage points';
 if(!rows.length)return ['No comparable performance and readiness history yet.'];
 return [...rows.slice(0,30).map(r=>r.skill+' · '+r.context+' · '+r.protocol+' · '+r.condition+' '+r.field+': '+r.status+' ('+r.pairs+' matched weeks, '+r.daysA+'/'+r.daysB+' measured days)'+(r.status==='association'?'; difference '+format(r.delta,r.skill):'')), 'These associations are based on reported daily conditions, not a diagnosis or proof of a cause. Do not deliberately induce fatigue or discomfort.'];
}
export function techniqueLines(state,day){
 const rows=techniqueProfiles(state,day);
 if(!rows.length)return ['No recent structured technical observations. Observe the existing comfortable throw before changing mechanics.'];
 return [...rows.slice(0,20).map(r=>r.domain+' · '+r.skill+' · '+r.context+' · '+r.protocol+' · '+r.condition+': '+r.status+' ('+r.supportDays+' supporting days; '+r.contraryDays+' contrary days)'+(r.pain?'; recent discomfort reported':'')), 'Compare observations within the same condition; a difference is not proof of a fault. If throwing hurts, stop aggravating practice.'];
}
