import {legalFinishCount} from './finish-validation.mjs';
// Source: darts-coach V6.2 b248a1caa169c9a45a6beda3954dc067cbfbe6e1.
// Read-only projection from authoritative host records. Rebuild after Undo or restore.
export const BASELINE='b248a1caa169c9a45a6beda3954dc067cbfbe6e1';
export const STORAGE_KEYS=Object.freeze({dartsCoachV4:'IDC:training:v1',dartsCoachV4Checkpoint:'IDC:training:checkpoint:v1',dartsCoachAccentColour:'IDC:accent:v1',dartsCoachRhythm:'IDC:rhythm:v1',dartsCoachCasualV1:'IDC:casual:v1'});
const values=[0,25,50,...Array.from({length:20},(_,i)=>i+1).flatMap(n=>[n,n*2,n*3])];
const possible=new Set();for(const a of values)for(const b of values)for(const c of values)possible.add(a+b+c);
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

export function projectEvidence(host,{today,now=Date.now()}={}){
 if(!host||typeof host!=='object'||!Array.isArray(host.games)||!Array.isArray(host.sessions)||!dayOK(today)||!Number.isFinite(now))throw Error('Invalid V6.2 snapshot or date');
 const rows=[],skipped=[],seen=new Map(),ambiguous=new Set(),parents=trainingParentIndex(host.sessions);
 const skip=(source,reason)=>skipped.push({source,reason});
 function add(source,day,skill,protocol,attempts,hits){
  if(!dayOK(day)||day>today||!count(attempts,1000)||!attempts||!count(hits,attempts*(skill==='scoring'?60:1))){skip(source,'invalid measurement');return false}
  const id='IDC:host-v62:'+source+':'+skill,o={id,day,skill,context:'practice',protocol:'IDC V6.2 '+protocol,attempts,hits};
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
 for(const g of host.games){
  if(!g||!['Scoring Challenge','Bull Accuracy'].includes(g.name))continue;
  const source='game:'+g.at+':'+g.name,day=g.day;
  if(g.completion!=='natural'||g.benchmark!==true||!trainingParentEligible(g,parents)||g.recovery||g.challengeTuning||!Number.isFinite(g.at)||g.at<=0||g.at>now||!dayOK(day)||localDay(g.at,g.offsetMinutes)!==day){skip(source,'not a comparable fixed training game');continue}
  if(g.name==='Scoring Challenge'&&g.visits===10&&Array.isArray(g.scores)&&g.scores.length===10&&g.scores.every(n=>possible.has(n))&&g.scores.reduce((s,n)=>s+n,0)===g.points)add(source,day,'scoring','Scoring Challenge fixed 30 darts',30,g.points);
  else if(g.name==='Bull Accuracy'&&g.thrown===30&&count(g.outer,30)&&count(g.inner,30)&&g.outer+g.inner<=30&&count(g.misses,30)&&g.outer+g.inner+g.misses===30)add(source,day,'bull','Bull Accuracy any bull 30',30,g.outer+g.inner);
  else skip(source,'invalid game counts');
 }
 // Exact fixed Quick Play protocols get their own measurement scope, never
 // pooled with scheduled tests or used as a training dose.
 for(const g of quickSkillGames(host,today,now)){
  const source='quick:'+g.at+':'+g.name;
  if(g.name==='Bull Accuracy'&&g.benchmark===true&&g.thrown===30&&count(g.outer,30)&&count(g.inner,30)&&count(g.misses,30)&&g.outer+g.inner+g.misses===30)add(source,g.day,'bull','Quick Play Bull Accuracy any bull 30',30,g.outer+g.inner);
  if(g.name==='Scoring Challenge'&&g.benchmark===true&&g.visits===10&&Array.isArray(g.scores)&&g.scores.length===10&&g.scores.every(n=>possible.has(n))&&g.scores.reduce((a,b)=>a+b,0)===g.points)add(source,g.day,'scoring','Quick Play Scoring Challenge fixed 30 darts',30,g.points);
 }
 return {observations:rows.filter(o=>!ambiguous.has(o.id)).sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id)),skipped};
}

 // Explicitly separate measured Quick Play from scheduled training dose.
 // A round must have a known, unique matching Quick Play parent and actual
 // recorded measurements. No result is inferred from wins or bot games.
 export function quickSkillGames(host,day,now=Date.now()){
  const index=trainingParentIndex([...(host.sessions??[]),...(host.activeQuickSession?[host.activeQuickSession]:[])]),groups=new Map(),bad=new Set();
  for(const g of host.games??[]){
   if(!g||typeof g.name!=='string'||!Number.isFinite(g.at)||g.at<=0||g.at>now)continue;
   const k=String(g.sessionId),id=JSON.stringify([k,g.name,g.at]),signature=JSON.stringify(g);
   if(groups.has(id)&&groups.get(id).signature!==signature)bad.add(id);else groups.set(id,{g,signature});
  }
  return [...groups].filter(([id])=>!bad.has(id)).map(([,x])=>x.g).filter(g=>{
   if(g.quick!==true||g.completion!=='natural'||g.recovery||g.challengeTuning||!dayOK(g.day)||g.day>day||localDay(g.at,g.offsetMinutes)!==g.day)return false;
   const k=String(g.sessionId),s=index.parents.get(k);
   return s&&!index.duplicates.has(k)&&s.quick===true&&s.quickGame===g.name&&Number.isFinite(s.start)&&s.start>0&&g.at>=s.start;
  });
 }
 export function masteryMeasurements(g){
  if(g.name!=='Target Mastery'||!count(g.hits,15))return [];
  const mode=g.masteryMode,log=g.targetLog;
  if(mode==='checkout'){
   const a=g.attemptLog;
   if(g.attempts!==5||g.hits>5||g.thrown!==0||!Array.isArray(a)||a.length!==5||a.filter(x=>x?.success===true).length!==g.hits)return [];
   const bands={'2–40':[24,32,40],'41–60':[42,52,60],'61–80':[64,72,80],'81–100':[81,92,100],'101+':[101,121,138]};
   if(!a.every(x=>x&&Object.hasOwn(bands,x.range)&&bands[x.range].includes(x.finish)&&x.allowance===3&&typeof x.success==='boolean'&&(x.dartsUsed==null||x.success&&legalFinishCount(x.finish,x.dartsUsed))))return [];
   return a.map(x=>({kind:'checkout',target:String(x.finish),protocol:'Mastery checkout '+x.range,attempts:1,hits:Number(x.success),darts:x.dartsUsed??null}));
  }
  if(!Array.isArray(log)||g.thrown!==15||log.length!==15||log.filter(x=>x?.hit===true).length!==g.hits)return [];
  if(mode==='bull'){
   if(!log.every(x=>x&&x.ring==='B'&&[25,50,null].includes(x.target)&&x.hit===(x.target!==null)))return [];
   return ['25','50','25/50'].map(target=>({kind:'bull',target,protocol:'Mastery bull',attempts:15,hits:log.filter(x=>target==='25/50'?x.hit:String(x.target)===target).length}));
  }
  if(!['segment','straight','switch','setup','pressure','scoring'].includes(mode)||!log.every(x=>x&&['S','D','T'].includes(x.ring)&&count(x.target,20)&&x.target>0&&typeof x.hit==='boolean'))return [];
  return log.map(x=>({kind:'target',target:x.ring+x.target,protocol:'Mastery '+mode,attempts:1,hits:Number(x.hit)}));
 }
 export function quickSkillMeasurements(host,day,now=Date.now()){
  const out=[];
  for(const g of quickSkillGames(host,day,now)){
   const add=(protocol,kind,target,attempts,hits)=>out.push({day:g.day,at:g.at,protocol:'Quick Play · '+protocol,kind,target,attempts,hits});
   if(g.name==='Target Mastery'){for(const x of masteryMeasurements(g))add(x.protocol,x.kind,x.target,x.attempts,x.hits);continue}
   if(g.name==='Bull Accuracy'&&g.benchmark===true&&g.thrown===30&&count(g.outer,30)&&count(g.inner,30)&&count(g.misses,30)&&g.outer+g.inner+g.misses===30){
    add('Bull Accuracy','bull','25',30,g.outer);add('Bull Accuracy','bull','50',30,g.inner);add('Bull Accuracy','bull','25/50',30,g.outer+g.inner);
   }
   if(['Scoring Challenge','Scoring Survival','Scoring Ladder'].includes(g.name)&&count(g.visits,1000)&&g.visits>0&&Array.isArray(g.scores)&&g.scores.length===g.visits&&g.scores.every(n=>possible.has(n))&&g.scores.reduce((a,b)=>a+b,0)===g.points){
    if(g.name==='Scoring Challenge'&&(g.visits!==10||g.benchmark!==true))continue;
    add(g.name,'scoring','visit',g.visits,g.points);
   }
   const ring=['Doubles Survival','Doubles Streak'].includes(g.name)?({doubles:'D',singles:'S'})[g.variant]:g.name==='Treble Hunt'?({treble:'T',single:'S'})[g.variant]:null;
   if(ring&&count(g.thrown,10000)&&g.thrown>0&&Array.isArray(g.targetLog)&&g.targetLog.length===g.thrown&&g.targetLog.every(x=>x&&x.ring===ring&&count(x.target,20)&&x.target>0&&typeof x.hit==='boolean')&&g.targetLog.filter(x=>x.hit).length===g.hits){
    for(const x of g.targetLog)add(g.name,'target',ring+x.target,1,Number(x.hit));
   }
   if(g.name==='Checkout Climb'&&count(g.success,1000)&&count(g.fail,1000)&&Array.isArray(g.attemptLog)&&g.attemptLog.length===g.success+g.fail&&g.attemptLog.every(x=>x&&count(x.target,170)&&x.target>=2&&[0,1,true,false].includes(x.hit)&&(!x.hit||legalFinishCount(x.target,1)||legalFinishCount(x.target,2)||legalFinishCount(x.target,3)))&&g.attemptLog.filter(x=>x.hit).length===g.success){
    for(const x of g.attemptLog)add(g.name,'checkout',String(x.target),1,Number(x.hit));
   }
  }
  return out;
 }
 export function quickSkillProfiles(host,day,now=Date.now(),days=84){
  const rows=quickSkillMeasurements(host,day,now).filter(x=>(Date.parse(day)-Date.parse(x.day))/86400000<days),groups=new Map();
  for(const r of rows){const k=JSON.stringify([r.protocol,r.target]),g=groups.get(k)??{...r,attempts:0,hits:0,days:new Set()};g.attempts+=r.attempts;g.hits+=r.hits;g.days.add(r.day);groups.set(k,g)}
  return [...groups.values()].sort((a,b)=>b.attempts-a.attempts||a.protocol.localeCompare(b.protocol)||a.target.localeCompare(b.target));
 }
 export function quickSkillLines(host,day,now=Date.now()){
  const ranked=quickSkillProfiles(host,day,now);
  return [ranked.length?ranked.length+' measured Quick Play game/target profiles in the last 84 days.':'No eligible completed Quick Play skill measurements yet.',...ranked.slice(0,40).map(g=>g.protocol+' · '+g.target+': '+(g.kind==='scoring'?(g.hits/g.attempts).toFixed(1)+' average · '+g.attempts+' visits':g.hits+'/'+g.attempts+' ('+(100*g.hits/g.attempts).toFixed(1)+'%)')+' · '+g.days.size+' measured days.'),...(ranked.length>40?['Showing 40 of '+ranked.length+' profiles.']:[]),'Adaptive games are descriptive and target-specific, not fixed ability benchmarks. Quick Play does not complete a scheduled session or establish training dose.'];
 }
