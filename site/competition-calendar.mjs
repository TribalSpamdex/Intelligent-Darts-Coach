// Local competition intentions; no calendar account, network or automatic
// training changes. A dated event is a player-reported plan, not a result.
import {dayValid,dayGap} from './engine/context.mjs';
export function validateEvents(rows=[]){
 if(!Array.isArray(rows)||rows.length>5000)throw Error('Invalid competition history');
 const seen=new Set();
 return rows.map(x=>{
  if(!x||typeof x.id!=='string'||!/^[A-Za-z0-9-]{1,100}$/.test(x.id)||seen.has(x.id)||!dayValid(x.day)||!dayValid(x.recordedDay)||x.recordedDay>x.day||dayGap(x.recordedDay,x.day)>366||typeof x.name!=='string'||!x.name.trim()||x.name.length>100||!['league','tournament','friendly','other'].includes(x.kind))throw Error('Invalid competition event');
  seen.add(x.id);return {id:x.id,day:x.day,recordedDay:x.recordedDay,name:x.name.trim(),kind:x.kind};
 });
}
export function addEvent(rows,event,today){
 if(!dayValid(today)||!dayValid(event?.day)||event.day<today||dayGap(today,event.day)>366)throw Error('Choose a competition date within the next year');
 return validateEvents([...validateEvents(rows),{...event,recordedDay:today}]);
}
export function removeEvent(rows,id){
 const events=validateEvents(rows);if(!events.some(x=>x.id===id))throw Error('Unknown competition');
 return events.filter(x=>x.id!==id);
}
export function eventContext(rows,day){
 if(!dayValid(day))throw Error('Invalid review date');
 const events=validateEvents(rows).filter(x=>x.day>=day&&x.recordedDay<=day).sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id));
 const event=events[0]??null,days=event?dayGap(day,event.day):null;
 return {event,days,upcoming:events.slice(0,10),phase:days===null?'ordinary':days===0?'competition-day':days<=2?'near-event':days<=7?'event-week':'ordinary'};
}
export function eventLines(rows,day){
 const r=eventContext(rows,day);
 if(!r.event)return ['No upcoming competition recorded. Maintain your normal agreed practice.'];
 const guidance={'competition-day':'Prioritise a comfortable familiar warm-up and your normal match routine. No extra demanding session is prescribed.','near-event':'Keep equipment and technique familiar. Avoid introducing a demanding new experiment just before the event.','event-week':'Use familiar finishing and scoring practice, review your routine and allow recovery. Do not force extra practice.','ordinary':'Maintain normal balanced practice; review preparation closer to the event.'};
 return [...r.upcoming.map(e=>e.day+' · '+e.name+' ('+e.kind+')'),guidance[r.phase],'Player-entered schedule only. These preparation suggestions are advisory; no session is automatically added, cancelled or extended.'];
}
