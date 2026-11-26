import {analyseLeg,parseVisits} from './engine/match.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
import {distribution} from './statistics.mjs';
const sum=(xs,k)=>xs.reduce((n,x)=>n+x[k],0);
const ratio=(a,b)=>b?a/b:null;
export function legFromInput({id,day,start,doubleIn,context,result,visits},today){
 if(!dayValid(today)||!dayValid(day)||day>today)throw Error('Choose a real date no later than today');
 if(typeof doubleIn!=='boolean')throw Error('Choose the starting rule');
 return analyseLeg({id,day,start:Number(start),doubleIn,context,result,visits:typeof visits==='string'?parseVisits(visits):visits});
}
export function matchProfiles(legs,day){
 if(!dayValid(day)||!Array.isArray(legs))throw Error('Invalid leg history');
 const seen=new Set(),groups=new Map();
 for(const raw of legs){
 const a=analyseLeg(raw),l=a.leg;
 if(seen.has(l.id))throw Error('Duplicate leg record');seen.add(l.id);
 const age=dayGap(l.day,day);if(age<0||age>=365)continue;
 const key=JSON.stringify([l.start,l.doubleIn,l.context]),g=groups.get(key)??{start:l.start,doubleIn:l.doubleIn,context:l.context,rows:[]};
 g.rows.push({...a,age});groups.set(key,g);
 }
 return [...groups.values()].map(g=>({start:g.start,doubleIn:g.doubleIn,context:g.context,windows:[7,28,84,365].map(days=>{
 const eligible=g.rows.filter(r=>r.age<days),rows=eligible.filter(r=>r.leg.result!=='abandoned'),won=rows.filter(r=>r.leg.result==='won'),nine=rows.filter(r=>r.firstNineDarts===9),known=rows.filter(r=>r.unknownIntent===0);
 const darts=sum(rows,'thrown'),points=sum(rows,'points'),checkoutVisits=sum(rows,'checkoutVisits'),finishAttempts=sum(known,'finishAttempts');
 const dayValues=new Map();for(const r of rows){const v=dayValues.get(r.leg.day)??[0,0];v[0]+=r.points;v[1]+=r.thrown;dayValues.set(r.leg.day,v)}
 return {days,legs:rows.length,wins:won.length,losses:rows.length-won.length,abandoned:eligible.length-rows.length,measuredDays:dayValues.size,darts,points,average:ratio(3*points,darts),legAverage:distribution(rows.map(r=>r.average)),dailyAverage:distribution([...dayValues.values()].map(([p,d])=>3*p/d)),winningDarts:distribution(won.map(r=>r.thrown)),firstNineLegs:nine.length,firstNine:ratio(3*sum(nine,'firstNinePoints'),9*nine.length),busts:sum(rows,'busts'),checkoutVisits,checkoutWins:sum(rows,'checkoutWins'),checkoutVisitRate:ratio(sum(rows,'checkoutWins'),checkoutVisits),finishAttempts,finishHits:sum(known,'finishHits'),finishingDoubleRate:ratio(sum(known,'finishHits'),finishAttempts),fullyAimedLegs:known.length,unknownIntent:sum(rows,'unknownIntent')};
 })})).sort((a,b)=>a.start-b.start||Number(a.doubleIn)-Number(b.doubleIn)||a.context.localeCompare(b.context));
}
export function matchLines(profiles){
 const num=x=>x===null?'not recorded':x.toFixed(1),pct=x=>x===null?'not recorded':(100*x).toFixed(1)+'%';
 if(!profiles.length)return ['No manually logged actual legs in the last 365 days.'];
 return [...profiles.slice(0,20).flatMap(p=>[p.start+' · '+(p.doubleIn?'double-in':'straight-in')+' · '+p.context,...p.windows.flatMap(w=>[w.days+' days: '+w.legs+' completed legs ('+w.wins+' won, '+w.losses+' lost), '+w.abandoned+' abandoned; '+w.measuredDays+' measured days.','Three-dart average '+num(w.average)+'; first nine '+num(w.firstNine)+' ('+w.firstNineLegs+' eligible legs); winning-leg median darts '+num(w.winningDarts.median)+'; busts '+w.busts+'.','Checkout visits '+w.checkoutWins+'/'+w.checkoutVisits+' ('+pct(w.checkoutVisitRate)+'); explicit finishing-double attempts '+w.finishHits+'/'+w.finishAttempts+' ('+pct(w.finishingDoubleRate)+'), '+w.fullyAimedLegs+' fully aimed legs.'])]),'Credited score after bust rollback divided by actual darts. First nine requires nine darts in first three visits. Abandoned legs excluded from performance. Unknown aims are never assumed to be double attempts; opponents and match strength are not modelled.'];
}
