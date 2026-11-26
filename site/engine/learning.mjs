import {summarise,mean,sd,serialMargin} from './engine.mjs';
import {dayGap,dayValid,asOfState} from './context.mjs';
// A later cancellation does not erase practice already undertaken. The
// historical status is projected before testing whether an interval overlaps.
function competingAllocation(memory,item,day){
 return memory.interventions.some(i=>{
  if(i.id===item.id||i.skill!==item.skill||!dayValid(i.responseDay)||i.responseDay>day)return false;
  if(i.status==='declined'&&i.cancelledFrom!=='accepted')return false;
  const end=i.cancelledDay??i.reviewDay??day;
  return end>=item.responseDay;
 });
}
export function retentionReview(memory,id,day){
 if(!dayValid(day))return {status:'not-eligible'};
 memory=asOfState(memory,day);
 const item=memory.interventions.find(i=>i.id===id);
 if(!item||item.status!=='completed'||item.outcome?.status!=='observed-improvement'||!dayValid(item.reviewDay))return {status:'not-eligible'};
 const age=dayGap(item.reviewDay,day);
 if(age<14)return {status:'too-early',daysRemaining:14-age};
 const original=memory.observations.filter(o=>item.baselineIds.includes(o.id));
 if(original.length!==item.baselineIds.length||!original.length||original.some(o=>o.day>=item.responseDay||o.skill!==item.skill||o.context!==item.context||o.protocol!==item.protocol))return {status:'baseline-edited'};
 const overlapping=competingAllocation(memory,item,day);
 const within=x=>x.day>=item.responseDay&&x.day<=day;
 const changed=(memory.changes??[]).some(within)||(memory.setups??[]).some(x=>x.day>item.responseDay&&x.day<=day)||(memory.clinic??[]).some(x=>within(x)&&x.pain)||(memory.readiness??[]).some(x=>within(x)&&x.context===item.context&&(x.pain||x.fatigue==='high'||x.pressure==='high'));
 // Exclude the immediate post-review week. Require genuinely delayed and
 // recent measurements, not merely a delayed request to review old results.
 const retained=memory.observations.filter(o=>o.skill===item.skill&&o.context===item.context&&o.protocol===item.protocol&&dayGap(item.reviewDay,o.day)>=7&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<28);
 const a=summarise(original),b=summarise(retained);
 if(!a||a.days<7||a.attempts<60||!b||b.days<7||b.attempts<60||dayGap(item.reviewDay,b.daily.at(-1).day)<14||dayGap(b.daily.at(-1).day,day)>7)return {status:'insufficient',days:b?.days??0};
 const delta=b.dayMean-a.dayMean,noise=serialMargin(a,b),threshold=['scoring','firstNine'].includes(item.skill)?3:.05;
 const latest=b.daily.slice(-3),current=mean(latest.map(x=>x.value))-a.dayMean;
 return {status:overlapping||changed?'confounded':delta>=Math.max(threshold,noise)&&current>=threshold?'observed-retention':'retention-not-established',baseline:a,followup:b,delta,noise,causality:'not established',reviewDay:day,method:'delayed-v2'};
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
