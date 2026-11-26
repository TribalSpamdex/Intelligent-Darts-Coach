import {dayValid,dayGap} from './engine/context.mjs';
import {validSetting,settingKey,baseKey,LEARNING_GAMES} from './challenge-setting.mjs';
import {validPrecisionRecord} from './precision-games.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const id=v=>typeof v==='string'&&v.length>0&&v.length<=150||Number.isSafeInteger(v)&&v>0;
const seconds=v=>Number.isInteger(v)&&v>=0&&v<=3600;
function validRound(g,s,a,now){
 const l=g.learningSetting;
 if(!validSetting(l)||g.name!==l.name||g.name!==a.name||g.sessionId!==s.id||g.exerciseId!==a.exerciseId||g.exerciseIndex!==a.exerciseIndex||g.day!==s.date||g.quick!==false||g.extra||g.recovery||g.ruleVersion!==l.rule&&!(g.ruleVersion==null&&l.rule===null)||g.tierAtStart!==l.tier||!Number.isFinite(g.at)||g.at<s.start||g.at>a.at||g.at>now)return false;
 if(l.quarter){if(!validPrecisionRecord(g)||![2,3].includes(g.precision.version)||g.precision.quarter!==l.quarter||!same(g.precision.before,l.before)||!same(g.precision.after,l.after)||g.precision.field!==l.field||(g.precision.basis??g.precision.skill)!==l.skill)return false}
 else if(g.challengeTuning||g.precision)return false;
 return ['natural','partial','manual'].includes(g.completion)&&(g.completion!=='natural'||typeof g.win==='boolean');
}
export function extractLearningExposure(host,day,now=Date.now()){
 if(!host||!Array.isArray(host.sessions)||!Array.isArray(host.games)||!dayValid(day)||!Number.isFinite(now))throw Error('Invalid exposure history');
 const sessions=new Map(),duplicates=new Set(),games=new Map(),conflicts=new Set(),rounds=new Map(),out=[],blockedDays=new Set();
 for(const s of host.sessions){if(!s||!id(s.id)||!dayValid(s.date)||s.date>day||dayGap(s.date,day)>180)continue;const k=String(s.id);if(sessions.has(k))duplicates.add(k);else sessions.set(k,s)}
 for(const g of host.games){if(!g||!id(g.sessionId)||!sessions.has(String(g.sessionId))||!Number.isFinite(g.at)||g.at>now)continue;const k=JSON.stringify([String(g.sessionId),g.at,g.name,g.exerciseIndex]);if(games.has(k)&&!same(games.get(k),g))conflicts.add(k);else games.set(k,g)}
 for(const [k,g] of games){const i=String(g.sessionId),a=rounds.get(i)??[];a.push({g,conflict:conflicts.has(k)});rounds.set(i,a)}
 for(const [key,s] of sessions){
 if(s.quick===true)continue;
 if(duplicates.has(key)||s.quick!==false||s.extra||s.completed!==true||!Number.isFinite(s.start)||s.start>now||!Array.isArray(s.activities)||s.activities.some(a=>!a||!seconds(a.seconds)||!Number.isInteger(a.exerciseIndex)||a.exerciseIndex<0)||new Set(s.activities.map(a=>a.exerciseIndex)).size!==s.activities.length){blockedDays.add(s.date);continue}
 const total=s.activities.reduce((n,a)=>n+a.seconds,0);
 if(total>7200){blockedDays.add(s.date);continue}
 const list=rounds.get(key)??[];
 for(const a of s.activities){
 if(!LEARNING_GAMES.includes(a.name)||a.seconds<300||!id(a.exerciseId)||!Number.isFinite(a.at)||a.at>now||a.at<s.start)continue;
 const records=list.filter(x=>x.g.exerciseIndex===a.exerciseIndex||x.g.exerciseId===a.exerciseId);
 if(!records.length||records.some(x=>x.conflict||!validRound(x.g,s,a,now)))continue;
 const complete=records.filter(x=>x.g.completion==='natural').length;
 if(complete<2||!Number.isInteger(a.rounds)||a.rounds!==complete)continue;
 const groups=new Map();for(const {g} of records){const k=settingKey(g.learningSetting),c=groups.get(k)??{setting:g.learningSetting,count:0,wins:0,completed:0};c.count++;if(g.completion==='natural'){c.completed++;c.wins+=Number(g.win)}groups.set(k,c)}
 const ranked=[...groups.values()].sort((a,b)=>b.count-a.count||settingKey(a.setting).localeCompare(settingKey(b.setting))),main=ranked[0];
 if(main.count/records.length<.75||main.completed<2||ranked.some(x=>baseKey(x.setting)!==baseKey(main.setting)))continue;
 // Same exercise seconds are total observed activity time, not time at a setting.
 const other=s.activities.filter(x=>x!==a).map(x=>[x.name,x.seconds]).sort((a,b)=>a[0].localeCompare(b[0])||a[1]-b[1]);
 out.push({day:s.date,sessionId:s.id,exerciseId:a.exerciseId,setting:main.setting,seconds:a.seconds,otherSeconds:total-a.seconds,other,rounds:records.length,dominance:main.count/records.length,completed:main.completed,wins:main.wins});
 }
 }
 return {exposures:out.sort((a,b)=>a.day.localeCompare(b.day)||String(a.sessionId).localeCompare(String(b.sessionId))),blockedDays:[...blockedDays].sort(),sessionDays:[...sessions.values()].filter(s=>s.quick!==true).map(s=>({day:s.date,id:s.id}))};
}
