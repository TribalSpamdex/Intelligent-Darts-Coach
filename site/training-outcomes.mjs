// Observational training method, dose and delayed follow-up learning.
// Never changes the player's difficulty, allocation, or saved records.
import {dayValid,dayGap} from './engine/context.mjs';
import {distribution} from './statistics.mjs';
import {canonicalRows} from './longitudinal.mjs';
import {summarise} from './engine/engine.mjs';
import {learningEpisodes,recordedConfounder} from './challenge-episodes.mjs';
import {settingKey} from './challenge-setting.mjs';
const floor=s=>s==='scoring'?3:5;
const minimum={scoring:30,doubles:60,checkout:12,bull:30,singles:60,trebles:60};
const ratio=(a,b,t=.25)=>Math.abs(a-b)<=Math.max(a,b)*t;
const key=e=>JSON.stringify([e.skill,e.protocol]);
const exact=e=>settingKey(e.setting);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const measure=(s,v)=>s==='scoring'?v:v*100;
const disjoint=(a,b)=>a.to<b.from||b.to<a.from;
const dist=(a,b)=>Math.abs(dayGap(a.to,b.to));
function compatible(a,b){
 return key(a)===key(b)&&disjoint(a,b)&&!a.endpointPractice.length&&!b.endpointPractice.length&&
 Math.abs(a.baseline-b.baseline)<=(a.skill==='scoring'?5:10)&&Math.abs(a.gap-b.gap)<=2&&a.sessions===b.sessions&&
 Math.abs(a.otherSeconds-b.otherSeconds)<=300&&same(a.otherGames,b.otherGames)&&
 a.otherGames.every(k=>ratio(a.otherDose[k],b.otherDose[k]))&&Math.abs(a.dominance-b.dominance)<=.15&&
 a.attempts.every((n,i)=>ratio(n,b.attempts[i]))&&dist(a,b)<=56;
}
function summary(matches,day,skill){
 const a=distribution(matches.map(m=>m.a.delta)),b=distribution(matches.map(m=>m.b.delta)),d=distribution(matches.map(m=>m.a.delta-m.b.delta)),n=matches.length;
 const aFirst=matches.filter(m=>m.a.to<m.b.from).length,bFirst=n-aFirst;
 const dates=matches.flatMap(m=>[m.a.to,m.b.to]),weeks=new Set(dates.map(x=>Math.floor(dayGap(x,day)/7))).size,latest=dates.sort().at(-1)??null;
 const threshold=floor(skill),noise=n>=2?2.5*d.sd/Math.sqrt(n):null;
 const direction=d.median===null?0:Math.sign(d.median);
 const agreement=n?matches.filter(m=>direction*(m.a.delta-m.b.delta)>=threshold).length/n:0;
 const leaveOneOut=n>=2?Math.min(...matches.map((_,i)=>direction*distribution(matches.filter((_,j)=>i!==j).map(m=>m.a.delta-m.b.delta)).median)):null;
 const adequate=n>=6&&weeks>=6&&aFirst>=2&&bFirst>=2&&latest&&dayGap(latest,day)<=28;
 const supported=adequate&&direction!==0&&agreement>=.75&&direction*d.median>=Math.max(threshold,noise)&&leaveOneOut>=threshold&&(direction>0?a.median:b.median)>=threshold;
 return {pairs:n,weeks,latest,aFirst,bFirst,a,b,difference:d,noise,agreement,leaveOneOut,status:!adequate?'insufficient':supported?(direction>0?'first-associated':'second-associated'):'unclear',matched:matches.map(m=>({a:[m.a.from,m.a.to],b:[m.b.from,m.b.to],aSeconds:m.a.seconds,bSeconds:m.b.seconds,aChange:m.a.delta,bChange:m.b.delta}))};
}
// One episode per side and per comparison. Greedy baseline/time matching
// is deterministic and does not inspect outcome to choose a pair.
function match(candidates){
 candidates.sort((x,y)=>Math.abs(x.a.baseline-x.b.baseline)-Math.abs(y.a.baseline-y.b.baseline)||dist(x.a,x.b)-dist(y.a,y.b)||x.a.from.localeCompare(y.a.from)||x.b.from.localeCompare(y.b.from));
 const used=new Set(),out=[];
 for(const x of candidates){if(used.has(x.a)||used.has(x.b))continue;used.add(x.a);used.add(x.b);out.push(x)}
 return out;
}
const settingLabel=s=>s.name+' ('+s.field+' '+(Array.isArray(s.after)?s.after.join('/'):s.after)+')';
export function methodComparisons(episodes,day){
 if(!dayValid(day)||!Array.isArray(episodes))throw Error('Invalid training comparison');
 const scopes=new Map(),out=[];
 for(const e of episodes){if(e.to>day||dayGap(e.to,day)>180)continue;const k=key(e),list=scopes.get(k)??[];list.push(e);scopes.set(k,list)}
 for(const list of scopes.values()){
  const groups=new Map();
  for(const e of list){const k=exact(e),g=groups.get(k)??[];g.push(e);groups.set(k,g)}
  const settings=[...groups.keys()].sort();
  for(let i=0;i<settings.length;i++){
   const group=groups.get(settings[i]),first=group[0],dose=[];
   for(const a of group)for(const b of group){
    if(a.seconds>=b.seconds||b.seconds-a.seconds<300||b.seconds/a.seconds<1.3||!compatible(a,b))continue;
    // Different numbers of rounds are allowed for a dose comparison;
    // duration is the recorded exposure, not throws or time at one exact setting.
    dose.push({a,b});
   }
   if(dose.length){
    const matches=match(dose),s=summary(matches,day,first.skill);
    out.push({kind:'dose',skill:first.skill,protocol:first.protocol,first:settingLabel(first.setting)+' · shorter recorded exercise',second:settingLabel(first.setting)+' · longer recorded exercise',firstSetting:first.setting,secondSetting:first.setting,...s});
   }
   for(let j=i+1;j<settings.length;j++){
    const other=groups.get(settings[j]),second=other[0];
    if(first.setting.name===second.setting.name)continue; // existing difficulty learner owns same-game settings
    const candidates=group.flatMap(a=>other.filter(b=>compatible(a,b)&&ratio(a.seconds,b.seconds)&&ratio(a.rounds,b.rounds)).map(b=>({a,b})));
    if(!candidates.length)continue;
    out.push({kind:'method',skill:first.skill,protocol:first.protocol,first:settingLabel(first.setting),second:settingLabel(second.setting),firstSetting:first.setting,secondSetting:second.setting,...summary(match(candidates),day,first.skill)});
   }
  }
 }
 return out.sort((a,b)=>b.pairs-a.pairs||a.skill.localeCompare(b.skill)||a.first.localeCompare(b.first)||a.second.localeCompare(b.second));
}
export function delayedFollowups(episodes,state,host,day,blockedDays=[]){
 if(!dayValid(day)||!Array.isArray(episodes)||!Array.isArray(host?.sessions))throw Error('Invalid follow-up history');
 const groups=new Map();
 for(const o of canonicalRows(state.observations??[],day)){
  if(o.context!=='practice'||dayGap(o.day,day)>180)continue;
  const k=JSON.stringify([o.skill,o.protocol]),days=groups.get(k)??new Map(),r=days.get(o.day)??[];
  r.push(o);days.set(o.day,r);groups.set(k,days);
 }
 const recordedDays=new Set(host.sessions.filter(s=>s?.quick===false&&dayValid(s.date)&&s.date<=day).map(s=>s.date));
 const used=new Set(),out=[];
 // Never reuse another episode's benchmark as independent follow-up.
 const endpointIds=new Set(episodes.flatMap(e=>e.measurementIds??[]));
 for(const e of [...episodes].sort((a,b)=>a.to.localeCompare(b.to)||key(a).localeCompare(key(b)))){
  if(e.to>day||e.delta<floor(e.skill)||dayGap(e.to,day)<7)continue;
  const scope=key(e),days=groups.get(scope);if(!days)continue;
  const later=[...days].filter(([d,rs])=>dayGap(e.to,d)>=7&&dayGap(e.to,d)<=21&&!used.has(JSON.stringify([scope,d]))&&!rs.some(o=>endpointIds.has(o.id))).sort((a,b)=>a[0].localeCompare(b[0]));
  const x=later.find(([,rs])=>summarise(rs).attempts>=minimum[e.skill]);if(!x)continue;
  const [d,rs]=x;
  if(recordedConfounder(state,e.to,d)||blockedDays.some(v=>v>=e.to&&v<=d))continue;
  used.add(JSON.stringify([scope,d]));
  const s=summarise(rs),value=measure(e.skill,s.value),gain=value-e.baseline;
  const interveningDays=[...recordedDays].filter(v=>v>=e.to&&v<=d).sort();
  const status=gain>=floor(e.skill)&&gain>=e.delta*.75?'gain-still-observed':gain<=0?'gain-not-observed':'partial-or-unclear';
  out.push({skill:e.skill,protocol:e.protocol,setting:e.setting,from:e.from,to:e.to,followup:d,delay:dayGap(e.to,d),baseline:e.baseline,after:e.after,value,gain,attempts:s.attempts,measurementIds:rs.map(o=>o.id),interveningDays,status,independentOfRecordedTraining:interveningDays.length===0});
 }
 return out;
}
export function trainingOutcomes(host,state,day,now=Date.now()){
 const history=learningEpisodes(host,state,day,now);
 return {...history,comparisons:methodComparisons(history.episodes,day),followups:delayedFollowups(history.episodes,state,host,day),limitation:'Matched observational comparisons, not causal effects. Unlogged practice, different conditions, selection bias and regression to the mean may remain. No automatic changes to exercise choice, time or difficulty.'};
}
export function outcomeReportLines(report,kind=null){
 const f=n=>n===null?'not measured':(n>0?'+':'')+n.toFixed(1);
 const rows=report.comparisons.filter(r=>!kind||r.kind===kind),lines=[report.exposures+' eligible exercise exposures; '+report.episodes.length+' disjoint benchmark episodes.'];
 if(!rows.length)lines.push('No comparable recorded '+(kind==='dose'?'training duration':kind==='method'?'training method':'method or duration')+' contrasts yet. Continue balanced practice and fixed checks.');
 for(const r of rows.slice(0,20)){
  const units=r.skill==='scoring'?' points':' percentage points';
  lines.push(r.skill+' · '+r.protocol+' · '+r.first+' versus '+r.second+'. '+r.pairs+' matched pairs across '+r.weeks+' weekly blocks; '+r.aFirst+'/'+r.bFirst+' chronological orders.');
  lines.push('Median later change '+f(r.a.median)+' versus '+f(r.b.median)+units+'. '+(r.status==='insufficient'?'More independent comparisons needed.':r.status==='unclear'?'No clear observed advantage.':(r.status==='first-associated'?r.first:r.second)+' was associated with better later measurements; investigate before changing training.'));
 }
 return [...lines,report.limitation];
}
export function followupLines(report){
 const rows=report.followups,lines=[rows.length+' separately measured delayed follow-ups.'];
 if(!rows.length)lines.push('No eligible independent later benchmark yet.');
 for(const r of rows.slice(-20).reverse())lines.push(r.skill+' · '+r.protocol+' · '+settingLabel(r.setting)+' · '+r.delay+' days later: '+r.baseline.toFixed(1)+' before, '+r.after.toFixed(1)+' after, '+r.value.toFixed(1)+' at follow-up'+(r.skill==='scoring'?' points.':'%.')+' '+r.status.replaceAll('-',' ')+'. '+(r.independentOfRecordedTraining?'No intervening saved training days; unlogged practice remains unknown.':r.interveningDays.length+' saved training days including endpoints; not a retention-isolation test.'));
 return [...lines,'Only new benchmark identities are used for follow-up. Observing a gain later does not establish permanent retention or causal benefit.'];
}
