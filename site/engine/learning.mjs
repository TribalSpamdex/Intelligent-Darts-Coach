import {summarise,mean,sd} from './engine.mjs';
import {dayGap,dayValid} from './context.mjs';
export function retentionReview(memory,id,day){
 const item=memory.interventions.find(i=>i.id===id);
 if(!item||item.status!=='completed'||item.outcome?.status!=='observed-improvement'||!dayValid(day)||!dayValid(item.reviewDay))return {status:'not-eligible'};
 const age=dayGap(item.reviewDay,day);
 if(age<14)return {status:'too-early',daysRemaining:14-age};
 const original=memory.observations.filter(o=>item.baselineIds.includes(o.id));
 if(original.length!==item.baselineIds.length||!original.length)return {status:'baseline-edited'};
 const overlapping=memory.interventions.some(i=>i.id!==id&&i.skill===item.skill&&i.status!=='declined'&&i.responseDay&&i.responseDay>item.responseDay&&i.responseDay<=day);
 const retained=memory.observations.filter(o=>o.skill===item.skill&&o.context===item.context&&o.protocol===item.protocol&&o.day>item.reviewDay&&o.day<=day&&dayGap(o.day,day)<28);
 const a=summarise(original),b=summarise(retained);
 if(!b||b.days<7||b.attempts<60)return {status:'insufficient',days:b?.days??0};
 const delta=b.dayMean-a.dayMean,noise=2*Math.sqrt(a.daySD**2/a.days+b.daySD**2/b.days),threshold=['scoring','firstNine'].includes(item.skill)?3:.05;
 return {status:overlapping?'confounded':delta>=Math.max(threshold,noise)?'observed-retention':'retention-not-established',baseline:a,followup:b,delta,noise,causality:'not established',reviewDay:day};
}
export function recordRetention(memory,id,day){
 const outcome=retentionReview(memory,id,day);
 if(!['observed-retention','retention-not-established','confounded'].includes(outcome.status))throw Error('Retention review incomplete: '+outcome.status);
 return {...memory,interventions:memory.interventions.map(i=>i.id===id?{...i,retentionHistory:[...(i.retentionHistory??[]).filter(x=>x.reviewDay!==day),outcome]}:i)};
}
export function dailyDistribution(observations){
 const s=summarise(observations);if(!s)return null;
 const values=s.daily.map(d=>d.value).sort((a,b)=>a-b);
 const q=p=>{const i=(values.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return values[lo]+(values[hi]-values[lo])*(i-lo)};
 const blocks=new Map();
 for(const d of s.daily){const week=Math.floor(Date.parse(d.day)/604800000);if(!blocks.has(week))blocks.set(week,[]);blocks.get(week).push(d.value)}
 const means=[...blocks.values()].map(mean),n=means.length;
 // Descriptive between-week dispersion, not an inferential confidence interval.
 return {median:q(.5),q1:q(.25),q3:q(.75),minimum:values[0],maximum:values.at(-1),days:values.length,weeks:n,weeklySD:sd(means),uncertainty:'descriptive; no independence assumption or confidence claim'};
}
