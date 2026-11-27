import {dayGap,dayValid} from './engine/context.mjs';
import {distribution} from './statistics.mjs';
import {learningEpisodes,currentLearningEpisodes} from './challenge-episodes.mjs';
import {baseKey,settingSnapshot} from './challenge-setting.mjs';
const ratio=(a,b)=>Math.abs(a-b)<=Math.max(a,b)*.25;
const distance=(a,b)=>Math.abs(dayGap(a.to,b.to));
function matchable(a,b){
 const floor=a.skill==='scoring'?5:10;
 return a.key===b.key&&a.protocol===b.protocol&&a.setting.quarter!==b.setting.quarter&&Math.abs(a.baseline-b.baseline)<=floor&&Math.abs(a.gap-b.gap)<=2&&a.sessions===b.sessions&&ratio(a.seconds,b.seconds)&&Math.abs(a.otherSeconds-b.otherSeconds)<=300&&JSON.stringify(a.otherGames)===JSON.stringify(b.otherGames)&&a.otherGames.every(k=>ratio(a.otherDose[k],b.otherDose[k]))&&JSON.stringify(a.endpointPractice)===JSON.stringify(b.endpointPractice)&&Math.abs(a.dominance-b.dominance)<=.15&&ratio(a.rounds,b.rounds)&&a.attempts.every((n,i)=>ratio(n,b.attempts[i]))&&distance(a,b)<=56&&(a.to<b.from||b.to<a.from);
}
export function compareSettings(episodes,day){
 if(!dayValid(day))throw Error('Invalid learning review date');
 const groups=new Map();
 for(const e of episodes){const k=JSON.stringify([e.key,e.protocol]),g=groups.get(k)??[];g.push(e);groups.set(k,g)}
 const out=[];
 for(const list of groups.values()){
 const levels=[...new Set(list.map(e=>e.setting.quarter))].sort((a,b)=>a-b);
 for(let i=0;i<levels.length;i++)for(let j=i+1;j<levels.length;j++){
 const lower=list.filter(e=>e.setting.quarter===levels[i]),higher=list.filter(e=>e.setting.quarter===levels[j]),matches=[],used=new Set();
 const candidates=lower.flatMap(a=>higher.filter(b=>matchable(a,b)).map(b=>({a,b,distance:distance(a,b),baseline:Math.abs(a.baseline-b.baseline)}))).sort((x,y)=>x.baseline-y.baseline||x.distance-y.distance||x.a.from.localeCompare(y.a.from)||x.b.from.localeCompare(y.b.from));
 for(const {a,b} of candidates){if(used.has(a)||used.has(b))continue;used.add(a);used.add(b);matches.push({lower:a,higher:b,difference:a.delta-b.delta})}
 const diff=distribution(matches.map(m=>m.difference)),lo=distribution(matches.map(m=>m.lower.delta)),hi=distribution(matches.map(m=>m.higher.delta));
 const lowerFirst=matches.filter(m=>m.lower.to<m.higher.from).length,higherFirst=matches.length-lowerFirst;
 const orderBalanced=lowerFirst>0&&higherFirst>0;
 const endpointAmbiguous=matches.some(m=>m.lower.endpointPractice?.length||m.higher.endpointPractice?.length);
 const latest=matches.flatMap(m=>[m.lower.to,m.higher.to]).sort().at(-1)??null;
 const blocks=new Set(matches.flatMap(m=>[m.lower.to,m.higher.to]).map(d=>Math.floor(dayGap(d,day)/7))).size;
 const floor=list[0].skill==='scoring'?3:5;
 const majority=matches.length?matches.filter(m=>m.difference>=floor).length/matches.length:0;
 const reverse=matches.length?matches.filter(m=>m.difference<=-floor).length/matches.length:0;
 const noise=diff.n>=2?2.5*diff.sd/Math.sqrt(diff.n):null;
 const adequate=matches.length>=4&&blocks>=4&&latest&&dayGap(latest,day)<=28;
 const ordered=[...matches].sort((a,b)=>[a.lower.to,a.higher.to].sort().at(-1).localeCompare([b.lower.to,b.higher.to].sort().at(-1))),recent=ordered.slice(Math.floor(matches.length/2));
 const recentLower=recent.length?recent.filter(m=>m.difference>=floor).length/recent.length:0,recentHigher=recent.length?recent.filter(m=>m.difference<=-floor).length/recent.length:0;
 const status=!adequate?'insufficient':diff.median>=Math.max(floor,noise)&&lo.median>=floor&&majority>=.75&&recentLower>=.75?'lower-favoured':diff.median<=-Math.max(floor,noise)&&hi.median>=floor&&reverse>=.75&&recentHigher>=.75?'higher-favoured':'unclear';
 out.push({key:list[0].key,skill:list[0].skill,protocol:list[0].protocol,name:list[0].setting.name,lower:lower[0].setting,higher:higher[0].setting,pairs:matches.length,blocks,latest,endpointAmbiguous,orderBalanced,lowerFirst,higherFirst,difference:diff,lowerChange:lo,higherChange:hi,status,matched:matches.map(m=>({lower:[m.lower.from,m.lower.to],higher:[m.higher.from,m.higher.to],difference:m.difference})),limitation:'Matched observational episodes; remaining confounding and regression to the mean are possible.'});
 }
 }
 return out.sort((a,b)=>b.pairs-a.pairs||a.name.localeCompare(b.name));
}
export function challengeLearning(host,state,day,now=Date.now()){
 const evidence=learningEpisodes(host,state,day,now);
 const current=currentLearningEpisodes(evidence.episodes,state,day),comparisons=compareSettings(evidence.episodes,day);
 return {...evidence,comparisons,currentComparisons:current.boundary?compareSettings(current.episodes,day):comparisons,boundary:current.boundary,currentEpisodes:current.episodes.length};
}
export function learnedCap(game,report){
 const s=settingSnapshot(game,game);if(!s)return {maxQuarter:3,reason:'untracked-rule'};
 const key=baseKey(s),rows=(report?.currentComparisons??report?.comparisons??[]).filter(r=>r.key===key);
 // Never make a game harder than the current independent evidence permits.
 // A lower setting can be preferred only when every adequate comparison of
 // those same settings agrees; contradictory or unclear protocols veto.
 const caps=[];
 for(const r of rows.filter(r=>r.status==='lower-favoured'&&!r.endpointAmbiguous&&r.orderBalanced)){
 const same=rows.filter(x=>x.lower.quarter===r.lower.quarter&&x.higher.quarter===r.higher.quarter&&x.status!=='insufficient');
 if(same.every(x=>x.status==='lower-favoured')&&!rows.some(x=>x.status==='higher-favoured'&&x.higher.quarter>=r.higher.quarter))caps.push(r.lower.quarter);
 }
 return {maxQuarter:caps.length?Math.min(...caps):3,reason:caps.length?'matched-benchmark-association':'no-confirmed-preference'};
}
export function learningLines(r){
 const number=n=>n===null?'not measured':(n>0?'+':'')+n.toFixed(1);
 const setting=s=>s.field+' '+(Array.isArray(s.after)?s.after.join('/'):s.after);
 const lines=[r.exposures+' eligible recorded exercise exposures; '+r.episodes.length+' nonoverlapping benchmark episodes.'];
 if(r.boundary)lines.push('Latest recorded setup or routine change: '+r.boundary+'. Only '+r.currentEpisodes+' post-change episodes are eligible for current learned difficulty preferences. Earlier evidence remains descriptive.');
 if(!r.comparisons.length)lines.push('Not enough comparable records at different settings yet. Normal training continues.');
 for(const c of r.comparisons.slice(0,20))lines.push(c.name+' · '+c.protocol+' · '+setting(c.lower)+' versus '+setting(c.higher)+': '+c.pairs+' matched pairs; '+c.blocks+' measured weekly blocks. '+(c.status==='insufficient'?'More evidence needed.':c.status==='lower-favoured'?'Lower setting associated with better later measurements.':c.status==='higher-favoured'?'Higher setting associated with better later measurements.':'No clear preference.')+' Median benchmark change: '+number(c.lowerChange.median)+' versus '+number(c.higherChange.median)+(c.skill==='scoring'?' points.':' percentage points.'));
 lines.push('Only complete saved sessions, exact recorded configurations and disjoint fixed benchmark measurements are eligible. Other practice and unrecorded conditions may still explain the differences. Measurement-day practice or a single chronological order prevents automatic difficulty changes. A preference can reduce challenge, never override the skill evidence ceiling or safety rules.');
 return lines;
}
