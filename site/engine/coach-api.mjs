// Versioned, local-only boundary. The host owns memory and persistence.
import {VERSION,emptyMemory,addObservation,setFact,currentFacts,ALLOCATION_PROOF,REVIEW_UNVERIFIED} from './engine.mjs';
import {validateState} from './state.mjs';
import {fullReport,canAccept} from './executive.mjs';
import {explainReport} from './explanation.mjs';
import {advice} from './tactics.mjs';
import {trainingRecommendation,logSession} from './session-intelligence.mjs';
import {recordAnswer} from './diagnosis.mjs';
import {recordReadiness,dayValid,asOfState} from './context.mjs';
import {recordLeg} from './match.mjs';
import {appendThrow} from './target-evidence.mjs';
import {nextActions} from './next-actions.mjs';
import {propose,respond} from './interventions.mjs';
export const CONTRACT_VERSION=1;
export const QUERIES=Object.freeze(['review','training','checkout','memory-summary','next-actions']);
export const COMMANDS=Object.freeze(['observation','throw','leg','session','readiness','answer','fact','propose','respond']);
const copy=x=>JSON.parse(JSON.stringify(x));
function requireDay(day){if(!dayValid(day))throw Error('Invalid local date');}
function object(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function shape(x,keys){if(!object(x)||Object.keys(x).some(k=>!keys.includes(k)))throw Error('Invalid request fields');}
function checkEnvelope(req,allowed){shape(req,['version','type','day','payload']);if(req.version!==CONTRACT_VERSION||!allowed.includes(req.type))throw Error('Unsupported contract version or request');requireDay(req.day);if(!object(req.payload))throw Error('Invalid payload');}
function snapshot(raw){
 const s=validateState(copy(raw)),original=new Map((raw.interventions??[]).map(i=>[i.id,i]));
 for(const i of s.interventions){const source=original.get(i.id);for(const key of [ALLOCATION_PROOF,REVIEW_UNVERIFIED])if(source?.[key]===true)i[key]=true}
 return s;
}
export function newPlayer(){return snapshot(emptyMemory())}
export function query(raw,req){
 checkEnvelope(req,QUERIES);const p=req.payload,day=req.day,m=asOfState(snapshot(raw),day);
 if(req.type==='checkout'){shape(p,['score','darts','actual','doubleIn','opened','context','protocol','opponent']);return {version:1,engine:VERSION,type:req.type,result:advice(m,p)}}
 if(req.type==='memory-summary'){shape(p,[]);return {version:1,engine:VERSION,type:req.type,result:{facts:currentFacts(m),observations:m.observations.length,throws:m.throws.length,legs:m.legs.length,sessions:m.sessions.length,interventions:m.interventions.length}}}
 const report=fullReport(m,day);
 if(req.type==='next-actions'){shape(p,[]);return {version:1,engine:VERSION,type:req.type,result:nextActions(m,day,report)}}
 if(req.type==='training'){shape(p,['number']);const plan=trainingRecommendation(m,report,day,report.active,p.number??1);return {version:1,engine:VERSION,type:req.type,result:plan}}
 shape(p,[]);
 const readable=explainReport(report,m);
 return {version:1,engine:VERSION,type:req.type,result:{decision:report.decision,focus:report.focus,active:report.active,reason:readable.reason,wellbeing:readable.wellbeing,issues:readable.issues.map((i,index)=>({...i,actions:report.issues[index].actions,strategy:report.issues[index].strategy})),nextQuestion:report.decision==='stop'?null:report.strategy.agenda.next,development:report.development,verification:report.verification}};
}
export function command(raw,req,{confirmed=false}={}){
 checkEnvelope(req,COMMANDS);
 if(confirmed!==true)throw Error('Explicit player confirmation required');
 const m=snapshot(raw),p=req.payload,day=req.day;
 if(['observation','throw','leg','session','readiness','answer'].includes(req.type)&&(!dayValid(p.day)||p.day>day))throw Error('Record date is invalid or in the future');
 let next;
 switch(req.type){
 case 'observation':shape(p,['id','day','skill','context','protocol','attempts','hits']);next=addObservation(m,p);break;
 case 'throw':shape(p,['id','day','context','protocol','aim','actual']);next=appendThrow(m,p);break;
 case 'leg':shape(p,['id','day','start','doubleIn','context','result','visits']);next=recordLeg(m,p);break;
 case 'session':shape(p,['id','day','number','status','segments']);next=logSession(m,p);break;
 case 'readiness':shape(p,['day','context','fatigue','pressure','confidence','pain','note']);next=recordReadiness(m,p);break;
 case 'answer':shape(p,['day','skill','context','protocol','question','answer']);next=recordAnswer(m,p);break;
 case 'fact':shape(p,['key','value','evidence']);if(!['reported','confirmed'].includes(p.evidence))throw Error('Only player-reported or player-confirmed facts allowed');next=setFact(m,p.key,p.value,p.evidence,day+'T00:00:00.000Z');break;
 case 'propose':shape(p,['id']);next=propose(m,fullReport(m,day),p.id,day);break;
 case 'respond':shape(p,['id','decision']);if(p.decision==='accepted'){const i=m.interventions.find(i=>i.id===p.id);if(!i)throw Error('Unknown intervention');const check=canAccept(m,i,day);if(!check.allowed)throw Error(check.reason)}next=respond(m,p.id,p.decision,day);break;
 }
 return {version:1,engine:VERSION,type:req.type,state:snapshot(next)};
}
// A batch is all-or-nothing from the caller's point of view. No persistence or network access.
export function batch(raw,requests,options={}){
 if(!Array.isArray(requests)||!requests.length||requests.length>200)throw Error('Invalid batch size');
 let state=snapshot(raw);for(const req of requests)state=command(state,req,options).state;
 return {version:1,engine:VERSION,state};
}
