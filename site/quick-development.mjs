import {currentReferenceBoundary} from './adaptive-review.mjs';
// Read-only contextual signals. Native validated samples are the only inputs;
// these records never enter fixed calibration, dose, or intervention memory.
import {quickAdaptiveMeasurements,projectEvidence,recordedDay} from './v62-evidence.mjs';
import {gameProfile} from './game-profile.mjs';
import {robustTrend,earlyWarning,dayGap,dayValid} from './engine/context.mjs';
import {learningBoundary} from './challenge-episodes.mjs';
import {publicProtocol,projectTargets} from './host-targets.mjs';
const fmt=(v,scoring)=>scoring?v.toFixed(1):(100*v).toFixed(1)+'%';
const clean=s=>publicProtocol(s);
const advice=p=>p.target?(['25','50','B25','B50'].includes(String(p.target))?'Repeat a familiar fixed bull check; keep 25 and 50 distinct.':'Repeat a familiar 15-dart exact-target check at '+p.target+' on separate days.'):p.finish?'Repeat a familiar three-dart checkout check at '+p.finish+' on separate days.':p.scoring?'Repeat the fixed 30-dart scoring check under familiar conditions.':/bull/i.test(p.label)?'Repeat a familiar fixed bull check; keep 25 and 50 distinct.':/decision|route/i.test(p.label)?'Review familiar checkout routes separately from physical dart execution.':'Repeat the same familiar game and recorded conditions, then confirm with a relevant fixed skill check.';
export function quickDevelopment(host,state,day,now=Date.now()){
 if(!dayValid(day)||!Number.isFinite(now))throw Error('Invalid Quick Play review date');
 const boundary=learningBoundary(state,day),a=host.assessment;
 const reassessed=currentReferenceBoundary({assessment:a},{},day,now);
 const after=d=>dayValid(d)&&d<=day&&(!boundary||d>boundary)&&(!reassessed||d>reassessed)&&dayGap(d,day)<56;
 const groups=new Map();
 const current={...host,games:(host.games??[]).filter(g=>Number.isFinite(g?.at)&&g.at>=now-84*86400000&&g.at<=now),sessions:host.sessions??[],bigSingles:[]};
 function put(key,meta,d,hits,attempts){
  if(!after(d)||!Number.isSafeInteger(hits)||!Number.isSafeInteger(attempts)||attempts<=0||hits<0||hits>attempts*(meta.scoring?60:1))return;
  const g=groups.get(key)??{...meta,key,byDay:new Map()};const x=g.byDay.get(d)??{hits:0,attempts:0};x.hits+=hits;x.attempts+=attempts;g.byDay.set(d,x);groups.set(key,g);
 }
 for(const g of quickAdaptiveMeasurements(current,day,now,{daily:true})){
  for(const r of g.records){const key=JSON.stringify([g.key,r.config]);put(key,{label:g.key,game:g.key.split(' · ')[0],scoring:g.scoring,known:r.config!==null,unit:g.unit},r.day,r.hits,r.attempts*(g.scoring&&!g.perDart?3:1));}
 }
 // Fixed benchmarks keep the authoritative existing identity and denominators.
 for(const o of projectEvidence({...current,assessment:null,assessmentHistory:[]},{today:day,now}).observations){
  if(!o.protocol.startsWith('IDC V6.2 Quick Play '))continue;
  put(o.protocol,{label:o.protocol,game:o.skill==='scoring'?'Scoring Challenge':'Bull Accuracy',scoring:o.skill==='scoring',known:true,unit:'darts'},o.day,o.hits,o.attempts);
 }
 // Exact finish attempts remain separate by score, recorded task and source.
 // Older protocols may not retain every allowance; use them only as prompts
 // to confirm a familiar checkout, never as a difficulty or route change.
 for(const r of gameProfile(current,day,now,{includeRecords:true,includeConfiguration:true}).records){
  if(!r.protocol.startsWith('Quick Play · ')||!r.rows)continue;
  for(const x of r.rows)put(JSON.stringify([r.protocol,x.score,r.config??null]),{label:r.protocol+' · '+x.score,game:r.protocol.includes('Target Mastery')?'Target Mastery':r.protocol.split(' · ')[1]?.split(' (')[0],finish:x.score,scoring:false,known:r.config!=null||r.protocol.includes('Target Mastery'),unit:'attempts'},r.day,Number(x.success),1);
 }
 for(const r of projectTargets(current,day,now,[],{includeConfiguration:true}).rows){
  if(!r.protocol.startsWith('Quick Play · '))continue;
  put(JSON.stringify([r.protocol,r.target,r.config??null]),{label:r.protocol+' · '+r.target,game:r.protocol.split(' · ')[1]?.startsWith('Target Mastery')?'Target Mastery':r.protocol.split(' · ')[1],target:r.target,scoring:false,known:r.config!=null||r.protocol.includes('Target Mastery'),unit:'darts'},r.day,r.hits,r.attempts);
 }
 const profiles=[...groups.values()].map(({byDay,...g})=>{
  const rows=[...byDay].map(([day,x])=>({day,...x,skill:g.scoring?'scoring':'contextual',context:'practice',protocol:g.key}));
  const trend=robustTrend(rows,{asOf:day}),warning=earlyWarning(rows,{asOf:day});
  const last=[...byDay.keys()].sort().at(-1);return {...g,trend,warning,last,days:rows.length};
 }).sort((a,b)=>a.key.localeCompare(b.key));
 const eligible=profiles.filter(p=>dayGap(p.last,day)<=7&&(p.trend.status==='declining'||p.warning.status==='watch'));
 const conflict=p=>profiles.some(q=>q!==p&&((p.target&&q.target===p.target)||(q.game===p.game&&q.label===p.label))&&q.trend.status==='improving'&&dayGap(q.last,day)<=7);
 // Prioritise confirmed declines, better documented conditions, and coverage,
 // never the largest raw percentage across unlike metrics.
 const rank=(a,b)=>Number(b.trend.status==='declining')-Number(a.trend.status==='declining')||Number(b.known)-Number(a.known)||b.days-a.days||a.key.localeCompare(b.key);
 const mixed=eligible.filter(conflict),focus=eligible.filter(p=>!conflict(p)).sort(rank)[0]??null;
 return {profiles,focus,mixed,boundary,reassessed,games:[...new Set(profiles.map(p=>p.game))].sort(),limitation:'Contextual Quick Play observations are not match results or scheduled training. Adaptive stopping, incomplete old settings and target selection can bias comparisons. Repeat a fixed familiar check before changing training.'};
}
export function quickDevelopmentLines(r){
 if(!r.focus)return [r.mixed.length?'Comparable game settings disagree. Confirm a familiar fixed check before choosing a focus.':r.profiles.length?'No repeated recent Quick Play warning is established; missing or sparse evidence is not proof of stable performance.':'No eligible Quick Play measurement history yet.',r.profiles.length+' separate measurement profiles from '+r.games.length+' games.',r.limitation];
 const p=r.focus,a=p.trend.earlier,b=p.trend.recent;
 const denominator=p.scoring?'darts':p.unit;
 return [clean(p.label)+': '+(p.trend.status==='declining'?'repeated contextual decline':'early watch, not a confirmed decline')+'.',
 ...(a&&b?['Earlier 28 days: '+fmt(a.value,p.scoring)+' across '+a.attempts+' '+denominator+' on '+a.days+' days; recent 28 days: '+fmt(b.value,p.scoring)+' across '+b.attempts+' '+denominator+' on '+b.days+' days.']:[]),
 advice(p),...(!p.known?['Some recorded rule details may be missing; treat this as an exploratory check.']:[]),r.limitation];
}
