import {SKILLS,mean,sd,summarise,serialMargin,ALLOCATION_PROOF,REVIEW_UNVERIFIED} from './engine.mjs';
export const dayValid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export const dayGap=(a,b)=>(Date.parse(b)-Date.parse(a))/86400000;
// End-of-local-day retrospective projection. The original stored records
// are never rewritten. Later lifecycle transitions cannot activate or erase
// an earlier consent. Legacy deletions without event history are not replayable.
export function asOfState(m,day){
 if(!dayValid(day))throw Error('Invalid retrospective date');
 const x={...m};
 for(const key of ['observations','throws','exposure','readiness','difficulty','answers','changes','sessions','clinic','setups','followups','legs']){
  if(Array.isArray(m[key]))x[key]=m[key].filter(o=>dayValid(o.day)&&o.day<=day);
 }
 x.facts=(m.facts??[]).filter(f=>typeof f.at==='string'&&dayValid(f.at.slice(0,10))&&f.at.slice(0,10)<=day);
 x.interventions=(m.interventions??[]).filter(i=>!i.proposedDay||i.proposedDay<=day).map(i=>{
  const y={...i,retentionHistory:(i.retentionHistory??[]).filter(r=>dayValid(r.reviewDay)&&r.reviewDay<=day)};
  const removeReview=()=>{for(const key of ['reviewDay','outcome','adherence','confounders','retentionHistory',ALLOCATION_PROOF,REVIEW_UNVERIFIED])delete y[key]};
  if(i.responseDay&&i.responseDay>day){y.status='proposed';delete y.responseDay;delete y.cancelledDay;delete y.cancelledFrom;removeReview()}
  else if(i.cancelledDay&&i.cancelledDay>day){y.status=i.cancelledFrom??(i.responseDay<i.cancelledDay?'accepted':'proposed');if(y.status==='proposed')delete y.responseDay;delete y.cancelledDay;delete y.cancelledFrom;removeReview()}
  else if(i.reviewDay&&i.reviewDay>day){y.status='accepted';removeReview()}
  return y;
 });
 if(Array.isArray(m.goals))x.goals=m.goals.filter(g=>g.start<=day).map(g=>g.closedDay&&g.closedDay>day?{...g,status:'active',closedDay:undefined}:g);
 if(Array.isArray(m.trials))x.trials=m.trials.filter(t=>t.start<=day).map(t=>{
  const pairs=t.pairs.filter(p=>p.day<=day),future=t.pairs.length!==pairs.length||t.finishDay&&t.finishDay>day;
  const result={...t,pairs,status:future?'active':t.status};
  if(future)delete result.finishDay;
  return result;
 });
 return x;
}
const levels=['low','normal','high','unknown'];
export function validateReadiness(o){
 if(!o||!dayValid(o.day)||!['practice','competition'].includes(o.context)||!levels.includes(o.fatigue)||!levels.includes(o.pressure)||!levels.includes(o.confidence)||typeof o.pain!=='boolean'||typeof o.note!=='string'||o.note.length>500)throw Error('Invalid readiness record');
 return {day:o.day,context:o.context,fatigue:o.fatigue,pressure:o.pressure,confidence:o.confidence,pain:o.pain,note:o.note};
}
export function recordReadiness(m,o){o=validateReadiness(o);return {...m,readiness:[...(m.readiness??[]).filter(x=>x.day!==o.day||x.context!==o.context),o]}}
export function matchedContext(obs,readiness,field,high='high',low='normal'){
 if(!['fatigue','pressure','confidence'].includes(field))throw Error('Invalid readiness field');
 if(!obs.length)return {status:'insufficient'};
 const g=new Map();
 for(const o of obs){const k=JSON.stringify([o.skill,o.context,o.protocol]);if(!g.has(k))g.set(k,[]);g.get(k).push(o)}
 if(g.size!==1)return {status:'not-comparable'};
 const known=new Map(readiness.map(r=>[r.day+'/'+r.context,r[field]]));
 const a=summarise(obs.filter(o=>known.get(o.day+'/'+o.context)===high)),b=summarise(obs.filter(o=>known.get(o.day+'/'+o.context)===low));
 if(!a||!b||a.days<5||b.days<5||a.attempts<60||b.attempts<60)return {status:'insufficient',high:a,normal:b};
 const change=a.dayMean-b.dayMean,noise=2*Math.sqrt(a.daySD**2/a.days+b.daySD**2/b.days),floor=['scoring','firstNine'].includes(obs[0].skill)?3:.05;
 return {status:Math.abs(change)>=Math.max(noise,floor)?'association':'unclear',change,noise,high:a,normal:b,causality:'not established'};
}
export function robustTrend(obs,{asOf=null}={}){
 if(!obs.length)return {status:'insufficient'};
 const end=asOf??obs.map(o=>o.day).sort().at(-1);if(!dayValid(end))throw Error('Invalid analysis date');
 // Scope validation must also be retrospective: a protocol introduced
 // tomorrow cannot make yesterday's otherwise comparable history unusable.
 const known=obs.filter(o=>dayValid(o.day)&&o.day<=end);
 if(!known.length)return {status:'insufficient'};
 if(new Set(known.map(o=>JSON.stringify([o.skill,o.context,o.protocol]))).size!==1)return {status:'not-comparable'};
 const current=known.filter(o=>dayGap(o.day,end)<28),previous=known.filter(o=>dayGap(o.day,end)>=28&&dayGap(o.day,end)<56);
 const a=summarise(previous),b=summarise(current),base={earlier:a,recent:b,asOf:end,method:'Nonoverlapping 28-day windows; weekly and fortnightly block dispersion plus conservative daily dependence allowance. Exploratory, not a calibrated confidence interval.'};
 if(!a||!b||a.days<7||b.days<7||a.attempts<60||b.attempts<60)return {...base,status:'insufficient'};
 function blocks(s,width=7){const bins=new Map();for(const d of s.daily){const k=Math.floor(dayGap(d.day,end)/width);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(d.value)}return [...bins.values()].map(mean)}
 const x=blocks(a),y=blocks(b);if(x.length<3||y.length<3)return {...base,status:'insufficient'};
 const u=blocks(a,14),v=blocks(b,14);
 if(u.length<2||v.length<2)return {...base,status:'insufficient'};
 const change=mean(y)-mean(x),weekly=2.5*Math.sqrt(sd(x)**2/x.length+sd(y)**2/y.length),fortnightly=2.5*Math.sqrt(sd(u)**2/u.length+sd(v)**2/v.length),daily=serialMargin(a,b);
 const noise=Math.max(weekly,fortnightly,daily),floor=['scoring','firstNine'].includes(known[0].skill)?3:.05;
 const signs=y.map(v=>v-mean(x));const consistent=signs.filter(v=>Math.sign(v)===Math.sign(change)).length>=3;
 return {...base,change,noise,consistent,blocks:[x.length,y.length],status:consistent&&Math.abs(change)>=Math.max(floor,noise)?change>0?'improving':'declining':'unclear'};
}
export function exposureSummary(memory,day,window=28){
 const rows=memory.exposure.filter(e=>dayGap(e.day,day)>=0&&dayGap(e.day,day)<window),total=rows.reduce((n,e)=>n+e.minutes,0),days=new Set(rows.map(e=>e.day)).size;
 return {days,total,skills:Object.fromEntries(SKILLS.map(skill=>[skill,rows.filter(e=>e.skill===skill).reduce((n,e)=>n+e.minutes,0)])),adequacy:days>=7&&total>=180?'exploratory':'insufficient'};
}
