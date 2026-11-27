import {dayValid,dayGap} from './engine/context.mjs';
import {distribution,describeDifference} from './statistics.mjs';
const validTarget=t=>typeof t==='string'&&/^(?:[SDT](?:[1-9]|1[0-9]|20)|25|50)$/.test(t);
export function targetDaily(rows,day,days=84){
 if(!dayValid(day)||!Number.isInteger(days)||days<1||days>365||!Array.isArray(rows))throw Error('Invalid target history');
 const groups=new Map();
 for(const r of rows){
  if(!r||!dayValid(r.day)||!validTarget(r.target)||typeof r.protocol!=='string'||!r.protocol.trim()||!Number.isSafeInteger(r.attempts)||r.attempts<1||!Number.isSafeInteger(r.hits)||r.hits<0||r.hits>r.attempts)throw Error('Invalid target measurement');
  const age=dayGap(r.day,day);if(age<0||age>=days)continue;
  const key=JSON.stringify([r.protocol,r.target,r.day]),g=groups.get(key)??{day:r.day,target:r.target,protocol:r.protocol,hits:0,attempts:0,age};
  g.hits+=r.hits;g.attempts+=r.attempts;groups.set(key,g);
 }
 return [...groups.values()].map(g=>({...g,value:g.hits/g.attempts,block:Math.floor(g.age/7)})).sort((a,b)=>a.day.localeCompare(b.day)||a.target.localeCompare(b.target,undefined,{numeric:true}));
}
export function detailedTargets(rows,day){
 const groups=new Map();
 for(const r of targetDaily(rows,day)){const k=JSON.stringify([r.protocol,r.target]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
 return [...groups.values()].map(g=>{
 const {protocol,target}=g[0];
 const windows=[7,28,84].map(days=>{
 const x=g.filter(r=>r.age<days),attempts=x.reduce((n,r)=>n+r.attempts,0),hits=x.reduce((n,r)=>n+r.hits,0);
 return {days,attempts,hits,pooled:attempts?hits/attempts:null,daily:distribution(x.map(r=>r.value)),weeks:new Set(x.map(r=>r.block)).size};
 });
 const prior=g.filter(r=>r.age>=28&&r.age<56),recent=g.filter(r=>r.age<28);
 const trend=describeDifference(prior,recent,{floor:.1});
 if(prior.reduce((n,r)=>n+r.attempts,0)<30||recent.reduce((n,r)=>n+r.attempts,0)<30)trend.status='insufficient';
 return {protocol,target,last:g.at(-1).day,windows,trend,limitation:'Binary target hits only; no landing positions. Exploratory weekly-block difference, not a calibrated confidence interval.'};
 }).sort((a,b)=>a.protocol.localeCompare(b.protocol)||a.target.localeCompare(b.target,undefined,{numeric:true}));
}
export function targetDetailLines(profiles,target=null){
 const pct=x=>x===null?'not recorded':(x*100).toFixed(1)+'%';
 const rows=profiles.filter(r=>!target||r.target===target);
 if(!rows.length)return ['No eligible target-level measurements for this question.'];
 const lines=rows.slice(0,24).flatMap(r=>[r.target+' · '+r.protocol,...r.windows.map(w=>w.days+' days: '+w.hits+'/'+w.attempts+' hits; daily median '+pct(w.daily.median)+'; middle 50% of days '+pct(w.daily.q1)+' to '+pct(w.daily.q3)+'; '+w.daily.n+' measured days.'),'28-day change: '+r.trend.status+(r.trend.delta!==null?' ('+(r.trend.delta*100).toFixed(1)+' percentage points)':'')+'. Last measured '+r.last+'.']);
 if(rows.length>24)lines.push('Showing 24 of '+rows.length+' protocol/target profiles. Ask for a specific target.');
 return [...lines,'Fixed and adaptive practice are never pooled. Daily ranges describe observed days, not prediction intervals.'];
}
