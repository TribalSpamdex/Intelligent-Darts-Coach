import {legalFinishCount} from './finish-validation.mjs';
// Source: darts-coach V6.2 b248a1caa169c9a45a6beda3954dc067cbfbe6e1.
// Read-only projection from authoritative host records. Rebuild after Undo or restore.
export const BASELINE='b248a1caa169c9a45a6beda3954dc067cbfbe6e1';
export const STORAGE_KEYS=Object.freeze({dartsCoachV4:'IDC:training:v1',dartsCoachV4Checkpoint:'IDC:training:checkpoint:v1',dartsCoachAccentColour:'IDC:accent:v1',dartsCoachRhythm:'IDC:rhythm:v1',dartsCoachCasualV1:'IDC:casual:v1'});
const values=[0,25,50,...Array.from({length:20},(_,i)=>i+1).flatMap(n=>[n,n*2,n*3])];
const possible=new Set();for(const a of values)for(const b of values)for(const c of values)possible.add(a+b+c);
const count=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
const dayOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
function localDay(at){if(!Number.isFinite(at)||at<=0)return null;const d=new Date(at);if(!Number.isFinite(+d))return null;return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
const targets=[41,46,52,60,68,76,81,90,101,110,120,130];
export function projectEvidence(host,{today,now=Date.now()}={}){
 if(!host||typeof host!=='object'||!Array.isArray(host.games)||!Array.isArray(host.sessions)||!dayOK(today)||!Number.isFinite(now))throw Error('Invalid V6.2 snapshot or date');
 const rows=[],skipped=[],seen=new Map(),ambiguous=new Set();
 const skip=(source,reason)=>skipped.push({source,reason});
 function add(source,day,skill,protocol,attempts,hits){
  if(!dayOK(day)||day>today||!count(attempts,1000)||!attempts||!count(hits,attempts*(skill==='scoring'?60:1))){skip(source,'invalid measurement');return false}
  const id='IDC:host-v62:'+source+':'+skill,o={id,day,skill,context:'practice',protocol:'IDC V6.2 '+protocol,attempts,hits};
  if(ambiguous.has(id))return false;
  if(seen.has(id)){if(JSON.stringify(seen.get(id))!==JSON.stringify(o)){ambiguous.add(id);skip(source,'conflicting record identity')}return false}
  seen.set(id,o);rows.push(o);return true;
 }
 for(const a of [...(Array.isArray(host.assessmentHistory)?host.assessmentHistory:[]),host.assessment].filter(Boolean)){
  const at=a.completedAt,day=localDay(at),source='assessment:'+at;
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
  if(b.at!=null&&(!Number.isFinite(b.at)||b.at>now)){skip(source,'invalid timestamp');continue}
  if(typeof b.sessionId!=='string'&&typeof b.sessionId!=='number'){skip(source,'missing native training session identity');continue}
  const sessions=host.sessions.filter(s=>s?.id===b.sessionId);if(sessions.length!==1||sessions[0].quick!==false){skip(source,'unconfirmed non-quick session');continue}
  const session=sessions[0];
  // Native daily singles are attributed to the session start date, even
  // when the final dart is recorded after midnight. Reject contradictory
  // dates and timestamps instead of moving later evidence into an earlier day.
  if(session.date!==b.day||!Number.isFinite(session.start)||session.start<=0||session.start>now||localDay(session.start)!==b.day||(b.at!=null&&b.at<session.start)){skip(source,'daily benchmark chronology mismatch');continue}
  add(source,b.day,'singles','daily large singles 60',60,b.hits);
 }
 for(const g of host.games){
  if(!g||!['Scoring Challenge','Bull Accuracy'].includes(g.name))continue;
  const source='game:'+g.at+':'+g.name,day=g.day;
  if(g.completion!=='natural'||g.benchmark!==true||g.quick!==false||g.recovery||g.challengeTuning||!Number.isFinite(g.at)||g.at<=0||g.at>now||!dayOK(day)||localDay(g.at)!==day){skip(source,'not a comparable fixed training game');continue}
  if(g.name==='Scoring Challenge'&&g.visits===10&&Array.isArray(g.scores)&&g.scores.length===10&&g.scores.every(n=>possible.has(n))&&g.scores.reduce((s,n)=>s+n,0)===g.points)add(source,day,'scoring','Scoring Challenge fixed 30 darts',30,g.points);
  else if(g.name==='Bull Accuracy'&&g.thrown===30&&count(g.outer,30)&&count(g.inner,30)&&g.outer+g.inner<=30&&count(g.misses,30)&&g.outer+g.inner+g.misses===30)add(source,day,'bull','Bull Accuracy any bull 30',30,g.outer+g.inner);
  else skip(source,'invalid game counts');
 }
 return {observations:rows.filter(o=>!ambiguous.has(o.id)).sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id)),skipped};
}
