import {points,mean,sd,SEGMENTS} from './engine.mjs';
import {dayValid,dayGap} from './context.mjs';
import {REGIONS,classify} from './target-evidence.mjs';
const canonical=s=>/^[LI]/.test(s)?'S'+s.slice(1):s;
const validTarget=s=>REGIONS.includes(s)&&s!=='MISS';
function groups(rows,key){const m=new Map();for(const o of rows){const k=key(o),g=m.get(k)??[];g.push(o);m.set(k,g)}return m}
function blockComparison(pairs,floor){
 const delta=mean(pairs.map(p=>p.delta)),noise=pairs.length>=2?2.5*sd(pairs.map(p=>p.delta))/Math.sqrt(pairs.length):null;
 const consistent=pairs.length>0&&pairs.filter(p=>Math.sign(p.delta)===Math.sign(delta)).length>=Math.ceil(.75*pairs.length);
 return {delta,noise,status:pairs.length>=7&&consistent&&Math.abs(delta)>=Math.max(floor,noise)?delta>0?'first-higher':'second-higher':'not-established',pairedDays:pairs.length};
}
export function targetComparison(m,{first,second,context,protocol,day}){
 if(!validTarget(first)||!validTarget(second)||first===second||!['practice','competition'].includes(context)||typeof protocol!=='string'||!protocol.trim()||!dayValid(day))throw Error('Invalid target comparison');
 const rows=(m.throws??[]).filter(o=>o.context===context&&o.protocol===protocol&&[first,second].includes(o.aim)&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<56);
 const byDay=groups(rows,o=>o.day),pairs=[];let attemptsA=0,attemptsB=0;
 for(const [day,group] of byDay){const a=group.filter(o=>o.aim===first),b=group.filter(o=>o.aim===second);if(a.length<5||b.length<5)continue;const ra=a.filter(o=>classify(o.aim,o.actual)==='exact').length/a.length,rb=b.filter(o=>classify(o.aim,o.actual)==='exact').length/b.length;attemptsA+=a.length;attemptsB+=b.length;pairs.push({day,first:ra,second:rb,delta:ra-rb})}
 const result=blockComparison(pairs,.10);
 return {first,second,context,protocol,pairs,attemptsA,attemptsB,...result,status:attemptsA<60||attemptsB<60?'insufficient':result.status,limitation:'Matched day accuracy is exploratory. Different target difficulty, order and correlated throws may still influence the comparison.'};
}
export function scoringComparison(m,{context,protocol,day,targets=['T20','T19','T18']}){
 if(!dayValid(day)||!['practice','competition'].includes(context)||typeof protocol!=='string'||!protocol.trim()||!Array.isArray(targets)||targets.length<2||targets.length>5||new Set(targets).size!==targets.length||!targets.every(s=>SEGMENTS.includes(s)))throw Error('Invalid scoring comparison');
 const rows=(m.throws??[]).filter(o=>o.context===context&&o.protocol===protocol&&targets.includes(o.aim)&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<56),byDay=groups(rows,o=>o.day);
 const days=[];const counts=Object.fromEntries(targets.map(s=>[s,0]));
 for(const [day,group] of byDay){const values={};for(const target of targets){const g=group.filter(o=>o.aim===target);if(g.length<5)break;values[target]={n:g.length,mean:mean(g.map(o=>points(canonical(o.actual))))}}if(Object.keys(values).length!==targets.length)continue;days.push({day,values});for(const target of targets)counts[target]+=values[target].n}
 const estimates=targets.map(target=>({target,average:days.length?3*mean(days.map(d=>d.values[target].mean)):null,attempts:counts[target]})).sort((a,b)=>(b.average??-1)-(a.average??-1)||a.target.localeCompare(b.target));
 if(days.length<7||targets.some(t=>counts[t]<60))return {status:'insufficient',estimates,days:days.length,recommendation:null};
 const first=estimates[0].target,comparisons=estimates.slice(1).map(e=>({against:e.target,...blockComparison(days.map(d=>({delta:3*(d.values[first].mean-d.values[e.target].mean)})),5)}));
 const supported=comparisons.every(c=>c.status==='first-higher');
 return {status:supported?'observed-advantage':'unclear',estimates,days:days.length,comparisons,recommendation:supported?first:null,limitation:'Observed mean points on matched days, not a general optimal aiming location or match-win probability. Keep switch options and verify transfer.'};
}
export function directionReview(m,{aim,context,protocol,day}){
 if(!validTarget(aim)||!dayValid(day)||!['practice','competition'].includes(context)||typeof protocol!=='string'||!protocol.trim())throw Error('Invalid directional query');
 const rows=(m.throws??[]).filter(o=>o.aim===aim&&o.context===context&&o.protocol===protocol&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<56);
 const days=groups(rows,o=>o.day),usable=[];
 for(const [day,group] of days){let cw=0,ccw=0;for(const o of group){const c=classify(aim,o.actual);cw+=Number(c==='clockwise-neighbour');ccw+=Number(c==='anticlockwise-neighbour')}if(cw+ccw>=3)usable.push({day,cw,ccw,delta:(cw-ccw)/(cw+ccw)})}
 const neighbours=usable.reduce((n,d)=>n+d.cw+d.ccw,0),comparison=blockComparison(usable,.20);
 const status=usable.length<7||neighbours<40?'insufficient':comparison.status==='first-higher'?'clockwise-pattern':comparison.status==='second-higher'?'anticlockwise-pattern':'not-established';
 return {aim,context,protocol,status,neighbours,usableDays:usable.length,comparison,action:status.endsWith('-pattern')?'Repeat same-target observations and compare comfortable alignment, release and rhythm; do not assume a mechanical fault.':'Keep collecting comparable segment outcomes.',limitation:'Angular neighbour counts are not physical x/y dispersion or evidence of a specific release fault.'};
}
