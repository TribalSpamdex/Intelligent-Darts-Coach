// Synthetic reconstruction benchmark; no browser/device timing claims.
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const now=Date.parse('2026-11-27T12:00Z'),day='2026-11-27',ms=86400000;
function dataset(years){const h={games:[],sessions:[],bigSingles:[]};
 for(let age=years*365-1;age>=0;age--){const at=now-age*ms-1000,d=new Date(at).toISOString().slice(0,10);
 for(let round=0;round<3;round++){const id='perf-'+age+'-'+round,name=round?'Target Mastery':'Scoring Challenge';h.sessions.push({id,quick:true,quickGame:name,date:d,start:at-1000});
 const g={name,sessionId:id,quick:true,at:at+round,day:d,offsetMinutes:0,completion:'natural',benchmark:!round};
 Object.assign(g,round?{masteryMode:'segment',thrown:15,hits:age<28?3:12,targetLog:Array.from({length:15},(_,i)=>({ring:'D',target:round===1?16:20,hit:i<(age<28?3:12)}))}:{visits:10,points:600,scores:Array(10).fill(60)});h.games.push(g)}}return h}
const roots=process.argv.slice(2),results=[];
for(const root of roots){const module=async name=>import(pathToFileURL(path.resolve(root,name+'.mjs'))),v=await module('v62-evidence'),p=await module('precision-adapter'),t=await module('host-targets'),c=await module('coach-memory');
 for(const years of [1,5,10]){const host=dataset(years),json=JSON.stringify(host),runs=[];
 const operations={benchmarks:()=>v.projectEvidence(host,{today:day,now}),targets:()=>t.projectTargets(host,day,now),cards:()=>p.quickMeasurementCards(host,day,now),coach:()=>c.assess(host,null,day,now),restoreParse:()=>JSON.parse(json)};
 if(t.targetDevelopment)operations.targetAction=()=>t.targetDevelopment(host,c.newMemory().state,day,now);
 for(const [name,fn] of Object.entries(operations)){const times=[];let count=null;for(let i=0;i<6;i++){const start=performance.now(),r=fn(),elapsed=performance.now()-start;if(i)times.push(elapsed);count=Array.isArray(r)?r.length:r.observations?.length??r.rows?.length??null}times.sort((a,b)=>a-b);runs.push({operation:name,medianMs:+times[2].toFixed(3),p95Ms:+times[4].toFixed(3),returned:count})}
 results.push({root,years,days:years*365,games:host.games.length,sessions:host.sessions.length,jsonBytes:Buffer.byteLength(json),runs});
 }}
console.log(JSON.stringify({environment:{node:process.version,platform:process.platform,arch:process.arch},method:'one warm-up plus five sequential reconstruction samples; median and maximum-as-p95 with n=5; synthetic 3 rounds/day; no physical-device claims',results},null,2));
