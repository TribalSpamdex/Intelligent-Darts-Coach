import {SKILLS} from './engine.mjs';
import {dayValid,dayGap} from './context.mjs';
export const DOMAINS=['stance','balance','grip','alignment','aiming','drawback','tempo','release','follow-through','shoulder','elbow','wrist','tension','head movement','equipment','target mechanics'];
export const OBSERVATIONS=['changed','repeated difference','no observed difference','unknown'];
export const CONDITIONS=['normal practice','match pressure','late practice','specific target','all targets'];
export const METHODS=['self report','video review','coach observation'];
const str=(x,n)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
export function validateClinic(o){
 if(!o||!str(o.id,100)||!dayValid(o.day)||!SKILLS.includes(o.skill)||!str(o.protocol,100)||!['practice','competition'].includes(o.context)||!DOMAINS.includes(o.domain)||!OBSERVATIONS.includes(o.observation)||!CONDITIONS.includes(o.condition)||!METHODS.includes(o.method)||typeof o.pain!=='boolean'||typeof o.note!=='string'||o.note.length>500)throw Error('Invalid technical observation');
 return {id:o.id,day:o.day,skill:o.skill,protocol:o.protocol,context:o.context,domain:o.domain,observation:o.observation,condition:o.condition,method:o.method,pain:o.pain,note:o.note};
}
export function recordClinic(m,o){o=validateClinic(o);if((m.clinic??[]).some(x=>x.id===o.id))throw Error('Duplicate technical observation');return {...m,clinic:[...(m.clinic??[]),o]}}
const prompts={
 stance:'Compare foot placement and comfortable stability from the same camera angle.',
 balance:'Observe weight shifts and whether balance is maintained through release.',
 grip:'Record finger contact and pressure without deliberately changing both.',
 alignment:'Compare setup and intended line at the same target.',
 aiming:'Compare one attentional cue against the usual cue without changing mechanics.',
 drawback:'Observe the comfortable draw path and repeatability, not a prescribed distance.',
 tempo:'Compare preparation and throw rhythm in otherwise matched visits.',
 release:'Compare observed release and trajectory; do not infer timing from a miss alone.',
 'follow-through':'Observe what happens after release without forcing an exaggerated finish.',
 shoulder:'Observe shoulder motion alongside the rest of the throw; no universal stationary shoulder rule.',
 elbow:'Compare elbow motion at the same target, not a universal fixed position.',
 wrist:'Observe wrist movement in context of release and trajectory.',
 tension:'Compare perceived effort and comfort during a familiar task.',
 'head movement':'Observe head position and visual routine without forcing immobility.',
 equipment:'Compare one setup variable using the known comfortable baseline.',
 'target mechanics':'Compare the same throw at different targets; target-dependent adjustments can be normal.'
};
export function clinicReview(m,scope,day){
 if(!dayValid(day)||!SKILLS.includes(scope.skill)||!str(scope.protocol,100)||!['practice','competition'].includes(scope.context))throw Error('Invalid clinic scope');
 const rows=(m.clinic??[]).filter(o=>o.skill===scope.skill&&o.protocol===scope.protocol&&o.context===scope.context&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<28);
 const hypotheses=DOMAINS.map(domain=>{
 const records=rows.filter(o=>o.domain===domain),support=records.filter(o=>['changed','repeated difference'].includes(o.observation)),against=records.filter(o=>o.observation==='no observed difference');
 const days=new Set(support.map(o=>o.day)).size,contraryDays=new Set(against.map(o=>o.day)).size;
 const corroborated=days>=2&&support.some(o=>o.method!=='self report');
 const status=support.length&&against.length?'mixed':corroborated?'corroborated-observation':support.length?'reported-observation':contraryDays>=2?'less-supported':'unresolved';
 return {domain,status,days,contraryDays,support:support.map(o=>({id:o.id,day:o.day,method:o.method,condition:o.condition,note:o.note})),against:against.map(o=>({id:o.id,day:o.day,method:o.method,condition:o.condition,note:o.note})),next:prompts[domain],limitation:'Observation of a difference does not demonstrate a fault or its causal contribution.'}
 });
 const latestPain=rows.some(o=>o.pain&&dayGap(o.day,day)<7);
 const ranked=hypotheses.filter(h=>['corroborated-observation','reported-observation','mixed'].includes(h.status)).sort((a,b)=>Number(b.status==='corroborated-observation')-Number(a.status==='corroborated-observation')||b.days-a.days||a.domain.localeCompare(b.domain));
 return {scope,decision:latestPain?'stop':ranked.length?'investigate-one-variable':'observe-baseline',hypotheses,priority:ranked[0]?.domain??null,next:latestPain?'Stop the aggravating activity; seek qualified advice for persistent or significant pain.':ranked[0]?.next??'Record a comfortable baseline under matched conditions before prescribing mechanical change.',limitations:['Observations are player-entered, not automated video measurements.','No inferred mechanical diagnosis from board segment or miss direction.']};
}
