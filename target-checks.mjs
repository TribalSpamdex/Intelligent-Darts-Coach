import {dayValid,dayGap} from './engine/context.mjs';
const double=x=>typeof x==='string'&&/^D(?:[1-9]|1[0-9]|20)$/.test(x);
const hits=x=>Number.isInteger(x)&&x>=0&&x<=10;
export function validateTargetCheck(x){
 if(!x||typeof x.id!=='string'||!x.id.trim()||x.id.length>100||!dayValid(x.day)||!double(x.first)||!double(x.second)||x.first===x.second||!hits(x.firstHits)||!hits(x.secondHits)||typeof x.comparable!=='boolean')throw Error('Invalid two-double check');
 const reverse=Number(x.first.slice(1))>Number(x.second.slice(1));
 return {id:x.id,day:x.day,first:reverse?x.second:x.first,second:reverse?x.first:x.second,firstHits:reverse?x.secondHits:x.firstHits,secondHits:reverse?x.firstHits:x.secondHits,comparable:x.comparable};
}
export function validateChecks(raw=[]){
 if(!Array.isArray(raw)||raw.length>10000)throw Error('Invalid target check history');
 const ids=new Set(),days=new Set();return raw.map(v=>{const x=validateTargetCheck(v),key=[x.day,x.first,x.second].join('/');if(ids.has(x.id)||days.has(key))throw Error('Duplicate target check');ids.add(x.id);days.add(key);return x})
}
export function addCheck(raw,x,day){
 x=validateTargetCheck(x);if(x.day!==day)throw Error('Target check must be recorded today');
 return validateChecks([...raw,x])
}
export const checkProtocol=(a,b)=>'Paired doubles '+[a,b].sort((x,y)=>Number(x.slice(1))-Number(y.slice(1))).join(' / ')+' · 10 each';
export function projectChecks(raw,day){
 return validateChecks(raw).filter(x=>x.comparable&&dayGap(x.day,day)>=0&&dayGap(x.day,day)<84).flatMap(x=>[{day:x.day,protocol:checkProtocol(x.first,x.second),target:x.first,attempts:10,hits:x.firstHits},{day:x.day,protocol:checkProtocol(x.first,x.second),target:x.second,attempts:10,hits:x.secondHits}])
}
