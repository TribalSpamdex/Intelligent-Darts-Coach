import {dayGap} from './engine/context.mjs';
import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {distribution,describeDifference} from './statistics.mjs';
import {summarise} from './engine/engine.mjs';
export function skillProfiles(observations,day){
 const scopes=new Map();
 for(const o of canonicalRows(observations,day)){
 const k=scopeKey(o);if(!scopes.has(k))scopes.set(k,[]);scopes.get(k).push(o);
 }
 return [...scopes.values()].map(rows=>{
 const {skill,context,protocol}=rows[0],score=['scoring','firstNine'].includes(skill);
 const summary=summarise(rows),daily=summary.daily.map(o=>({...o,age:dayGap(o.day,day),block:Math.floor(dayGap(o.day,day)/7)}));
 const windows=[7,28,84,365].map(days=>{
 const x=daily.filter(o=>o.age<days),s=summarise(rows.filter(o=>dayGap(o.day,day)<days));
 return {days,attempts:s?.attempts??0,pooled:s?.value??null,distribution:distribution(x.map(o=>o.value)),weeks:new Set(x.map(o=>o.block)).size};
 });
 const recent=daily.filter(o=>o.age<28),earlier=daily.filter(o=>o.age>=28&&o.age<56);
 const trend=describeDifference(earlier,recent,{floor:score?3:.05});
 if(rows.filter(o=>dayGap(o.day,day)<28).reduce((a,o)=>a+o.attempts,0)<60||rows.filter(o=>dayGap(o.day,day)>=28&&dayGap(o.day,day)<56).reduce((a,o)=>a+o.attempts,0)<60)trend.status='insufficient';
 const prior=windows[1].distribution;
 return {skill,context,protocol,windows,trend,last:daily.at(-1).day,coverage:prior.n>=7&&windows[1].attempts>=60&&windows[1].weeks>=3?'multi-week':prior.n?'limited':'stale'};
 }).sort((a,b)=>a.skill.localeCompare(b.skill)||a.context.localeCompare(b.context)||a.protocol.localeCompare(b.protocol));
}
export function skillLines(profiles,skill=null){
 const rows=profiles.filter(r=>!skill||r.skill===skill);
 if(!rows.length)return ['No eligible comparable skill measurements.'];
 const f=(v,s)=>v===null?'not recorded':(['scoring','firstNine'].includes(s)?v.toFixed(1):(100*v).toFixed(1)+'%');
 return [...rows.slice(0,20).flatMap(r=>[r.skill+' · '+r.context+' · '+r.protocol+' · '+r.coverage,...r.windows.map(w=>w.days+' days: '+w.attempts+' attempts; '+w.distribution.n+' measured days; pooled '+f(w.pooled,r.skill)+'; daily median '+f(w.distribution.median,r.skill)+'; middle 50% '+f(w.distribution.q1,r.skill)+'–'+f(w.distribution.q3,r.skill)), 'Recent trend: '+r.trend.status+'; last measured '+r.last+'.']),...(rows.length>20?['Showing 20 of '+rows.length+' protocols.']:[]),'Recorded daily variation is descriptive, not a forecast or diagnosis.'];
}
