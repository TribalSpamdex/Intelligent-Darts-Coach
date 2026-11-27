import {dayGap,dayValid} from './engine/context.mjs';
import {canonicalRows} from './longitudinal.mjs';
import {distribution} from './statistics.mjs';
import {summarise} from './engine/engine.mjs';
export function contextComparison(observations,day){
 if(!dayValid(day))throw Error('Invalid comparison date');
 const scopes=new Map();
 for(const o of canonicalRows(observations,day).filter(o=>dayGap(o.day,day)<84)){
 const k=JSON.stringify([o.skill,o.protocol]);if(!scopes.has(k))scopes.set(k,{practice:[],competition:[]});scopes.get(k)[o.context].push(o);
 }
 return [...scopes].map(([key,g])=>{
 const [skill,protocol]=JSON.parse(key);
 const a=summarise(g.practice),b=summarise(g.competition);
 const weeks=new Map();
 for(const [context,s] of [['practice',a],['competition',b]])for(const o of s?.daily??[]){
 const k=Math.floor(dayGap(o.day,day)/7),w=weeks.get(k)??{practice:[],competition:[]};w[context].push(o.value);weeks.set(k,w);
 }
 const paired=[...weeks.values()].filter(w=>w.practice.length&&w.competition.length);
 const matchedWeeks=new Set([...weeks].filter(([,w])=>w.practice.length&&w.competition.length).map(([k])=>k));
 const attemptsA=g.practice.filter(o=>matchedWeeks.has(Math.floor(dayGap(o.day,day)/7))).reduce((n,o)=>n+o.attempts,0),attemptsB=g.competition.filter(o=>matchedWeeks.has(Math.floor(dayGap(o.day,day)/7))).reduce((n,o)=>n+o.attempts,0);
 const diff=distribution(paired.map(w=>distribution(w.competition).mean-distribution(w.practice).mean));
 const daysA=paired.reduce((n,w)=>n+w.practice.length,0),daysB=paired.reduce((n,w)=>n+w.competition.length,0);
 const floor=['scoring','firstNine'].includes(skill)?3:.05;
 const noise=diff.n>=2?2.5*diff.sd/Math.sqrt(diff.n):null;
 const consistent=diff.n&&paired.filter(w=>Math.sign(distribution(w.competition).mean-distribution(w.practice).mean)===Math.sign(diff.mean)).length/diff.n;
 const status=diff.n<4||daysA<7||daysB<7||attemptsA<60||attemptsB<60?'insufficient':Math.abs(diff.mean)>=Math.max(floor,noise)&&consistent>=.75?'observed-gap':'unclear';
 return {skill,protocol,status,practiceDays:a?.days??0,competitionDays:b?.days??0,pairedWeeks:diff.n,pairedPracticeDays:daysA,pairedCompetitionDays:daysB,pairedPracticeAttempts:attemptsA,pairedCompetitionAttempts:attemptsB,difference:diff.mean,noise,practice:a?.dayMean??null,competition:b?.dayMean??null};
 });
}
export function contextComparisonLines(rows){
 if(!rows.length)return ['No comparable practice or competition measurements.'];
 const f=(v,s)=>v===null?'not recorded':(['scoring','firstNine'].includes(s)?v.toFixed(1)+' average points':(100*v).toFixed(1)+' percentage points');
 return [...rows.slice(0,20).map(r=>r.skill+' · '+r.protocol+': '+r.status+'; '+r.pairedWeeks+' matched weeks, '+r.pairedPracticeDays+' matched practice days, '+r.pairedCompetitionDays+' matched competition days, '+r.pairedPracticeAttempts+'/'+r.pairedCompetitionAttempts+' matched attempts'+(r.status==='observed-gap'?'; competition minus practice '+f(r.difference,r.skill):'')), 'Only identical protocols across contexts are compared. An observed difference does not prove pressure caused it. Match data are not inferred from practice or bot games.'];
}
