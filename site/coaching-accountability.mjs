// Reconstruct delivered training adjustments from locked native plans and
// matched completed activities. Planned extra minutes are NOT actual throws.
import {dayValid,dayGap} from './engine/context.mjs';
import {baselineIntegrity,reviewReproduction,verifiedRetention} from './intervention-audit.mjs';
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
  rows.push({...base,planned:300,observedBeyondOriginal:observed,status:'matched-activity',completedSession:s.completed===true,actualSeconds:x.seconds,originalSeconds:oldReceiver.proposedSeconds,allocatedSeconds:receiver.plannedSeconds});
 }
 return {rows,plannedSeconds:rows.reduce((n,x)=>n+x.planned,0),observedBeyondOriginal:rows.reduce((n,x)=>n+(x.observedBeyondOriginal??0),0),matched:rows.filter(x=>x.status==='matched-activity').length,unverified:rows.filter(x=>x.status==='unverified').length,limitation:'Observed elapsed activity beyond original budget is capped at five minutes per transfer. Not actual throwing time, proof of extra training, or player-reported adherence.'};
}
export function coachingAccountability(host,state,baselines,day,now=Date.now()){
 const rows=[];
 for(const i of state.interventions??[]){
  if(!dayValid(i.responseDay)||i.responseDay>day||i.status==='declined')continue;
  const base=Object.hasOwn(baselines,i.id)?baselines[i.id]:[];
  const integrity=baselineIntegrity(i,base,state.observations,day),review=reviewReproduction(i,base,state.observations,day),retention=verifiedRetention(state,i,base,day),delivery=deliveryEvidence(host,i,day,now);
  const due=dayGap(i.responseDay,day)>=i.reviewAfterDays;
  const status=integrity.status!=='intact'?'baseline-edited':review.status==='reproduced'?delivery.matched===0?'review-reproduced-delivery-unverified':'review-reproduced':review.status==='not-reviewed'?due?'review-due':'awaiting-review':'review-needs-verification';
  rows.push({id:i.id,skill:i.skill,protocol:i.protocol,status,observedOutcome:review.status==='reproduced'?i.outcome.status:null,retentionChecks:retention.valid.length,invalidRetention:retention.invalid,reportedAdherence:i.reviewDay&&i.reviewDay<=day?i.adherence??null:null,delivery});
 }
 return rows;
}
export function accountabilityLines(rows){
 if(!rows.length)return ['No accepted intervention history to audit.'];
 return [...rows.slice(-20).flatMap(r=>[r.skill+' · '+r.protocol+' · '+r.status.replaceAll('-',' ')+'. '+(r.observedOutcome??'No reproduced outcome')+'.','Reconstructed allocation '+(r.delivery.plannedSeconds/60).toFixed(1)+' min; matched elapsed activity above original budget '+(r.delivery.observedBeyondOriginal/60).toFixed(1)+' min across '+r.delivery.matched+' activities. '+r.delivery.unverified+' unverified transfers.','Reported adherence '+(r.reportedAdherence===null?'not recorded':(100*r.reportedAdherence).toFixed(0)+'%')+'; '+r.retentionChecks+' reproduced retention checks, '+r.invalidRetention+' invalid checks.']), 'Reproduced results remain observational. Delivery, adherence, and outcome are different kinds of evidence; no causal success rate is asserted.'];
}
