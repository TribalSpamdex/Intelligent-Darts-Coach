import {dayValid} from './context.mjs';
export const SETUP_FIELDS=['weight','barrel shape','grip position','grip intensity','balance point','point length','stem length','flight shape','integrated flight','entry angle'];
export function validateSetup(o){
 if(!o||typeof o.id!=='string'||!o.id.trim()||o.id.length>100||!dayValid(o.day)||typeof o.name!=='string'||!o.name.trim()||o.name.length>100||!o.values||typeof o.values!=='object'||Array.isArray(o.values)||!Object.keys(o.values).every(k=>SETUP_FIELDS.includes(k))||!Object.values(o.values).every(v=>typeof v==='string'&&v.trim()&&v.length<=100)||!['comfortable','uncomfortable','unknown'].includes(o.comfort))throw Error('Invalid equipment snapshot');
 return {id:o.id,day:o.day,name:o.name.trim(),values:Object.fromEntries(Object.entries(o.values).map(([k,v])=>[k,v.trim()])),comfort:o.comfort};
}
export function recordSetup(m,o){o=validateSetup(o);if((m.setups??[]).some(x=>x.id===o.id))throw Error('Duplicate equipment snapshot');return {...m,setups:[...(m.setups??[]),o]}}
export function setupComparison(a,b){
 a=validateSetup(a);b=validateSetup(b);
 const changed=[],unchanged=[],unknown=[];
 for(const key of SETUP_FIELDS){if(!a.values[key]||!b.values[key])unknown.push(key);else if(a.values[key]===b.values[key])unchanged.push(key);else changed.push(key)}
 return {baseline:a.name,alternative:b.name,changed,unchanged,unknown,decision:b.comfort==='uncomfortable'?'stop-and-review':changed.length>1?'isolate-variables':changed.length===1?'compare-single-variable':'no-established-change',guidance:b.comfort==='uncomfortable'?'Do not persist with an uncomfortable setup.':changed.length>1?'More than one known variable changed. Do not attribute results to just one.':changed.length===1?'Test the known change under matched conditions; unknown fields may still differ.':'Do not infer equipment changes from missing specifications.',limitation:'These are reported specifications. No product purchase recommendation or measured mechanical effect.'};
}
