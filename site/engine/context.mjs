import {SKILLS,mean,sd,summarise} from './engine.mjs';
export const dayValid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export const dayGap=(a,b)=>(Date.parse(b)-Date.parse(a))/86400000;
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
 if(new Set(obs.map(o=>JSON.stringify([o.skill,o.context,o.protocol]))).size!==1)return {status:'not-comparable'};
 const end=asOf??obs.map(o=>o.day).sort().at(-1);if(!dayValid(end))throw Error('Invalid analysis date');
 const current=obs.filter(o=>dayGap(o.day,end)>=0&&dayGap(o.day,end)<28),previous=obs.filter(o=>dayGap(o.day,end)>=28&&dayGap(o.day,end)<56);
 const a=summarise(previous),b=summarise(current),base={earlier:a,recent:b,asOf:end,method:'Nonoverlapping 28-day windows; weekly block means for exploratory noise. Serial dependence between weeks can remain.'};
 if(!a||!b||a.days<7||b.days<7||a.attempts<60||b.attempts<60)return {...base,status:'insufficient'};
 function blocks(s){const bins=new Map();for(const d of s.daily){const k=Math.floor(dayGap(d.day,end)/7);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(d.value)}return [...bins.values()].map(mean)}
 const x=blocks(a),y=blocks(b);if(x.length<3||y.length<3)return {...base,status:'insufficient'};
 const change=mean(y)-mean(x),noise=2*Math.sqrt(sd(x)**2/x.length+sd(y)**2/y.length),floor=['scoring','firstNine'].includes(obs[0].skill)?3:.05;
 const signs=y.map(v=>v-mean(x));const consistent=signs.filter(v=>Math.sign(v)===Math.sign(change)).length>=3;
 return {...base,change,noise,consistent,blocks:[x.length,y.length],status:consistent&&Math.abs(change)>=Math.max(floor,noise)?change>0?'improving':'declining':'unclear'};
}
export function exposureSummary(memory,day,window=28){
 const rows=memory.exposure.filter(e=>dayGap(e.day,day)>=0&&dayGap(e.day,day)<window),total=rows.reduce((n,e)=>n+e.minutes,0),days=new Set(rows.map(e=>e.day)).size;
 return {days,total,skills:Object.fromEntries(SKILLS.map(skill=>[skill,rows.filter(e=>e.skill===skill).reduce((n,e)=>n+e.minutes,0)])),adequacy:days>=7&&total>=180?'exploratory':'insufficient'};
}
