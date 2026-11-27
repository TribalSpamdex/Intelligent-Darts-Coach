// Read-only longitudinal intelligence. Nothing here changes a score, tier or training plan.
import {dayValid,dayGap,robustTrend} from './engine/context.mjs';
import {validObservation,summarise} from './engine/engine.mjs';
export const scopeKey=o=>JSON.stringify([o.skill,o.context,o.protocol]);
export function canonicalRows(observations,day){
 if(!dayValid(day)||!Array.isArray(observations))throw Error('Invalid longitudinal input');
 const byId=new Map(),conflicts=new Set();
 for(const raw of observations){
  const o=validObservation(raw);
  if(o.day>day)continue;
  if(byId.has(o.id)&&JSON.stringify(byId.get(o.id))!==JSON.stringify(o))conflicts.add(o.id);
  else byId.set(o.id,o);
 }
 return [...byId.values()].filter(o=>!conflicts.has(o.id)).sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id));
}
export function longitudinal(observations,day){
 const groups=new Map();
 for(const o of canonicalRows(observations,day)){
  const k=scopeKey(o);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);
 }
 return [...groups.values()].map(rows=>{
  const {skill,context,protocol}=rows[0],last=rows.at(-1).day;
  const windows=[7,28,84,365].map(days=>{
   const subset=rows.filter(o=>dayGap(o.day,day)<days),s=summarise(subset);
   return {days,measurements:subset.length,observedDays:s?.days??0,attempts:s?.attempts??0,dayMean:s?.dayMean??null,pooled:s?.value??null};
  });
  const trend=robustTrend(rows,{asOf:day});
  return {skill,context,protocol,last,age:dayGap(last,day),windows,trend:{status:trend.status,change:trend.change??null,blocks:trend.blocks??null},limitation:'Comparable recorded practice or competition only. Missing days are not zero scores.'};
 }).sort((a,b)=>a.age-b.age||scopeKey(a).localeCompare(scopeKey(b)));
}
export function investigationQueue(profiles,reflections=[]){
 const items=[];
 for(const p of profiles){
  const w=p.windows.find(x=>x.days===28);
  if(p.age>=28)items.push({kind:'stale',scope:scopeKey(p),question:'Has your practice changed, or has this benchmark simply not been recorded recently?',priority:2});
  else if(p.trend.status==='declining')items.push({kind:'decline',scope:scopeKey(p),question:'Were the recent and earlier measurements taken with the same target, equipment and conditions?',priority:1});
  else if(w.observedDays<7)items.push({kind:'coverage',scope:scopeKey(p),question:'Repeat this benchmark on separate days before drawing a conclusion.',priority:3});
 }
 for(const r of reflections)if(r.days>=2&&r.question)items.push({kind:'reported',scope:r.topic,question:r.question,priority:2});
 return items.sort((a,b)=>a.priority-b.priority||a.scope.localeCompare(b.scope));
}
export function profileLines(profiles){
 const f=(n,skill)=>n===null?'not recorded':(['scoring','firstNine'].includes(skill)?n.toFixed(1): (100*n).toFixed(1)+'%');
 if(!profiles.length)return ['No comparable measurements recorded yet.'];
 return profiles.slice(0,20).flatMap(p=>[p.skill+' | '+p.context+' | '+p.protocol,
 ...p.windows.map(w=>w.days+' days: '+f(w.dayMean,p.skill)+' daily mean, '+w.observedDays+' measured days, '+w.attempts+' recorded attempts.'),
 'Recent trend: '+p.trend.status+'; last measured '+p.last+'. '+p.limitation]);
}
