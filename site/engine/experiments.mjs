import {SKILLS,mean,sd} from './engine.mjs';
import {dayValid,dayGap} from './context.mjs';
export const APPROACHES=['attention cue','equipment','routine','practice order','practice allocation','feedback'];
export function validateTrial(t){
 if(!t||typeof t.id!=='string'||!t.id.trim()||t.id.length>100||!SKILLS.includes(t.skill)||!APPROACHES.includes(t.approach)||!['practice','competition'].includes(t.context)||typeof t.protocol!=='string'||!t.protocol.trim()||t.protocol.length>100||!dayValid(t.start)||!['active','completed','cancelled'].includes(t.status)||!['AB','BA'].includes(t.firstOrder)||typeof t.baseline!=='string'||!t.baseline.trim()||t.baseline.length>200||typeof t.alternative!=='string'||!t.alternative.trim()||t.alternative.length>200||t.baseline.trim()===t.alternative.trim()||!Array.isArray(t.pairs)||t.pairs.length>100)throw Error('Invalid experiment');
 const days=new Set();let prior=null;for(const [index,p] of t.pairs.entries()){validatePair(t,p);const assigned=index%2===0?t.firstOrder:t.firstOrder==='AB'?'BA':'AB';if(days.has(p.day)||prior&&p.day<=prior||p.order!==assigned||index<t.pairs.length-1&&p.discomfort)throw Error('Invalid paired experiment sequence');days.add(p.day);prior=p.day}if(t.pairs.some(p=>p.discomfort)&&t.status!=='cancelled')throw Error('Discomfort must stop experiment');if(t.status==='completed'&&trialOutcome(t).status==='insufficient')throw Error('Incomplete experiment cannot be completed');
 return {...t,baseline:t.baseline.trim(),alternative:t.alternative.trim()};
}
export function validatePair(t,p){
 if(!p||!dayValid(p.day)||p.day<t.start||!['AB','BA'].includes(p.order)||typeof p.comparable!=='boolean'||typeof p.discomfort!=='boolean'||!Number.isInteger(p.attempts)||p.attempts<1||p.attempts>1000||!Number.isInteger(p.a)||!Number.isInteger(p.b)||p.a<0||p.b<0||p.a>p.attempts*(['scoring','firstNine'].includes(t.skill)?60:1)||p.b>p.attempts*(['scoring','firstNine'].includes(t.skill)?60:1))throw Error('Invalid paired result');return p;
}
export function beginTrial(m,t){t=validateTrial({...t,status:'active',pairs:[]});if((m.trials??[]).some(x=>x.id===t.id||x.status==='active'))throw Error('Resolve current experiment first');return {...m,trials:[...(m.trials??[]),t]}}
export function nextOrder(t){return t.pairs.length%2===0?t.firstOrder:t.firstOrder==='AB'?'BA':'AB'}
export function addPair(m,id,p){const t=(m.trials??[]).find(x=>x.id===id);if(!t||t.status!=='active')throw Error('Experiment is not active');validatePair(t,p);if(t.pairs.some(x=>x.day>=p.day)||p.order!==nextOrder(t))throw Error('Use a new later day and assigned order');return {...m,trials:m.trials.map(x=>x.id===id?{...x,pairs:[...x.pairs,p],status:p.discomfort?'cancelled':'active'}:x)}}
export function trialOutcome(t){
 if(t.pairs.some(p=>p.discomfort))return {status:'stopped-for-discomfort'};
 if(t.status==='cancelled')return {status:'cancelled'};
 const pairs=t.pairs.filter(p=>p.comparable),a=pairs.filter(p=>p.order==='AB'),b=pairs.filter(p=>p.order==='BA'),attempts=pairs.reduce((n,p)=>n+p.attempts,0);
 if(pairs.length<6||a.length<3||b.length<3||attempts<120)return {status:'insufficient',days:pairs.length,attempts,orders:[a.length,b.length]};
 const score=['scoring','firstNine'].includes(t.skill),delta=p=>(p.b-p.a)/p.attempts*(score?3:1),values=pairs.map(delta),d=mean(values),noise=2*sd(values)/Math.sqrt(values.length),floor=score?3:.05,orderA=mean(a.map(delta)),orderB=mean(b.map(delta));
 const consistent=Math.sign(orderA)===Math.sign(orderB)&&values.filter(x=>Math.sign(x)===Math.sign(d)).length>=Math.ceil(values.length*.75);
 return {status:consistent&&Math.abs(d)>=Math.max(noise,floor)?d>0?'alternative-favoured':'baseline-favoured':'unclear',change:d,noise,orders:[orderA,orderB],days:pairs.length,attempts,limitations:'Paired short-term performance only. Carryover, expectancy and serial dependence may remain; retention and transfer are not established.'};
}
export function finishTrial(m,id,cancel=false){const t=(m.trials??[]).find(x=>x.id===id);if(!t||t.status!=='active')throw Error('Experiment is not active');if(!cancel&&trialOutcome(t).status==='insufficient')throw Error('Collect more comparable paired days before completion');return {...m,trials:m.trials.map(x=>x.id===id?{...x,status:cancel?'cancelled':'completed'}:x)}}
export function approachHistory(m,skill,protocol,context,approach,baseline,alternative){const rows=(m.trials??[]).filter(t=>t.status==='completed'&&t.skill===skill&&t.protocol===protocol&&t.context===context&&t.approach===approach&&t.baseline===baseline&&t.alternative===alternative).map(trialOutcome);return {favoured:rows.filter(x=>x.status==='alternative-favoured').length,notFavoured:rows.filter(x=>x.status==='baseline-favoured').length,unclear:rows.filter(x=>x.status==='unclear').length,policy:rows.some(x=>x.status==='baseline-favoured')?'do-not-repeat-without-new-evidence':'no-causal-conclusion'}}
