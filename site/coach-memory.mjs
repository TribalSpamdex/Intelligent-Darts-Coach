import {newPlayer,command} from './engine/coach-api.mjs';
import {validateState} from './engine/state.mjs';
import {validObservation,currentFacts,removeFact,plan} from './engine/engine.mjs';
import {recordClinic} from './engine/clinic.mjs';
import {recordSetup,setupComparison} from './engine/equipment-profile.mjs';
import {fullReport} from './engine/executive.mjs';
import {review,finish} from './engine/interventions.mjs';
import {validateChecks,addCheck} from './target-checks.mjs';
import {createGoal,closeGoal} from './engine/goals.mjs';
import {projectEvidence} from './v62-evidence.mjs';
import {projectExposure} from './host-exposure.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const HOST_PREFIX='IDC:host-v62:';
export function newMemory(){return {format:'IDC-coach-memory',version:1,state:newPlayer(),baselines:{},targetChecks:[]}}
export function validateMemory(raw){
 if(raw==null)return newMemory();
 if(raw.format!=='IDC-coach-memory'||raw.version!==1||!raw.baselines||typeof raw.baselines!=='object'||Array.isArray(raw.baselines))throw Error('Invalid IDC coaching memory');
 const state=validateState(raw.state);
 if(state.observations.some(o=>o.id.startsWith(HOST_PREFIX)))throw Error('Host observations must not be stored twice');
 const baselines={};
 for(const i of state.interventions){const rows=Object.hasOwn(raw.baselines,i.id)?raw.baselines[i.id]:null;if(!Array.isArray(rows)||rows.length!==i.baselineIds.length||rows.length>50000)throw Error('Missing intervention baseline');const verified=rows.map(validObservation);if(new Set(verified.map(o=>o.id)).size!==verified.length||!i.baselineIds.every(id=>verified.some(o=>o.id===id)))throw Error('Invalid intervention baseline');Object.defineProperty(baselines,i.id,{value:verified,enumerable:true,writable:true,configurable:true})}
 return {format:'IDC-coach-memory',version:1,state,baselines,targetChecks:validateChecks(raw.targetChecks??[])};
}
export function assemble(host,raw,day,now=Date.now()){
 const memory=validateMemory(raw),evidence=projectEvidence(host,{today:day,now});
 const practice=projectExposure(host,day);
 const state=validateState({...memory.state,exposure:practice.exposure,observations:[...memory.state.observations,...evidence.observations]});
 const byId=new Map(state.observations.map(o=>[o.id,JSON.stringify(o)]));
 const edited=state.interventions.filter(i=>['proposed','accepted'].includes(i.status)&&memory.baselines[i.id].some(o=>byId.get(o.id)!==JSON.stringify(o))).map(i=>i.id);
 return {memory,state,evidence,edited,practice};
}
export function assess(host,raw,day,now=Date.now()){
 const x=assemble(host,raw,day,now),report=fullReport(x.state,day);
 if(x.edited.includes(report.active.intervention)){report.active={mode:'baseline-edited',plan:plan(),intervention:report.active.intervention}}
 const active=x.state.interventions.find(i=>i.status==='accepted'&&i.id===report.active.intervention);
 // The engine intentionally suppresses new proposals while an intervention is accepted.
 // Reassess only that proposal guard, retaining all other history and current evidence.
 const confirmation=active&&report.active.mode==='accepted-temporary-focus'?fullReport({...x.state,interventions:x.state.interventions.filter(i=>i.id!==active.id)},day):null;
 return {...x,report,confirmation};
}
export function changeMemory(host,raw,day,type,payload,now=Date.now()){
 const x=assemble(host,raw,day,now),m=x.memory;let state;
 if(type==='target-check')return validateMemory({...m,targetChecks:addCheck(m.targetChecks,payload,day)});
 if(type==='remove-target-check')return validateMemory({...m,targetChecks:m.targetChecks.filter(x=>x.id!==payload.id)});
 if(type==='remove-fact')state=removeFact(x.state,payload.key);
 else if(type==='goal'){if(payload.start!==day||!x.state.observations.some(o=>o.skill===payload.skill&&o.context===payload.context&&o.protocol===payload.protocol))throw Error('Choose a recorded benchmark for the goal');state=createGoal(x.state,payload)}
 else if(type==='close-goal')state=closeGoal(x.state,payload.id);
 else if(type==='clinic'){if(payload.day!==day)throw Error('Observation must be recorded today');state=recordClinic(x.state,payload)}
 else if(type==='setup'){if(payload.day!==day)throw Error('Setup must be recorded today');state=recordSetup(x.state,payload)}
 else if(type==='remove-clinic'||type==='remove-setup'){const key=type==='remove-clinic'?'clinic':'setups';state={...x.state,[key]:x.state[key].filter(o=>o.id!==payload.id)}}
 else if(type==='cancel'){const i=x.state.interventions.find(i=>i.id===payload.id&&['accepted','proposed'].includes(i.status));if(!i)throw Error('No open intervention');state={...x.state,interventions:x.state.interventions.map(o=>o.id===i.id?{...o,status:'declined',responseDay:o.responseDay??day,cancelledDay:day}:o)}}
 else if(type==='finish'){if(x.edited.includes(payload.id))throw Error('The original baseline was corrected; cancel and reassess instead.');state=finish(x.state,payload.id,day,{adherence:payload.adherence,confounders:payload.confounders??[]})}
 else {
 if(type==='respond'&&payload.decision==='accepted'&&x.edited.includes(payload.id))throw Error('Baseline was corrected; decline and reassess');
 if(!['fact','readiness','answer','propose','respond'].includes(type))throw Error('Unsupported memory command');
 state=command(x.state,{version:1,type,day,payload},{confirmed:true}).state;
 }
 const baselines=clone(m.baselines);
 for(const i of state.interventions)if(!Object.hasOwn(baselines,i.id))Object.defineProperty(baselines,i.id,{value:state.observations.filter(o=>i.baselineIds.includes(o.id)),enumerable:true,writable:true,configurable:true});
 state={...state,exposure:m.state.exposure,observations:state.observations.filter(o=>!o.id.startsWith(HOST_PREFIX))};
 return validateMemory({...m,state,baselines});
}
export function memorySummary(raw){const m=validateMemory(raw);return {facts:currentFacts(m.state),readiness:m.state.readiness,clinic:m.state.clinic,setups:m.state.setups,interventions:m.state.interventions,goals:m.state.goals,targetChecks:m.targetChecks}}
export function compareSetups(raw,a,b){const s=validateMemory(raw).state.setups;return setupComparison(s.find(o=>o.id===a),s.find(o=>o.id===b))}
export function interventionReview(host,raw,id,day,adherence,confounders=[],now=Date.now()){const x=assemble(host,raw,day,now);return x.edited.includes(id)?{status:'baseline-edited'}:review(x.state,id,day,{adherence,confounders})}
