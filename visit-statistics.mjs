import {dayGap,dayValid} from './engine/context.mjs';
import {distribution,describeDifference} from './statistics.mjs';
import {gameProfile} from './game-profile.mjs';
const bounds=[0,40,60,80,100,120,140,160,181];
const labels=['0–39','40–59','60–79','80–99','100–119','120–139','140–159','160–180'];
function scoringWindow(rows,day,days){
 const games=rows.filter(r=>r.scores&&dayGap(r.day,day)<days),daily=new Map();
 for(const r of games){const a=daily.get(r.day)??[];a.push(...r.scores);daily.set(r.day,a)}
 const visits=games.flatMap(r=>r.scores),ds=[...daily].map(([day,v])=>({day,value:distribution(v).mean}));
 return {days,games:games.length,visits:distribution(visits),daily:distribution(ds.map(d=>d.value)),bands:labels.map((label,i)=>({label,count:visits.filter(v=>v>=bounds[i]&&v<bounds[i+1]).length})),hundreds:visits.filter(v=>v>=100).length,oneForties:visits.filter(v=>v>=140).length,maximums:visits.filter(v=>v===180).length,low:visits.filter(v=>v<40).length,dayValues:ds};
}
export function scoringDetail(host,day,now=Date.now()){
 const {records,conflicts}=gameProfile(host,day,now,{includeRecords:true});
 const windows=[7,28,84].map(days=>scoringWindow(records,day,days));
 const d=windows[2].dayValues.map(r=>({...r,age:dayGap(r.day,day),block:Math.floor(dayGap(r.day,day)/7)}));
 const trend=describeDifference(d.filter(r=>r.age>=28&&r.age<56),d.filter(r=>r.age<28),{floor:3});
 return {windows,trend,conflicts,limitation:'Visit totals only. First-nine averages, intended segments and misses cannot be reconstructed from totals.'};
}
export function scoringDetailLines(r){
 const f=x=>x===null?'not recorded':x.toFixed(1);
 if(!r.windows[2].visits.n)return ['No eligible fixed Scoring Challenge visits recorded.'];
 return [...r.windows.flatMap(w=>[w.days+' days · '+w.visits.n+' visits on '+w.daily.n+' days','Average '+f(w.visits.mean)+'; daily median '+f(w.daily.median)+'; middle 50% of measured days '+f(w.daily.q1)+'–'+f(w.daily.q3)+'.','100+: '+w.hundreds+'; 140+: '+w.oneForties+'; 180s: '+w.maximums+'; below 40: '+w.low+'.']), '84-day visit distribution: '+r.windows[2].bands.map(b=>b.label+': '+b.count).join(' · '), 'Recent comparable change: '+r.trend.status+'.',r.limitation];
}
export function checkoutDetail(host,day,now=Date.now()){
 const {records,conflicts}=gameProfile(host,day,now,{includeRecords:true});
 const groups=new Map();
 for(const record of records.filter(r=>!r.scores))for(const x of record.rows){
 const k=JSON.stringify([record.protocol,x.score]),g=groups.get(k)??{protocol:record.protocol,score:x.score,rows:[]};
 g.rows.push({...x,day:record.day,age:dayGap(record.day,day)});groups.set(k,g);
 }
 return {conflicts,groups:[...groups.values()].map(g=>({protocol:g.protocol,score:g.score,windows:[7,28,84].map(days=>{
 const a=g.rows.filter(r=>r.age<days),success=a.filter(r=>r.success),known=success.filter(r=>r.used!==null),daily=new Map();
 for(const r of a){const d=daily.get(r.day)??[0,0];d[0]+=Number(r.success);d[1]++;daily.set(r.day,d)}
 return {days,attempts:a.length,hits:success.length,rate:a.length?success.length/a.length:null,daily:distribution([...daily.values()].map(([h,n])=>h/n)),knownSuccessDarts:known.length,unknownSuccessDarts:success.length-known.length,oneDart:known.filter(r=>r.used===1).length,twoDart:known.filter(r=>r.used===2).length,threeDart:known.filter(r=>r.used===3).length,meanDartsOnSuccess:known.length&&known.length===success.length?distribution(known.map(r=>r.used)).mean:null};
 })})).sort((a,b)=>a.protocol.localeCompare(b.protocol)||a.score-b.score),limitation:'Successful dart counts are reported only where recorded; an adaptive attempt distribution does not estimate match finishing probability.'};
}
export function checkoutDetailLines(r,score=null){
 const rows=r.groups.filter(g=>score===null||g.score===score),pct=x=>x===null?'not recorded':(x*100).toFixed(1)+'%';
 if(!rows.length)return ['No eligible checkout measurements for this score.'];
 return [...rows.slice(0,24).flatMap(g=>[g.score+' · '+g.protocol,...g.windows.map(w=>w.days+' days: '+w.hits+'/'+w.attempts+' finishes ('+pct(w.rate)+'), '+w.daily.n+' measured days; successful attempts by darts used: '+w.oneDart+'/'+w.twoDart+'/'+w.threeDart+' (1/2/3), unknown '+w.unknownSuccessDarts+'.')]),...(rows.length>24?['Showing 24 of '+rows.length+' profiles. Ask for a specific finish.']:[]),r.limitation];
}
