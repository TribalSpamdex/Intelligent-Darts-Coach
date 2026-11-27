import {currentReferenceBoundary} from './adaptive-review.mjs';
import {trainingParentIndex,trainingParentEligible,recordedDay,skillPlayEligible,masteryRows,canonicalSkillGames,extraQuickRounds,roundIdentity,quickProtocolConfig} from './v62-evidence.mjs';
// Binary intended-target evidence is NOT an actual landing segment.
import {mean,sd,rankedRoutes,visit,isDouble} from './engine/engine.mjs';
import {preferredDoubles} from './engine/goals.mjs';
import {advice} from './engine/tactics.mjs';
import {checkProtocol,projectChecks} from './target-checks.mjs';
import {dayValid,dayGap,robustTrend} from './engine/context.mjs';
import {learningBoundary} from './challenge-episodes.mjs';
const targetOK=x=>typeof x==='string'&&/^(?:[SDT](?:[1-9]|1[0-9]|20)|50|25)$/.test(x);
const localDay=t=>{const d=new Date(t);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const count=(x,n)=>Number.isInteger(x)&&x>=0&&x<=n;
const fixed='Fixed doubles assessment';
export function projectTargets(host,day,now=Date.now(),checks=[],{includeConfiguration=false}={}){
 if(!dayValid(day)||!Number.isFinite(now)||!Array.isArray(host.games)||!Array.isArray(host.sessions))throw Error('Invalid target evidence input');
 const groups=new Map(),conflicts=new Set(),parents=trainingParentIndex(host.sessions);
 const eligible=d=>dayValid(d)&&dayGap(d,day)>=0&&dayGap(d,day)<84;
 function record(id,rows){if(conflicts.has(id))return;const prev=groups.get(id);if(prev){if(JSON.stringify(prev)!==JSON.stringify(rows)){groups.delete(id);conflicts.add(id)}return}groups.set(id,rows)}
 const row=(day,protocol,target,attempts,hits,g=null)=>({day,protocol,target,attempts,hits,...(includeConfiguration&&g?.quick?{config:quickProtocolConfig(g)}:{})});
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
 for(const g of canonicalSkillGames(host.games,conflicts,{since:now-84*86400000,until:now})){
 if(!g||!skillPlayEligible(g,parents)||g.completion!=='natural'||g.recovery||g.challengeTuning||!Number.isFinite(g.at)||g.at<=0||g.at>now||!eligible(g.day)||recordedDay(g.at,g.offsetMinutes)!==g.day)continue;
 const ring=g.quick&&g.name==='Double Duel'?(g.details?.tier>=6?'S':'D'):['Doubles Survival','Doubles Streak'].includes(g.name)?(g.variant==='doubles'?'D':g.quick&&g.variant==='singles'?'S':null):g.name==='Treble Hunt'?(g.variant==='treble'?'T':g.quick&&g.variant==='single'?'S':null):g.quick&&['Outside Doubles','Double Double','Dartboard Bingo'].includes(g.name)?(g.details?.variant==='singles'?'S':g.details?.ring??'D'):null;
 const duel=g.quick&&g.name==='Double Duel',raw=g.details?.dcVisitLog;
 const log=duel?(Array.isArray(raw)?raw.map(x=>{const m=/^([SD])([1-9]|1[0-9]|20)$/.exec(x?.target);return m?{ring:m[1],target:Number(m[2]),hit:x.hit}:null}):null):g.targetLog??g.details?.targetLog,expectedHits=duel?g.details?.player:g.hits;
 if(!['S','D','T'].includes(ring)||!Array.isArray(log)||!log.length||log.length!==g.thrown||!log.every(x=>x?.ring===ring&&Number.isInteger(x.target)&&x.target>=1&&x.target<=20&&typeof x.hit==='boolean')||log.filter(x=>x.hit).length!==expectedHits)continue;
 const bins=new Map();
 for(const x of log){const t=ring+x.target,v=bins.get(t)??row(g.day,(g.quick?'Quick Play · ':'')+g.name+' · tier '+(g.tierAtStart??'unspecified')+(g.name==='Doubles Streak'?' · '+(g.ruleVersion==='same-target-streak-v1'?'per-target streak':'legacy advancing targets'):''),t,0,0,g);v.attempts++;v.hits+=Number(x.hit);bins.set(t,v)}
 record('game:'+roundIdentity(g),[...bins.values()].sort((a,b)=>a.target.localeCompare(b.target)));
 }
 for(const r of extraQuickRounds(host,day,now)){
  const bins=new Map(),g=r.g,protocol='Quick Play · '+g.name+' · '+r.setting+' · recorded targets';
  for(const x of r.targets){const v=bins.get(x.target)??row(g.day,protocol,x.target,0,0,g);v.attempts+=x.attempts;v.hits+=x.hits;bins.set(x.target,v)}
  if(bins.size)record('extra:'+JSON.stringify([g.name,g.at,String(g.sessionId)]),[...bins.values()].sort((a,b)=>a.target.localeCompare(b.target)));
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
 if(standard.status==='insufficient'&&paired.status==='insufficient'){
  const extra=['Quick Play · Target Mastery segment','Quick Play · Target Mastery straight'].map(p=>compareTargets(rows,first,second,p));
  const supported=extra.filter(decisive);
  if(supported.length&&extra.every(x=>x.status==='insufficient'||x.status===supported[0].status))return {...supported.sort((a,b)=>b.days-a.days)[0],sources:[standard,paired,...extra],limitation:'Separate, same-day Quick Play exact-target comparisons; primary fixed checks remain preferred. No full-route or match-win probability is established.'};
 }
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

// Bounded contextual review. Keep each game's target protocol separate and
// use the existing serial-form trend screen, never a pooled accuracy score.
export function targetDevelopment(host,state,day,now=Date.now(),checks=[]){
 const boundary=learningBoundary(state,day),assessment=host.assessment;
 const reassessed=currentReferenceBoundary({assessment},{},day,now);
 const current={...host,games:(host.games??[]).filter(g=>(!boundary||g?.day>boundary)&&(!reassessed||g?.day>reassessed))};
 const rows=projectTargets(current,day,now,checks.filter(c=>!boundary||c.day>boundary),{includeConfiguration:true}).rows.filter(r=>(!boundary||r.day>boundary)&&(!reassessed||r.day>reassessed));
 const groups=new Map();
 for(const r of rows){const key=JSON.stringify([r.protocol,r.target,r.config??null]),group=groups.get(key)??[];group.push(r);groups.set(key,group)}
 const profiles=[...groups.values()].map(group=>{
  const {protocol,target}=group[0],skill=target[0]==='D'?'doubles':target[0]==='T'?'trebles':target[0]==='S'?'singles':'bull';
  const observations=group.map((r,i)=>({id:'target:'+i,day:r.day,skill,context:'practice',protocol,attempts:r.attempts,hits:r.hits}));
  const trend=robustTrend(observations,{asOf:day}),last=group.map(r=>r.day).sort().at(-1);
  return {protocol,target,skill,last,trend};
 });
 const candidates=profiles.filter(p=>/^[SDT]/.test(p.target)&&p.trend.status==='declining'&&dayGap(p.last,day)<=7);
 const mixed=candidates.filter(p=>profiles.some(q=>q.target===p.target&&q.trend.status==='improving'&&dayGap(q.last,day)<=7));
 const supported=candidates.filter(p=>!mixed.includes(p)).sort((a,b)=>b.last.localeCompare(a.last)||a.target.localeCompare(b.target,undefined,{numeric:true})||a.protocol.localeCompare(b.protocol));
 const focus=supported[0]??null;
 return {focus,mixed,profiles,boundary,limitation:'Repeated exact-target changes within a recorded task are contextual signals. Adaptive stopping and target selection can bias them; confirm with familiar fixed checks. No diagnosis, extra workload or automatic technique change.'};
}
export const publicProtocol=protocol=>protocol.replace(/tier (?:[1-7]|unspecified)\b/g,'separate setting');
export function targetDevelopmentLines(review){
 if(!review.focus)return [review.mixed.length?'Target protocols disagree. Repeat familiar fixed checks before choosing a target focus.':'No repeated recent exact-target decline is established. Missing target evidence is unknown.',review.limitation];
 const p=review.focus,a=p.trend.earlier,b=p.trend.recent;
 return [p.target+' is worth checking next · '+publicProtocol(p.protocol)+'.',
  'Earlier 28 days: '+a.hits+'/'+a.attempts+' ('+(100*a.value).toFixed(1)+'%) over '+a.days+' days. Recent 28 days: '+b.hits+'/'+b.attempts+' ('+(100*b.value).toFixed(1)+'%) over '+b.days+' days.',
  'Use a familiar 15-dart Target Mastery segment check at '+p.target+' on separate days, within your usual practice time.',review.limitation];
}

export function contextualDrillPreferences(review,base={}){const p=review.focus;return {...base,...(p?.skill==='doubles'?{doubles:'Doubles Streak'}:p?.skill==='trebles'?{scoring:'Treble Hunt'}:{})}}
