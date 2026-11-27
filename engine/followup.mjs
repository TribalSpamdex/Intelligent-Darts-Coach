import {SKILLS,summarise} from './engine.mjs';
import {dayValid,dayGap} from './context.mjs';
import {trialOutcome} from './experiments.mjs';
const exact=(a,b)=>a.skill===b.skill&&a.protocol===b.protocol&&a.context===b.context;
export function validateFollowup(o){
 if(!o||typeof o.id!=='string'||!o.id.trim()||o.id.length>100||typeof o.trialId!=='string'||!o.trialId.trim()||o.trialId.length>100||!dayValid(o.day)||!SKILLS.includes(o.skill)||typeof o.protocol!=='string'||!o.protocol.trim()||o.protocol.length>100||!['practice','competition'].includes(o.context)||!['baseline','followup'].includes(o.phase)||!['retention','transfer'].includes(o.kind)||!Number.isInteger(o.attempts)||o.attempts<1||o.attempts>1000||!Number.isInteger(o.hits)||o.hits<0||o.hits>o.attempts*(['scoring','firstNine'].includes(o.skill)?60:1)||typeof o.comparable!=='boolean'||typeof o.confounder!=='boolean')throw Error('Invalid learning follow-up');
 return {id:o.id,trialId:o.trialId,day:o.day,skill:o.skill,protocol:o.protocol,context:o.context,phase:o.phase,kind:o.kind,attempts:o.attempts,hits:o.hits,comparable:o.comparable,confounder:o.confounder};
}
export function recordFollowup(m,o){
 o=validateFollowup(o);
 const t=(m.trials??[]).find(t=>t.id===o.trialId);
 if(!t||t.status!=='completed'||t.skill!==o.skill||trialOutcome(t).status!=='alternative-favoured')throw Error('Follow-up requires a completed favourable experiment');
 const end=t.pairs.at(-1)?.day;
 if(o.kind==='retention'&&(!exact(t,o)||o.phase==='baseline'||dayGap(end,o.day)<7))throw Error('Retention must use the original task at least seven days later');
 if(o.kind==='transfer'&&(exact(t,o)||o.phase==='baseline'&&o.day>=t.start||o.phase==='followup'&&dayGap(end,o.day)<7))throw Error('Transfer needs a distinct matched task, pre-trial baseline and delayed follow-up');
 const rows=m.followups??[];
 if(rows.some(x=>x.id===o.id||x.trialId===o.trialId&&x.kind===o.kind&&exact(x,o)&&x.day===o.day))throw Error('Duplicate follow-up day');
 return {...m,followups:[...rows,o]};
}
export function followupReview(m,t,day){
 const records=(m.followups??[]).filter(o=>o.trialId===t.id&&o.day<=day);
 const groups=new Map();
 for(const o of records){const key=JSON.stringify([o.kind,o.skill,o.context,o.protocol]);const group=groups.get(key)??[];group.push(o);groups.set(key,group)}
 const result=[];
 for(const rows of groups.values()){
 const o=rows[0],eligible=rows.filter(x=>x.comparable&&!x.confounder),after=summarise(eligible.filter(x=>x.phase==='followup'));
 const baseline=o.kind==='retention'?summarise(t.pairs.filter(p=>p.comparable&&!p.discomfort).map(p=>({skill:t.skill,day:p.day,attempts:p.attempts,hits:p.a}))):summarise(eligible.filter(x=>x.phase==='baseline'));
 const enough=baseline&&after&&baseline.days>=6&&after.days>=7&&baseline.attempts>=120&&after.attempts>=120;
 let status='insufficient',change=null,noise=null;
 if(rows.some(x=>x.confounder))status='confounded';
 else if(enough){change=after.dayMean-baseline.dayMean;noise=2.5*Math.sqrt(after.daySD**2/after.days+baseline.daySD**2/baseline.days);const floor=['scoring','firstNine'].includes(o.skill)?5:.08;status=change>=Math.max(floor,noise)?'observed-benefit':change<=-Math.max(floor,noise)?'observed-decline':'benefit-not-established'}
 result.push({kind:o.kind,skill:o.skill,protocol:o.protocol,context:o.context,status,change,noise,baseline,after,limitation:'Delayed observed benefit is not proof of causality. For retention, comparison is against the original A condition, not against peak B performance.'});
 }
 return result;
}
