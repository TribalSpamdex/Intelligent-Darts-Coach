import {trainingParentIndex,skillPlayEligible,recordedDay,masteryRows,canonicalSkillGames,extraQuickRounds,roundIdentity} from './v62-evidence.mjs';
import {legalFinishCount} from './finish-validation.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
import {routes,mean,sd} from './engine/engine.mjs';
const validCount=(x,n)=>Number.isInteger(x)&&x>=0&&x<=n;
const finishes=[41,46,52,60,68,76,81,90,101,110,120,130];
const possible=new Set();const scores=[0,25,50,...Array.from({length:20},(_,i)=>[i+1,2*(i+1),3*(i+1)]).flat()];for(const a of scores)for(const b of scores)for(const c of scores)possible.add(a+b+c);
const localDay=t=>{const d=new Date(t);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
export function gameProfile(host,day,now=Date.now(),{includeRecords=false}={}){
 if(!dayValid(day)||!Number.isFinite(now))throw Error('Invalid profile date');
 const within=d=>dayValid(d)&&dayGap(d,day)>=0&&dayGap(d,day)<84;
 const map=new Map(),bad=new Set(),parents=trainingParentIndex(host.sessions??[]);
 function put(key,value){if(bad.has(key))return;if(map.has(key)&&JSON.stringify(map.get(key))!==JSON.stringify(value)){bad.add(key);map.delete(key)}else map.set(key,value)}
 for(const a of [...(host.assessmentHistory??[]),host.assessment].filter(Boolean)){
 if(a.version!==6||a.finished!==true||a.quickStart||a.carriedForward||!Number.isFinite(a.completedAt)||a.completedAt<=0||a.completedAt>now)continue;
 const d=recordedDay(a.completedAt,a.offsetMinutes);if(!within(d))continue;
 const rows=Array.isArray(a.checkout)&&a.checkout.length===12&&a.checkout.every((x,i)=>x?.target===finishes[i]&&typeof x.hit==='boolean'&&[1,2,3].includes(x.darts)&&(x.hit?legalFinishCount(x.target,x.darts):x.darts===3))?a.checkout.map(x=>({score:x.target,success:x.hit,allowance:3,used:x.darts})):[];
 put('assessment:'+a.completedAt,{day:d,protocol:'Fixed checkout assessment',rows});
 }
 for(const g of canonicalSkillGames(host.games,bad,{since:now-84*86400000,until:now})){
 if(!g||!skillPlayEligible(g,parents)||g.completion!=='natural'||g.recovery||g.challengeTuning||!Number.isFinite(g.at)||g.at<=0||g.at>now||!within(g.day)||recordedDay(g.at,g.offsetMinutes)!==g.day)continue;
 if(['Checkout Climb','Focused Checkouts'].includes(g.name)&&Array.isArray(g.attemptLog)&&g.attemptLog.length>0&&g.attemptLog.length===g.success+g.fail){
 const rows=g.attemptLog.map(x=>{
 if(x&&Number.isInteger(x.target)&&(x.hit===0||x.hit===1||typeof x.hit==='boolean'))return {score:x.target,success:!!x.hit,allowance:3,used:x.hit?(x.darts??null):3};
 if(x&&Number.isInteger(x.finish)&&typeof x.success==='boolean'&&x.allowance===3&&[1,2,3].includes(x.dartsUsed))return {score:x.finish,success:x.success,allowance:3,used:x.dartsUsed};
 return null;
 });
 if((g.name!=='Focused Checkouts'||Number.isInteger(g.rangeStart)&&Number.isInteger(g.rangeEnd)&&g.rangeStart>=2&&g.rangeEnd<=170&&g.rangeStart<=g.rangeEnd&&g.attemptLog.every(x=>[1,2,3].includes(x.darts)&&(!x.hit?x.darts===3:true)&&x.target>=g.rangeStart&&x.target<=g.rangeEnd))&&rows.every(x=>x&&x.score>=2&&x.score<=170&&(x.success?(x.used===null?routes(x.score,3).length>0:legalFinishCount(x.score,x.used)):x.used===3))&&rows.filter(x=>x.success).length===g.success)put('checkout:'+roundIdentity(g),{day:g.day,protocol:(g.quick?'Quick Play · ':'')+g.name+' (adaptive)'+(g.name==='Focused Checkouts'?' · '+g.rangeStart+'–'+g.rangeEnd+' · '+g.pressure:''),rows});
 }
 if(g.name==='Scoring Challenge'&&g.benchmark===true&&g.visits===10&&Array.isArray(g.scores)&&g.scores.length===10&&g.scores.every(n=>possible.has(n))&&g.scores.reduce((a,b)=>a+b,0)===g.points)put('scoring:'+roundIdentity(g),{day:g.day,protocol:(g.quick?'Quick Play · ':'')+'Scoring Challenge fixed 30',scores:[...g.scores]});
 }
 for(const r of extraQuickRounds(host,day,now))if(r.finishes.length)put('extra:'+JSON.stringify([r.g.name,r.g.at,String(r.g.sessionId)]),{day:r.g.day,protocol:'Quick Play · '+r.g.name+' · '+r.setting+' · three-dart attempts',rows:r.finishes});
 const byFinish=new Map(),scoring=[];
 const mastery=new Map();for(const r of masteryRows(host,now,84)){if(r.kind!=='checkout'||!within(r.day))continue;const protocol=(r.quick?'Quick Play · ':'Training · ')+'Target Mastery checkout',k=JSON.stringify([r.day,protocol]),x=mastery.get(k)??{day:r.day,protocol,rows:[]};x.rows.push({score:r.score,success:!!r.hit,allowance:3,used:r.darts});mastery.set(k,x)}
 for(const [k,r] of mastery)put('mastery:'+k,r);
 for(const r of map.values()){if(r.scores){scoring.push(r);continue}for(const o of r.rows){const key=JSON.stringify([r.protocol,o.score]),g=byFinish.get(key)??{protocol:r.protocol,score:o.score,attempts:0,hits:0,days:new Set(),used:0,knownSuccessDarts:0};g.attempts++;g.hits+=Number(o.success);if(o.success&&o.used!==null){g.used+=o.used;g.knownSuccessDarts++}g.days.add(r.day);byFinish.set(key,g)}}
 const checkout=[...byFinish.values()].map(g=>({...g,days:g.days.size,rate:g.hits/g.attempts,meanDartsOnSuccess:g.hits&&g.knownSuccessDarts===g.hits?g.used/g.hits:null})).sort((a,b)=>a.protocol.localeCompare(b.protocol)||a.score-b.score);
 const visits=scoring.flatMap(x=>x.scores),daily=new Map();for(const r of scoring){const v=daily.get(r.day)??[];v.push(...r.scores);daily.set(r.day,v)}
 const dayMeans=[...daily.values()].map(mean);
 return {...(includeRecords?{records:[...map.values()].map(r=>JSON.parse(JSON.stringify(r)))}:{}),checkout,scoring:{visits:visits.length,days:daily.size,average:mean(visits),visitSD:sd(visits),daySD:sd(dayMeans),hundreds:visits.filter(v=>v>=100).length,lowVisits:visits.filter(v=>v<40).length,maximums:visits.filter(v=>v===180).length},conflicts:bad.size,limitation:'Practice-only descriptive results; adaptive checkout selection and incomplete history may bias comparisons. Visit totals do not identify aiming targets.'};
}
