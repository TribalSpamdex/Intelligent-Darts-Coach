import {SKILLS,plan} from './engine.mjs';
const same=(a,b)=>a.skill===b.skill&&a.context===b.context&&a.protocol===b.protocol;
const safePlan=p=>Array.isArray(p)&&p.reduce((s,g)=>s+g.minutes,0)===60&&p[0]?.skill==='warmup'&&p[0]?.minutes===10&&p.every(g=>Number.isInteger(g.minutes)&&g.minutes>=5&&['warmup',...SKILLS].includes(g.skill))&&new Set(p.map(g=>g.skill)).size===p.length;
export function checkDecision(m,r){
 const faults=[],safety=['stop','reduce-load'].includes(r.decision),candidate=r.issues.find(i=>i.skill===r.focus&&i.protocol===r.focusProtocol&&i.context===r.focusContext);
 if(safety&&(r.focus||r.plan.length||r.active.plan.length))faults.push('safety-plan-conflict');
 if(!safety&&!safePlan(r.plan))faults.push('invalid-proposed-plan');
 if(!safety&&!safePlan(r.active.plan))faults.push('invalid-active-plan');
 if(r.decision==='temporary-focus'&&(!candidate||candidate.action!=='temporary-focus'||candidate.confirmation?.status!=='confirmed'||candidate.investigation?.veto))faults.push('unsupported-focus');
 if(r.decision!=='temporary-focus'&&r.focus)faults.push('focus-without-decision');
 if(candidate&&candidate.strategy?.ledger?.blocked.some(x=>x.kind==='training-allocation'))faults.push('repeat-unsuccessful-intervention');
 if(r.active.mode==='accepted-temporary-focus'&&!m.interventions.some(i=>i.status==='accepted'&&i.id===r.active.intervention))faults.push('missing-consent');
 for(const i of r.issues)if(i.action==='temporary-focus'&&(i.confirmation?.status!=='confirmed'||i.investigation?.veto))faults.push('unconfirmed-candidate');
 if(r.safety.stop&&r.decision!=='stop')faults.push('ignored-safety-flag');
 return {status:faults.length?'failed':'passed',faults:[...new Set(faults)]};
}
export function enforceDecision(m,r){
 const verification=checkDecision(m,r);
 if(verification.status==='passed')return {...r,verification};
 const stop=r.safety.stop||r.decision==='stop',reduce=!stop&&r.decision==='reduce-load',decision=stop?'stop':reduce?'reduce-load':'investigate',safe=stop||reduce;
 const active={mode:safe?decision:'verification-review',plan:safe?[]:plan()};
 return {...r,decision,focus:null,focusProtocol:null,focusContext:null,plan:active.plan,active,issues:r.issues.map(i=>({...i,action:'investigate',actions:[]})),strategy:{...r.strategy,primary:null},trace:{...r.trace,decision,primary:null,verificationFaults:verification.faults},verification};
}
