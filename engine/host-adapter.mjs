// Adapter for a future host training application. Host owns stable event IDs and local storage.
import {command,batch,query} from './coach-api.mjs';
import {dayValid} from './context.mjs';
import {SKILLS,validObservation} from './engine.mjs';
const allowed=/^[A-Za-z0-9_-]{1,32}$/;
const eventAllowed=/^[A-Za-z0-9_-]{1,60}$/;
function eventIdentity(source,id){if(!allowed.test(source)||!eventAllowed.test(id)||typeof source!=='string'||typeof id!=='string')throw Error('Invalid host source or event identity');return 'host:'+source+':'+id;}
const shape=(o,fields)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!fields.includes(k)))throw Error('Unsupported host event fields')};
export function benchmarkEvent(source,event){
 shape(event,['eventId','day','skill','context','protocol','attempts','hits']);
 if(typeof event.protocol!=='string'||!event.protocol.trim()||event.protocol.length>55||!dayValid(event.day)||!SKILLS.includes(event.skill))throw Error('Host benchmark requires an explicit compatible protocol');
 const observation=validObservation({id:eventIdentity(source,event.eventId),day:event.day,skill:event.skill,context:event.context,protocol:'host:'+source+':'+event.protocol.trim(),attempts:event.attempts,hits:event.hits});
 return observation;
}
export function importBenchmarks(memory,source,events,day,{confirmed=false}={}){
 if(confirmed!==true)throw Error('Explicit permission required to import player data');
 if(!Array.isArray(events)||!events.length||events.length>200||!dayValid(day))throw Error('Invalid import batch');
 const existing=new Map(memory.observations.map(o=>[o.id,o])),requests=[];let duplicates=0;
 for(const event of events){
 const o=benchmarkEvent(source,event);
 if(o.day>day)throw Error('Future host event');
 const prev=existing.get(o.id);
 if(prev){if(['id','day','skill','context','protocol','attempts','hits'].some(k=>prev[k]!==o[k]))throw Error('Host event conflicts with an existing record');duplicates++;continue}
 existing.set(o.id,o);requests.push({version:1,type:'observation',day,payload:o});
 }
 // Validate even on a no-op; never trust the caller's memory schema.
 const state=requests.length?batch(memory,requests,{confirmed:true}).state:structuredCopy(memory);
 return {state,imported:requests.length,duplicates,source};
}
import {validateState} from './state.mjs';
const structuredCopy=x=>validateState(JSON.parse(JSON.stringify(x)));
export function integrationExample(day){
 if(!dayValid(day))throw Error('Invalid example date');
 const date=n=>new Date(Date.parse(day)-86400000*n).toISOString().slice(0,10);
 const memory={schema:1,namespace:'DCI-independent',facts:[],observations:[],exposure:[],interventions:[]};
 const events=Array.from({length:14},(_,i)=>({eventId:'demo'+i,day:date(14-i),skill:'doubles',context:'practice',protocol:'fixed-doubles-60',attempts:60,hits:i<7?30:12}));
 const a=importBenchmarks(memory,'example-host',events,day,{confirmed:true});
 const b=importBenchmarks(a.state,'example-host',events,day,{confirmed:true});
 const report=query(b.state,{version:1,type:'review',day,payload:{}}).result;
 const session=query(b.state,{version:1,type:'training',day,payload:{number:1}}).result;
 return {imported:a.imported,retried:b.duplicates,total:b.state.observations.length,decision:report.decision,focus:report.focus,trainingMinutes:session.segments.reduce((n,g)=>n+g.minutes,0),verification:report.verification.status};
}

export function parseHostExport(text){
 if(typeof text!=='string'||!text.length||text.length>250000)throw Error('Invalid or oversized host export');
 let data;try{data=JSON.parse(text)}catch{throw Error('Host export must be valid JSON')}
 shape(data,['format','version','source','events']);
 if(data.format!=='DCI-benchmark-events'||data.version!==1||typeof data.source!=='string'||!allowed.test(data.source)||!Array.isArray(data.events)||!data.events.length||data.events.length>200)throw Error('Unsupported benchmark export');
 for(const event of data.events)benchmarkEvent(data.source,event);
 return {format:data.format,version:data.version,source:data.source,events:data.events};
}
export function previewHostExport(memory,text,day){
 const data=parseHostExport(text),result=importBenchmarks(memory,data.source,data.events,day,{confirmed:true});
 const scopes=[...new Set(data.events.map(e=>e.skill+' • '+e.context+' • '+e.protocol))];
 return {data,imported:result.imported,duplicates:result.duplicates,scopes};
}
