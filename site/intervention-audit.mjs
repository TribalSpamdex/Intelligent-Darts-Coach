// Audit completed-session evidence separately from the player's reported adherence.
import {dayValid} from './engine/context.mjs';
import {validObservation,summarise} from './engine/engine.mjs';
export function interventionDelivery(host,item,day){
 if(!dayValid(day)||!item||typeof item.id!=='string'||!dayValid(item.responseDay)||item.responseDay>day||!Array.isArray(host.sessions))throw Error('Invalid intervention audit');
 const until=item.reviewDay&&item.reviewDay<day?item.reviewDay:day;
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
 const valid=expected.size===baseline.length&&expected.size===item.baselineIds.length&&new Set(item.baselineIds).size===item.baselineIds.length&&item.baselineIds.every(id=>expected.has(id)&&!conflict.has(id)&&actual.get(id)===expected.get(id));
 return {status:valid?'intact':'baseline-edited',count:expected.size};
}
export function outcomeAudit(host,state,baselines,day){
 return state.interventions.filter(i=>i.responseDay&&i.responseDay<=day&&i.status!=='declined').map(item=>{
  const integrity=baselineIntegrity(item,baselines[item.id]??[],state.observations,day),delivery=interventionDelivery(host,item,day);
  const status=integrity.status==='baseline-edited'?'baseline-edited':item.outcome?.status??item.status;
  return {id:item.id,skill:item.skill,protocol:item.protocol,status,integrity,delivery,limitation:'An observed outcome is not proof that the intervention caused it. Historical outcome labels can become stale if source records change.'};
 });
}
export function outcomeLines(rows){
 return rows.length?rows.slice(-15).flatMap(r=>[r.skill+' | '+r.protocol+' | '+r.status,r.delivery.sessions+' completed sessions with recorded five-minute allocation ('+r.delivery.plannedMinutes+' planned minutes). '+r.delivery.limitation,r.limitation]):['No accepted intervention history recorded.'];
}
