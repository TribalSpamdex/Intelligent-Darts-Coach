import {legalFinishCount} from './finish-validation.mjs';
// Source: darts-coach V6.2 b248a1caa169c9a45a6beda3954dc067cbfbe6e1.
// Read-only projection from authoritative host records. Rebuild after Undo or restore.
export const BASELINE='b248a1caa169c9a45a6beda3954dc067cbfbe6e1';
export const STORAGE_KEYS=Object.freeze({dartsCoachV4:'IDC:training:v1',dartsCoachV4Checkpoint:'IDC:training:checkpoint:v1',dartsCoachAccentColour:'IDC:accent:v1',dartsCoachRhythm:'IDC:rhythm:v1',dartsCoachCasualV1:'IDC:casual:v1'});
const values=[0,25,50,...Array.from({length:20},(_,i)=>i+1).flatMap(n=>[n,n*2,n*3])];
const possible=new Set(),twoDarts=new Set();for(const a of values)for(const b of values){twoDarts.add(a+b);for(const c of values)possible.add(a+b+c)}
const possibleForDarts=[null,new Set(values),twoDarts,possible];
const count=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
const dayOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
function localDay(at,offset){if(!Number.isFinite(at)||at<=0)return null;const d=new Date(at);if(!Number.isFinite(+d))return null;if(offset!==undefined){
 if(!Number.isInteger(offset)||Math.abs(offset)>840)return null;
 const local=new Date(at-offset*60000);
 return Number.isFinite(+local)?local.toISOString().slice(0,10):null;
}return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
const targets=[41,46,52,60,68,76,81,90,101,110,120,130];
// Known contradictory parent records veto training eligibility even when a
// round claims quick:false. Unknown parents remain explicitly legacy/active
// evidence, not proof of session completion. No stored record is edited.
export function trainingParentIndex(sessions=[]){
 const parents=new Map(),duplicates=new Set();
 for(const s of sessions){
  if(!s||!((typeof s.id==='string'&&s.id.length>0)||Number.isSafeInteger(s.id)))continue;
  const k=String(s.id);if(parents.has(k))duplicates.add(k);else parents.set(k,s);
 }
 return {parents,duplicates};
}
export function trainingParentEligible(g,index,requireParent=false){
 if(!g||g.quick!==false)return false;
 const k=g.sessionId==null?null:String(g.sessionId);
 if(k===null||!index.parents.has(k))return !requireParent;
 if(index.duplicates.has(k))return false;
 const s=index.parents.get(k);
 return s.quick===false&&!(Number.isFinite(s.start)&&Number.isFinite(g.at)&&g.at<s.start);
}
export function recordedDay(at,offset){return localDay(at,offset)}
// Actual skill measurements in Quick Play are a different source, not
// scheduled practice dose. Only an explicitly linked single-game session
// with matching identity, source, chronology and recorded mode qualifies.
export function skillPlayEligible(g,index){
 if(!g||g.quick!==true)return trainingParentEligible(g,index);
 const k=g.sessionId==null?null:String(g.sessionId),s=index.parents.get(k);
 return !!s&&!index.duplicates.has(k)&&s.quick===true&&
  (s.quickGame===g.name||s.quickGame==null&&Array.isArray(s.focus)&&s.focus.length===1&&s.focus[0]===g.name)&&
  Number.isFinite(s.start)&&s.start>0&&Number.isFinite(g.at)&&g.at>=s.start&&
  (s.end==null||Number.isFinite(s.end)&&s.end>=s.start&&g.at<=s.end)&&
  dayOK(g.day)&&localDay(g.at,g.offsetMinutes)===g.day&&
  (!s.date||localDay(s.start,s.startOffsetMinutes)===s.date);
}
// Deduplicate authoritative identities BEFORE eligibility/count validation. A corrupt
// mirror must veto its valid twin, rather than disappear before conflict detection.
const measurementFields=['name','ruleVersion','precision','learningSetting','quick','day','offsetMinutes','completion','benchmark','recovery','challengeTuning','variant','tierAtStart','tier','visits','points','scores','thrown','hits','success','fail','outer','inner','misses','attempts','masteryMode','target','targetLog','attemptLog','rangeStart','rangeEnd','pressure','counts','darts','dartsUsed','targets','locked','ring','details'];
// Use the same provenance at every projection boundary. Numeric/string native
// session aliases are equivalent; different sessions are different rounds.
export const roundIdentity=g=>JSON.stringify([g.name,g.at,g.sessionId==null?null:String(g.sessionId)]);
export function fixedGameSources(games){
 const groups=new Map();
 for(const g of games){if(!g||!['Scoring Challenge','Bull Accuracy'].includes(g.name))continue;const base='game:'+g.at+':'+g.name,keys=groups.get(base)??new Set();keys.add(roundIdentity(g));groups.set(base,keys)}
 // Preserve historic benchmark IDs when unambiguous, including intervention
 // baselines. Only genuine collisions require a provenance suffix.
 return new Map(games.filter(Boolean).map(g=>{const base='game:'+g.at+':'+g.name;return [roundIdentity(g),base+(groups.get(base)?.size>1?':s'+String(g.sessionId??'legacy'):'')]}));
}
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export function canonicalSkillGames(games=[],conflicts=null,window=null){
 const seen=new Map(),bad=new Set(),legacy=[];
 for(const g of games){
  // Timestamp is part of identity. Windowing it before deep serialization
  // cannot hide a conflicting mirror at the same identity. Day/source/count
  // validation still happens only after conflict detection.
  if(window&&Number.isFinite(g?.at)&&(g.at<window.since||g.at>window.until))continue;
  if(!g||!Number.isFinite(g.at)||g.at<=0){legacy.push(g);continue}
  const key=roundIdentity(g),value=JSON.stringify(measurementFields.map(k=>stable(g[k])));
  if(seen.has(key)){if(seen.get(key).value!==value)bad.add(key)}else seen.set(key,{g,value});
 }
 if(conflicts)for(const key of bad)conflicts.add(key);
 return [...legacy,...[...seen].filter(([key])=>!bad.has(key)).map(([,v])=>v.g)];
}
const masteryModes=new Set(['segment','straight','switch','setup','pressure','scoring','bull','checkout']);
const bands={'2–40':[2,40],'41–60':[41,60],'61–80':[61,80],'81–100':[81,100],'101+':[101,170]};
const targetValid=d=>d&&['S','D','T'].includes(d.ring)&&Number.isInteger(d.target)&&d.target>=1&&d.target<=20&&typeof d.hit==='boolean';
// Rebuild from original natural rounds, not personal bests or round wins.
// Duplicate mirrors collapse, contradictory identities are discarded.
export function masteryRows(host,now=Date.now(),windowDays=112){
 const parents=trainingParentIndex(host.sessions??[]),seen=new Map(),bad=new Set(),out=[];
 for(const g of canonicalSkillGames(host.games??[],null,{since:now-windowDays*86400000,until:now})){
  if(!g||g.name!=='Target Mastery'||!Number.isFinite(g.at)||g.at<=0||g.at>now||g.at<now-windowDays*86400000)continue;
  const k=JSON.stringify([g.at,String(g.sessionId??'')]),value=JSON.stringify([g.quick,g.completion,g.recovery,g.challengeTuning,g.masteryMode,g.thrown,g.hits,g.attempts,g.targetLog,g.attemptLog,g.day,g.offsetMinutes]);
  if(seen.has(k)){if(seen.get(k).value!==value)bad.add(k)}else seen.set(k,{g,value});
 }
 for(const [k,{g}] of seen){
  if(bad.has(k)||!skillPlayEligible(g,parents)||g.completion!=='natural'||g.recovery||g.challengeTuning||!masteryModes.has(g.masteryMode))continue;
  const day=localDay(g.at,g.offsetMinutes),mode=g.masteryMode,quick=g.quick===true,log=g.targetLog;
  if(!day||g.day!=null&&g.day!==day)continue;
  if(mode==='checkout'){
   const a=g.attemptLog;
   if(g.attempts!==5||!Array.isArray(a)||a.length!==5||!a.every(x=>x&&Object.hasOwn(bands,x.range)&&Number.isInteger(x.finish)&&x.finish>=bands[x.range][0]&&x.finish<=bands[x.range][1]&&x.allowance===3&&typeof x.success==='boolean'&&legalFinishCount(x.finish,3)&&(!x.success?x.dartsUsed==null:x.dartsUsed==null||[1,2,3].includes(x.dartsUsed)&&legalFinishCount(x.finish,x.dartsUsed)))||a.filter(x=>x.success).length!==g.hits)continue;
   // A range is a label, not a common checkout probability: keep exact scores.
   for(const x of a)out.push({kind:'checkout',key:'Checkout '+x.range+' · '+x.finish,day,hit:Number(x.success),darts:x.dartsUsed??null,score:x.finish,quick});
  }else{
   if(g.thrown!==15||!Array.isArray(log)||log.length!==15||log.filter(d=>d?.hit===true).length!==g.hits)continue;
   if(mode==='bull'){
    if(!log.every(d=>d&&d.ring==='B'&&[25,50,null].includes(d.target)&&d.hit===(d.target!==null)))continue;
    for(const d of log)out.push({kind:'bull',key:'Bull outcomes',day,hit:Number(d.hit),outcome:d.target,quick});
   }else{
    if(!log.every(targetValid)||['segment','straight','pressure'].includes(mode)&&log.some(d=>d.ring!==log[0].ring||d.target!==log[0].target)||mode==='setup'&&log.some(d=>d.ring!=='S')||mode==='scoring'&&log.some(d=>!['S','T'].includes(d.ring)||d.ring!==log[0].ring))continue;
    for(const d of log)out.push({kind:mode,key:mode+' '+d.ring+d.target,day,hit:Number(d.hit),target:d.ring+d.target,quick});
   }
  }
 }
 return out;
}
// Native input traces for the remaining Quick Play games. Reconstruct the
// actual task, not a global skill estimate or a win/loss proxy. The trace
// is captured inside the same native round/Undo snapshot as the game.
export const EXTRA_QUICK_GAMES=Object.freeze(["Shanghai Combo","Number Lock","Halve It","101 Sprint","Golf Five","Cricket Countdown","Double-In 201","Switchback","Last Dart Rescue","Last Dart Standing","Pressure Cricket","Neighbour Trap","Double Jackpot","Checkout Poker","Double Bull Bridge"]);
const exact=t=>typeof t==='string'&&/^[SDT](?:[1-9]|1[0-9]|20)$/.test(t);
const number=n=>Number.isInteger(n)&&n>=1&&n<=20;
const ring=r=>['S','D','T'].includes(r);
const bool=b=>typeof b==='boolean';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const list=(a,n,check)=>Array.isArray(a)&&a.length===n&&a.every(check);
const sum=a=>a.reduce((s,n)=>s+n,0);
const neighbours=n=>{const b=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5],i=b.indexOf(n);return [b[(i+19)%20],b[(i+1)%20]]};
function extraRound(g){
 const d=g.details,log=d?.skillTrace,metrics=[],targets=[],finishes=[];
 const conditions=[];
 for(const [field,label] of [['allowed','dart allowance'],['allowedMisses','miss allowance'],['entryLimit','opening allowance'],['maxVisits','visit allowance'],['goal','goal'],['skillStartLives','starting lives']])if(Number.isInteger(d?.[field]))conditions.push(label+' '+d[field]);
 if(g.name==='Shanghai Combo')conditions.push(d?.variant==='singles'?'three single stages':'single, double, treble stages');
 if(g.name==='Switchback')conditions.push(d?.beginner||d?.holdPosition?'hold position after a miss':'retreat two after a miss');
 for(const field of ['targets','sequence','scores','stages','cards'])if(Array.isArray(d?.[field])&&d[field].length<=10&&d[field].every(x=>typeof x==='string'||Number.isInteger(x)))conditions.push(field+' '+d[field].join(' / '));
 const setting=(Number.isInteger(g.tierAtStart)&&g.tierAtStart>=1&&g.tierAtStart<=7?'tier '+g.tierAtStart:'legacy setting')+(conditions.length?' · '+conditions.join(' · '):'');
 const m=(label,hits,attempts,unit='darts',scoring=false)=>{if(attempts>0)metrics.push({label,hits,attempts,unit,scoring,perDart:scoring})};
 const t=(target,hits,attempts=1)=>targets.push({target,hits,attempts});
 const f=(score,success,used)=>finishes.push({score,success,used,allowance:3});
 const done=()=>({g,setting,metrics,targets,finishes});
 // The legacy Number Lock record already carries a reliable set-level
 // denominator; there is deliberately no per-target allocation of misses.
 if(g.name==='Number Lock'&&log==null){
  if(!ring(g.ring)||!list(g.targets,3,number)||new Set(g.targets).size!==3||!Array.isArray(g.locked)||new Set(g.locked).size!==g.locked.length||!g.locked.every(n=>g.targets.includes(n))||g.hits!==g.locked.length||!count(g.misses,1000)||g.thrown!==g.hits+g.misses||!g.thrown)return null;
  m('open '+g.ring+' target set '+[...g.targets].sort((a,b)=>a-b).join('/')+' (legacy)',g.hits,g.thrown);return done();
 }
 // A legacy sprint result has an explicit total allowance and finish
 // result. It is not a three-dart checkout-attempt denominator.
 if(g.name==='101 Sprint'&&log==null&&d){
  if(!count(d.allowed,1000)||!d.allowed||!count(d.used,d.allowed)||!d.used||![0,1].includes(d.success)||d.hits!==d.success||(!d.success&&d.used!==d.allowed)||d.success&&d.used<2)return null;
  m('101 completed within '+d.allowed+' darts (legacy)',d.success,1,'rounds');return done();
 }
 if(!d||d.name!==g.name||!Array.isArray(log)||!log.length||log.length>5000||!log.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))return null;
 // Fields duplicated by native serialization must agree. Missing legacy
 // fields stay missing; never repair a contradiction by choosing one copy.
 for(const key of ['thrown','hits','points','visits','success','remaining'])if(g[key]!==undefined&&d[key]!==undefined&&g[key]!==d[key])return null;
 const lifeGame=['Shanghai Combo','Last Dart Rescue','Last Dart Standing'].includes(g.name);
 let budget=null;
 if(lifeGame){
  if(!count(d.lives,1000))return null;
  const penalties=log.filter(x=>x.hit===false).length;
  // Rescue's changing target needs replay below; legacy budgets are checked
  // after replay. Versioned new rounds retain the actual initial allowance.
  if(d.skillTraceVersion!==undefined){if(d.skillTraceVersion!==1||!count(d.skillStartLives,1000)||!d.skillStartLives)return null;budget=d.skillStartLives}
  else if(g.name==='Shanghai Combo')budget=d.lives+penalties;
 }
 let i=0,h=0,n=0,misses=0,terminal=false;
 switch(g.name){
 case 'Shanghai Combo':{
  if(!number(d.target))return null;
  for(const x of log){if(i>=3||budget!==null&&misses>=budget||!bool(x.hit))return null;t((d.variant==='singles'?'S':['S','D','T'][i])+d.target,Number(x.hit));n++;if(x.hit){i++;h++}else misses++}
  if(budget!==null&&d.lives!==budget-misses)return null;
  if(d.stage!==i||d.hits!==h||g.hits!==h||d.thrown!==n||g.thrown!==n||d.combinations!==Number(i===3)||!(i===3||d.lives===0))return null;break;
 }
 case 'Number Lock':{
  if(!ring(d.ring)||!list(d.targets,3,number)||new Set(d.targets).size!==3||!count(d.allowedMisses,1000)||!d.allowedMisses)return null;
  const closed=[];for(const x of log){if(closed.length===3||misses>=d.allowedMisses||!(x.value===0||d.targets.includes(x.value)&&!closed.includes(x.value)))return null;n++;if(x.value){closed.push(x.value);h++}else misses++}
  if(!same(closed,d.locked)||h!==d.hits||h!==g.hits||misses!==d.misses||n!==d.thrown||n!==g.thrown||!(h===3||misses===d.allowedMisses))return null;
  m('open '+d.ring+' target set '+[...d.targets].sort((a,b)=>a-b).join('/'),h,n);break;
 }
 case 'Halve It':{
  if(!list(d.targets,6,z=>exact(z)||z==='BULL')||log.length!==6)return null;
  let points=0,halves=0;
  for(const x of log){const aim=d.targets[i++];if(!count(x.action,3))return null;
   if(aim==='BULL')m('bull target hits',x.action,3);else t(aim,x.action,3);
   if(x.action===0){points=Math.floor(points/2);halves++}else points+=(aim==='BULL'?25:Number(aim.slice(1))*(aim[0]==='T'?3:aim[0]==='D'?2:1))*x.action;n+=3}
  if(d.index!==i||d.visits!==i||g.visits!==i||d.thrown!==n||g.thrown!==n||d.points!==points||g.points!==points||d.halves!==halves)return null;break;
 }
 case '101 Sprint':{
  if(!count(d.allowed,1000)||!d.allowed)return null;
  for(const x of log){if(terminal||n>=d.allowed)return null;
   if(x.action==='miss'){n++;terminal=n===d.allowed}else if([2,3].includes(x.finish)&&x.finish<=d.allowed-n&&legalFinishCount(101,x.finish)){n+=x.finish;h=1;terminal=true}else return null}
  if(!terminal||d.used!==n||d.success!==h||d.hits!==h||g.success!==h)return null;
  m('101 completed within '+d.allowed+' darts',h,1,'rounds');break;
 }
 case 'Golf Five':{
  if(!ring(d.ring)||!list(d.holes,5,number))return null;
  let shots=0,strokes=0;
  for(const x of log){if(i>=5||!['hit','miss'].includes(x.action))return null;
   const hit=x.action==='hit';t(d.ring+d.holes[i],Number(hit));n++;shots++;
   if(hit){h++;strokes+=shots;shots=0;i++}else if(shots===3){strokes+=4;shots=0;i++}}
  if(i!==5||d.index!==i||d.shots!==shots||d.strokes!==strokes||g.score!==strokes||d.hits!==h||g.hits!==h||d.thrown!==n||g.thrown!==n)return null;break;
 }
 case 'Cricket Countdown':case 'Pressure Cricket':{
  const pressure=g.name==='Pressure Cricket',ns=d.targets;
  if(!Array.isArray(ns)||!ns.length||ns.length>7||new Set(ns).size!==ns.length||!ns.every(v=>number(v)||!pressure&&v===25)||pressure&&ns.length!==3||!count(d.allowed,1000)||!d.allowed)return null;
  const marks=ns.map(()=>0),bins=new Map();
  for(const x of log){if(i>=ns.length||n>=d.allowed)return null;const aim=ns[i],a=pressure?x.value:x.action;if(!count(a,aim===25?2:3))return null;
   const v=bins.get(aim)??[0,0];v[0]+=Number(a>0);v[1]++;bins.set(aim,v);
   // Explicit bull/number marks, never equate sector hits with intended trebles.
   marks[i]=Math.min(3,marks[i]+a);n++;h+=Number(a>0);if(marks[i]===3)i++}
  if(d.index!==i||d.hits!==h||g.hits!==h||d.thrown!==n||g.thrown!==n||!same(d.marks,marks)||!(i===ns.length||n===d.allowed))return null;
  for(const [aim,v] of bins)m(aim===25?'either bull (cricket)':'number lane '+aim+' (any ring)',v[0],v[1]);break;
 }
 case 'Double-In 201':{
  if(!count(d.entryLimit,1000)||!d.entryLimit||!count(d.maxVisits,1000)||!d.maxVisits)return null;
  let entered=false,openingDarts=0,entryDouble=null,points=0,remaining=201,visits=0,busts=0,finish=0,scores=[],entryMisses=0,entryDarts=0;
  for(const x of log){
   if(terminal||![1,2,3].includes(x.darts))return null;
   const room=3-n%3;
   if(!entered){
    if(x.darts>room)return null;
    if(x.kind==='entryMiss'){if(x.darts>d.entryLimit-entryMisses)return null;n+=x.darts;openingDarts+=x.darts;entryMisses+=x.darts;terminal=entryMisses===d.entryLimit;continue}
    if(x.kind!=='entry'||!(number(x.double)||x.double===25)||!Number.isInteger(x.entry)||x.entry<1||x.entry>x.darts||x.entry>d.entryLimit-entryMisses)return null;
    const tail=x.darts-x.entry;if(!Number.isInteger(x.score)||x.score<2*x.double||!(tail?possibleForDarts[tail].has(x.score-2*x.double):x.score===2*x.double))return null;
    entryDouble=x.double;entered=true;entryMisses+=x.entry-1;entryDarts=n+x.entry;openingDarts+=x.entry;
    n+=x.darts;points+=x.score;remaining-=x.score;
    // Modern opening visit is credited to scores; legacy keypad entry
    // only records the opening double, leaving the tail as a later visit.
    if(x.darts===room)scores.push(x.score);continue;
   }
   if(!['visit','bust','finish'].includes(x.kind)||x.darts>room||!possibleForDarts[x.darts].has(x.score)||x.kind!=='finish'&&x.darts!==room)return null;
   if(x.kind==='bust'){if(x.score!==0)return null;busts++}
   else if(x.kind==='finish'){if(x.score!==remaining||!legalFinishCount(x.score,x.darts))return null;finish=x.score;terminal=true}
   else if(x.score>=remaining||remaining-x.score===1)return null;
   n+=x.darts;visits++;points+=x.score;remaining-=x.score;scores.push(x.score);if(visits===d.maxVisits)terminal=true;
  }
  if(!terminal||d.entered!==entered||d.entryMisses!==entryMisses||d.entryDouble!==entryDouble||entered&&d.entryDarts!==entryDarts||d.points!==points||g.points!==points||d.remaining!==remaining||d.visits!==visits||d.busts!==busts||d.thrown!==n||d.dartsUsed!==n||g.dartsUsed!==n||d.wins!==Number(finish>0)||!same(d.scores,scores))return null;
  m('opening double (any double)',Number(entered),openingDarts);
  if(entered)m('credited double-in leg scoring',points,n,'darts',true);
  break;
 }
 case 'Switchback':{
  if(!ring(d.ring)||!Array.isArray(d.sequence)||!d.sequence.length||!d.sequence.every(number)||!count(d.allowed,1000)||!d.allowed)return null;
  for(const x of log){if(i>=d.sequence.length||n>=d.allowed||!['hit','miss'].includes(x.action))return null;
   const hit=x.action==='hit';t(d.ring+d.sequence[i],Number(hit));n++;if(hit){h++;i++}else{misses++;i=Math.max(0,i-(d.beginner||d.holdPosition?0:2))}}
  if(d.index!==i||d.misses!==misses||d.hits!==h||g.hits!==h||d.thrown!==n||g.thrown!==n||!(i===d.sequence.length||n===d.allowed))return null;break;
 }
 case 'Last Dart Rescue':{
  if(!Array.isArray(d.targets)||!d.targets.length||!d.targets.every(x=>x===50||Number.isInteger(x)&&x>=2&&x<=40&&x%2===0))return null;
  let aim=null,decisions=0,correct=0,lastPenalty=-1;
  for(const x of log){if(i>=d.targets.length||budget!==null&&misses>=budget)return null;const target=d.targets[i]===50?'BULL':'D'+d.targets[i]/2;
   if(Object.hasOwn(x,'choice')){if(aim||!(exact(x.choice)&&x.choice[0]==='D'||x.choice==='BULL'))return null;decisions++;if(x.choice===target){aim=target;correct++}else misses++}
   else{if(!aim||!bool(x.hit))return null;t(aim==='BULL'?'50':aim,Number(x.hit));n++;if(x.hit){h++;i++}else misses++;aim=null}
   if(Object.hasOwn(x,'choice')?x.choice!==target:x.hit===false)lastPenalty=decisions+n-1;}
  if(budget!==null&&d.lives!==budget-misses||d.lives===0&&lastPenalty!==log.length-1)return null;
  if(aim||d.aim!==null||d.index!==i||d.thrown!==n||g.thrown!==n||d.hits!==h||g.hits!==h||!(i===d.targets.length||d.lives===0))return null;
  m('one-dart finish selection',correct,decisions,'decisions');break;
 }
 case 'Last Dart Standing':{
  if(!Array.isArray(d.scores)||!d.scores.length||!d.scores.every(x=>Number.isInteger(x)&&x>=2&&x<=50&&(x%2||x<=40||x===50)))return null;
  let decisions=0,correct=0,executed=0,lastPenalty=-1;
  for(const x of log){if(i>=d.scores.length||budget!==null&&misses>=budget||!['FINISH','SETUP'].includes(x.choice)||!['hit','miss'].includes(x.value))return null;
   const right=x.choice===(d.scores[i]%2===0?'FINISH':'SETUP');decisions++;if(right){correct++;if(x.value==='hit'){executed++;h++;i++}}if(!right||x.value==='miss'){misses++;lastPenalty=n}n++}
  if(budget!==null&&d.lives!==budget-misses||d.lives===0&&lastPenalty!==log.length-1)return null;
  if(d.index!==i||d.hits!==h||g.hits!==h||d.thrown!==n||g.thrown!==n||d.choice!==null||!(i===d.scores.length||d.lives===0))return null;
  m('finish or setup decision',correct,decisions,'decisions');m('reported execution after correct decision',executed,correct);break;
 }
 case 'Neighbour Trap':{
  const aim=d.target||20;if(!number(aim)||!count(d.allowed,1000)||!d.allowed||!count(d.goal,1000)||!d.goal)return null;
  let progress=0,near=0;
  for(const x of log){if(progress>=d.goal||n>=d.allowed||![String(aim),...neighbours(aim).map(String),'miss'].includes(x.value))return null;
   const hit=x.value===String(aim);t('S'+aim,Number(hit));n++;if(hit){h++;progress++}else if(x.value!=='miss'){near++;progress=Math.max(0,progress-1)}}
  if(d.hits!==h||g.hits!==h||d.thrown!==n||g.thrown!==n||d.progress!==progress||d.neighbours!==near||!(progress>=d.goal||n===d.allowed))return null;break;
 }
 case 'Double Jackpot':{
  if(!['S','D'].includes(d.ring)||!count(d.allowed,1000)||!d.allowed||!count(d.goal,1000)||!d.goal)return null;
  let points=0;const used=[];
  for(const x of log){if(points>=d.goal||n>=d.allowed||![20,16,10,5].includes(x.choice)||used.includes(x.choice)||!['hit','miss'].includes(x.value))return null;
   const hit=x.value==='hit';t(d.ring+x.choice,Number(hit));n++;if(hit){h++;used.push(x.choice);points+=x.choice*(d.ring==='D'?2:1)}}
  if(d.hits!==h||g.hits!==h||d.thrown!==n||g.thrown!==n||d.points!==points||g.points!==points||!same(d.usedTargets,used)||!(points>=d.goal||n===d.allowed))return null;break;
 }
 case 'Checkout Poker':{
  if(!Array.isArray(d.cards)||!d.cards.length||new Set(d.cards).size!==d.cards.length||!d.cards.every(c=>legalFinishCount(c,3))||!count(d.allowed,1000)||!d.allowed)return null;
  const used=[];let successDarts=0;
  for(const x of log){if(h>=2||i>=d.allowed||!d.cards.includes(x.score)||used.includes(x.score)||!['hit','miss'].includes(x.value))return null;
   const hit=x.value==='hit';if(hit?![1,2,3].includes(x.darts)||!legalFinishCount(x.score,x.darts):x.darts!==3)return null;
   f(x.score,hit,x.darts);i++;n+=x.darts;if(hit){h++;successDarts+=x.darts;used.push(x.score)}else misses++}
  if(d.attempts!==i||d.wins!==h||d.failures!==misses||d.thrown!==n||g.thrown!==n||!same(d.cardsUsed??[],used)||(d.dartsUsed??0)!==successDarts||!(h===2||i===d.allowed))return null;break;
 }
 case 'Double Bull Bridge':{
  if(!list(d.stages,3,(a)=>a==='BULL'||exact(a)&&a[0]==='D')||d.stages[1]!=='BULL'||d.stages[0]==='BULL'||d.stages[2]==='BULL'||!count(d.allowed,1000)||!d.allowed)return null;
  let bullHits=0,bullDarts=0;
  for(const x of log){if(i>=3||n>=d.allowed||!['hit','miss'].includes(x.value))return null;
   const hit=x.value==='hit';if(d.stages[i]==='BULL'){bullDarts++;bullHits+=Number(hit)}else t(d.stages[i],Number(hit));n++;if(hit){h++;i++}}
  if(d.index!==i||d.hits!==h||g.hits!==h||d.thrown!==n||g.thrown!==n||!(i===3||n===d.allowed))return null;
  m('bull stage (reported target)',bullHits,bullDarts);break;
 }
 default:return null;
 }
 return done();
}
export function extraQuickRounds(host,day,now=Date.now()){
 const parents=trainingParentIndex(host.sessions??[]),out=[];
 for(const g of canonicalSkillGames(host.games??[],null,{since:now-84*86400000,until:now})){
  if(!g||!EXTRA_QUICK_GAMES.includes(g.name)||g.quick!==true||!skillPlayEligible(g,parents)||g.at>now||g.at<now-84*86400000||g.day>day||g.completion!=='natural'||g.recovery||g.challengeTuning)continue;
  const r=extraRound(g);if(r&&(r.metrics.length||r.targets.length||r.finishes.length))out.push(r);
 }
 return out;
}
// Descriptive adaptive protocols. Never converted into fixed calibration or dose.
export function quickAdaptiveMeasurements(host,day,now=Date.now()){
 const parents=trainingParentIndex(host.sessions??[]),groups=new Map();
 const add=(g,label,hits,attempts,scoring=false,perDart=false,unit=null)=>{const key=g.name+' · '+label+' · '+(Number.isInteger(g.tierAtStart)?'tier '+g.tierAtStart:'legacy setting'),x=groups.get(key)??{key,hits:0,attempts:0,days:new Set(),scoring,perDart,unit:unit??(scoring&&!perDart?'visits':'darts')};x.hits+=hits;x.attempts+=attempts;x.days.add(g.day);groups.set(key,x)};
 for(const g of canonicalSkillGames(host.games??[],null,{since:now-84*86400000,until:now})){
  if(!g||g.quick!==true||!skillPlayEligible(g,parents)||g.at>now||g.at<now-84*86400000||g.day>day||g.completion!=='natural'||g.recovery||g.challengeTuning)continue;
  if(['Scoring Survival','Scoring Ladder','First Nine Siege','Setup Shot','Risk or Reward','High-Low','Split the Difference'].includes(g.name)&&count(g.visits,1000)&&g.visits>=1&&Array.isArray(g.scores)&&g.scores.length===g.visits&&g.scores.every(n=>possible.has(n))&&(['Risk or Reward','High-Low','Split the Difference'].includes(g.name)||g.scores.reduce((a,b)=>a+b,0)===g.points)&&(g.name!=='First Nine Siege'||g.visits===3))add(g,g.name==='First Nine Siege'?'first nine, three fixed visits':'contextual three-dart visits',g.scores.reduce((a,b)=>a+b,0),g.visits,true);
  if(['301 Pressure','501 Pressure','170 Challenge'].includes(g.name)&&count(g.visits,1000)&&g.visits>0&&count(g.dartsUsed,3000)&&g.dartsUsed>3*(g.visits-1)&&g.dartsUsed<=3*g.visits&&Array.isArray(g.scores)&&g.scores.length===g.visits&&g.scores.every((n,i)=>possibleForDarts[i===g.visits-1?g.dartsUsed-3*(g.visits-1):3].has(n))&&g.scores.reduce((a,b)=>a+b,0)===g.points)add(g,'leg scoring with busts, recorded darts',g.points,g.dartsUsed,true,true);
  if(['Bull Bank','Bull Blackjack'].includes(g.name)){
   const b=g.name==='Bull Bank'?g:g.details,n=g.name==='Bull Bank'?g.dartsUsed:g.thrown;
   if(count(n,1000)&&n>0&&count(b?.outer,n)&&count(b?.inner,n)&&b.outer+b.inner<=n&&(g.name!=='Bull Bank'||count(g.misses,n)&&g.outer+g.inner+g.misses===n)&&g.points===25*b.outer+50*b.inner){add(g,'outer bull (25)',b.outer,n);add(g,'bullseye (50)',b.inner,n);add(g,'either bull',b.outer+b.inner,n)}
  }
  if(['Bull Survival','Bull Streak'].includes(g.name)&&['50','25/50','CENTRE'].includes(g.target)&&count(g.thrown,1000)&&g.thrown>0&&Array.isArray(g.targetLog)&&g.targetLog.length===g.thrown&&g.targetLog.every(x=>x?.target===g.target&&typeof x.hit==='boolean')&&g.targetLog.filter(x=>x.hit).length===g.hits)add(g,g.target==='50'?'bullseye only':g.target==='25/50'?'either bull':'centre practice area',g.hits,g.thrown);
  if(g.name==='Staying Straight'&&Array.isArray(g.targets)&&JSON.stringify(g.targets)===JSON.stringify([20,19,18,17,16])&&[g.hits,g.misses,g.counts].every(x=>Array.isArray(x)&&x.length===5&&x.every(n=>count(n,1000)))&&g.misses.every(n=>n===1)&&g.hits.reduce((a,b)=>a+b,0)+5===g.darts&&g.counts.every((n,i)=>n>=g.hits[i]&&n<=3*g.hits[i])&&g.counts.reduce((a,b)=>a+b,0)===g.points)for(let i=0;i<5;i++)add(g,'number lane '+g.targets[i]+' (any ring)',g.hits[i],g.hits[i]+1);
 }
 for(const r of extraQuickRounds(host,day,now))for(const x of r.metrics)add(r.g,x.label,x.hits,x.attempts,x.scoring,x.perDart,x.unit);
 return [...groups.values()].map(x=>({...x,days:x.days.size}));
}
export function quickAbilityLines(host,day,now=Date.now()){
 const rows=masteryRows(host,now).filter(r=>r.quick&&r.day<=day),groups=new Map();
 for(const r of rows){const x=groups.get(r.key)??{key:r.key,hits:0,attempts:0,days:new Set()};x.hits+=r.hit;x.attempts++;x.days.add(r.day);groups.set(r.key,x)}
 const fixed=new Map();
 for(const o of projectEvidence(host,{today:day,now}).observations.filter(o=>o.protocol.startsWith('IDC V6.2 Quick Play '))){const x=fixed.get(o.protocol)??{protocol:o.protocol,skill:o.skill,hits:0,attempts:0,days:new Set()};x.hits+=o.hits;x.attempts+=o.attempts;x.days.add(o.day);fixed.set(o.protocol,x)}
 const adaptive=quickAdaptiveMeasurements(host,day,now);
 return [...(groups.size||fixed.size||adaptive.length?[]:['No eligible completed Quick Play Mastery or measured game rounds recorded yet.']),
 ...[...groups.values()].sort((a,b)=>b.attempts-a.attempts||a.key.localeCompare(b.key)).map(x=>x.key+': '+x.hits+'/'+x.attempts+' ('+(100*x.hits/x.attempts).toFixed(1)+'%) across '+x.days.size+' measured days.'),
 ...[...fixed.values()].map(x=>x.protocol+': '+(x.skill==='scoring'?3*x.hits/x.attempts:100*x.hits/x.attempts).toFixed(1)+(x.skill==='scoring'?' average':'%')+' across '+x.days.size+' measured days and '+x.attempts+' darts.'),
 ...adaptive.map(x=>x.key+': '+(x.scoring?(x.perDart?3:1)*x.hits/x.attempts:100*x.hits/x.attempts).toFixed(1)+(x.scoring?' measured visit average':'%')+' across '+x.attempts+' '+x.unit+' and '+x.days+' days; adaptive stopping rules and task selection mean this is not a fixed benchmark.'),
 'Quick Play skill results are kept separate from scheduled training. Comparable fixed benchmarks can inform calibration; no recreational wins, scheduled completion credit or training-dose evidence is inferred.'].map(line=>line.replace(/tier [1-7]\b/g,'separate setting'));
}



export function projectEvidence(host,{today,now=Date.now()}={}){
 if(!host||typeof host!=='object'||!Array.isArray(host.games)||!Array.isArray(host.sessions)||!dayOK(today)||!Number.isFinite(now))throw Error('Invalid V6.2 snapshot or date');
 const rows=[],skipped=[],seen=new Map(),ambiguous=new Set(),parents=trainingParentIndex(host.sessions);
 const skip=(source,reason)=>skipped.push({source,reason});
 function add(source,day,skill,protocol,attempts,hits){
  if(!dayOK(day)||day>today||!count(attempts,1000)||!attempts||!count(hits,attempts*(skill==='scoring'?60:1))){skip(source,'invalid measurement');return false}
  const id='IDC:host-v62:'+source+':'+skill;
  if(id.length>100){skip(source,'measurement identity too long');return false}
  const o={id,day,skill,context:'practice',protocol:'IDC V6.2 '+protocol,attempts,hits};
  if(ambiguous.has(id))return false;
  if(seen.has(id)){if(JSON.stringify(seen.get(id))!==JSON.stringify(o)){ambiguous.add(id);skip(source,'conflicting record identity')}return false}
  seen.set(id,o);rows.push(o);return true;
 }
 for(const a of [...(Array.isArray(host.assessmentHistory)?host.assessmentHistory:[]),host.assessment].filter(Boolean)){
  const at=a.completedAt,day=localDay(at,a.offsetMinutes),source='assessment:'+at;
  if(a.version!==6||a.finished!==true||a.quickStart||a.carriedForward||!day||at>now){skip(source,'not a completed native assessment');continue}
  if(Array.isArray(a.scoring)&&a.scoring.length===20&&a.scoring.every(x=>x?.darts===3&&possible.has(x.score)))add(source,day,'scoring','assessment scoring 60 darts',60,a.scoring.reduce((s,x)=>s+x.score,0));else skip(source,'invalid scoring assessment');
  if(Array.isArray(a.doubles)&&a.doubles.length===20&&new Set(a.doubles.map(x=>x?.target)).size===20&&a.doubles.every(x=>/^D(?:[1-9]|1[0-9]|20)$/.test(x?.target)&&Array.isArray(x.darts)&&x.darts.length===3&&x.darts.every(d=>d?.segment===x.target||d?.segment==='MISS')))add(source,day,'doubles','assessment D1-D20 fixed 60',60,a.doubles.reduce((s,x)=>s+x.darts.filter(d=>d.segment===x.target).length,0));else skip(source,'invalid doubles assessment');
  if(Array.isArray(a.bull)&&a.bull.length===30&&a.bull.every(x=>[0,25,50].includes(x?.score)))add(source,day,'bull','assessment any bull 30',30,a.bull.filter(x=>x.score>0).length);else skip(source,'invalid bull assessment');
  if(Array.isArray(a.checkout)&&a.checkout.length===12&&a.checkout.every((x,i)=>x?.target===targets[i]&&typeof x.hit==='boolean'&&count(x.darts,3)&&x.darts>0&&(x.hit?legalFinishCount(x.target,x.darts):x.darts===3)))add(source,day,'checkout','assessment fixed 12 three-dart visits',12,a.checkout.filter(x=>x.hit).length);else skip(source,'invalid checkout assessment');
  if(Array.isArray(a.singles)&&a.singles.length===60&&a.singles.every((x,i)=>x?.target===Math.floor(i/3)+1&&typeof x.hit==='boolean'))add(source,day,'singles','assessment large singles 60',60,a.singles.filter(x=>x.hit).length);else skip(source,'invalid singles assessment');
 }
 for(const b of (Array.isArray(host.bigSingles)?host.bigSingles:[])){
  const source='daily-singles:'+b?.day;
  if(b?.complete!==true||!dayOK(b.day)||!count(b.hits,60)||!Array.isArray(b.perNumber)||b.perNumber.length!==20||!b.perNumber.every(n=>count(n,3))||b.perNumber.reduce((s,n)=>s+n,0)!==b.hits){skip(source,'invalid daily benchmark');continue}
  if(b.source==='assessment'){skip(source,'assessment mirror excluded');continue}
  if(b.at!=null&&(!Number.isFinite(b.at)||b.at>now||!localDay(b.at,b.offsetMinutes)||localDay(b.at,b.offsetMinutes)>today)){skip(source,'invalid or not yet available timestamp');continue}
  if(typeof b.sessionId!=='string'&&typeof b.sessionId!=='number'){skip(source,'missing native training session identity');continue}
  if(!trainingParentEligible({...b,quick:false},parents,true)){skip(source,'unconfirmed non-quick session');continue}
  const session=parents.parents.get(String(b.sessionId));
  // Native daily singles are attributed to the session start date, even
  // when the final dart is recorded after midnight. Reject contradictory
  // dates and timestamps instead of moving later evidence into an earlier day.
  if(session.date!==b.day||!Number.isFinite(session.start)||session.start<=0||session.start>now||localDay(session.start,session.startOffsetMinutes)!==b.day||(b.at!=null&&b.at<session.start)){skip(source,'daily benchmark chronology mismatch');continue}
  add(source,b.day,'singles','daily large singles 60',60,b.hits);
 }
 const games=canonicalSkillGames(host.games.filter(g=>g&&['Scoring Challenge','Bull Accuracy'].includes(g.name))),sources=fixedGameSources(games);
 for(const g of games){
  if(!g||!['Scoring Challenge','Bull Accuracy'].includes(g.name))continue;
  const source=sources.get(roundIdentity(g)),day=g.day;
  if(g.completion!=='natural'||g.benchmark!==true||!skillPlayEligible(g,parents)||g.recovery||g.challengeTuning||!Number.isFinite(g.at)||g.at<=0||g.at>now||!dayOK(day)||localDay(g.at,g.offsetMinutes)!==day){skip(source,'not a comparable fixed training game');continue}
  if(g.name==='Scoring Challenge'&&g.visits===10&&Array.isArray(g.scores)&&g.scores.length===10&&g.scores.every(n=>possible.has(n))&&g.scores.reduce((s,n)=>s+n,0)===g.points)add(source,day,'scoring',(g.quick?'Quick Play ':'')+'Scoring Challenge fixed 30 darts',30,g.points);
  else if(g.name==='Bull Accuracy'&&g.thrown===30&&count(g.outer,30)&&count(g.inner,30)&&g.outer+g.inner<=30&&count(g.misses,30)&&g.outer+g.inner+g.misses===30)add(source,day,'bull',(g.quick?'Quick Play ':'')+'Bull Accuracy any bull 30',30,g.outer+g.inner);
  else skip(source,'invalid game counts');
 }
 return {observations:rows.filter(o=>!ambiguous.has(o.id)).sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id)),skipped};
}
