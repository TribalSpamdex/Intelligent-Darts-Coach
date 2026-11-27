import {trainingParentIndex} from './v62-evidence.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
const codes=['comfortable','timing','aim','pressure','fatigue','confidence','other','unknown','skip'];
const str=(s,max)=>typeof s==='string'&&s.length>0&&s.length<=max;
export function validateReflection(o){
 if(!o||!['exercise','session'].includes(o.kind)||!dayValid(o.day)||!str(o.sessionId,100)||!str(o.name,120)||!codes.includes(o.answer)||typeof o.note!=='string'||o.note.length>300||!Number.isFinite(o.at)||o.at<=0)throw Error('Invalid practice reflection');
 if(o.kind==='exercise'&&(!Number.isInteger(o.index)||o.index<0||o.index>1000))throw Error('Invalid exercise identity');
 return {kind:o.kind,sessionId:o.sessionId,index:o.kind==='exercise'?o.index:null,name:o.name,day:o.day,at:o.at,answer:o.answer,note:o.answer==='skip'?'':o.note};
}
export const key=o=>JSON.stringify([o.kind,o.sessionId,o.kind==='exercise'?o.index:null]);
export function validateReflections(raw=[]){if(!Array.isArray(raw)||raw.length>20000)throw Error('Invalid reflection history');const seen=new Set();return raw.map(v=>{const x=validateReflection(v),k=key(x);if(seen.has(k))throw Error('Duplicate reflection');seen.add(k);return x})}
export function saveReflection(raw,boundary,answer,note=''){
 if(!boundary||boundary.quick!==false)throw Error('Only scheduled or extra training reflections are eligible');
 const x=validateReflection({...boundary,answer,note}),rows=validateReflections(raw);
 return validateReflections([...rows.filter(o=>key(o)!==key(x)),x]);
}
export function questionFor(boundary,history=[]){
 if(!boundary||boundary.quick!==false||!['exercise','session'].includes(boundary.kind))return null;
 if(boundary.kind==='exercise'&&['Warm-up','Review'].includes(boundary.name))return null;
 const saved=history.find(x=>key(x)===key(boundary));
 if(saved)return {saved};
 const name=boundary.name,session=boundary.kind==='session';
 const prior=history.filter(x=>x.sessionId===boundary.sessionId&&x.kind==='exercise'&&!['comfortable','unknown','skip'].includes(x.answer));
 const last=prior.at(-1);
 let question=session?'How did the session feel overall?':'How did '+name+' feel today?';
 if(session&&last)question='You noted '+label(last.answer).toLowerCase()+' during '+last.name+'. What best describes the session overall?';
 const choices=session?['comfortable','fatigue','pressure','confidence','timing','other','unknown']: /Double|Checkout|Pressure|Finish/i.test(name)?['comfortable','aim','pressure','timing','fatigue','other','unknown']:['comfortable','timing','aim','fatigue','pressure','other','unknown'];
 return {question,choices};
}
export function label(code){return ({comfortable:'Comfortable / controlled',timing:'Timing or release felt inconsistent',aim:'Aiming or grouping felt difficult',pressure:'Felt rushed or under pressure',fatigue:'Tired or losing concentration',confidence:'Confidence was low',other:'Something else',unknown:'Not sure',skip:'Skipped'})[code]??code}
export function reflectionInsights(history,host,day){
 const {parents,duplicates}=trainingParentIndex(host.sessions??[]);
 const validSessions=new Map([...parents].filter(([id,s])=>s.quick===false&&!duplicates.has(id)));
 const recent=validateReflections(history).filter(x=>{const s=validSessions.get(x.sessionId);return s&&s.date===x.day&&dayGap(x.day,day)>=0&&dayGap(x.day,day)<28&&x.answer!=='skip'&&(x.kind==='session'||s.activities?.some(a=>a.exerciseIndex===x.index&&a.name===x.name))});
 const groups=new Map();
 for(const x of recent.filter(x=>!['comfortable','unknown','other'].includes(x.answer))){const g=groups.get(x.answer)??new Set();g.add(x.day);groups.set(x.answer,g)}
 const repeated=[...groups].filter(([,days])=>days.size>=2).sort((a,b)=>b[1].size-a[1].size||a[0].localeCompare(b[0])).map(([topic,days])=>({topic,days:days.size,question:({timing:'Does the timing concern also appear in a comfortable, fixed benchmark?',aim:'Does the grouping concern occur on specific targets under the same conditions?',pressure:'Does the concern occur in normal practice as well as pressured games?',fatigue:'Does the concern improve after rest, under comparable conditions?',confidence:'Is confidence different in practice and competition?'})[topic]}));
 return {count:recent.length,repeated,limitation:'Player-reported feelings are contextual evidence only, not measured accuracy or proof of a mechanical fault.'};
}
