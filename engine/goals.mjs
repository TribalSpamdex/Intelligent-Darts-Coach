import {SKILLS,summarise,SEGMENTS,isDouble,currentFacts} from './engine.mjs';
import {dayValid,dayGap} from './context.mjs';
export function validateGoal(g){
 if(!g||typeof g.id!=='string'||!g.id.trim()||g.id.length>100||!SKILLS.includes(g.skill)||!['practice','competition'].includes(g.context)||typeof g.protocol!=='string'||!g.protocol.trim()||g.protocol.length>100||!dayValid(g.start)||!dayValid(g.review)||dayGap(g.start,g.review)<7||dayGap(g.start,g.review)>366||!Number.isFinite(g.target)||g.target<=0||g.target>(['scoring','firstNine'].includes(g.skill)?180:1)||!['active','closed'].includes(g.status))throw Error('Invalid measurable goal');
 if(g.closedDay!=null&&(!dayValid(g.closedDay)||g.closedDay<g.start||g.status!=='closed'))throw Error('Invalid goal closure date');
 return {id:g.id,skill:g.skill,context:g.context,protocol:g.protocol,start:g.start,review:g.review,target:g.target,status:g.status,...(g.closedDay?{closedDay:g.closedDay}:{})};
}
export function createGoal(m,g){g=validateGoal({...g,status:'active'});if((m.goals??[]).some(x=>x.id===g.id||x.status==='active'&&x.skill===g.skill&&x.context===g.context&&x.protocol===g.protocol))throw Error('Resolve the existing goal first');return {...m,goals:[...(m.goals??[]),g]}}
export function goalProgress(m,g,day){
 if(!dayValid(day))throw Error('Invalid review date');
 const rows=m.observations.filter(o=>o.skill===g.skill&&o.context===g.context&&o.protocol===g.protocol&&o.day<=day),earlier=summarise(rows.filter(o=>o.day<g.start&&dayGap(o.day,g.start)<=28)),recent=summarise(rows.filter(o=>o.day>=g.start&&dayGap(o.day,day)<28));
 const adequate=recent&&recent.days>=7&&recent.attempts>=60;
 const retained=adequate&&recent.daily.slice(-7).every(o=>o.value>=g.target);
 const status=!adequate?'insufficient':retained?'target-observed':recent.dayMean>=g.target?'promising-not-consistent':'in-progress';
 return {status,baseline:earlier&&earlier.days>=7&&earlier.attempts>=60?earlier.value:null,current:recent?.value??null,days:recent?.days??0,target:g.target,reviewDue:day>=g.review,limitation:'Goal achievement is observational; does not establish causation or permanent retention.'};
}
export function closeGoal(m,id,day=null){const goal=(m.goals??[]).find(g=>g.id===id&&g.status==='active');if(!goal)throw Error('Unknown active goal');if(day!==null&&(!dayValid(day)||day<goal.start))throw Error('Invalid goal closure date');return {...m,goals:m.goals.map(g=>g.id===id?{...g,status:'closed',...(day?{closedDay:day}:{})}:g)}}
export function preferredDoubles(m){
 const allowed=['D20','D16','D18','D10','D8'];
 const f=currentFacts(m).find(x=>x.key.toLowerCase().trim()==='preferred double');
 const raw=f?.value.trim().toUpperCase(),d=raw==='BULL'?'50':raw;
 return d&&isDouble(d)?[d,...allowed.filter(s=>s!==d)]:allowed;
}
// Actual logged session and manual exposure might refer to the same practice.
// Take the larger total for each date/skill, never automatically add overlaps.
export function combinedExposure(m){
 const byKey=new Map();
 function put(day,skill,minutes,source){if(skill==='warmup')return;const key=JSON.stringify([day,skill]);const row=byKey.get(key)??{day,skill,manual:0,session:0};row[source]+=minutes;byKey.set(key,row)}
 for(const e of m.exposure)put(e.day,e.skill,e.minutes,'manual');
 for(const s of m.sessions??[])for(const g of s.segments)put(s.day,g.skill,g.minutes,'session');
 return [...byKey.values()].map(o=>({day:o.day,skill:o.skill,minutes:Math.max(o.manual,o.session),overlap:o.manual>0&&o.session>0}));
}
