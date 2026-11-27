import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
import {summarise} from './engine/engine.mjs';
import {distribution,quantile} from './statistics.mjs';
const shift=(d,n)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
const score=s=>['scoring','firstNine'].includes(s);
const floor=s=>score(s)?3:.05;
const clamp=(v,s)=>Math.max(0,Math.min(score(s)?180:1,v));
const names=['recent-median','last-block','bounded-trend'];
function predict(history,skill,name){
 const values=history.slice(-4).map(x=>x.value),base=quantile(values,.5);
 if(name==='last-block')return values.at(-1);
 if(name==='bounded-trend'){
  const d=quantile(values.slice(1).map((x,i)=>x-values[i]),.5);
  return clamp(values.at(-1)+Math.max(-2*floor(skill),Math.min(2*floor(skill),d)),skill);
 }
 return base;
}
export function measuredBlocks(rows,day,skill){
 // Nonoverlapping trailing seven-day blocks ending on the review date.
 // Missing or inadequate blocks break chronological runs.
 const groups=new Map();
 for(const o of rows){
  const age=dayGap(o.day,day),n=Math.floor(age/7);
  if(n<0||n>=52)continue;
  const a=groups.get(n)??[];a.push(o);groups.set(n,a);
 }
 return Array.from({length:52},(_,i)=>51-i).map(n=>{
  const s=summarise(groups.get(n)??[]),adequate=s&&s.days>=2&&s.attempts>=(skill==='checkout'?24:60);
  return {start:shift(day,-7*n-6),end:shift(day,-7*n),value:adequate?s.dayMean:null,days:s?.days??0,attempts:s?.attempts??0};
 });
}
export function forecastBlocks(blocks,skill){
 const run=[];for(const b of blocks){if(b.value===null)run.length=0;else run.push(b)}
 const base={blocks:run.length,last:run.at(-1)?.end??null,status:'insufficient',point:null,range:null,method:null};
 if(run.length<16)return base;
 // Chronological model selection precedes error calibration, both out of
 // sample. The final prediction uses only measurements available now.
 const split=run.length-8,selection=[];
 for(const name of names){
  const errors=[];
  for(let i=4;i<split;i++)errors.push(Math.abs(run[i].value-predict(run.slice(0,i),skill,name)));
  selection.push({name,mae:distribution(errors).mean});
 }
 selection.sort((a,b)=>a.mae-b.mae||names.indexOf(a.name)-names.indexOf(b.name));
 const method=selection[0].name,errors=[];
 for(let i=split;i<run.length;i++)errors.push(run[i].value-predict(run.slice(0,i),skill,method));
 const radius=Math.max(floor(skill),quantile(errors.map(Math.abs),.875)),point=predict(run,skill,method);
 // Historical coverage here describes the calibration residuals only,
 // not independent verification or a nominal predictive confidence level.
 return {...base,status:'historical-range',point,range:[clamp(point-radius,skill),clamp(point+radius,skill)],method,selection,calibrationBlocks:errors.length,calibrationMAE:distribution(errors.map(Math.abs)).mean,calibrationBias:distribution(errors).mean,calibrationWithin:errors.filter(e=>Math.abs(e)<=radius).length};
}
export function performanceForecasts(observations,day){
 if(!dayValid(day))throw Error('Invalid forecast date');
 const groups=new Map();
 for(const o of canonicalRows(observations,day)){const k=scopeKey(o),g=groups.get(k)??[];g.push(o);groups.set(k,g)}
 return [...groups.values()].map(rows=>{
  const {skill,context,protocol}=rows[0],blocks=measuredBlocks(rows,day,skill),f=forecastBlocks(blocks,skill);
  return {skill,context,protocol,...f};
 }).sort((a,b)=>scopeKey(a).localeCompare(scopeKey(b)));
}
export function forecastLines(rows){
 const fmt=(v,s)=>score(s)?v.toFixed(1):(100*v).toFixed(1)+'%';
 if(!rows.length)return ['No comparable measured history to estimate a future performance range.'];
 return [...rows.slice(0,24).map(r=>r.skill+' · '+r.context+' · '+r.protocol+': '+(r.status==='insufficient'?'Need at least 16 consecutive adequately measured weekly blocks; currently '+r.blocks+'.':'Next comparable seven-day daily-mean estimate '+fmt(r.point,r.skill)+'; historical error range '+r.range.map(v=>fmt(v,r.skill)).join(' to ')+'. '+r.calibrationBlocks+' chronological calibration blocks, mean absolute error '+fmt(r.calibrationMAE,r.skill)+'. Method: '+r.method+'.')),'Historical conditional range, not a guaranteed result, calibrated probability, match prediction or goal date. Missing weeks break the evidence chain. No automatic difficulty changes from forecasts.'];
}

export function backtestBlocks(blocks,skill){
 const results=[];
 for(let i=16;i<blocks.length;i++){
  const actual=blocks[i];if(actual.value===null)continue;
  const history=blocks.slice(0,i),estimate=forecastBlocks(history,skill);
  if(estimate.status!=='historical-range')continue;
  const naive=history.at(-1).value;
  results.push({start:actual.start,end:actual.end,point:estimate.point,actual:actual.value,range:estimate.range,absoluteError:Math.abs(actual.value-estimate.point),naiveError:Math.abs(actual.value-naive),within:actual.value>=estimate.range[0]&&actual.value<=estimate.range[1],method:estimate.method});
 }
 const n=results.length,mae=distribution(results.map(r=>r.absoluteError)).mean,naiveMAE=distribution(results.map(r=>r.naiveError)).mean;
 return {n,mae,naiveMAE,within:results.filter(r=>r.within).length,rangeCoverage:n?results.filter(r=>r.within).length/n:null,status:n<8?'insufficient':mae<naiveMAE-floor(skill)*.25?'lower-historical-error':mae>naiveMAE+floor(skill)*.25?'higher-historical-error':'similar-historical-error',results};
}
export function forecastValidation(observations,day){
 if(!dayValid(day))throw Error('Invalid validation date');
 const groups=new Map();
 for(const o of canonicalRows(observations,day)){const k=scopeKey(o),g=groups.get(k)??[];g.push(o);groups.set(k,g)}
 return [...groups.values()].map(rows=>{const {skill,context,protocol}=rows[0];return {skill,context,protocol,...backtestBlocks(measuredBlocks(rows,day,skill),skill)}}).sort((a,b)=>scopeKey(a).localeCompare(scopeKey(b)));
}
export function forecastValidationLines(rows){
 const f=(v,s)=>v===null?'not measured':score(s)?v.toFixed(1):(100*v).toFixed(1)+' percentage points';
 if(!rows.length)return ['No comparable recorded history for forecast validation.'];
 return [...rows.slice(0,20).map(r=>r.skill+' · '+r.context+' · '+r.protocol+': '+r.n+' walk-forward evaluations, model mean absolute error '+f(r.mae,r.skill)+', last-block baseline error '+f(r.naiveMAE,r.skill)+'. '+r.within+'/'+r.n+' later observed results inside historical ranges. '+(r.status==='insufficient'?'At least eight evaluations needed for a descriptive comparison.':r.status.replaceAll('-',' ')+'.')),'Each prediction is reconstructed using only earlier blocks. Overlapping training histories and current data corrections may affect results. Historical coverage is not calibrated future confidence; no automatic coaching change.'];
}
