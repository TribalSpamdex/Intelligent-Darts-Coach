// Evidence-to-action reviews: separate practice, competition and individual
// method history. No new player facts, no causal or workload inference.
import {robustTrend,earlyWarning,dayGap,dayValid} from './engine/context.mjs';
import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {actualLegObservations} from './match-statistics.mjs';
import {FIXED_PROTOCOLS,learningBoundary} from './challenge-episodes.mjs';
import {trainingOutcomes,delayedMethodCautions} from './training-outcomes.mjs';
import {settingKey,validSetting} from './challenge-setting.mjs';
const fixedQuick=new Set(['IDC V6.2 Quick Play Scoring Challenge fixed 30 darts','IDC V6.2 Quick Play Bull Accuracy any bull 30']);
const status=t=>['declining','improving'].includes(t?.status)?t.status:null;
const format=(n,skill)=>n===null||!Number.isFinite(n)?'unknown':(skill==='scoring'||skill==='firstNine'?n:100*n).toFixed(1)+(skill==='scoring'||skill==='firstNine'?' average points':' percentage points');
export function transferSignals(state,day){
 if(!dayValid(day))throw Error('Invalid review date');
 const boundary=learningBoundary(state,day),groups=new Map();
 const all=[...canonicalRows(state.observations??[],day).filter(o=>o.context==='practice'&&(FIXED_PROTOCOLS[o.skill]?.includes(o.protocol)||fixedQuick.has(o.protocol))),...actualLegObservations(state.legs??[],day).filter(o=>o.context==='competition')];
 for(const o of all){if((boundary&&o.day<=boundary)||dayGap(o.day,day)>=56)continue;const key=scopeKey(o),rows=groups.get(key)??[];rows.push(o);groups.set(key,rows)}
 const profiles=[...groups.values()].map(rows=>{const {skill,protocol,context}=rows[0],last=rows.map(r=>r.day).sort().at(-1);return {skill,protocol,context,last,trend:robustTrend(rows,{asOf:day})}});
 const out=[];
 for(const c of profiles.filter(p=>p.context==='competition'&&dayGap(p.last,day)<=7)){
  const comparable=profiles.filter(p=>p.context==='practice'&&p.skill===c.skill&&dayGap(p.last,day)<=7&&status(p.trend));
  if(!comparable.length)continue;
  const directions=new Set(comparable.map(p=>p.trend.status));
  for(const p of comparable){
   const cs=status(c.trend),ps=status(p.trend);
   const finding=directions.size>1?'practice-mixed':!cs?'match-unconfirmed':ps===cs?'same-direction':'opposite-direction';
   out.push({skill:p.skill,practice:p,competition:c,finding});
  }
 }
 return {rows:out.sort((a,b)=>a.skill.localeCompare(b.skill)||a.practice.protocol.localeCompare(b.practice.protocol)||a.competition.protocol.localeCompare(b.competition.protocol)),boundary,limitation:'Only directions of change are compared. A fixed practice check and an actual match leg have different conditions and denominators; this is not a training-effect estimate or proof of pressure.'};
}
export function transferSignalLines(r){
 const lines=[];
 for(const x of r.rows.slice(0,12)){
  lines.push(x.skill+' · '+x.practice.protocol+' versus '+x.competition.protocol+': practice '+x.practice.trend.status+' ('+format(x.practice.trend.change,x.skill)+'), competition '+x.competition.trend.status+(status(x.competition.trend)?' ('+format(x.competition.trend.change,x.skill)+')':'')+'.');
  lines.push(x.finding==='opposite-direction'?'Changes disagree. Retest the same practice check and record actual matches before changing the training method.':x.finding==='same-direction'?'Both move in the same direction. Continue independent measurement; causation is not established.':x.finding==='practice-mixed'?'Practice protocols disagree; do not choose a training change from this contrast.':'Match change is not independently established; collect comparable actual legs.');
 }
 if(!lines.length)lines.push('No fresh fixed-practice change with comparable actual competition records. Bot and Quick Play legs cannot substitute for actual match logs.');
 return [...lines,r.limitation];
}
// Report a decision for each exact method setting, not a generic learning
// style. Conflicting results and independent delayed adverse evidence win.
export function methodSignalReview(report,day){
 if(!dayValid(day))throw Error('Invalid individual method review');
 const groups=new Map(),cautions=delayedMethodCautions(report.currentFollowups??[],day);
 for(const c of report.currentComparisons??[]){
  if(c.kind!=='method'||!FIXED_PROTOCOLS[c.skill]?.includes(c.protocol)||!dayValid(c.latest)||dayGap(c.latest,day)<0||dayGap(c.latest,day)>28||!Number.isInteger(c.pairs)||!Number.isInteger(c.weeks)||c.pairs<6||c.weeks<6||!validSetting(c.firstSetting)||!validSetting(c.secondSetting))continue;
  for(const [side,setting,other] of [['first',c.firstSetting,c.secondSetting],['second',c.secondSetting,c.firstSetting]]){
   if(setting.skill!==c.skill||other.skill!==c.skill)continue;
   const key=JSON.stringify([c.skill,c.protocol,settingKey(setting)]),g=groups.get(key)??{skill:c.skill,protocol:c.protocol,setting,favourable:[],unfavourable:[],unclear:[],latest:c.latest};
   const record={other:other.name,pairs:c.pairs,weeks:c.weeks,latest:c.latest};
   (c.status===side+'-associated'?g.favourable:['first-associated','second-associated'].includes(c.status)?g.unfavourable:g.unclear).push(record);
   if(c.latest>g.latest)g.latest=c.latest;groups.set(key,g);
  }
 }
 for(const c of cautions){const key=JSON.stringify([c.skill,c.protocol,settingKey(c.setting)]),g=groups.get(key)??{skill:c.skill,protocol:c.protocol,setting:c.setting,favourable:[],unfavourable:[],unclear:[],latest:c.last};g.caution=c;groups.set(key,g)}
 return [...groups.values()].map(g=>({...g,decision:g.caution?'defer':g.favourable.length&&g.unfavourable.length||g.favourable.length&&g.unclear.length?'mixed':g.favourable.length?'candidate':g.unfavourable.length?'reconsider':'collect-evidence'})).sort((a,b)=>a.skill.localeCompare(b.skill)||a.setting.name.localeCompare(b.setting.name)||settingKey(a.setting).localeCompare(settingKey(b.setting)));
}
export function methodDecisionLines(rows){
 if(!rows.length)return ['No current, adequately sampled exact-setting method comparisons. Keep balanced familiar practice and repeat independent fixed checks.'];
 return [...rows.slice(0,16).map(r=>r.setting.name+' · '+r.skill+' · '+r.protocol+': '+r.favourable.length+' favourable, '+r.unfavourable.length+' unfavourable and '+r.unclear.length+' unclear comparisons. '+(r.decision==='defer'?r.caution.reason:r.decision==='mixed'?'Conflicting evidence; do not prefer this method automatically.':r.decision==='candidate'?'Candidate for an existing player-enabled near-tie, subject to all delivery and safety gates.':r.decision==='reconsider'?'Review this method before choosing it over a measured alternative.':'Collect another independent comparison.')),'Comparison counts are not independent trial counts. No extra practice minutes, causal conclusion or automatic technique change.'];
}
export function individualMethodSignals(host,state,day,now=Date.now()){return methodSignalReview(trainingOutcomes(host,state,day,now),day)}
// An adequately sampled contradictory comparison or independent delayed
// caution blocks a proposed optional near-tie. Cannot create a preference.
export function methodSignalAllows(choice,rows){
 if(choice?.status!=='selected')return choice;
 const row=rows.find(r=>r.skill===choice.skill&&r.protocol===choice.protocol&&settingKey(r.setting)===settingKey(choice.expectedSetting));
 return row&&['mixed','defer','reconsider'].includes(row.decision)?{status:'unchanged',reason:'Current individual method evidence is '+row.decision+'; keep the normal native choice and review.'}:choice;
}

// Fixed practice and actual competition are screened independently.
export function performanceWatchLines(state,day){
 const boundary=learningBoundary(state,day),groups=new Map();
 for(const o of [...canonicalRows(state.observations??[],day).filter(o=>o.context==='practice'&&FIXED_PROTOCOLS[o.skill]?.includes(o.protocol)),...actualLegObservations(state.legs??[],day).filter(o=>o.context==='competition')]){
  if((boundary&&o.day<=boundary)||dayGap(o.day,day)>=56)continue;const k=scopeKey(o),r=groups.get(k)??[];r.push(o);groups.set(k,r);
 }
 const watches=[];for(const rows of groups.values()){const last=rows.map(r=>r.day).sort().at(-1);if(dayGap(last,day)>7)continue;const t=robustTrend(rows,{asOf:day}),w=earlyWarning(rows,{asOf:day});if(t.status==='declining'||w.status==='watch'){const r=rows[0];watches.push(r.skill+' · '+r.context+' · '+r.protocol+': '+(t.status==='declining'?'repeated decline':'early advisory warning')+'. Repeat comparable measurement before changing practice.');}}
 return watches.length?watches.slice(0,8):['No fresh fixed-practice or actual competition warning established; sparse data is not proof of stability.'];
}
