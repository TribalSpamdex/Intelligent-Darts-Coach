import {trainingParentIndex,trainingParentEligible,recordedDay,skillPlayEligible,masteryRows} from './v62-evidence.mjs';
// Binary intended-target evidence is NOT an actual landing segment.
import {mean,sd,rankedRoutes,visit,isDouble} from './engine/engine.mjs';
import {preferredDoubles} from './engine/goals.mjs';
import {advice} from './engine/tactics.mjs';
import {checkProtocol,projectChecks} from './target-checks.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
const targetOK=x=>typeof x==='string'&&/^(?:[SDT](?:[1-9]|1[0-9]|20)|50|25)$/.test(x);
const localDay=t=>{const d=new Date(t);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const count=(x,n)=>Number.isInteger(x)&&x>=0&&x<=n;
const fixed='Fixed doubles assessment';
export function projectTargets(host,day,now=Date.now(),checks=[]){
 if(!dayValid(day)||!Number.isFinite(now)||!Array.isArray(host.games)||!Array.isArray(host.sessions))throw Error('Invalid target evidence input');
 const groups=new Map(),conflicts=new Set(),parents=trainingParentIndex(host.sessions);
 const eligible=d=>dayValid(d)&&dayGap(d,day)>=0&&dayGap(d,day)<84;
 function record(id,rows){if(conflicts.has(id))return;const prev=groups.get(id);if(prev){if(JSON.stringify(prev)!==JSON.stringify(rows)){groups.delete(id);conflicts.add(id)}return}groups.set(id,rows)}
 const row=(day,protocol,target,attempts,hits)=>({day,protocol,target,attempts,hits});
 for(const a of [...(host.assessmentHistory??[]),host.assessment].filter(Boolean)){
 if(a.version!==6||a.finished!==true||a.quickStart||a.carriedForward||!Number.isFinite(a.completedAt)||a.completedAt>now||a.completedAt<=0)continue;
 const d=recordedDay(a.completedAt,a.offsetMinutes);if(!eligible(d))continue;
 const ds=a.doubles,ss=a.singles,bs=a.bull,rows=[];
 if(Array.isArray(ds)&&ds.length===20&&new Set(ds.map(x=>x?.target)).size===20&&ds.every(x=>/^D(?:[1-9]|1[0-9]|20)$/.test(x?.target)&&Array.isArray(x.darts)&&x.darts.length===3&&x.darts.every(v=>v?.segment===x.target||v?.segment==='MISS')))for(const x of ds)rows.push(row(d,fixed,x.target,3,x.darts.filter(v=>v.segment===x.target).length));
 if(Array.isArray(ss)&&ss.length===60&&ss.every((x,i)=>x?.target===Math.floor(i/3)+1&&typeof x.hit==='boolean'))for(let n=1;n<=20;n++)rows.push(row(d,'Fixed large singles assessment','S'+n,3,ss.slice((n-1)*3,n*3).filter(x=>x.hit).length));
 if(Array.isArray(bs)&&bs.length===30&&bs.every(x=>[0,25,50].includes(x?.score))){rows.push(row(d,'Fixed bull assessment','50',30,bs.filter(x=>x.score===50).length));}
 record('assessment:'+a.completedAt,rows.sort((a,b)=>a.target.localeCompare(b.target)));
 }
 for(const b of host.bigSingles??[]){
 if(b?.complete!==true||b.source==='assessment'||!eligible(b.day)||!count(b.hits,60)||!Array.isArray(b.perNumber)||b.perNumber.length!==20||!b.perNumber.every(x=>count(x,3))||b.perNumber.reduce((a,x)=>a+x,0)!==b.hits||b.at!=null&&(!Number.isFinite(b.at)||b.at>now))continue;
 if(!trainingParentEligible({...b,quick:false},parents,true))continue;
 const parent=parents.parents.get(String(b.sessionId));if(parent.date!==b.day||!Number.isFinite(parent.start)||parent.start<=0||parent.start>now||recordedDay(parent.start,parent.startOffsetMinutes)!==b.day||b.at!=null&&(recordedDay(b.at,b.offsetMinutes)===null||recordedDay(b.at,b.offsetMinutes)>day))continue;
 record('daily:'+b.day,b.perNumber.map((hits,i)=>row(b.day,'Daily large singles benchmark','S'+(i+1),3,hits)));
 }
 for(const g of host.games){
 if(!g||!skillPlayEligible(g,parents)||g.completion!=='natural'||g.recovery||g.challengeTuning||!Number.isFinite(g.at)||g.at<=0||g.at>now||!eligible(g.day)||recordedDay(g.at,g.offsetMinutes)!==g.day)continue;
 const ring=['Doubles Survival','Doubles Streak'].includes(g.name)&&g.variant==='doubles'?'D':g.name==='Treble Hunt'&&g.variant!=='single'?'T':null;
 if(!ring||!Array.isArray(g.targetLog)||!g.targetLog.length||g.targetLog.length!==g.thrown||!g.targetLog.every(x=>x?.ring===ring&&Number.isInteger(x.target)&&x.target>=1&&x.target<=20&&typeof x.hit==='boolean')||g.targetLog.filter(x=>x.hit).length!==g.hits)continue;
 const bins=new Map();
 for(const x of g.targetLog){const t=ring+x.target,v=bins.get(t)??row(g.day,(g.quick?'Quick Play · ':'')+g.name+' · tier '+(g.tierAtStart??'unspecified'),t,0,0);v.attempts++;v.hits+=Number(x.hit);bins.set(t,v)}
 record('game:'+g.at+':'+g.name,[...bins.values()].sort((a,b)=>a.target.localeCompare(b.target)));
 }
 const mastery=new Map();
 for(const r of masteryRows(host,now,84)){
  if(!eligible(r.day)||!r.target)continue;
  const protocol=(r.quick?'Quick Play · ':'Training · ')+'Target Mastery '+r.kind,k=JSON.stringify([r.day,protocol,r.target]),x=mastery.get(k)??row(r.day,protocol,r.target,0,0);x.attempts++;x.hits+=r.hit;mastery.set(k,x);
 }
 return {rows:[...groups.values()].flat().concat([...mastery.values()],projectChecks(checks,day)),conflicts:conflicts.size,windowDays:84,limitation:'Hit/miss records identify the intended target only. Miss landing segments and scoring points are unknown.'};
}
function daily(rows,target,protocol){const m=new Map();for(const o of rows.filter(x=>x.target===target&&x.protocol===protocol)){const g=m.get(o.day)??{attempts:0,hits:0};g.attempts+=o.attempts;g.hits+=o.hits;m.set(o.day,g)}return m}
export function summaries(rows){const keys=[...new Set(rows.map(x=>JSON.stringify([x.protocol,x.target])))];return keys.map(k=>{const [protocol,target]=JSON.parse(k),days=daily(rows,target,protocol),v=[...days.values()],attempts=v.reduce((n,x)=>n+x.attempts,0),hits=v.reduce((n,x)=>n+x.hits,0);return {protocol,target,attempts,hits,days:days.size,rate:hits/attempts,dayMean:mean(v.map(x=>x.hits/x.attempts)),status:days.size>=7&&attempts>=30?'exploratory':'limited'}}).sort((a,b)=>a.protocol.localeCompare(b.protocol)||a.target.localeCompare(b.target,undefined,{numeric:true}))}
export function compareTargets(rows,first,second,protocol=fixed){
 if(!targetOK(first)||!targetOK(second)||first===second)throw Error('Select two different valid targets');
 const a=daily(rows,first,protocol),b=daily(rows,second,protocol),paired=[];
 for(const [day,x] of a){const y=b.get(day);if(y&&x.attempts>=3&&y.attempts>=3)paired.push({day,a:x,b:y,delta:x.hits/x.attempts-y.hits/y.attempts})}
 const n=paired.length,attemptsA=paired.reduce((s,x)=>s+x.a.attempts,0),attemptsB=paired.reduce((s,x)=>s+x.b.attempts,0),delta=mean(paired.map(x=>x.delta)),noise=n>=2?2.5*sd(paired.map(x=>x.delta))/Math.sqrt(n):null;
 const consistent=n&&paired.filter(x=>Math.sign(x.delta)===Math.sign(delta)).length>=Math.ceil(.75*n);
 const status=n<7||attemptsA<30||attemptsB<30?'insufficient':consistent&&Math.abs(delta)>=Math.max(.12,noise)?delta>0?'first-higher':'second-higher':'unclear';
 return {first,second,protocol,days:n,attemptsA,attemptsB,delta,noise,status,limitation:'Exploratory same-day comparison, not a calibrated statistical test or proof of a technical fault.'};
}
export function combinedDoubleComparison(rows,first,second){
 const standard=compareTargets(rows,first,second),paired=compareTargets(rows,first,second,checkProtocol(first,second));
 const decisive=c=>['first-higher','second-higher'].includes(c.status);
 if(decisive(standard)&&decisive(paired)&&standard.status!==paired.status)return {...standard,status:'unclear',limitation:'Fixed assessment and paired practice evidence disagree; no preference change.',sources:[standard,paired]};
 return {...(decisive(standard)?standard:decisive(paired)?paired:standard.status==='insufficient'?paired:standard),sources:[standard,paired]};
}
export function personalisedCheckout(memory,rows,score,darts){
 const base=advice(memory,{score,darts});
 if(base.status!=='finish-available')return {...base,personalisation:'No legal finish; use setup options.',comparison:null};
 const routes=rankedRoutes(score,darts,{},preferredDoubles(memory)),standard=routes[0],length=standard.path.length,finish=standard.path.at(-1);
 const same=routes.filter(x=>x.path.length===length),candidates=[...new Set(same.map(x=>x.path.at(-1)))].filter(t=>t!==finish);
 const comparisons=candidates.map(t=>/^D/.test(t)&&/^D/.test(finish)?combinedDoubleComparison(rows,t,finish):compareTargets(rows,t,finish));
 const winning=comparisons.filter(c=>c.status==='first-higher').sort((a,b)=>b.delta-a.delta||a.first.localeCompare(b.first));
 let chosen=standard,comparison=null;
 if(winning.length){comparison=winning[0];chosen=same.find(x=>x.path.at(-1)===comparison.first)}
 if(!visit(score,chosen.path).finished||chosen.path.length>darts)throw Error('Invalid personalised route');
 return {...base,standard:standard.path,suggested:chosen.path,comparison,personalisation:comparison?'Alternative finishing double supported by matched practice evidence. This is a finishing-double comparison, not a measured full-route or match-win probability. Earlier dart accuracy and miss recovery are not modelled.':'Standard legal route using recorded preference; insufficient or unclear evidence to favour a different finishing double.'};
}
export function targetProfile(rows){const groups=summaries(rows),doubles=groups.filter(x=>x.protocol===fixed),strong=[],weak=[];for(const a of doubles){const peers=doubles.filter(b=>b.target!==a.target).map(b=>compareTargets(rows,a.target,b.target));const above=peers.filter(x=>x.status==='first-higher'),below=peers.filter(x=>x.status==='second-higher');if(above.length>=3&&below.length===0)strong.push({target:a.target,comparisons:above.length});if(below.length>=3&&above.length===0)weak.push({target:a.target,comparisons:below.length})}return {groups,strong,weak,limitation:'Fixed assessment comparisons only; adaptive game results are displayed separately. No automatic technique change or difficulty adjustment.'}}
