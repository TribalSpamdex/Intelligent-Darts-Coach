import {dayValid,dayGap} from './engine/context.mjs';
import {routes,mean,sd} from './engine/engine.mjs';
const validCount=(x,n)=>Number.isInteger(x)&&x>=0&&x<=n;
const finishes=[41,46,52,60,68,76,81,90,101,110,120,130];
const possible=new Set();const scores=[0,25,50,...Array.from({length:20},(_,i)=>[i+1,2*(i+1),3*(i+1)]).flat()];for(const a of scores)for(const b of scores)for(const c of scores)possible.add(a+b+c);
const localDay=t=>{const d=new Date(t);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
export function gameProfile(host,day,now=Date.now()){
 if(!dayValid(day)||!Number.isFinite(now))throw Error('Invalid profile date');
 const within=d=>dayValid(d)&&dayGap(d,day)>=0&&dayGap(d,day)<84;
 const map=new Map(),bad=new Set();
 function put(key,value){if(bad.has(key))return;if(map.has(key)&&JSON.stringify(map.get(key))!==JSON.stringify(value)){bad.add(key);map.delete(key)}else map.set(key,value)}
 for(const a of [...(host.assessmentHistory??[]),host.assessment].filter(Boolean)){
 if(a.version!==6||!a.finished||a.quickStart||a.carriedForward||!Number.isFinite(a.completedAt)||a.completedAt<=0||a.completedAt>now)continue;
 const d=localDay(a.completedAt);if(!within(d))continue;
 const rows=Array.isArray(a.checkout)&&a.checkout.length===12&&a.checkout.every((x,i)=>x?.target===finishes[i]&&typeof x.hit==='boolean'&&[1,2,3].includes(x.darts)&&(x.hit||x.darts===3))?a.checkout.map(x=>({score:x.target,success:x.hit,allowance:3,used:x.darts})):[];
 put('assessment:'+a.completedAt,{day:d,protocol:'Fixed checkout assessment',rows});
 }
 for(const g of host.games){
 if(!g||g.quick!==false||g.completion!=='natural'||g.recovery||g.challengeTuning||!Number.isFinite(g.at)||g.at<=0||g.at>now||!within(g.day))continue;
 if(g.name==='Checkout Climb'&&Array.isArray(g.attemptLog)&&g.attemptLog.length>0&&g.attemptLog.length===g.success+g.fail&&g.attemptLog.every(x=>Number.isInteger(x.finish)&&x.finish>=2&&x.finish<=170&&typeof x.success==='boolean'&&x.allowance===3&&[1,2,3].includes(x.dartsUsed)&&(x.success||x.dartsUsed===3)&&(!x.success||routes(x.finish,x.dartsUsed).length>0))&&g.attemptLog.filter(x=>x.success).length===g.success)put('checkout:'+g.at,{day:g.day,protocol:'Checkout Climb (adaptive)',rows:g.attemptLog.map(x=>({score:x.finish,success:x.success,allowance:x.allowance,used:x.dartsUsed}))});
 if(g.name==='Scoring Challenge'&&g.benchmark===true&&g.visits===10&&Array.isArray(g.scores)&&g.scores.length===10&&g.scores.every(n=>possible.has(n))&&g.scores.reduce((a,b)=>a+b,0)===g.points)put('scoring:'+g.at,{day:g.day,protocol:'Scoring Challenge fixed 30',scores:[...g.scores]});
 }
 const byFinish=new Map(),scoring=[];
 for(const r of map.values()){if(r.scores){scoring.push(r);continue}for(const o of r.rows){const key=JSON.stringify([r.protocol,o.score]),g=byFinish.get(key)??{protocol:r.protocol,score:o.score,attempts:0,hits:0,days:new Set(),used:0};g.attempts++;g.hits+=Number(o.success);g.used+=o.success?o.used:0;g.days.add(r.day);byFinish.set(key,g)}}
 const checkout=[...byFinish.values()].map(g=>({...g,days:g.days.size,rate:g.hits/g.attempts,meanDartsOnSuccess:g.hits?g.used/g.hits:null})).sort((a,b)=>a.protocol.localeCompare(b.protocol)||a.score-b.score);
 const visits=scoring.flatMap(x=>x.scores),daily=new Map();for(const r of scoring){const v=daily.get(r.day)??[];v.push(...r.scores);daily.set(r.day,v)}
 const dayMeans=[...daily.values()].map(mean);
 return {checkout,scoring:{visits:visits.length,days:daily.size,average:mean(visits),visitSD:sd(visits),daySD:sd(dayMeans),hundreds:visits.filter(v=>v>=100).length,lowVisits:visits.filter(v=>v<40).length,maximums:visits.filter(v=>v===180).length},conflicts:bad.size,limitation:'Practice-only descriptive results; adaptive checkout selection and incomplete history may bias comparisons. Visit totals do not identify aiming targets.'};
}
