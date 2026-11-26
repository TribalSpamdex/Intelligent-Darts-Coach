// Within-exercise performance pattern intelligence. Not a fatigue diagnosis.
import {dayGap,dayValid} from './engine/context.mjs';
import {extractLearningExposure} from './challenge-exposure.mjs';
import {settingKey} from './challenge-setting.mjs';
import {distribution} from './statistics.mjs';
import {validateReflections} from './reflections.mjs';
const mean=xs=>distribution(xs).mean;
const rate=xs=>xs.reduce((n,x)=>n+Number(x.win),0)/xs.length;
export function exerciseSequences(host,state,reflections,day,now=Date.now()){
 if(!dayValid(day))throw Error('Invalid exercise review date');
 const history=extractLearningExposure(host,day,now),ref=validateReflections(reflections??[]),groups=new Map(),rejected={partialOrMixed:0,tooFew:0,duplicateTime:0};
 const reflectionMap=new Map(ref.filter(r=>r.kind==='exercise'&&r.answer!=='skip').map(r=>[JSON.stringify([r.sessionId,r.index]),r]));
 const readiness=new Map((state.readiness??[]).filter(r=>r.context==='practice'&&r.day<=day).map(r=>[r.day,r]));
 for(const e of history.exposures){
  if(dayGap(e.day,day)>=84)continue;
  const seq=e.sequence??[],key=settingKey(e.setting);
  if(e.dominance!==1||seq.length!==e.completed||seq.some(x=>x.completion!=='natural'||typeof x.win!=='boolean'||x.setting!==key)){rejected.partialOrMixed++;continue}
  if(seq.length<6){rejected.tooFew++;continue}
  if(new Set(seq.map(x=>x.at)).size!==seq.length){rejected.duplicateTime++;continue}
  const n=Math.floor(seq.length/2),first=seq.slice(0,n),last=seq.slice(-n),r=reflectionMap.get(JSON.stringify([String(e.sessionId),e.exerciseIndex]));
  const reflection=r&&r.day===e.day&&r.name===e.setting.name?r.answer:null;
  const condition=readiness.get(e.day),known=condition?condition.pain||condition.fatigue==='high'||condition.pressure==='high'?'reported-concern':condition.fatigue==='normal'&&condition.pressure==='normal'?'reported-normal':'other-or-unknown':'unreported';
  const g=groups.get(key)??{setting:e.setting,exercises:[]};
  g.exercises.push({day:e.day,sessionId:e.sessionId,exerciseId:e.exerciseId,rounds:seq.length,pairedRounds:n,first:rate(first),last:rate(last),delta:rate(last)-rate(first),reflection,condition:known});
  groups.set(key,g);
 }
 const profiles=[...groups.values()].map(g=>{
  const byDay=new Map();
  for(const e of g.exercises){const x=byDay.get(e.day)??[];x.push(e);byDay.set(e.day,x)}
  const daily=[...byDay].map(([day,rows])=>({day,first:mean(rows.map(x=>x.first)),last:mean(rows.map(x=>x.last)),delta:mean(rows.map(x=>x.delta)),rounds:rows.reduce((n,x)=>n+x.pairedRounds,0)})).sort((a,b)=>a.day.localeCompare(b.day));
  const d=distribution(daily.map(x=>x.delta)),weeks=new Set(daily.map(x=>Math.floor(dayGap(x.day,day)/7))).size,last=daily.at(-1).day,rounds=daily.reduce((n,x)=>n+x.rounds,0);
  const noise=d.n>=2?2.5*d.sd/Math.sqrt(d.n):null,sign=Math.sign(d.median),consistency=daily.filter(x=>sign*x.delta>=.15).length/daily.length;
  const adequate=d.n>=7&&weeks>=3&&rounds>=21&&dayGap(last,day)<=28;
  const status=!adequate?'insufficient':Math.abs(d.median)>=Math.max(.20,noise)&&consistency>=.75?(sign<0?'later-lower':'later-higher'):'unclear';
  const reflections={},conditions={};
  for(const e of g.exercises){if(e.reflection)reflections[e.reflection]=(reflections[e.reflection]??0)+1;conditions[e.condition]=(conditions[e.condition]??0)+1}
  return {setting:g.setting,exercises:g.exercises.length,days:d.n,weeks,last,roundsPerSide:rounds,early:distribution(daily.map(x=>x.first)),late:distribution(daily.map(x=>x.last)),difference:d,noise,consistency,status,reflections,conditions,daily};
 }).sort((a,b)=>b.days-a.days||a.setting.name.localeCompare(b.setting.name)||settingKey(a.setting).localeCompare(settingKey(b.setting)));
 return {profiles,rejected,limitation:'Round success, not per-dart accuracy or benchmark improvement. Only exact unchanged rules with complete chronological rounds are compared. Later changes may reflect adaptation, fatigue, target sequence or chance; no causal or automatic difficulty conclusion.'};
}
export function sequenceLines(report){
 const pct=x=>x===null?'not measured':(100*x).toFixed(1)+'%';
 const lines=[];
 for(const p of report.profiles.slice(0,20)){
  const s=p.setting;
  lines.push(s.name+' · '+s.field+' '+(Array.isArray(s.after)?s.after.join('/'):s.after)+' · '+p.exercises+' eligible exercises on '+p.days+' days, '+p.roundsPerSide+' rounds per side.');
  lines.push('Median early success '+pct(p.early.median)+'; later '+pct(p.late.median)+'. '+(p.status==='later-lower'?'Later rounds repeatedly lower; investigate conditions before changing training.':p.status==='later-higher'?'Later rounds repeatedly higher; investigate warm-up or task familiarisation without assuming cause.':p.status==='insufficient'?'More comparable days needed.':'No clear repeated early/late difference.'));
  if(Object.keys(p.reflections).length)lines.push('Linked optional reflections: '+Object.entries(p.reflections).map(([k,v])=>k+' '+v).join(' · ')+'.');
 }
 if(!lines.length)lines.push('No exercises with six or more complete identical-setting rounds yet.');
 return [...lines,'Excluded exercises: '+Object.entries(report.rejected).map(([k,v])=>k+' '+v).join(' · ')+'.',report.limitation];
}
