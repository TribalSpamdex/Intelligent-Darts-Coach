import {dayGap,dayValid} from './engine/context.mjs';
import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {summarise} from './engine/engine.mjs';
import {distribution} from './statistics.mjs';
const shift=(day,n)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
export function weeklyHistory(observations,day,weeks=12){
 if(!dayValid(day)||!Number.isInteger(weeks)||weeks<1||weeks>52)throw Error('Invalid weekly history window');
 const scopes=new Map();
 for(const o of canonicalRows(observations,day).filter(r=>dayGap(r.day,day)<weeks*7)){
 const k=scopeKey(o);if(!scopes.has(k))scopes.set(k,[]);scopes.get(k).push(o);
 }
 return [...scopes.values()].map(rows=>{
 const {skill,context,protocol}=rows[0],bins=new Map();
 for(const o of rows){const k=Math.floor(dayGap(o.day,day)/7),a=bins.get(k)??[];a.push(o);bins.set(k,a)}
 const series=Array.from({length:weeks},(_,i)=>{const k=weeks-i-1,s=summarise(bins.get(k)??[]);return {start:shift(day,-k*7-6),end:shift(day,-k*7),attempts:s?.attempts??0,measuredDays:s?.days??0,mean:s?.dayMean??null,pooled:s?.value??null}});
 const adequate=series.filter(w=>w.measuredDays>=3&&w.attempts>=30),typical=distribution(adequate.map(w=>w.mean));
 return {skill,context,protocol,series,typical,bestMeasuredWeek:adequate.length?[...adequate].sort((a,b)=>b.mean-a.mean||b.end.localeCompare(a.end))[0]:null};
 });
}
export function weeklyLines(rows,skill=null){
 const f=(v,s)=>v===null?'not recorded':(['scoring','firstNine'].includes(s)?v.toFixed(1):(100*v).toFixed(1)+'%');
 const x=rows.filter(r=>!skill||r.skill===skill);
 if(!x.length)return ['No comparable weekly measurements.'];
 return [...x.slice(0,12).flatMap(r=>[r.skill+' · '+r.context+' · '+r.protocol,...r.series.map(w=>w.start+' to '+w.end+': '+f(w.mean,r.skill)+'; '+w.measuredDays+' measured days, '+w.attempts+' attempts.'),'Typical adequately measured week: '+f(r.typical.median,r.skill)+'; best recorded adequately measured week: '+f(r.bestMeasuredWeek?.mean??null,r.skill)+'.']), 'Seven-day calendar blocks ending on the analysis date. Empty weeks are unmeasured; best recorded week is descriptive, not a predicted performance level.'];
}
