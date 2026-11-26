import {validMemory} from './engine.mjs';
import {validThrow} from './target-evidence.mjs';
import {validateReadiness,dayValid} from './context.mjs';
import {validateDifficulty} from './training.mjs';
import {validateAnswer,validateChange} from './diagnosis.mjs';
import {validateTrial} from './experiments.mjs';
import {validateSession} from './session-intelligence.mjs';
import {validateGoal} from './goals.mjs';
import {validateClinic} from './clinic.mjs';
import {validateSetup} from './equipment-profile.mjs';
import {validateFollowup,recordFollowup} from './followup.mjs';
import {analyseLeg} from './match.mjs';
export function validateState(raw){
 const s=validMemory(raw),throws=s.throws??[];
 if(!Array.isArray(throws)||throws.length>100000)throw Error('Invalid throw history');
 const ids=new Set();s.throws=throws.map(o=>{const t=validThrow(o);if(ids.has(t.id))throw Error('Duplicate throw');ids.add(t.id);return t});
 for(const i of s.interventions){if(!Array.isArray(i.baselineIds)||i.baselineIds.length>50000||!i.baselineIds.every(x=>typeof x==='string')||typeof i.protocol!=='string'||!['practice','competition'].includes(i.context)||!/^\d{4}-\d{2}-\d{2}$/.test(i.proposedDay)||i.reviewAfterDays!==14||i.maximumDays!==21)throw Error('Invalid intervention record');if(i.status!=='proposed'&&(!i.responseDay||i.responseDay<i.proposedDay))throw Error('Invalid intervention response');}
 for(const [key,validator,id] of [['readiness',validateReadiness,x=>x.day+'/'+x.context],['difficulty',validateDifficulty,x=>x.id]]){const rows=s[key]??[];if(!Array.isArray(rows)||rows.length>50000)throw Error('Invalid '+key+' history');const unique=new Set();s[key]=rows.map(raw=>{const o=validator(raw),k=id(o);if(unique.has(k))throw Error('Duplicate '+key+' record');unique.add(k);return o})}
 for(const e of s.exposure)if(!dayValid(e.day))throw Error('Invalid exposure date');
 for(const [key,validator] of [['answers',validateAnswer],['changes',validateChange],['trials',validateTrial],['sessions',validateSession],['goals',validateGoal],['clinic',validateClinic],['setups',validateSetup],['followups',validateFollowup],['legs',o=>analyseLeg(o).leg]]){const rows=s[key]??[];if(!Array.isArray(rows)||rows.length>10000)throw Error('Invalid '+key+' history');const ids=new Set();s[key]=rows.map(raw=>{const o=validator(raw);if(key!=='answers'){if(ids.has(o.id))throw Error('Duplicate '+key+' identity');ids.add(o.id)}return o})}
 if(s.trials.filter(t=>t.status==='active').length>1)throw Error('Multiple active experiments');
 const slots=new Set();for(const session of s.sessions){const k=session.day+'/'+session.number;if(slots.has(k))throw Error('Duplicate session slot');slots.add(k)}
 const goalSlots=new Set();for(const goal of s.goals.filter(g=>g.status==='active')){const k=JSON.stringify([goal.skill,goal.context,goal.protocol]);if(goalSlots.has(k))throw Error('Duplicate active goal');goalSlots.add(k)}
 const followups=s.followups;s.followups=[];for(const o of followups)s.followups=recordFollowup(s,o).followups;
 return s;
}
