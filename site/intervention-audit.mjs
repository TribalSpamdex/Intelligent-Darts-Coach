// Audit completed-session evidence separately from the player's reported adherence.
import {dayValid} from './engine/context.mjs';
import {validObservation,summarise} from './engine/engine.mjs';
import {evaluation} from './engine/reasoning.mjs';
import {canonicalRows} from './longitudinal.mjs';
export function interventionDelivery(host,item,day){
 if(!dayValid(day)||!item||typeof item.id!=='string'||!dayValid(item.responseDay)||item.responseDay>day||!Array.isArray(host.sessions))throw Error('Invalid intervention audit');
 const until=dayValid(item.reviewDay)&&item.reviewDay<day?item.reviewDay:day;
 const seen=new Map(),conflicts=new Set();
 for(const s of host.sessions){
  if(!s||s.quick!==false||!['number','string'].includes(typeof s.id)||!dayValid(s.date)||s.date<item.responseDay||s.date>until)continue;
  const k=String(s.id);if(seen.has(k))conflicts.add(k);else seen.set(k,s);
 }
 let sessions=0,planned=0;const days=new Set(),exclusions=[];
 for(const [id,s] of seen){
  if(conflicts.has(id)){exclusions.push(id);continue}
  const a=s.wholeSessionAudit?.idcTransfer;
  if(a?.status!=='transferred'||a.intervention!==item.id)continue;
  if(a.skill!==item.skill||a.seconds!==300||a.day!==s.date){exclusions.push(id);continue}
  sessions++;planned+=5;days.add(s.date);
 }
 return {sessions,days:days.size,plannedMinutes:planned,excluded:exclusions.length,limitation:'Saved session allocation, not proof that all extra minutes were thrown. Unlogged practice and skipped or abandoned sessions are unknown.'};
}
export function baselineIntegrity(item,baseline,observations,day){
 if(!dayValid(day)||!Array.isArray(baseline)||!Array.isArray(observations)||!Array.isArray(item?.baselineIds))throw Error('Invalid baseline audit');
 const expected=new Map(baseline.map(o=>{const x=validObservation(o);return [x.id,JSON.stringify(x)]}));
 const actual=new Map(),conflict=new Set();
 for(const raw of observations){const o=validObservation(raw);if(o.day>day)continue;const value=JSON.stringify(o);if(actual.has(o.id)&&actual.get(o.id)!==value)conflict.add(o.id);actual.set(o.id,value)}
 const valid=expected.size>0&&expected.size===baseline.length&&expected.size===item.baselineIds.length&&new Set(item.baselineIds).size===item.baselineIds.length&&item.baselineIds.every(id=>expected.has(id)&&!conflict.has(id)&&actual.get(id)===expected.get(id));
 return {status:valid?'intact':'baseline-edited',count:expected.size};
}
// Reproduce the recorded numerical review from current authoritative measurements.
export function reviewReproduction(item,baseline,observations,day){
 if(!item.outcome||!item.reviewDay||item.reviewDay>day)return {status:'not-reviewed'};
 if(!dayValid(item.reviewDay)||!dayValid(item.responseDay)||item.reviewDay<item.responseDay||!Number.isFinite(item.adherence)||item.adherence<0||item.adherence>1||!Array.isArray(item.confounders))return {status:'unverifiable'};
 if(baselineIntegrity(item,baseline,observations,day).status!=='intact')return {status:'baseline-edited'};
 const after=canonicalRows(observations,item.reviewDay).filter(o=>o.day>item.responseDay&&o.skill===item.skill&&o.context===item.context&&o.protocol===item.protocol);
 if(!after.length)return {status:'outcome-changed'};
 const scope={skill:item.skill,context:item.context,protocol:item.protocol};
 const result=evaluation({...scope,summary:summarise(baseline)},{...scope,summary:summarise(after)},{adherence:item.adherence,confounders:item.confounders});
 const sameNumber=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-10;
 const agrees=result.status===item.outcome.status&&sameNumber(result.delta,item.outcome.delta)&&sameNumber(result.noise,item.outcome.noise);
 return {status:agrees?'reproduced':'outcome-changed',current:result.status,limitation:'Numerical reproduction cannot prove unchanged record identities or causal effect.'};
}
export function outcomeAudit(host,state,baselines,day){
 return state.interventions.filter(i=>i.responseDay&&i.responseDay<=day&&i.status!=='declined').map(item=>{
  const integrity=baselineIntegrity(item,baselines[item.id]??[],state.observations,day),delivery=interventionDelivery(host,item,day);
  const reproduction=reviewReproduction(item,baselines[item.id]??[],state.observations,day);
  const status=integrity.status==='baseline-edited'?'baseline-edited':['outcome-changed','unverifiable'].includes(reproduction.status)?'review-needs-verification':item.reviewDay&&item.reviewDay>day?'accepted':item.outcome?.status??item.status;
  return {id:item.id,skill:item.skill,protocol:item.protocol,status,integrity,delivery,reproduction,limitation:'An observed outcome is not proof that the intervention caused it. Historical outcome labels can become stale if source records change.'};
 });
}
export function outcomeLines(rows){
 return rows.length?rows.slice(-15).flatMap(r=>[r.skill+' | '+r.protocol+' | '+r.status,r.delivery.sessions+' completed sessions with recorded five-minute allocation ('+r.delivery.plannedMinutes+' planned minutes). '+r.delivery.limitation,'Historical review check: '+r.reproduction.status+'.',r.limitation]):['No accepted intervention history recorded.'];
}

// A transient learning view: preserve the stored history, but block automatic repetition
// when a previous outcome is no longer reproducible. Never turn an invalid negative
// outcome into a positive recommendation.
export function verifiedLearningState(state,baselines,day){
 const questionable=[];
 const interventions=state.interventions.map(item=>{
  if(!['completed','unsuccessful'].includes(item.status)||!item.reviewDay||item.reviewDay>day)return item;
  const b=Object.hasOwn(baselines,item.id)?baselines[item.id]:[];
  const check=reviewReproduction(item,b,state.observations,day);
  if(check.status==='reproduced')return item;
  questionable.push({id:item.id,skill:item.skill,protocol:item.protocol,context:item.context,reason:check.status});
  return {...item,outcome:{status:'unclear'},retentionHistory:[]};
 });
 return {state:{...state,interventions},questionable};
}
