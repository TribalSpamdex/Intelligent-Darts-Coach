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
const measurementFields=['name','ruleVersion','precision','learningSetting','quick','day','offsetMinutes','completion','benchmark','recovery','challengeTuning','variant','tierAtStart','tier','visits','points','scores','thrown','hits','success','fail','outer','inner','misses','attempts','masteryMode','target','targetLog','attemptLog','rangeStart','rangeEnd','pressure','counts','darts','targets','details'];
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export function canonicalSkillGames(games=[],conflicts=null){
 const seen=new Map(),bad=new Set(),legacy=[];
 for(const g of games){
  if(!g||!Number.isFinite(g.at)||g.at<=0){legacy.push(g);continue}
  const key=JSON.stringify([g.name,g.at,g.sessionId==null?null:String(g.sessionId)]),value=JSON.stringify(measurementFields.map(k=>stable(g[k])));
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
 for(const g of canonicalSkillGames(host.games??[])){
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
// Descriptive adaptive protocols. Never converted into fixed calibration or dose.
export function quickAdaptiveMeasurements(host,day,now=Date.now()){
 const parents=trainingParentIndex(host.sessions??[]),groups=new Map();
 const add=(g,label,hits,attempts,scoring=false)=>{const key=g.name+' · '+label+' · '+(Number.isInteger(g.tierAtStart)?'setting '+g.tierAtStart:'legacy setting'),x=groups.get(key)??{key,hits:0,attempts:0,days:new Set(),scoring};x.hits+=hits;x.attempts+=attempts;x.days.add(g.day);groups.set(key,x)};
 for(const g of canonicalSkillGames(host.games??[])){
  if(!g||g.quick!==true||!skillPlayEligible(g,parents)||g.at>now||g.at<now-84*86400000||g.day>day||g.completion!=='natural'||g.recovery||g.challengeTuning)continue;
  if(['Scoring Survival','Scoring Ladder'].includes(g.name)&&count(g.visits,1000)&&g.visits>=3&&Array.isArray(g.scores)&&g.scores.length===g.visits&&g.scores.every(n=>possible.has(n))&&g.scores.reduce((a,b)=>a+b,0)===g.points)add(g,'adaptive visits',g.points,g.visits,true);
  if(['Bull Survival','Bull Streak'].includes(g.name)&&['50','25/50','CENTRE'].includes(g.target)&&count(g.thrown,1000)&&g.thrown>0&&Array.isArray(g.targetLog)&&g.targetLog.length===g.thrown&&g.targetLog.every(x=>x?.target===g.target&&typeof x.hit==='boolean')&&g.targetLog.filter(x=>x.hit).length===g.hits)add(g,g.target==='50'?'bullseye only':g.target==='25/50'?'either bull':'centre practice area',g.hits,g.thrown);
  if(g.name==='Staying Straight'&&Array.isArray(g.targets)&&JSON.stringify(g.targets)===JSON.stringify([20,19,18,17,16])&&[g.hits,g.misses,g.counts].every(x=>Array.isArray(x)&&x.length===5&&x.every(n=>count(n,1000)))&&g.misses.every(n=>n===1)&&g.hits.reduce((a,b)=>a+b,0)+5===g.darts&&g.counts.every((n,i)=>n>=g.hits[i]&&n<=3*g.hits[i])&&g.counts.reduce((a,b)=>a+b,0)===g.points)for(let i=0;i<5;i++)add(g,'number lane '+g.targets[i]+' (any ring)',g.hits[i],g.hits[i]+1);
 }
 return [...groups.values()].map(x=>({...x,days:x.days.size}));
}
export function quickAbilityLines(host,day,now=Date.now()){
 const rows=masteryRows(host,now).filter(r=>r.quick&&r.day<=day),groups=new Map();
 for(const r of rows){const x=groups.get(r.key)??{key:r.key,hits:0,attempts:0,days:new Set()};x.hits+=r.hit;x.attempts++;x.days.add(r.day);groups.set(r.key,x)}
 const benchmarks=projectEvidence(host,{today:day,now}).observations.filter(o=>o.protocol.startsWith('IDC V6.2 Quick Play '));
 const parents=trainingParentIndex(host.sessions??[]),adaptive=new Map(),seen=new Map(),bad=new Set();
 for(const g of canonicalSkillGames(host.games??[])){
  if(!g||!['Scoring Survival','Scoring Ladder'].includes(g.name)||g.quick!==true||!Number.isFinite(g.at)||g.at>now||g.at<now-84*86400000)continue;
  const k=JSON.stringify([g.name,g.at,String(g.sessionId??'')]),value=JSON.stringify(g);
  if(seen.has(k)){if(seen.get(k).value!==value)bad.add(k)}else seen.set(k,{g,value});
 }
 for(const [k,{g}] of seen){
  if(bad.has(k)||!skillPlayEligible(g,parents)||g.day>day||g.completion!=='natural'||g.recovery||g.challengeTuning||!Array.isArray(g.scores)||g.scores.length!==g.visits||!Number.isInteger(g.visits)||g.visits<3||g.visits>1000||!g.scores.every(n=>possible.has(n))||g.scores.reduce((a,b)=>a+b,0)!==g.points)continue;
  const name=g.name+' · adaptive rounds',x=adaptive.get(name)??{name,points:0,visits:0,days:new Set()};x.points+=g.points;x.visits+=g.visits;x.days.add(g.day);adaptive.set(name,x);
 }
 const fixed=new Map();for(const o of benchmarks){const x=fixed.get(o.protocol)??{protocol:o.protocol,skill:o.skill,hits:0,attempts:0,days:new Set()};x.hits+=o.hits;x.attempts+=o.attempts;x.days.add(o.day);fixed.set(o.protocol,x)}
 const extra=quickAdaptiveMeasurements(host,day,now).filter(x=>!x.scoring);
 return [...extra.map(x=>x.key+': '+x.hits+'/'+x.attempts+' ('+(100*x.hits/x.attempts).toFixed(1)+'%) across '+x.days+' days; adaptive stopping rules.'),...(groups.size||fixed.size||adaptive.size||extra.length?[]:['No eligible completed Quick Play Mastery or fixed benchmark rounds recorded yet.']),...[...groups.values()].sort((a,b)=>b.attempts-a.attempts||a.key.localeCompare(b.key)).slice(0,35).map(x=>x.key+': '+x.hits+'/'+x.attempts+' ('+(100*x.hits/x.attempts).toFixed(1)+'%) across '+x.days.size+' measured days.'),...[...fixed.values()].map(x=>x.protocol+': '+(x.skill==='scoring'?3*x.hits/x.attempts:100*x.hits/x.attempts).toFixed(1)+(x.skill==='scoring'?' average':'%')+' across '+x.days.size+' measured days and '+x.attempts+' darts.'),...[...adaptive.values()].map(x=>x.name+': '+(x.points/x.visits).toFixed(1)+' measured visit average across '+x.visits+' visits and '+x.days.size+' days; adaptive stopping rules mean this is not a fixed scoring benchmark.'),'Quick Play skill results are kept separate from scheduled training. Comparable fixed benchmarks can inform calibration; no recreational wins, scheduled completion credit or training-dose evidence is inferred.'];
}


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
 for(const g of canonicalSkillGames(host.games)){
  if(!g||!['Scoring Challenge','Bull Accuracy'].includes(g.name))continue;
  const source='game:'+g.at+':'+g.name,day=g.day;
  if(g.completion!=='natural'||g.benchmark!==true||!skillPlayEligible(g,parents)||g.recovery||g.challengeTuning||!Number.isFinite(g.at)||g.at<=0||g.at>now||!dayOK(day)||localDay(g.at,g.offsetMinutes)!==day){skip(source,'not a comparable fixed training game');continue}
  if(g.name==='Scoring Challenge'&&g.visits===10&&Array.isArray(g.scores)&&g.scores.length===10&&g.scores.every(n=>possible.has(n))&&g.scores.reduce((s,n)=>s+n,0)===g.points)add(source,day,'scoring',(g.quick?'Quick Play ':'')+'Scoring Challenge fixed 30 darts',30,g.points);
  else if(g.name==='Bull Accuracy'&&g.thrown===30&&count(g.outer,30)&&count(g.inner,30)&&g.outer+g.inner<=30&&count(g.misses,30)&&g.outer+g.inner+g.misses===30)add(source,day,'bull',(g.quick?'Quick Play ':'')+'Bull Accuracy any bull 30',30,g.outer+g.inner);
  else skip(source,'invalid game counts');
 }
 return {observations:rows.filter(o=>!ambiguous.has(o.id)).sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id)),skipped};
}
