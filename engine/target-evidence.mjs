import {points,isDouble,SEGMENTS,routes} from './engine.mjs';
export const BOARD=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
export const REGIONS=[...BOARD.flatMap(n=>['S'+n,'L'+n,'I'+n,'D'+n,'T'+n]),'25','50','MISS'];
const valid=x=>REGIONS.includes(x);
const canonical=x=>/^[LI]/.test(x)?'S'+x.slice(1):x;
const num=x=>/^[SLIDT]/.test(x)?Number(x.slice(1)):null;
const ring=x=>x==='25'||x==='50'?'bull':x==='MISS'?'miss':x[0];
export function classify(aim,actual){
 if(!valid(aim)||aim==='MISS'||!valid(actual))throw Error('Invalid aimed/actual segment');
 if(actual===aim||(/^S/.test(aim)&&canonical(actual)===aim))return 'exact';
 if(actual==='MISS')return 'off-board';
 if(num(aim)===null||num(actual)===null)return 'other-region';
 const offset=(BOARD.indexOf(num(actual))-BOARD.indexOf(num(aim))+20)%20;
 if(offset===1)return 'clockwise-neighbour';
 if(offset===19)return 'anticlockwise-neighbour';
 if(offset===0)return 'same-number-different-ring';
 return 'different-number';
}
export function validThrow(o){
 if(!o||typeof o.id!=='string'||!o.id.trim()||o.id.length>100||typeof o.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(o.day)||!Number.isFinite(Date.parse(o.day))||new Date(o.day).toISOString().slice(0,10)!==o.day||!['practice','competition'].includes(o.context)||typeof o.protocol!=='string'||!o.protocol.trim()||o.protocol.length>100||!valid(o.aim)||o.aim==='MISS'||!valid(o.actual))throw Error('Invalid throw observation');
 return {id:o.id,day:o.day,context:o.context,protocol:o.protocol,aim:o.aim,actual:o.actual};
}
export function appendThrow(memory,o){
 o=validThrow(o);const throws=memory.throws??[];if(throws.some(x=>x.id===o.id))throw Error('Duplicate throw');
 return {...memory,throws:[...throws,o]};
}
export function targetSummaries(throws){
 const groups=new Map();
 for(const raw of throws){const o=validThrow(raw),key=JSON.stringify([o.aim,o.context,o.protocol]);if(!groups.has(key))groups.set(key,{aim:o.aim,context:o.context,protocol:o.protocol,attempts:0,hits:0,days:new Set(),outcomes:{},directions:{}});const g=groups.get(key),dir=classify(o.aim,o.actual);g.attempts++;g.hits+=Number(dir==='exact');g.days.add(o.day);g.outcomes[o.actual]=(g.outcomes[o.actual]??0)+1;g.directions[dir]=(g.directions[dir]??0)+1}
 return [...groups.values()].map(g=>({...g,days:g.days.size,accuracy:g.hits/g.attempts,adequacy:g.days.size>=7&&g.attempts>=60?'exploratory':'insufficient'}));
}
export function modelFor(throws,context,protocol){
 const groups=targetSummaries(throws).filter(g=>g.context===context&&g.protocol===protocol&&g.adequacy==='exploratory'&&SEGMENTS.includes(g.aim));
 return Object.fromEntries(groups.map(g=>[g.aim,{counts:g.outcomes,attempts:g.attempts,days:g.days}]));
}
// Restricted empirical policy, not a calibrated win probability. Only observed
// targets are eligible. Outcomes unseen in the sample have no mass; missing
// target data are explicitly excluded, never filled with invented estimates.
export function missAwarePolicy(score,darts,model){
 if(!Number.isInteger(score)||score<2||score>1001||!Number.isInteger(darts)||darts<1||darts>3)throw Error('Invalid tactical query');
 const aims=Object.keys(model).filter(a=>{const g=model[a];return SEGMENTS.includes(a)&&g&&Number.isInteger(g.attempts)&&g.attempts>=60&&g.days>=7&&Object.entries(g.counts??{}).every(([s,n])=>valid(s)&&Number.isInteger(n)&&n>=0)&&Object.values(g.counts).reduce((a,b)=>a+b,0)===g.attempts});
 if(!aims.length)return {status:'insufficient',options:[],limitations:['No comparable target outcome distributions.']};
 const memo=new Map();
 function best(left,n){if(n===0||left<2)return 0;const k=left+'/'+n;if(memo.has(k))return memo.get(k);const v=Math.max(0,...options(left,n).map(x=>x.estimate));memo.set(k,v);return v}
 function options(left,n){return aims.map(aim=>{const g=model[aim];let estimate=0;for(const [raw,count] of Object.entries(g.counts)){const actual=canonical(raw),remain=left-points(actual);const p=remain===0&&isDouble(actual)?1:remain<2?0:best(remain,n-1);estimate+=count/g.attempts*p}return {aim,estimate}}).sort((a,b)=>b.estimate-a.estimate||a.aim.localeCompare(b.aim))}
 return {status:'restricted-empirical-model',options:options(score,darts),eligibleTargets:aims,limitations:['Conditional on measured target distributions and stationary independent outcomes.','Unobserved outcomes and unmeasured targets are not modelled; estimates are not calibrated checkout or match-win probabilities.','Only same-context and same-protocol measurements should be supplied.']};
}
