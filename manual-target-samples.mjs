import {REGIONS,validThrow,targetSummaries} from './engine/target-evidence.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
const prefix='idc-fixed20:',protocol='Manual fixed 20-dart target sample';
const aimed=REGIONS.filter(t=>t!=='MISS');
export function makeTargetSample(input,today){
 if(!input||!dayValid(today)||input.day!==today||!aimed.includes(input.aim)||typeof input.id!=='string'||!/^[a-zA-Z0-9-]{1,50}$/.test(input.id))throw Error('Invalid fixed target sample');
 const actual=typeof input.actual==='string'?input.actual.trim().toUpperCase().split(/\s+/):input.actual;
 if(!Array.isArray(actual)||actual.length!==20||actual.some(s=>!REGIONS.includes(s)))throw Error('Enter exactly 20 actual board segments, including MISS where appropriate');
 return actual.map((s,i)=>validThrow({id:prefix+input.id+':'+i,day:today,context:'practice',protocol,aim:input.aim,actual:s}));
}
export function manualSamples(throws){
 const groups=new Map(),dayTargets=new Set();
 for(const raw of throws??[]){
 if(!raw?.id?.startsWith(prefix))continue;
 const o=validThrow(raw),m=o.id.match(/^idc-fixed20:([a-zA-Z0-9-]{1,50}):(\d{1,2})$/);
 if(!m)throw Error('Invalid target sample identity');
 const g=groups.get(m[1])??[];g.push({...o,index:Number(m[2])});groups.set(m[1],g);
 }
 return [...groups].map(([id,rows])=>{
 const first=rows[0];
 if(rows.length!==20||new Set(rows.map(o=>o.index)).size!==20||rows.some(o=>o.index<0||o.index>19||o.day!==first.day||o.aim!==first.aim||o.protocol!==protocol||o.context!=='practice'))throw Error('Incomplete or conflicting fixed target sample');
 const key=JSON.stringify([first.day,first.aim]);if(dayTargets.has(key))throw Error('Duplicate daily fixed target sample');dayTargets.add(key);
 const ordered=rows.sort((a,b)=>a.index-b.index).map(({index,...o})=>o);
 const s=targetSummaries(ordered)[0];
 return {id,day:first.day,aim:first.aim,hits:s.hits,attempts:20,throws:ordered};
 });
}
export function addTargetSample(state,input,today){
 const rows=makeTargetSample(input,today),samples=manualSamples(state.throws);
 if(samples.some(s=>s.id===input.id||s.day===today&&s.aim===input.aim))throw Error('One fixed sample per target per day; remove the old sample first');
 return {...state,throws:[...(state.throws??[]),...rows]};
}
export function removeTargetSample(state,id){
 if(!manualSamples(state.throws).some(s=>s.id===id))throw Error('Unknown fixed target sample');
 return {...state,throws:state.throws.filter(o=>!o.id.startsWith(prefix+id+':'))};
}
export function manualTargetRows(throws,day){
 return manualSamples(throws).filter(s=>dayGap(s.day,day)>=0&&dayGap(s.day,day)<84&&/^(?:[SDT](?:[1-9]|1[0-9]|20)|25|50)$/.test(s.aim)).map(s=>({day:s.day,target:s.aim,protocol,attempts:s.attempts,hits:s.hits}));
}
export function manualMissProfile(throws,day){
 const samples=manualSamples(throws).filter(s=>dayGap(s.day,day)>=0&&dayGap(s.day,day)<84);
 return {groups:targetSummaries(samples.flatMap(s=>s.throws)),unknown:0,excluded:0,limitation:'Manually recorded fixed target practice; actual board segments only. No mechanical diagnosis from a miss direction.'};
}
