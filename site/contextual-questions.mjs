// Compare recorded reflections only with the matching exercise or session identity.
import {dayValid,dayGap} from './engine/context.mjs';
import {validateReflections} from './reflections.mjs';
const subjects=['timing','aim','pressure','fatigue','confidence'];
export function contextualQuestions(history,host,boundary){
 if(!boundary||boundary.quick!==false||!dayValid(boundary.day))return [];
 const sessions=new Map(),ambiguous=new Set();
 for(const s of host.sessions??[]){
  if(!s||s.quick!==false||!dayValid(s.date)||s.date>=boundary.day||!['string','number'].includes(typeof s.id))continue;
  const id=String(s.id);if(sessions.has(id))ambiguous.add(id);else sessions.set(id,s);
 }
 const groups=new Map();
 for(const r of validateReflections(history)){
  const s=sessions.get(r.sessionId);
  if(!s||ambiguous.has(r.sessionId)||s.date!==r.day||dayGap(r.day,boundary.day)>28||r.kind!==boundary.kind||!subjects.includes(r.answer))continue;
  if(r.kind==='exercise'&&(r.name!==boundary.name||!s.activities?.some(a=>a.exerciseIndex===r.index&&a.name===r.name)))continue;
  const set=groups.get(r.answer)??new Set();set.add(r.day);groups.set(r.answer,set);
 }
 return [...groups].filter(([,d])=>d.size>=2).sort((a,b)=>b[1].size-a[1].size||a[0].localeCompare(b[0])).map(([topic,d])=>({topic,days:d.size,question:({
 timing:'How did your timing and release feel this time?',
 aim:'How did your aiming and grouping feel this time?',
 pressure:'How comfortable did you feel under pressure this time?',
 fatigue:'How was your energy and concentration this time?',
 confidence:'How confident and comfortable did you feel this time?'
 })[topic]}));
}
