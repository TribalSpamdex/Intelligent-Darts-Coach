import {dayValid,dayGap} from './engine/context.mjs';
import {projectExposure} from './host-exposure.mjs';
import {distribution} from './statistics.mjs';
export function practiceProfile(host,day){
 if(!dayValid(day)||!Array.isArray(host.sessions)||!Array.isArray(host.games))throw Error('Invalid practice history');
 const exposure=projectExposure(host,day).exposure,seen=new Map(),duplicates=new Set();
 for(const s of host.sessions){
 if(!s||s.quick!==false||!dayValid(s.date)||s.date>day||!['number','string'].includes(typeof s.id))continue;
 const id=String(s.id);if(seen.has(id))duplicates.add(id);else seen.set(id,s);
 }
 const sessions=[...seen].filter(([id])=>!duplicates.has(id)).map(([,s])=>s);
 return {duplicates:duplicates.size,windows:[7,28,84,365].map(days=>{
 const rows=exposure.filter(r=>dayGap(r.day,day)<days),ss=sessions.filter(s=>dayGap(s.date,day)<days),active=new Set(ss.map(s=>s.date)),classified=new Set(rows.map(r=>r.day)),perSkill=new Map(),daily=new Map();
 for(const r of rows){perSkill.set(r.skill,(perSkill.get(r.skill)??0)+r.minutes);daily.set(r.day,(daily.get(r.day)??0)+r.minutes)}
 const total=rows.reduce((n,r)=>n+r.minutes,0);
 return {days,sessions:ss.length,sessionDays:active.size,classifiedDays:classified.size,total,minutesPerCalendarWeek:total*7/days,recordedDayMinutes:distribution([...daily.values()]),skills:[...perSkill].map(([skill,minutes])=>({skill,minutes,share:total?minutes/total:null})).sort((a,b)=>b.minutes-a.minutes||a.skill.localeCompare(b.skill))};
 }),limitation:'Only classified saved training minutes; warm-up, mixed games, Quick Play and unlogged practice are not included. Unrecorded dates are not assumed rest days.'};
}
export function practiceLines(p){
 if(!p.windows[3].sessions)return ['No eligible saved training sessions in the last 365 days.'];
 return [...p.windows.flatMap(w=>[w.days+' days: '+w.sessions+' saved sessions on '+w.sessionDays+' days; '+w.total+' classified minutes on '+w.classifiedDays+' days; '+w.minutesPerCalendarWeek.toFixed(1)+' classified minutes per calendar week.',w.skills.length?w.skills.map(s=>s.skill+' '+s.minutes+' min ('+(100*s.share).toFixed(1)+'%)').join(' · '):'No classified skill minutes.']),p.limitation];
}
