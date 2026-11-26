// Reconstruct delivered training adjustments from locked native plans and
// matched completed activities. Planned extra minutes are NOT actual throws.
import {dayValid,dayGap} from './engine/context.mjs';
import {baselineIntegrity,reviewReproduction,verifiedRetention} from './intervention-audit.mjs';
import {extractLearningExposure} from './challenge-exposure.mjs';
import {validSetting,settingKey} from './challenge-setting.mjs';
import {FIXED_PROTOCOLS,recordedConfounder} from './challenge-episodes.mjs';
import {canonicalRows} from './longitudinal.mjs';
import {summarise} from './engine/engine.mjs';
const integer=n=>Number.isInteger(n)&&n>=0&&n<=7200;
export function deliveryEvidence(host,item,day,now=Date.now()){
 if(!dayValid(day)||!dayValid(item?.responseDay)||item.responseDay>day||!Array.isArray(host?.sessions))throw Error('Invalid delivery history');
 const end=item.reviewDay&&item.reviewDay<day?item.reviewDay:day,seen=new Map(),dupes=new Set(),rows=[];
 for(const s of host.sessions){
  if(!s||s.quick!==false||s.extra!==false||!dayValid(s.date)||s.date<item.responseDay||s.date>end)continue;
  const k=String(s.id);if(seen.has(k))dupes.add(k);else seen.set(k,s);
 }
 for(const [id,s] of seen){
  const t=s.wholeSessionAudit?.idcTransfer;if(t?.status!=='transferred'||t.intervention!==item.id)continue;
  const b=s.provenanceLocked,locked=b?.exercises,p=t.delivery;
  const base={id,day:s.date,planned:0,observedBeyondOriginal:null,status:'unverified'};
  const reject=reason=>rows.push({...base,reason});
  if(dupes.has(id)||t.skill!==item.skill||t.day!==s.date||t.seconds!==300||!Number.isInteger(t.from)||!Number.isInteger(t.to)||t.from===t.to||t.from<0||t.to<0){reject('invalid transfer identity');continue}
  if(!Number.isFinite(s.start)||s.start<=0||s.start>now||b?.kind!=='post-allocation'||!Number.isFinite(b.at)||b.at<s.start||b.at>now||!Array.isArray(locked)||!p||p.version!==1||!Number.isInteger(p.receiverIndex)||p.receiverIndex<0){reject('missing exact transfer provenance; older planned allocations cannot establish delivery');continue}
  const receiver=locked[p.receiverIndex],oldReceiver={proposedSeconds:p.receiver?.before};
  const valid=x=>x&&typeof x.name==='string'&&x.name.length>0&&integer(x.before)&&integer(x.after);
  if(!valid(p.donor)||!valid(p.receiver)||p.donor.before-p.donor.after!==300||p.receiver.after-p.receiver.before!==300||p.donor.after<300||p.receiver.before<300||p.receiver.after>1200||!receiver||receiver.index!==p.receiverIndex||receiver.id!==id+':exercise:'+p.receiverIndex||receiver.mode!=='timed'||receiver.name!==p.receiver.name||receiver.plannedSeconds!==p.receiver.after){reject('transfer not reproduced by immediate budgets and locked receiver');continue}
  const candidates=(s.activities??[]).filter(x=>x.exerciseIndex===p.receiverIndex||x.exerciseId===receiver.id);
  if(candidates.length!==1){rows.push({...base,planned:300,status:'planned-only',reason:'receiver completion not uniquely recorded'});continue}
  const x=candidates[0];
  if(x.exerciseId!==receiver.id||x.exerciseIndex!==p.receiverIndex||x.name!==receiver.name||x.plannedSeconds!==receiver.plannedSeconds||!integer(x.seconds)||!Number.isFinite(x.at)||x.at<b.at||x.at>now){rows.push({...base,planned:300,status:'planned-only',reason:'receiver activity inconsistent with locked plan'});continue}
  const observed=Math.min(300,Math.max(0,x.seconds-oldReceiver.proposedSeconds));
  rows.push({...base,planned:300,observedBeyondOriginal:observed,status:s.completed===true?'matched-activity':'abandoned-activity',completedSession:s.completed===true,actualSeconds:x.seconds,originalSeconds:oldReceiver.proposedSeconds,allocatedSeconds:receiver.plannedSeconds});
 }
 return {rows,plannedSeconds:rows.reduce((n,x)=>n+x.planned,0),observedBeyondOriginal:rows.filter(x=>x.status==='matched-activity').reduce((n,x)=>n+(x.observedBeyondOriginal??0),0),matched:rows.filter(x=>x.status==='matched-activity').length,abandoned:rows.filter(x=>x.status==='abandoned-activity').length,abandonedElapsedBeyondOriginal:rows.filter(x=>x.status==='abandoned-activity').reduce((n,x)=>n+(x.observedBeyondOriginal??0),0),unverified:rows.filter(x=>x.status==='unverified').length,limitation:'Only completed sessions contribute to delivery totals. Abandoned activities are reported separately; elapsed time is capped at five minutes per transfer and is not actual throwing time, causal proof or player-reported adherence.'};
}
// Conservative eligibility policy, not a scientifically validated dose threshold.
// Require three separate completed, attributable exercises, each with at least
// four of the additional five minutes and a real recorded throwing round.
export function attributableAllocation(host,item,day,now=Date.now()){
 if(!Array.isArray(host?.games)||!Array.isArray(host?.sessions)||item.context!=='practice')return false;
 const evidence=deliveryEvidence(host,item,day,now),days=new Set();
 for(const row of evidence.rows){
  if(row.status!=='matched-activity'||row.completedSession!==true||row.observedBeyondOriginal<240)continue;
  const session=host.sessions.find(s=>String(s.id)===row.id);
  const index=session?.wholeSessionAudit?.idcTransfer?.delivery?.receiverIndex;
  const receiver=session?.provenanceLocked?.exercises?.[index],activity=session?.activities?.find(a=>a.exerciseId===receiver?.id);
  if(!receiver||!activity)continue;
  const rounds=host.games.filter(g=>g.sessionId===session.id&&g.exerciseId===receiver.id&&g.exerciseIndex===index&&g.name===receiver.name&&g.quick===false&&g.extra===false&&!g.recovery&&['natural','partial'].includes(g.completion)&&g.day===session.date&&Number.isFinite(g.at)&&g.at>=session.provenanceLocked.at&&g.at<=activity.at);
  const unique=new Set(rounds.map(g=>g.at));
  if(rounds.length!==unique.size||!rounds.some(g=>[g.thrown,g.visits,g.attempts,g.dartsUsed,g.darts].some(n=>Number.isInteger(n)&&n>0)))continue;
  days.add(row.day);
 }
 return days.size>=3;
}
export function coachingAccountability(host,state,baselines,day,now=Date.now()){
 const rows=[];
 for(const i of state.interventions??[]){
  if(!dayValid(i.responseDay)||i.responseDay>day||i.status==='declined')continue;
  const base=Object.hasOwn(baselines,i.id)?baselines[i.id]:[];
  const integrity=baselineIntegrity(i,base,state.observations,day),review=reviewReproduction(i,base,state.observations,day),retention=verifiedRetention(state,i,base,day),delivery=deliveryEvidence(host,i,day,now);
  const due=dayGap(i.responseDay,day)>=i.reviewAfterDays;
  const status=integrity.status!=='intact'?'baseline-edited':review.status==='reproduced'?!attributableAllocation(host,i,day,now)?'review-reproduced-delivery-unverified':'review-reproduced':review.status==='not-reviewed'?due?'review-due':'awaiting-review':'review-needs-verification';
  rows.push({id:i.id,skill:i.skill,protocol:i.protocol,status,observedOutcome:review.status==='reproduced'?i.outcome.status:null,retentionChecks:retention.valid.length,invalidRetention:retention.invalid,reportedAdherence:i.reviewDay&&i.reviewDay<=day?i.adherence??null:null,delivery});
 }
 return rows;
}
export function accountabilityLines(rows){
 if(!rows.length)return ['No accepted intervention history to audit.'];
 return [...rows.slice(-20).flatMap(r=>[r.skill+' · '+r.protocol+' · '+r.status.replaceAll('-',' ')+'. '+(r.observedOutcome??'No reproduced outcome')+'.','Reconstructed allocation '+(r.delivery.plannedSeconds/60).toFixed(1)+' min; matched elapsed activity above original budget '+(r.delivery.observedBeyondOriginal/60).toFixed(1)+' min across '+r.delivery.matched+' completed-session activities. '+r.delivery.unverified+' unverified transfers. '+r.delivery.abandoned+' abandoned-session activities excluded.','Reported adherence '+(r.reportedAdherence===null?'not recorded':(100*r.reportedAdherence).toFixed(0)+'%')+'; '+r.retentionChecks+' reproduced retention checks, '+r.invalidRetention+' invalid checks.']), 'Reproduced results remain observational. Delivery, adherence, and outcome are different kinds of evidence; no causal success rate is asserted.'];
}

export function deliveryGate(host,item,day,now=Date.now()){
 const evidence=deliveryEvidence(host,item,day,now),byDay=new Map();
 for(const r of evidence.rows){
  if(r.status!=='matched-activity'||r.completedSession!==true||dayGap(r.day,day)>=14)continue;
  const previous=byDay.get(r.day)??0;byDay.set(r.day,Math.max(previous,r.observedBeyondOriginal));
 }
 const recent=[...byDay].sort(([a],[b])=>b.localeCompare(a)).slice(0,3);
 // Only three distinct recent measured days with confirmed incomplete
 // delivery can defer a repeat. Unknown records and legacy transfers are
 // not evidence of a shortfall. One bad or interrupted day is insufficient.
 const defer=recent.length===3&&dayGap(recent[0][0],day)<=7&&recent.every(([,seconds])=>seconds<150);
 return {defer,measuredDays:recent.length,recent,reason:defer?'Three recent distinct days had less than half the additional elapsed allocation delivered; review the adjustment before repeating it.':'No repeated measured delivery shortfall established.'};
}

// Reconstruct selected drills, actual elapsed activity, exact-setting
// recorded rounds and subsequent independent-day checks separately.
const methodMinimum={scoring:30,doubles:60,checkout:12,bull:30};
export function methodDeliveryEvidence(host,day,now=Date.now()){
 if(!dayValid(day)||!Array.isArray(host?.sessions)||!Number.isFinite(now))throw Error('Invalid method history');
 const sessions=new Map(),duplicates=new Set(),out=[];
 for(const s of host.sessions){
  if(!s||!dayValid(s.date)||s.date>day||dayGap(s.date,day)>180)continue;
  const id=String(s.id);if(sessions.has(id))duplicates.add(id);else sessions.set(id,s);
 }
 if(![...sessions.values()].some(s=>s.wholeSessionAudit?.idcMethod?.status==='selected'))return [];
 const exposure=Array.isArray(host.games)?extractLearningExposure(host,day,now).exposures:[];
 const byExercise=new Map(exposure.map(e=>[e.exerciseId,e]));
 for(const [id,s] of sessions){
  const d=s.wholeSessionAudit?.idcMethod;if(d?.status!=='selected'||s.quick!==false||s.extra!==false)continue;
  const base={id,day:s.date,skill:d.skill,protocol:d.protocol,normal:d.normal,alternative:d.alternative,status:'unverified',seconds:null,exactSetting:false};
  const reject=reason=>out.push({...base,reason});
  if(duplicates.has(id)||!(typeof s.id==='string'&&s.id.length>0||Number.isSafeInteger(s.id)&&s.id>0)||d.day!==s.date||!FIXED_PROTOCOLS[d.skill]?.includes(d.protocol)||!Object.hasOwn(methodMinimum,d.skill)||typeof d.normal!=='string'||d.normal===d.alternative||typeof d.alternative!=='string'||!validSetting(d.expectedSetting)||d.expectedSetting.name!==d.alternative||d.expectedSetting.skill!==d.skill||!Number.isInteger(d.seconds)||d.seconds<300||d.seconds>1200||!Number.isInteger(d.exerciseIndex)||d.exerciseIndex<0){reject('Invalid selection identity or missing historical setting');continue}
  const p=s.provenanceInitial,b=s.provenanceLocked,idx=d.exerciseIndex,e=b?.exercises?.[idx],eid=id+':exercise:'+idx;
  if(!Number.isFinite(s.start)||s.start<=0||!Number.isFinite(d.at)||d.at<s.start||d.at>now||p?.kind!=='initial-selection'||!Number.isFinite(p.at)||p.at<s.start||p.at>d.at||!Array.isArray(p.exercises)||p.exercises.filter(x=>x?.name===d.normal&&x.mode==='timed').length!==1||p.exercises.some(x=>x?.name===d.alternative)||b?.kind!=='post-allocation'||!Number.isFinite(b.at)||b.at<d.at||b.at>now||!Array.isArray(b.exercises)||!e||e.id!==eid||e.index!==idx||e.mode!=='timed'||e.name!==d.alternative||e.plannedSeconds!==d.seconds||b.exercises.some(x=>x?.name===d.normal)||b.exercises.filter(x=>x?.name===d.alternative).length!==1){reject('Initial and locked plans do not reproduce the selection');continue}
  const a=(Array.isArray(s.activities)?s.activities:[]).filter(x=>x?.exerciseId===eid||x?.exerciseIndex===idx);
  const planned={...base,status:'selected-only',plannedSeconds:d.seconds,reason:'No unique matched activity'};
  if(a.length!==1){out.push(planned);continue}
  const x=a[0];if(x.exerciseId!==eid||x.exerciseIndex!==idx||x.name!==e.name||x.plannedSeconds!==d.seconds||!integer(x.seconds)||!Number.isFinite(x.at)||x.at<b.at||x.at>now){out.push({...planned,reason:'Activity does not match locked exercise'});continue}
  const actual=byExercise.get(eid),exact=!!actual&&actual.sessionId===s.id&&actual.exerciseIndex===idx&&actual.seconds===x.seconds&&settingKey(actual.setting)===settingKey(d.expectedSetting);
  const delivered=exact&&s.completed===true&&x.seconds>=Math.max(300,.8*d.seconds);
  out.push({...base,status:delivered?'eligible-exposure':'matched-activity',plannedSeconds:d.seconds,seconds:x.seconds,exactSetting:exact,rounds:exact?actual.completed:null,reason:delivered?'Matched elapsed activity and exact-setting rounds':'Exact-setting exposure not established'});
 }
 return out.sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id));
}
export function methodReviews(host,state,day,now=Date.now()){
 const delivery=methodDeliveryEvidence(host,day,now);
 if(!delivery.length)return [];
 const rows=canonicalRows(state.observations??[],day),groups=new Map(),used=new Set(),out=[];
 for(const o of rows){
  if(o.context!=='practice'||!Object.hasOwn(methodMinimum,o.skill)||!FIXED_PROTOCOLS[o.skill]?.includes(o.protocol))continue;
  const key=JSON.stringify([o.skill,o.protocol]),g=groups.get(key)??new Map(),list=g.get(o.day)??[];
  list.push(o);g.set(o.day,list);groups.set(key,g);
 }
 for(const r of delivery){
  const result={...r,outcome:'not-evaluated',baselineDays:[],followupDays:[],change:null};
  if(r.status!=='eligible-exposure'){out.push(result);continue}
  const key=JSON.stringify([r.skill,r.protocol]),scale=r.skill==='scoring'?1:100,floor=r.skill==='scoring'?3:5;
  const daily=[...(groups.get(key)??new Map())].map(([d,rs])=>({day:d,s:summarise(rs)})).filter(x=>x.s.attempts>=methodMinimum[r.skill]).sort((a,b)=>a.day.localeCompare(b.day));
  const available=x=>!used.has(JSON.stringify([key,x.day]));
  const before=daily.filter(x=>x.day<r.day&&dayGap(x.day,r.day)<=14&&available(x)).slice(-2),after=daily.filter(x=>x.day>r.day&&dayGap(r.day,x.day)<=14&&available(x)).slice(0,2);
  if(before.length!==2||after.length!==2){out.push({...result,outcome:dayGap(r.day,day)<=14?'awaiting-comparable-checks':'insufficient-independent-checks'});continue}
  const baselineDays=before.map(x=>x.day),followupDays=after.map(x=>x.day);
  if(recordedConfounder(state,baselineDays[0],followupDays[1])){out.push({...result,baselineDays,followupDays,outcome:'confounded'});continue}
  if(delivery.some(x=>x.id!==r.id&&x.skill===r.skill&&x.day>=baselineDays[0]&&x.day<=followupDays[1])){out.push({...result,baselineDays,followupDays,outcome:'overlapping-selections'});continue}
  for(const x of [...before,...after])used.add(JSON.stringify([key,x.day]));
  const a=before.map(x=>x.s.value*scale),b=after.map(x=>x.s.value*scale),base=(a[0]+a[1])/2,change=(b[0]+b[1])/2-base;
  const lower=Math.max(...b)<=Math.min(...a)-floor,upper=Math.min(...b)>=Math.max(...a)+floor;
  const otherPractice=new Set(host.sessions.filter(s=>s&&s.quick===false&&dayValid(s.date)&&s.date>=baselineDays[0]&&s.date<=followupDays[1]&&String(s.id)!==r.id).map(s=>s.date)).size;
  out.push({...result,baselineDays,followupDays,baseline:base,change,outcome:lower?'observed-lower':upper?'observed-higher':'no-clear-change',otherPractice});
 }
 return out;
}
export function methodReviewGate(rows,day){
 if(!dayValid(day)||!Array.isArray(rows))throw Error('Invalid method review');
 const groups=new Map(),blocked=[];
 for(const r of rows){
  if(r.outcome!=='observed-lower'||!Array.isArray(r.baselineDays)||r.baselineDays.length!==2||!Array.isArray(r.followupDays)||r.followupDays.length!==2||!r.followupDays.every(dayValid)||!r.baselineDays.every(dayValid)||!dayValid(r.day)||!(r.baselineDays[0]<r.baselineDays[1]&&r.baselineDays[1]<r.day&&r.day<r.followupDays[0]&&r.followupDays[0]<r.followupDays[1])||r.followupDays[1]>day||dayGap(r.followupDays[1],day)>56)continue;
  const key=JSON.stringify([r.skill,r.protocol,r.alternative]),a=groups.get(key)??[];a.push(r);groups.set(key,a);
 }
 for(const a of groups.values()){
  a.sort((x,y)=>x.day.localeCompare(y.day));
  const unique=[];for(const r of a)if(!unique.some(x=>x.id===r.id||x.day===r.day||x.followupDays[1]>=r.baselineDays[0]))unique.push(r);
  if(unique.length>=2){const r=unique.at(-1);blocked.push({skill:r.skill,protocol:r.protocol,alternative:r.alternative,reviews:unique.length,last:r.followupDays[1],reason:'Two separate reviewed selections were followed by clearly lower comparable measurements. Defer this optional method and review conditions; no cause is established.'})}
 }
 return blocked;
}
export function methodReviewLines(rows,day){
 if(!rows.length)return ['No saved personalised drill selections to review.'];
 return [...rows.slice(-15).flatMap(r=>[r.day+' · '+r.normal+' to '+r.alternative+' · '+r.status.replaceAll('-',' ')+'; '+r.outcome.replaceAll('-',' ')+'.',...(r.seconds!==null?['Matched elapsed activity '+(r.seconds/60).toFixed(1)+' min; exact historical setting '+(r.exactSetting?'observed':'not established')+'.']:[]),...(r.change!==null?['Later fixed checks changed '+(r.change>0?'+':'')+r.change.toFixed(1)+(r.skill==='scoring'?' points.':' percentage points.')+' '+r.otherPractice+' other recorded practice days in the comparison window.']:[])]),...methodReviewGate(rows,day).map(x=>x.alternative+': '+x.reason),...methodFollowupGate(rows,day).map(x=>x.skill+': '+x.reason),'A selected drill, actual exposure and later performance are not the same. These reviews are observational, not controlled tests.'];
}

// A new same-skill selection during a pending review can make both
// comparisons uninterpretable. Defer until follow-up is observed or the
// 14-day observation window expires; missing checks are not a failure.
export function methodFollowupGate(rows,day){
 if(!dayValid(day)||!Array.isArray(rows))throw Error('Invalid follow-up review');
 const result=new Map();
 for(const r of rows){
  if(!r||!dayValid(r.day)||dayGap(r.day,day)<0||dayGap(r.day,day)>14||r.status!=='eligible-exposure'||r.outcome!=='awaiting-comparable-checks'||!Object.hasOwn(methodMinimum,r.skill)||!FIXED_PROTOCOLS[r.skill]?.includes(r.protocol))continue;
  const previous=result.get(r.skill);
  if(!previous||r.day>previous.day)result.set(r.skill,{skill:r.skill,protocol:r.protocol,day:r.day,reviewUntil:new Date(Date.parse(r.day)+14*86400000).toISOString().slice(0,10),reason:'Repeat the same fixed benchmark on separate days before choosing another personalised method for this skill.'});
 }
 return [...result.values()].sort((a,b)=>a.skill.localeCompare(b.skill));
}
