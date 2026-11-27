// Read-only contextual profiles. Readiness associations use the pinned engine's
// within-week matching, never mixed protocols or inferred mechanical diagnoses.
import {dayGap,dayValid} from './engine/context.mjs';
import {matchedWithinWeeks} from './engine/diagnosis.mjs';
import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {validateClinic} from './engine/clinic.mjs';
import {validateSetup,setupComparison} from './engine/equipment-profile.mjs';
import {summarise} from './engine/engine.mjs';
import {distribution} from './statistics.mjs';
import {recordedConfounder} from './challenge-episodes.mjs';
const fields=[['fatigue','high'],['pressure','high'],['confidence','low']];
export function readinessProfiles(state,day){
 const rows=canonicalRows(state.observations,day).filter(o=>dayGap(o.day,day)<56);
 const groups=new Map();
 for(const o of rows){const k=scopeKey(o);if(!groups.has(k))groups.set(k,{skill:o.skill,context:o.context,protocol:o.protocol});}
 const result=[];
 for(const scope of groups.values()){
  const observations=rows.filter(o=>scopeKey(o)===scopeKey(scope));
  const view={observations,readiness:state.readiness??[]};
  for(const [field,condition] of fields)result.push({...scope,field,condition,...matchedWithinWeeks(view,scope,day,field,condition)});
 }
 return result;
}
export function techniqueProfiles(state,day){
 if(!dayValid(day))throw Error('Invalid date');
 const rows=(state.clinic??[]).map(validateClinic).filter(o=>dayGap(o.day,day)>=0&&dayGap(o.day,day)<28);
 const groups=new Map();
 for(const o of rows){
  const k=JSON.stringify([scopeKey(o),o.domain,o.condition]);
  if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);
 }
 return [...groups.values()].map(g=>{
  const support=g.filter(o=>['changed','repeated difference'].includes(o.observation));
  const contrary=g.filter(o=>o.observation==='no observed difference');
  const a=new Set(support.map(o=>o.day)),b=new Set(contrary.map(o=>o.day));
  const {skill,context,protocol,domain,condition}=g[0];
  const status=a.size&&b.size?'mixed':a.size>=2&&support.some(o=>o.method!=='self report')?'corroborated-observation':a.size?'reported-observation':b.size>=2?'less-supported':'unresolved';
  return {skill,context,protocol,domain,condition,status,supportDays:a.size,contraryDays:b.size,pain:g.some(o=>o.pain&&dayGap(o.day,day)<7),methods:[...new Set(g.map(o=>o.method))]};
 }).sort((a,b)=>Number(b.pain)-Number(a.pain)||b.supportDays-a.supportDays||a.domain.localeCompare(b.domain));
}
export function contextLines(state,day){
 const rows=readinessProfiles(state,day);
 const format=(n,skill)=>['scoring','firstNine'].includes(skill)?n.toFixed(1)+' average points':(100*n).toFixed(1)+' percentage points';
 if(!rows.length)return ['No comparable performance and readiness history yet.'];
 return [...rows.slice(0,30).map(r=>r.skill+' · '+r.context+' · '+r.protocol+' · '+r.condition+' '+r.field+': '+r.status+' ('+r.pairs+' matched weeks, '+r.daysA+'/'+r.daysB+' measured days)'+(r.status==='association'?'; difference '+format(r.delta,r.skill):'')), 'These associations are based on reported daily conditions, not a diagnosis or proof of a cause. Do not deliberately induce fatigue or discomfort.'];
}
export function techniqueLines(state,day){
 const rows=techniqueProfiles(state,day);
 if(!rows.length)return ['No recent structured technical observations. Observe the existing comfortable throw before changing mechanics.'];
 return [...rows.slice(0,20).map(r=>r.domain+' · '+r.skill+' · '+r.context+' · '+r.protocol+' · '+r.condition+': '+r.status+' ('+r.supportDays+' supporting days; '+r.contraryDays+' contrary days)'+(r.pain?'; recent discomfort reported':'')), 'Compare observations within the same condition; a difference is not proof of a fault. If throwing hurts, stop aggravating practice.'];
}

const scoreSkill=s=>['scoring','firstNine'].includes(s);
const practicalFloor=s=>scoreSkill(s)?3:.05;
const threshold=s=>s==='checkout'?24:60;
const shift=(d,n)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
const groupRows=(rows,key)=>{
 const out=new Map();for(const r of rows){const k=key(r),g=out.get(k)??[];g.push(r);out.set(k,g)}return out;
};
const view=(rows,skill)=>{
 const s=summarise(rows);
 return {days:s?.days??0,attempts:s?.attempts??0,value:s?.dayMean??null,adequate:!!s&&s.days>=5&&s.attempts>=threshold(skill)};
};
const fmt=(n,s)=>n===null?'not measured':(scoreSkill(s)?n:100*n).toFixed(1)+(scoreSkill(s)?' average points':'%');
const changeFmt=(n,s)=>n===null?'not measured':(n>0?'+':'')+(scoreSkill(s)?n:100*n).toFixed(1)+(scoreSkill(s)?' points':' percentage points');
// Snapshot dates do not prove equipment usage. Never guess same-day order.
export function equipmentReviews(state,day){
 if(!dayValid(day))throw Error('Invalid equipment review date');
 const setups=(state.setups??[]).map(validateSetup).filter(s=>s.day<=day).sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id));
 const dates=[...groupRows(setups,s=>s.day)].map(([date,items])=>({date,items}));
 const groups=[...groupRows(canonicalRows(state.observations??[],day).filter(o=>dayGap(o.day,day)<180),scopeKey).values()];
 const out=[];
 for(let i=1;i<dates.length;i++){
  const previous=dates[i-1],current=dates[i],next=dates[i+1];
  if(dayGap(current.date,day)>90)continue;
  if(previous.items.length!==1||current.items.length!==1){
   out.push({day:current.date,status:'ambiguous-snapshots',scopes:[]});continue;
  }
  const a=previous.items[0],b=current.items[0],comparison=setupComparison(a,b);
  const from=[shift(b.day,-28),shift(a.day,1)].sort().at(-1),to=[shift(b.day,28),day,...(next?[shift(next.date,-1)]:[])].sort()[0];
  const beforeEnd=shift(b.day,-1),afterStart=shift(b.day,1);
  const other={...state,setups:setups.filter(s=>s.id!==a.id&&s.id!==b.id)};
  const scopes=[];
  for(const g of groups){
   const {skill,context,protocol}=g[0],earlier=view(g.filter(o=>o.day>=from&&o.day<=beforeEnd),skill),recent=view(g.filter(o=>o.day>=afterStart&&o.day<=to),skill);
   if(!earlier.days&&!recent.days)continue;
   const confounded=from<=to&&(recordedConfounder(other,from,to)||(state.readiness??[]).some(r=>r.context===context&&r.day>=from&&r.day<=to&&(r.pain||r.fatigue==='high'||r.pressure==='high'))||(state.clinic??[]).some(r=>r.day>=from&&r.day<=to&&r.observation==='changed'));
   const difference=earlier.value===null||recent.value===null?null:recent.value-earlier.value;
   const status=!earlier.adequate||!recent.adequate?'insufficient':confounded?'confounded':comparison.changed.length!==1||comparison.unknown.length?'variables-not-isolated':Math.abs(difference)>=practicalFloor(skill)?'observed-difference':'no-clear-difference';
   scopes.push({skill,context,protocol,earlier,recent,difference,status,confounded});
  }
  out.push({day:b.day,before:a.name,after:b.name,from,beforeEnd,afterStart,to,comparison,status:b.comfort==='uncomfortable'?'comfort-concern':'reported-change',scopes});
 }
 return out.reverse();
}
export function equipmentLines(rows){
 if(!rows.length)return ['No two dated equipment snapshots in the recent review period. Record the comfortable baseline and any later changes before comparing performance.'];
 return [...rows.slice(0,12).flatMap(r=>{
  if(r.status==='ambiguous-snapshots')return [r.day+': multiple same-day setup reports; no reliable ordering. No comparison made.'];
  const c=r.comparison;
  return [r.day+' · '+r.before+' → '+r.after+'. Known changed fields: '+(c.changed.join(', ')||'none')+'; unknown fields: '+(c.unknown.join(', ')||'none')+'. '+c.guidance,
  ...r.scopes.slice(0,12).map(s=>s.skill+' · '+s.context+' · '+s.protocol+': '+fmt(s.earlier.value,s.skill)+' to '+fmt(s.recent.value,s.skill)+' ('+s.earlier.days+'/'+s.recent.days+' days; '+s.earlier.attempts+'/'+s.recent.attempts+' attempts). '+changeFmt(s.difference,s.skill)+'; '+s.status.replaceAll('-',' ')+'.'),
  ...(r.scopes.length?[]:['No measured benchmark in the eligible windows.'])];
 }), 'Snapshot dates and comparable measurements are not proof of equipment use or causal effect. No purchase advice, automatic equipment changes or technique prescription.'];
}
// Compare only known conditions and hold other reported readiness dimensions normal.
export function isolatedReadiness(state,day){
 if(!dayValid(day))throw Error('Invalid mental performance date');
 const rows=canonicalRows(state.observations??[],day).filter(o=>dayGap(o.day,day)<56);
 const ready=groupRows((state.readiness??[]).filter(r=>dayValid(r.day)&&r.day<=day),r=>r.day+'/'+r.context);
 const result=[];
 const changesOnly={...state,readiness:[]};
 for(const g of groupRows(rows,scopeKey).values()){
  const {skill,context,protocol}=g[0],daily=groupRows(g,o=>o.day);
  for(const [field,condition] of fields){
   const bins=new Map();let excluded=0;
   for(const [date,obs] of daily){
    const records=ready.get(date+'/'+context)??[],r=records[0];
    if(records.length!==1||r.pain||![condition,'normal'].includes(r[field])||fields.some(([f])=>f!==field&&r[f]!=='normal')){excluded++;continue}
    const week=Math.floor(dayGap(date,day)/7),weekStart=shift(day,-7*week-6),weekEnd=shift(day,-7*week);
    if(recordedConfounder(changesOnly,weekStart,weekEnd)){excluded++;continue}
    const b=bins.get(week)??{a:[],b:[]},s=summarise(obs);
    b[r[field]===condition?'a':'b'].push({value:s.value,attempts:s.attempts});bins.set(week,b);
   }
   const pairs=[...bins.values()].filter(b=>b.a.length&&b.b.length);
   const daysA=pairs.reduce((n,b)=>n+b.a.length,0),daysB=pairs.reduce((n,b)=>n+b.b.length,0);
   const attemptsA=pairs.reduce((n,b)=>n+b.a.reduce((s,x)=>s+x.attempts,0),0),attemptsB=pairs.reduce((n,b)=>n+b.b.reduce((s,x)=>s+x.attempts,0),0);
   const diffs=pairs.map(b=>distribution(b.a.map(x=>x.value)).mean-distribution(b.b.map(x=>x.value)).mean),d=distribution(diffs);
   const sign=Math.sign(d.median??0),noise=d.n>=2?2.5*d.sd/Math.sqrt(d.n):null,agreement=d.n?diffs.filter(x=>sign*x>=practicalFloor(skill)).length/d.n:0;
   const adequate=d.n>=4&&daysA>=7&&daysB>=7&&attemptsA>=threshold(skill)&&attemptsB>=threshold(skill);
   const status=!adequate?'insufficient':Math.abs(d.median)>=Math.max(practicalFloor(skill),noise)&&agreement>=.75?'observed-association':'unclear';
   result.push({skill,context,protocol,field,condition,pairs:d.n,daysA,daysB,attemptsA,attemptsB,excluded,difference:d.median,status});
  }
 }
 return result;
}
export function isolatedReadinessLines(rows){
 if(!rows.length)return ['No comparable recorded performance and readiness history.'];
 return [...rows.slice(0,30).map(r=>r.skill+' · '+r.context+' · '+r.protocol+' · '+r.condition+' '+r.field+': '+r.pairs+' matched weeks, '+r.daysA+'/'+r.daysB+' days, '+r.excluded+' days without isolated known conditions. '+(r.status==='observed-association'?'Observed difference '+changeFmt(r.difference,r.skill)+'.':r.status==='unclear'?'No consistent difference.':'More comparable evidence needed.')), 'Other recorded readiness dimensions must be normal. Unreported influences remain possible. Never induce fatigue, pressure or discomfort to obtain data. Use normal comfortable routines and seek qualified advice for persistent pain.'];
}
export function techniqueEvidence(state,day){
 const profiles=techniqueProfiles(state,day),rows=canonicalRows(state.observations??[],day).filter(o=>dayGap(o.day,day)<28);
 const clinic=(state.clinic??[]).map(validateClinic).filter(o=>dayGap(o.day,day)>=0&&dayGap(o.day,day)<28);
 const observations=groupRows(rows,o=>JSON.stringify([scopeKey(o),o.day]));
 return profiles.map(p=>{
  const group=clinic.filter(o=>scopeKey(o)===scopeKey(p)&&o.domain===p.domain&&o.condition===p.condition),byDay=groupRows(group,o=>o.day);
  const support=[],contrary=[];let excluded=0;
  for(const [date,g] of byDay){
   const a=g.some(o=>['changed','repeated difference'].includes(o.observation)),b=g.some(o=>o.observation==='no observed difference');
   if(a===b||g.some(o=>o.pain)){excluded++;continue}
   const matched=observations.get(JSON.stringify([scopeKey(p),date]))??[];
   (a?support:contrary).push(...matched);
  }
  const a=view(support,p.skill),b=view(contrary,p.skill);
  return {...p,measuredSupport:a,measuredContrary:b,excluded,association:a.value===null||b.value===null?null:a.value-b.value,measurementStatus:a.adequate&&b.adequate?'descriptive-only':'insufficient'};
 });
}
export function techniqueEvidenceLines(rows){
 if(!rows.length)return ['No recent structured technique observations to link to fixed benchmarks.'];
 return [...rows.slice(0,20).map(r=>r.domain+' · '+r.skill+' · '+r.context+' · '+r.condition+' · '+r.protocol+': '+r.status+'; measured observation days '+r.measuredSupport.days+'/'+r.measuredContrary.days+'. '+(r.measurementStatus==='descriptive-only'?'Same-day descriptive difference '+changeFmt(r.association,r.skill)+'.':'Insufficient matched observation days.')+(r.pain?' Stop aggravating practice.':'')), 'Recorded observations and benchmark measurements on the same day do not establish which happened first. No automatic biomechanical diagnosis or throw changes.'];
}
