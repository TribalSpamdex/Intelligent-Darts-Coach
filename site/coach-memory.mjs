import {attributableAllocation} from './coaching-accountability.mjs';
import {validateEvents,addEvent,removeEvent} from './competition-calendar.mjs';
import {makeCheck,validatePrecisionChecks,isPrecisionCheck} from './precision-checks.mjs';
import {addTargetSample,removeTargetSample,manualSamples} from './manual-target-samples.mjs';
import {legFromInput} from './match-statistics.mjs';
import {retentionReview,recordRetention} from './engine/learning.mjs';
import {verifiedLearningState,reviewReproduction} from './intervention-audit.mjs';
import {newPlayer,command} from './engine/coach-api.mjs';
import {validateState} from './engine/state.mjs';
import {validObservation,currentFacts,removeFact,plan} from './engine/engine.mjs';
import {recordClinic} from './engine/clinic.mjs';
import {recordSetup,setupComparison} from './engine/equipment-profile.mjs';
import {fullReport} from './engine/executive.mjs';
import {asOfState} from './engine/context.mjs';
import {review,finish} from './engine/interventions.mjs';
import {validateReflections,saveReflection,reflectionInsights} from './reflections.mjs';
import {validateChecks,addCheck} from './target-checks.mjs';
import {createGoal,closeGoal} from './engine/goals.mjs';
import {projectEvidence} from './v62-evidence.mjs';
import {projectExposure} from './host-exposure.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const HOST_PREFIX='IDC:host-v62:';
export function newMemory(){return {format:'IDC-coach-memory',version:1,state:newPlayer(),baselines:{},targetChecks:[],reflections:[],events:[],learnedMethods:false}}
export function validateMemory(raw){
 if(raw==null)return newMemory();
 if(raw.format!=='IDC-coach-memory'||raw.version!==1||!raw.baselines||typeof raw.baselines!=='object'||Array.isArray(raw.baselines))throw Error('Invalid IDC coaching memory');
 if(raw.learnedMethods!==undefined&&typeof raw.learnedMethods!=='boolean')throw Error('Invalid learned method preference');
 const state=validateState(raw.state);
 manualSamples(state.throws);validatePrecisionChecks(state.observations);
 if(state.observations.some(o=>o.id.startsWith(HOST_PREFIX)||o.protocol.startsWith('IDC V6.2 ')))throw Error('Native benchmark observations must be reconstructed from original host records, not imported as manual results. Current profile has not been replaced.');
 const baselines={};
 for(const i of state.interventions){const rows=Object.hasOwn(raw.baselines,i.id)?raw.baselines[i.id]:null;if(!Array.isArray(rows)||rows.length!==i.baselineIds.length||rows.length>50000)throw Error('Missing intervention baseline');const verified=rows.map(validObservation);if(new Set(verified.map(o=>o.id)).size!==verified.length||!i.baselineIds.every(id=>verified.some(o=>o.id===id)))throw Error('Invalid intervention baseline');Object.defineProperty(baselines,i.id,{value:verified,enumerable:true,writable:true,configurable:true})}
 return {format:'IDC-coach-memory',version:1,state,baselines,targetChecks:validateChecks(raw.targetChecks??[]),reflections:validateReflections(raw.reflections??[]),events:validateEvents(raw.events??[]),learnedMethods:raw.learnedMethods===true};
}
export function assemble(host,raw,day,now=Date.now()){
 const memory=validateMemory(raw),evidence=projectEvidence(host,{today:day,now});
 const practice=projectExposure(host,day);
 const state=validateState({...memory.state,exposure:practice.exposure,observations:[...memory.state.observations,...evidence.observations]});
 const known=asOfState(state,day),byId=new Map(known.observations.map(o=>[o.id,JSON.stringify(o)]));
 const edited=known.interventions.filter(i=>['proposed','accepted'].includes(i.status)&&memory.baselines[i.id].some(o=>byId.get(o.id)!==JSON.stringify(o))).map(i=>i.id);
 return {memory,state,evidence,edited,practice};
}
export function assess(host,raw,day,now=Date.now()){
 const x=assemble(host,raw,day,now),known=asOfState(x.state,day),learning=verifiedLearningState(known,x.memory.baselines,day,host,now),report=fullReport(learning.state,day);
 if(x.edited.includes(report.active.intervention)){report.active={mode:'baseline-edited',plan:plan(),intervention:report.active.intervention}}
 const active=known.interventions.find(i=>i.status==='accepted'&&i.id===report.active.intervention);
 // The engine intentionally suppresses new proposals while an intervention is accepted.
 // Reassess only that proposal guard, retaining all other history and current evidence.
 const confirmation=active&&report.active.mode==='accepted-temporary-focus'?fullReport({...learning.state,interventions:learning.state.interventions.filter(i=>i.id!==active.id)},day):null;
 return {...x,state:known,report,confirmation,questionableOutcomes:learning.questionable,reflectionReview:reflectionInsights(x.memory.reflections,host,day)};
}
export function changeMemory(host,raw,day,type,payload,now=Date.now()){
 const x=assemble(host,raw,day,now),m=x.memory;let state;
 if(type==='learned-methods'){if(typeof payload?.enabled!=='boolean')throw Error('Choose whether to allow learned methods');return validateMemory({...m,learnedMethods:payload.enabled});}
 if(type==='competition-event')return validateMemory({...m,events:addEvent(m.events,payload,day)});
 if(type==='remove-competition-event')return validateMemory({...m,events:removeEvent(m.events,payload.id)});
 if(type==='target-check')return validateMemory({...m,targetChecks:addCheck(m.targetChecks,payload,day)});
 if(type==='remove-target-check')return validateMemory({...m,targetChecks:m.targetChecks.filter(x=>x.id!==payload.id)});
 if(type==='precision-check')state=command(x.state,{version:1,type:'observation',day,payload:makeCheck(payload.skill,payload.hits,day)},{confirmed:true}).state;
 else if(type==='remove-precision-check'){if(!x.state.observations.some(o=>o.id===payload.id&&isPrecisionCheck(o)))throw Error('Unknown fixed check');state={...x.state,observations:x.state.observations.filter(o=>o.id!==payload.id)}}
 else if(type==='target-sample')state=addTargetSample(x.state,payload,day);
 else if(type==='remove-target-sample')state=removeTargetSample(x.state,payload.id);
 else if(type==='leg'){
 const leg=legFromInput(payload,day).leg;
 state=command(x.state,{version:1,type:'leg',day,payload:leg},{confirmed:true}).state;
 }
 else if(type==='remove-leg'){
 if(!x.state.legs.some(l=>l.id===payload.id))throw Error('Unknown leg');
 state={...x.state,legs:x.state.legs.filter(l=>l.id!==payload.id)};
 }
 else if(type==='remove-fact')state=removeFact(x.state,payload.key);
 else if(type==='goal'){if(payload.start!==day||!x.state.observations.some(o=>o.skill===payload.skill&&o.context===payload.context&&o.protocol===payload.protocol))throw Error('Choose a recorded benchmark for the goal');state=createGoal(x.state,payload)}
 else if(type==='close-goal')state=closeGoal(x.state,payload.id,day);
 else if(type==='clinic'){if(payload.day!==day)throw Error('Observation must be recorded today');state=recordClinic(x.state,payload)}
 else if(type==='setup'){if(payload.day!==day)throw Error('Setup must be recorded today');state=recordSetup(x.state,payload)}
 else if(type==='remove-clinic'||type==='remove-setup'){const key=type==='remove-clinic'?'clinic':'setups';state={...x.state,[key]:x.state[key].filter(o=>o.id!==payload.id)}}
 else if(type==='cancel'){const i=x.state.interventions.find(i=>i.id===payload.id&&['accepted','proposed'].includes(i.status));if(!i)throw Error('No open intervention');state={...x.state,interventions:x.state.interventions.map(o=>o.id===i.id?{...o,status:'declined',responseDay:o.responseDay??day,cancelledDay:day,cancelledFrom:i.status}:o)}}
 else if(type==='retention'){
 const status=retentionEligibility(x,host,payload.id,day,now);
 if(status!=='eligible')throw Error('Cannot save retention review: '+status);
 state=recordRetention(x.state,payload.id,day);
 }
 else if(type==='finish'){if(x.edited.includes(payload.id))throw Error('The original baseline was corrected; cancel and reassess instead.');state=finish(x.state,payload.id,day,{adherence:payload.adherence,confounders:payload.confounders??[]})}
 else {
 if(type==='respond'&&payload.decision==='accepted'&&x.edited.includes(payload.id))throw Error('Baseline was corrected; decline and reassess');
 if(!['fact','readiness','answer','propose','respond'].includes(type))throw Error('Unsupported memory command');
 if(type==='propose'||type==='respond'&&payload.decision==='accepted'){
 const safe=verifiedLearningState(x.state,m.baselines,day,host,now),next=command(safe.state,{version:1,type,day,payload},{confirmed:true}).state;
 // Only the current proposal/response may be committed; never rewrite historic outcomes.
 const originals=new Map(x.state.interventions.filter(i=>['completed','unsuccessful'].includes(i.status)).map(i=>[i.id,i]));
 state={...next,interventions:next.interventions.map(i=>originals.get(i.id)??i)};
 }else state=command(x.state,{version:1,type,day,payload},{confirmed:true}).state;
 }
 const baselines=clone(m.baselines);
 for(const i of state.interventions)if(!Object.hasOwn(baselines,i.id))Object.defineProperty(baselines,i.id,{value:state.observations.filter(o=>i.baselineIds.includes(o.id)),enumerable:true,writable:true,configurable:true});
 state={...state,exposure:m.state.exposure,observations:state.observations.filter(o=>!o.id.startsWith(HOST_PREFIX))};
 return validateMemory({...m,state,baselines});
}
export function memorySummary(raw){const m=validateMemory(raw);return {facts:currentFacts(m.state),readiness:m.state.readiness,clinic:m.state.clinic,setups:m.state.setups,interventions:m.state.interventions,goals:m.state.goals,legs:m.state.legs,precisionChecks:m.state.observations.filter(isPrecisionCheck),manualSamples:manualSamples(m.state.throws).map(({throws,...s})=>s),targetChecks:m.targetChecks,reflections:m.reflections,events:m.events,learnedMethods:m.learnedMethods}}
export function compareSetups(raw,a,b){const s=validateMemory(raw).state.setups;return setupComparison(s.find(o=>o.id===a),s.find(o=>o.id===b))}
export function interventionReview(host,raw,id,day,adherence,confounders=[],now=Date.now()){const x=assemble(host,raw,day,now);return x.edited.includes(id)?{status:'baseline-edited'}:review(x.state,id,day,{adherence,confounders})}

export function recordReflection(raw,boundary,answer,note=''){const m=validateMemory(raw);return validateMemory({...m,reflections:saveReflection(m.reflections,boundary,answer,note)})}
export function removeReflection(raw,key){const m=validateMemory(raw);return validateMemory({...m,reflections:m.reflections.filter(o=>JSON.stringify([o.kind,o.sessionId,o.index])!==key)})}

export function previewRetention(host,raw,id,day,now=Date.now()){
 const x=assemble(host,raw,day,now),status=retentionEligibility(x,host,id,day,now);
 return status==='eligible'?retentionReview(x.state,id,day):{status};
}
function retentionEligibility(x,host,id,day,now){
 const item=x.state.interventions.find(i=>i.id===id);
 if(!item||reviewReproduction(item,x.memory.baselines[id]??[],x.state.observations,day).status!=='reproduced')return 'review-needs-verification';
 return attributableAllocation(host,item,day,now)?'eligible':'delivery-unverified';
}
