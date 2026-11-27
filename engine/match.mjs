import {visit,routes,isDouble,points,summarise} from './engine.mjs';
import {REGIONS} from './target-evidence.mjs';
import {dayValid,dayGap} from './context.mjs';
const checkoutCache=new Map();
function canFinish(score,opened){const key=score+'/'+opened;if(!checkoutCache.has(key))checkoutCache.set(key,score<=170&&(opened?![159,162,163,165,166,168,169].includes(score):routes(score,3).some(x=>isDouble(x[0]))));return checkoutCache.get(key)}
const canonical=x=>/^[LI]/.test(x)?'S'+x.slice(1):x;
export function analyseLeg(raw){
 if(!raw||typeof raw.id!=='string'||!raw.id.trim()||raw.id.length>80||!dayValid(raw.day)||![101,201,301,501,701].includes(raw.start)||typeof raw.doubleIn!=='boolean'||!['practice','competition'].includes(raw.context)||!['won','lost','abandoned'].includes(raw.result)||!Array.isArray(raw.visits)||raw.visits.length<1||raw.visits.length>100)throw Error('Invalid leg');
 let remaining=raw.start,opened=!raw.doubleIn,thrown=0,pointsWon=0,firstNine=0,firstNineDarts=0,busts=0,checkoutVisits=0,checkoutWins=0,finishAttempts=0,finishHits=0,unknownIntent=0;
 const visits=[];
 for(const [i,v] of raw.visits.entries()){
 if(remaining===0)throw Error('Visit after finish');
 if(!v||!Array.isArray(v.darts)||v.darts.length<1||v.darts.length>3||!v.darts.every(s=>REGIONS.includes(s))||!Array.isArray(v.aims)||v.aims.length!==v.darts.length||!v.aims.every(s=>s===null||REGIONS.includes(s)&&s!=='MISS'))throw Error('Invalid visit record');
 const start=remaining,wasOpen=opened,darts=v.darts.map(canonical),r=visit(start,darts,{doubleIn:raw.doubleIn,opened});
 if(r.used!==darts.length)throw Error('Extra dart after finish or bust');
 if(!r.finished&&!r.bust&&darts.length!==3&&!(i===raw.visits.length-1&&raw.result==='abandoned'))throw Error('An unfinished non-bust visit needs three darts');
 const possible=canFinish(start,wasOpen);
 if(possible){checkoutVisits++;if(r.finished)checkoutWins++}
 let left=start,active=opened;
 for(let j=0;j<darts.length;j++){
 const target=v.aims[j],d=darts[j];
 if(target===null)unknownIntent++;
 const intended=target!==null?canonical(target):null;
 if(intended&&isDouble(intended)&&points(intended)===left&&(active||raw.doubleIn)){finishAttempts++;finishHits+=Number(d===intended)}
 if(!active){if(!isDouble(d))continue;active=true}left-=points(d);
 }
 const scored=start-r.remaining;pointsWon+=scored;busts+=Number(r.bust);
 // first nine uses credited points from the first three visits; the denominator is actual darts thrown.
 if(i<3){firstNine+=scored;firstNineDarts+=r.used}
 thrown+=r.used;remaining=r.remaining;opened=r.opened;
 visits.push({start,remaining,scored,darts:[...v.darts],aims:[...v.aims],bust:r.bust,finished:r.finished});
 }
 if(raw.result==='won'&&remaining!==0||raw.result!=='won'&&remaining===0)throw Error('Result contradicts recorded finish');
 return {leg:{id:raw.id,day:raw.day,start:raw.start,doubleIn:raw.doubleIn,context:raw.context,result:raw.result,visits:raw.visits.map(v=>({darts:[...v.darts],aims:[...v.aims]}))},remaining,opened,thrown,points:pointsWon,average:3*pointsWon/thrown,firstNine:firstNineDarts?3*firstNine/firstNineDarts:null,firstNineDarts,firstNinePoints:firstNine,busts,checkoutVisits,checkoutWins,finishAttempts,finishHits,unknownIntent,visits,convention:'Actual thrown darts including bust darts; credited score after bust rollback. First-three-visit average is recorded as first-nine only when nine darts were thrown. Unknown aim never counts as a missed finishing double.'};
}
export function recordLeg(m,raw){
 const x=analyseLeg(raw).leg;if((m.legs??[]).some(l=>l.id===x.id))throw Error('Duplicate leg');return {...m,legs:[...(m.legs??[]),x]};
}
export function legEvidence(m,day){
 if(!dayValid(day))throw Error('Invalid review date');
 const result=[];
 for(const raw of (m.legs??[]).filter(l=>dayGap(l.day,day)>=0&&dayGap(l.day,day)<84&&l.result!=='abandoned')){
 const l=analyseLeg(raw),base={day:raw.day,context:raw.context,protocol:'Leg log '+raw.start+(raw.doubleIn?' double-in':' straight-in')+' (actual darts)'};
 function add(skill,attempts,hits){if(attempts)result.push({...base,id:'leg:'+raw.id+':'+skill,skill,attempts,hits})}
 add('scoring',l.thrown,l.points);
 if(l.firstNineDarts===9)add('firstNine',9,l.firstNinePoints);
 add('checkout',l.checkoutVisits,l.checkoutWins);
 // Finishing-double samples require explicit aim on every recorded dart; otherwise selection bias may be material.
 if(l.unknownIntent===0)add('doubles',l.finishAttempts,l.finishHits);
 }
 return result;
}
export function legSummary(m,day){
 const rows=(m.legs??[]).filter(l=>dayGap(l.day,day)>=0&&dayGap(l.day,day)<28&&l.result!=='abandoned'),groups=new Map();
 for(const l of rows){const k=JSON.stringify([l.start,l.doubleIn,l.context]),g=groups.get(k)??[];g.push(analyseLeg(l));groups.set(k,g)}
 return [...groups.values()].map(rows=>{const sum=k=>rows.reduce((n,x)=>n+x[k],0),n=sum('thrown'),attempts=sum('checkoutVisits'),nine=rows.filter(x=>x.firstNineDarts===9),known=rows.filter(x=>!x.unknownIntent),d=known.reduce((n,x)=>n+x.finishAttempts,0);return {start:rows[0].leg.start,doubleIn:rows[0].leg.doubleIn,context:rows[0].leg.context,legs:rows.length,wins:rows.filter(x=>x.leg.result==='won').length,average:3*sum('points')/n,darts:n,firstNine:nine.length?3*nine.reduce((n,x)=>n+x.firstNinePoints,0)/(9*nine.length):null,checkoutVisitRate:attempts?sum('checkoutWins')/attempts:null,checkoutVisits:attempts,finishingDoubleRate:d?known.reduce((n,x)=>n+x.finishHits,0)/d:null,finishingDoubleAttempts:d,busts:sum('busts'),unknownIntent:sum('unknownIntent'),limitation:'Win count is descriptive, opponent skill not modelled. Checkout visit rate is not per-dart double percentage.'}})
}

export function parseVisits(text){
 if(typeof text!=='string'||!text.trim()||text.length>5000)throw Error('Enter one visit per line');
 return text.trim().split(/\r?\n/).filter(l=>l.trim()).map(l=>{const darts=[],aims=[];for(const token of l.trim().toUpperCase().split(/\s+/)){const parts=token.split('>');if(parts.length>2||parts.some(s=>!s))throw Error('Use actual segment or AIM>ACTUAL');if(parts.length===1){aims.push(null);darts.push(parts[0])}else{aims.push(parts[0]);darts.push(parts[1])}}return {darts,aims}});
}
