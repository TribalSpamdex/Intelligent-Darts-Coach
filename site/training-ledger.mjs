// Authoritative observed training ledger. Read-only; no new stored player facts.
import {dayValid,dayGap} from './engine/context.mjs';
import {validSetting} from './challenge-setting.mjs';
import {validPrecisionRecord} from './precision-games.mjs';
const direct=new Map([
 ['Scoring Challenge','scoring'],['Scoring Survival','scoring'],['Scoring Ladder','scoring'],
 ['First Nine Siege','firstNine'],['Big Singles','singles'],['Bull Accuracy','bull'],
 ['Bull Bank','bull'],['Bull Blackjack','bull'],['Checkout Climb','checkout'],
 ['Focused Checkouts','checkout'],['170 Challenge','checkout'],['101 Sprint','checkout'],
 ['Double Double','doubles'],['Outside Doubles','doubles'],['Setup Shot','setup']
]);
const variant=new Set(['Doubles Survival','Doubles Streak','Treble Hunt','Number Lock','Golf Five','Switchback','Double Jackpot','Double Duel','Dartboard Bingo','Bull Survival','Bull Streak']);
export const LEDGER_SKILLS=Object.freeze(['scoring','firstNine','doubles','checkout','bull','singles','trebles','switching','setup','pressure','grouping']);
const id=x=>typeof x==='string'&&x.length>0&&x.length<=150||Number.isSafeInteger(x)&&x>0;
const duration=x=>Number.isInteger(x)&&x>=0&&x<=3600;
const text=x=>typeof x==='string'&&x.length>0&&x.length<=120;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const positiveTime=(x,now)=>Number.isFinite(x)&&x>0&&x<=now;
const ringSkill=r=>({S:'singles',D:'doubles',T:'trebles'})[r]??null;
function oneSkill(g){
 if(g.name==='Doubles Survival'||g.name==='Doubles Streak')return ({singles:'singles',doubles:'doubles'})[g.variant]??null;
 if(g.name==='Treble Hunt')return ({single:'singles',treble:'trebles'})[g.variant]??null;
 if(g.name==='Number Lock')return ringSkill(g.ring);
 if(g.name==='Golf Five'||g.name==='Double Jackpot'||g.name==='Double Duel'||g.name==='Dartboard Bingo')return ringSkill(g.details?.ring??g.ring);
 if(g.name==='Switchback')return ['S','D','T'].includes(g.details?.ring)?'switching':null;
 if(['Bull Survival','Bull Streak'].includes(g.name))return g.target==='25/50'?'bull':null;
 return null;
}
function classify(name,records){
 if(name==='Warm-up'||name==='Review')return {skill:null,kind:'routine'};
 // Mixed rules and recovery exposure must not masquerade as fixed practice.
 if(records.some(g=>g.recovery))return {skill:null,kind:'recovery'};
 if(direct.has(name))return {skill:direct.get(name),kind:'direct'};
 if(!variant.has(name))return {skill:null,kind:'mixed-or-unknown'};
 if(!records.length)return {skill:null,kind:'unverified-variant'};
 const skills=records.map(oneSkill);
 return skills[0]&&skills.every(s=>s===skills[0])?{skill:skills[0],kind:'recorded-variant'}:{skill:null,kind:'unverified-variant'};
}
function validRound(g,s,a,now){
 if(g.name!==a.name||g.sessionId!==s.id||g.exerciseId!==a.exerciseId||g.exerciseIndex!==a.exerciseIndex||g.day!==s.date||g.quick!==false||g.extra!==s.extra||!positiveTime(g.at,now)||g.at<s.start||g.at>a.at||!['natural','manual','partial','timed'].includes(g.completion))return false;
 // A malformed adjusted rule may be visible in the raw host, but it is
 // ineligible for configuration-level analysis.
 if(g.precision&&!validPrecisionRecord(g))return false;
 if(g.learningSetting&&(!validSetting(g.learningSetting)||g.learningSetting.name!==g.name||g.learningSetting.tier!==g.tierAtStart))return false;
 return true;
}
export function trainingLedger(host,day,now=Date.now()){
 if(!dayValid(day)||!Number.isFinite(now)||!Array.isArray(host?.sessions)||!Array.isArray(host?.games))throw Error('Invalid training ledger');
 const sessions=new Map(),duplicate=new Set(),rounds=new Map(),roundConflicts=new Set();
 const rejected={session:0,duplicate:0,activity:0,round:0};
 for(const s of host.sessions){
  if(!s||s.quick!==false||!dayValid(s.date)||s.date>day||dayGap(s.date,day)>=365)continue;
  if(!id(s.id)){rejected.session++;continue}
  const k=String(s.id);
  if(sessions.has(k))duplicate.add(k);else sessions.set(k,s);
 }
 const groups=new Map();
 for(const g of host.games){
  if(!g||!id(g.sessionId)||!sessions.has(String(g.sessionId))||!positiveTime(g.at,now))continue;
  const k=JSON.stringify([String(g.sessionId),g.exerciseIndex,g.exerciseId,g.at,g.name]);
  if(rounds.has(k)){if(!same(rounds.get(k),g))roundConflicts.add(k)}
  else rounds.set(k,g);
 }
 for(const [k,g] of rounds){
  const sid=String(g.sessionId),a=groups.get(sid)??[];
  a.push({g,conflict:roundConflicts.has(k)});groups.set(sid,a);
 }
 const rows=[],sessionRows=[],blockedDays=new Set();
 for(const [sid,s] of sessions){
  if(duplicate.has(sid)){rejected.duplicate++;blockedDays.add(s.date);continue}
  if(!positiveTime(s.start,now)||typeof s.extra!=='boolean'||typeof s.completed!=='boolean'||!Array.isArray(s.activities)){rejected.session++;blockedDays.add(s.date);continue}
  const acts=[...s.activities,...(s.interruptedExercise?[{...s.interruptedExercise,interrupted:true}]:[])],indexes=new Set(),ids=new Set();
  let invalid=acts.length>100;
  for(const a of acts){
   if(!a||!text(a.name)||!duration(a.seconds)||!Number.isInteger(a.exerciseIndex)||a.exerciseIndex<0||indexes.has(a.exerciseIndex)||id(a.exerciseId)&&ids.has(String(a.exerciseId))||!a.interrupted&&(!positiveTime(a.at,now)||a.at<s.start)||a.interrupted&&a.partialResultAt!=null&&(!positiveTime(a.partialResultAt,now)||a.partialResultAt<s.start)){invalid=true;break}
   indexes.add(a.exerciseIndex);if(id(a.exerciseId))ids.add(String(a.exerciseId));
  }
  if(invalid||acts.reduce((n,a)=>n+a.seconds,0)>7200){rejected.activity++;blockedDays.add(s.date);continue}
  if(!s.completed||s.interruptedExercise)blockedDays.add(s.date);
  sessionRows.push({sessionId:s.id,day:s.date,extra:s.extra,completed:s.completed,seconds:acts.reduce((n,a)=>n+a.seconds,0)});
  for(const a of acts){
   if(!a.seconds)continue;
   if(a.interrupted){
    rows.push({day:s.date,sessionId:s.id,exerciseId:a.exerciseId??null,index:a.exerciseIndex,name:a.name,seconds:a.seconds,plannedSeconds:null,extra:s.extra,sessionCompleted:false,interrupted:true,skill:null,kind:'interrupted',roundCoverage:false,rounds:null});
    continue;
   }
   const linked=(groups.get(sid)??[]).filter(x=>x.g.exerciseIndex===a.exerciseIndex||id(a.exerciseId)&&x.g.exerciseId===a.exerciseId);
   const valid=id(a.exerciseId)&&linked.every(x=>!x.conflict&&validRound(x.g,s,a,now));
   const natural=valid?linked.filter(x=>x.g.completion==='natural').length:0;
   const roundCoverage=valid&&Number.isInteger(a.rounds)&&a.rounds>=0&&a.rounds===natural;
   if((linked.length||Number.isInteger(a.rounds)&&a.rounds>0)&&(!valid||!roundCoverage)){rejected.round++;blockedDays.add(s.date)}
   const cls=classify(a.name,valid&&roundCoverage?linked.map(x=>x.g):[]);
   const classified=cls.skill!==null&&(!linked.length||valid&&roundCoverage);
   rows.push({day:s.date,sessionId:s.id,exerciseId:a.exerciseId??null,index:a.exerciseIndex,name:a.name,seconds:a.seconds,plannedSeconds:duration(a.plannedSeconds)?a.plannedSeconds:null,extra:s.extra,sessionCompleted:s.completed,interrupted:!!a.interrupted,skill:classified?cls.skill:null,kind:classified?cls.kind:cls.skill?'unverified-records':cls.kind,roundCoverage,rounds:roundCoverage?natural:null});
  }
 }
 return {rows:rows.sort((a,b)=>a.day.localeCompare(b.day)||String(a.sessionId).localeCompare(String(b.sessionId))||a.index-b.index),sessions:sessionRows.sort((a,b)=>a.day.localeCompare(b.day)),blockedDays:[...blockedDays].sort(),rejected,limitation:'Recorded elapsed exercise time, not throwing time or number of darts. Interrupted, mixed, uncertain and routine minutes remain separate. Unlogged practice is unknown.'};
}
const sum=(xs,k)=>xs.reduce((n,x)=>n+x[k],0);
export function ledgerWindows(ledger,day){
 return [7,28,84,365].map(days=>{
  const rows=ledger.rows.filter(x=>dayGap(x.day,day)<days),sessions=ledger.sessions.filter(x=>dayGap(x.day,day)<days);
  const main=rows.filter(x=>!x.extra),extra=rows.filter(x=>x.extra);
  const classified=rows.filter(x=>x.skill),skills=LEDGER_SKILLS.map(skill=>{
   const x=classified.filter(r=>r.skill===skill),planned=x.filter(r=>r.plannedSeconds!==null);
   return {skill,seconds:sum(x,'seconds'),scheduledSeconds:sum(x.filter(r=>!r.extra),'seconds'),extraSeconds:sum(x.filter(r=>r.extra),'seconds'),days:new Set(x.map(r=>r.day)).size,exercises:x.length,plannedSeconds:planned.length?sum(planned,'plannedSeconds'):null,observedComparableSeconds:planned.length?sum(planned,'seconds'):null};
  });
  const category=kind=>sum(rows.filter(r=>r.kind===kind),'seconds');
  const total=sum(rows,'seconds'),direct=sum(classified,'seconds'),routine=category('routine'),interrupted=category('interrupted');
  return {days,total,direct,routine,interrupted,unclassified:total-direct-routine-interrupted,scheduled:sum(main,'seconds'),extra:sum(extra,'seconds'),sessions:sessions.length,completedSessions:sessions.filter(s=>s.completed).length,recordedDays:new Set(sessions.map(s=>s.day)).size,skills,coverage:total-routine>0?direct/(total-routine):null};
 });
}
export function ledgerLines(ledger,day){
 const mins=s=>(s/60).toFixed(1)+' min';
 const windows=ledgerWindows(ledger,day);
 if(!windows[3].sessions)return ['No validated saved training sessions in the last 365 days.',ledger.limitation];
 return [...windows.flatMap(w=>[w.days+' days: '+w.sessions+' saved sessions ('+w.completedSessions+' completed); '+w.recordedDays+' recorded days. '+mins(w.total)+' logged activity, '+mins(w.scheduled)+' scheduled / '+mins(w.extra)+' extra.','Classified '+mins(w.direct)+'; routine '+mins(w.routine)+'; interrupted '+mins(w.interrupted)+'; other/unverified '+mins(w.unclassified)+'.',...w.skills.filter(s=>s.seconds).map(s=>s.skill+': '+mins(s.seconds)+' on '+s.days+' days across '+s.exercises+' exercises'+(s.plannedSeconds===null?'':'; matched planned '+mins(s.plannedSeconds)+', observed '+mins(s.observedComparableSeconds))+'.')]),'Rejected records: '+Object.entries(ledger.rejected).map(([k,v])=>k+' '+v).join(', ')+'.',ledger.limitation];
}
