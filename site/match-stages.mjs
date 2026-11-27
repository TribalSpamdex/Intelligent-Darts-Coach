// Actual straight-in match stages from validated, player-entered darts.
// No bot result is converted into a match, no unknown aim is inferred.
import {analyseLeg} from './engine/match.mjs';
import {points,isDouble} from './engine/engine.mjs';
import {classify} from './engine/target-evidence.mjs';
import {legalFinishCount} from './finish-validation.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
import {distribution} from './statistics.mjs';
import {FIXED_PROTOCOLS,recordedConfounder} from './challenge-episodes.mjs';
const canonical=x=>/^[LI]/.test(x)?'S'+x.slice(1):x;
const shortest=new Map();
export function minimumFinishDarts(score){
 if(!Number.isInteger(score)||score<2||score>170)return null;
 if(!shortest.has(score))shortest.set(score,[1,2,3].find(n=>legalFinishCount(score,n))??null);
 return shortest.get(score);
}
const band=s=>s<=40?'2–40':s<=80?'41–80':s<=120?'81–120':'121–170';
const count=(a,b)=>b?a/b:null;
const empty=()=>({visits:0,darts:0,points:0,busts:0,finishes:0});
const make=()=>({legs:0,days:new Set(),firstNine:{legs:0,points:0,darts:0},recovery:{opportunities:0,points:0,darts:0},scoring:empty(),checkout:empty(),bogey:empty(),setup:{attempts:0,leaves:0,doubleLeaves:0,busts:0},escape:{attempts:0,leaves:0},finishDarts:{1:0,2:0,3:0},shortest:{1:{attempts:0,finishes:0},2:{attempts:0,finishes:0},3:{attempts:0,finishes:0}},bands:Object.fromEntries(['2–40','41–80','81–120','121–170'].map(k=>[k,empty()])),aim:{known:0,total:0,knownFinishAttempts:0,knownFinishHits:0,fullyAimedLegs:0,completeLegAttempts:0,completeLegHits:0,misses:{},targets:{}}});
function addVisit(m,v){
 m.visits++;m.darts+=v.darts.length;m.points+=v.scored;m.busts+=Number(v.bust);m.finishes+=Number(v.finished);
}
function addLeg(m,a){
 m.legs++;m.days.add(a.leg.day);
 if(a.firstNineDarts===9){m.firstNine.legs++;m.firstNine.points+=a.firstNinePoints;m.firstNine.darts+=9}
 let previous=null;
 const complete=a.unknownIntent===0;if(complete)m.aim.fullyAimedLegs++;
 for(const v of a.visits){
  const min=minimumFinishDarts(v.start),phase=v.start>170?'scoring':min===null?'bogey':'checkout';
  addVisit(m[phase],v);
  // A recovery sample is the next scoring visit after a credited visit below 40.
  // No cross-leg transitions, checkout visits or assumed emotional pressure.
  if(phase==='scoring'&&previous&&previous.start>170&&previous.scored<40){m.recovery.opportunities++;m.recovery.points+=v.scored;m.recovery.darts+=v.darts.length}
  previous=v;
  if(phase==='checkout'){
   addVisit(m.bands[band(v.start)],v);m.shortest[min].attempts++;
   if(v.finished){m.shortest[min].finishes++;m.finishDarts[v.darts.length]++}
  }
  // From 171–350, a legal three-dart scoring visit may leave a checkout.
  // No claim that a particular route was intended or optimal.
  if(v.start>=171&&v.start<=350){
   m.setup.attempts++;m.setup.busts+=Number(v.bust);
   const next=minimumFinishDarts(v.remaining);if(next!==null){m.setup.leaves++;if(next===1)m.setup.doubleLeaves++}
  }
  if(phase==='bogey'){m.escape.attempts++;if(minimumFinishDarts(v.remaining)!==null)m.escape.leaves++}
  let left=v.start;
  for(let i=0;i<v.darts.length;i++){
   const raw=v.darts[i],actual=canonical(raw),intent=v.aims[i];m.aim.total++;
   if(intent!==null)m.aim.known++;
   const aim=intent===null?null:canonical(intent);
   if(aim&&isDouble(aim)&&points(aim)===left){
    const hit=actual===aim;m.aim.knownFinishAttempts++;m.aim.knownFinishHits+=Number(hit);
    if(complete){m.aim.completeLegAttempts++;m.aim.completeLegHits+=Number(hit)}
    const t=m.aim.targets[aim]??{attempts:0,hits:0,days:new Set()};t.attempts++;t.hits+=Number(hit);t.days.add(a.leg.day);m.aim.targets[aim]=t;
    if(!hit){const kind=classify(aim,raw);m.aim.misses[kind]=(m.aim.misses[kind]??0)+1}
   }
   left-=points(actual);
  }
 }
}
function finish(m){
 const stage=s=>({...s,average:count(3*s.points,s.darts),bustRate:count(s.busts,s.visits),finishRate:count(s.finishes,s.visits)});
 return {...m,days:m.days.size,firstNine:{...m.firstNine,average:count(3*m.firstNine.points,m.firstNine.darts)},recovery:{...m.recovery,average:count(3*m.recovery.points,m.recovery.darts)},scoring:stage(m.scoring),checkout:stage(m.checkout),bogey:stage(m.bogey),bands:Object.fromEntries(Object.entries(m.bands).map(([k,v])=>[k,stage(v)])),setup:{...m.setup,rate:count(m.setup.leaves,m.setup.attempts)},escape:{...m.escape,rate:count(m.escape.leaves,m.escape.attempts)},aim:{...m.aim,coverage:count(m.aim.known,m.aim.total),completeLegRate:count(m.aim.completeLegHits,m.aim.completeLegAttempts),targets:Object.fromEntries(Object.entries(m.aim.targets).map(([k,t])=>[k,{...t,days:t.days.size}]))}};
}
export function stageProfiles(legs,day){
 if(!dayValid(day)||!Array.isArray(legs))throw Error('Invalid match stage input');
 const ids=new Set(),groups=new Map();let doubleInExcluded=0,abandonedExcluded=0;
 for(const raw of legs){
  const a=analyseLeg(raw),l=a.leg;
  if(ids.has(l.id))throw Error('Duplicate actual leg');ids.add(l.id);
  const age=dayGap(l.day,day);if(age<0||age>=365)continue;
  if(l.result==='abandoned'){abandonedExcluded++;continue}
  if(l.doubleIn){doubleInExcluded++;continue}
  const k=JSON.stringify([l.start,l.context]),g=groups.get(k)??{start:l.start,context:l.context,rows:[]};g.rows.push(a);groups.set(k,g);
 }
 return {doubleInExcluded,abandonedExcluded,profiles:[...groups.values()].map(g=>{
  const windows=[7,28,84,365].map(days=>{const m=make();for(const a of g.rows.filter(a=>dayGap(a.leg.day,day)<days))addLeg(m,a);return {period:days,...finish(m)}});
  const byDay=new Map();for(const a of g.rows.filter(a=>dayGap(a.leg.day,day)<84)){const d=a.leg.day,m=byDay.get(d)??make();addLeg(m,a);byDay.set(d,m)}
  return {start:g.start,context:g.context,windows,daily:[...byDay].sort(([a],[b])=>a.localeCompare(b)).map(([d,m])=>({day:d,...finish(m)}))};
 }).sort((a,b)=>a.start-b.start||a.context.localeCompare(b.context))};
}
const metrics={
 'scoring-stage average':{read:r=>[3*r.scoring.points,r.scoring.darts],floor:3,min:90,units:'points'},
 'first-nine average':{read:r=>[3*r.firstNine.points,r.firstNine.darts],floor:3,min:90,units:'points'},
 'next scoring visit after below 40':{read:r=>[3*r.recovery.points,r.recovery.darts],floor:3,min:90,units:'points'},
 'checkout visit conversion':{read:r=>[r.checkout.finishes,r.checkout.visits],floor:.05,min:40,units:'percentage points'},
 'setup leave conversion':{read:r=>[r.setup.leaves,r.setup.attempts],floor:.08,min:40,units:'percentage points'},
 'checkout bust rate':{read:r=>[r.checkout.busts,r.checkout.visits],floor:.05,min:40,units:'percentage points'},
 'explicit finishing doubles':{read:r=>[r.aim.completeLegHits,r.aim.completeLegAttempts],floor:.05,min:60,units:'percentage points'}
};
export function stageTransfer(report,day){
 if(!dayValid(day))throw Error('Invalid transfer review date');
 const out=[];
 for(const start of [...new Set(report.profiles.map(p=>p.start))]){
  const p=report.profiles.find(p=>p.start===start&&p.context==='practice'),c=report.profiles.find(p=>p.start===start&&p.context==='competition');if(!p||!c)continue;
  for(const [metric,spec] of Object.entries(metrics)){
   const bins=new Map();
   for(const profile of [p,c])for(const d of profile.daily){
    const [hits,attempts]=spec.read(d);if(!attempts||dayGap(d.day,day)<0||dayGap(d.day,day)>=84)continue;
    const k=Math.floor(dayGap(d.day,day)/7),w=bins.get(k)??{practice:[],competition:[]};
    w[profile.context].push({value:hits/attempts,attempts});bins.set(k,w);
   }
   const paired=[...bins.values()].filter(w=>w.practice.length&&w.competition.length);
   const daysA=paired.reduce((n,w)=>n+w.practice.length,0),daysB=paired.reduce((n,w)=>n+w.competition.length,0);
   const attemptsA=paired.reduce((n,w)=>n+w.practice.reduce((a,d)=>a+d.attempts,0),0),attemptsB=paired.reduce((n,w)=>n+w.competition.reduce((a,d)=>a+d.attempts,0),0);
   const diffs=paired.map(w=>distribution(w.competition.map(d=>d.value)).mean-distribution(w.practice.map(d=>d.value)).mean),d=distribution(diffs);
   const noise=d.n>=2?2.5*d.sd/Math.sqrt(d.n):null,sign=Math.sign(d.median??0),agreement=d.n?diffs.filter(v=>sign*v>=spec.floor).length/d.n:0;
   const adequate=d.n>=4&&daysA>=7&&daysB>=7&&attemptsA>=spec.min&&attemptsB>=spec.min;
   const status=!adequate?'insufficient':Math.abs(d.median)>=Math.max(spec.floor,noise)&&agreement>=.75?'observed-gap':'unclear';
   out.push({start,metric,units:spec.units,status,pairedWeeks:d.n,daysA,daysB,attemptsA,attemptsB,difference:d.median,noise,agreement});
  }
 }
 return out;
}
const num=n=>n===null?'not measured':n.toFixed(1);
const pct=n=>n===null?'not measured':(100*n).toFixed(1)+'%';
export function stageLines(report,period=28){
 if(![7,28,84,365].includes(period))throw Error('Invalid stage period');
 const lines=[];
 for(const p of report.profiles){
  const w=p.windows.find(x=>x.period===period);
  if(!w.legs)continue;
  lines.push(p.start+' straight-in · '+p.context+' · '+period+' days: '+w.legs+' completed legs on '+w.days+' days.');
  lines.push('Scoring-stage average '+num(w.scoring.average)+' from '+w.scoring.darts+' actual darts in '+w.scoring.visits+' visits starting above 170.');
  lines.push('First-nine average '+num(w.firstNine.average)+' from '+w.firstNine.legs+' eligible legs. Next scoring visit after a credited scoring visit below 40: '+num(w.recovery.average)+' average from '+w.recovery.opportunities+' within-leg opportunities. Not a measure of psychological pressure.');
  lines.push('Setup zone 171–350: '+w.setup.leaves+'/'+w.setup.attempts+' legal checkout leaves ('+pct(w.setup.rate)+'); '+w.setup.doubleLeaves+' one-dart leaves. Bogey-score escapes '+w.escape.leaves+'/'+w.escape.attempts+'.');
  lines.push('Checkout conversion '+w.checkout.finishes+'/'+w.checkout.visits+' ('+pct(w.checkout.finishRate)+'); '+w.checkout.busts+' bust visits. '+Object.entries(w.bands).map(([k,v])=>k+': '+v.finishes+'/'+v.visits).join(' · ')+'.');
  lines.push('Shortest legal route opportunities: '+Object.entries(w.shortest).map(([k,v])=>k+' dart '+v.finishes+'/'+v.attempts).join(' · ')+'. Actual finishing visits used '+Object.entries(w.finishDarts).map(([k,v])=>k+' dart '+v).join(' · ')+'.');
  lines.push('Explicit aim coverage '+w.aim.known+'/'+w.aim.total+' darts; fully aimed legs '+w.aim.fullyAimedLegs+'. Finishing doubles within fully aimed legs '+w.aim.completeLegHits+'/'+w.aim.completeLegAttempts+' ('+pct(w.aim.completeLegRate)+').');
  if(w.aim.knownFinishAttempts)lines.push('All explicitly recorded finishing attempts '+w.aim.knownFinishHits+'/'+w.aim.knownFinishAttempts+'; missed regions '+(Object.entries(w.aim.misses).map(([k,v])=>k+' '+v).join(' · ')||'none recorded')+'. Partial aim logs may be selective.');
 }
 if(!lines.length)lines.push('No actual completed straight-in legs in this period.');
 return [...lines,report.doubleInExcluded+' double-in and '+report.abandonedExcluded+' abandoned legs excluded from this stage analysis over the year. Actual visits only; setup leaves do not prove intent, opponent strength is unknown, and no match-win prediction is made.'];
}
export function transferLines(rows){
 if(!rows.length)return ['No same-rule actual practice and competition leg histories to compare.'];
 return [...rows.map(r=>r.start+' straight-in · '+r.metric+': '+r.pairedWeeks+' matched weekly blocks, '+r.daysA+'/'+r.daysB+' measured days, '+r.attemptsA+'/'+r.attemptsB+' opportunities. '+(r.status==='observed-gap'?'Competition minus practice '+(r.units==='points'?r.difference:100*r.difference).toFixed(1)+' '+r.units+'.':r.status==='unclear'?'No clear observed difference.':'More comparable observations needed.')),'Matched actual leg stages, not fixed-drill versus match equivalence. Differences may reflect opponents, tactics, selection or conditions; pressure is not established as a cause.'];
}

 // Independent competition progress, not a training-effect estimate.
 // Nonoverlapping windows and exact starting rules; pooled and day-level summaries kept distinct.
 export function competitionProgress(report,day){
  if(!dayValid(day))throw Error('Invalid competition review date');
  const shift=n=>new Date(Date.parse(day)-n*86400000).toISOString().slice(0,10);
  const windows=[{from:shift(55),to:shift(28)},{from:shift(27),to:day}];
  const rows=[];
  for(const profile of report.profiles.filter(p=>p.context==='competition')){
   for(const [metric,spec] of Object.entries(metrics)){
    const [earlier,recent]=windows.map(w=>{
     return stageWindow(profile,spec,w.from,w.to);
    });
    const difference=earlier.value===null||recent.value===null?null:recent.value-earlier.value;
    rows.push({start:profile.start,metric,units:spec.units,earlier,recent,difference,status:difference===null?'missing-window':earlier.days<7||recent.days<7||earlier.opportunities<spec.min||recent.opportunities<spec.min?'limited':'descriptive'});
   }
  }
  return rows;
 }
 export function competitionProgressLines(rows){
  if(!rows.length)return ['No eligible real competition straight-in leg records. Log actual legs when convenient; practice and bot results cannot fill this gap.'];
  const fmt=(x,u)=>x===null?'not measured':(u==='points'?x:100*x).toFixed(1)+(u==='points'?'':'%');
  return [...rows.map(r=>r.start+' straight-in · '+r.metric+': '+r.earlier.from+' to '+r.earlier.to+' '+fmt(r.earlier.value,r.units)+' ('+r.earlier.days+' days, '+r.earlier.opportunities+' opportunities); '+r.recent.from+' to '+r.recent.to+' '+fmt(r.recent.value,r.units)+' ('+r.recent.days+' days, '+r.recent.opportunities+' opportunities). '+(r.difference===null?'No comparison possible.':'Observed change '+(r.difference>0?'+':'')+(r.units==='points'?r.difference:100*r.difference).toFixed(1)+' '+r.units+'. '+(r.status==='limited'?'Limited coverage.':'Descriptive comparison only.'))),'Separate real competition windows; no overlap, no bot or practice substitution. Opponents, tactics, equipment, readiness and selection may differ. This report does not establish a training effect or trigger a change.'];
 }

 // One real competition scope and one measured practice exposure at a time.
 // Complete prior and subsequent 14-day windows; never reuse overlapping
 // calendar windows within the same skill/start scope. No causal inference.
 function stageWindow(profile,spec,from,to){
  const days=profile.daily.filter(d=>d.day>=from&&d.day<=to).map(d=>{const [hits,attempts]=spec.read(d);return {day:d.day,hits,attempts}}).filter(d=>d.attempts>0);
  const opportunities=days.reduce((n,d)=>n+d.attempts,0),hits=days.reduce((n,d)=>n+d.hits,0);
  return {from,to,days:days.length,opportunities,hits,value:count(hits,opportunities),dayMean:distribution(days.map(d=>d.hits/d.attempts)).mean};
 }
 const methodMetrics={scoring:'scoring-stage average',doubles:'explicit finishing doubles',checkout:'checkout visit conversion'};
 const dateShift=(day,n)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
 export function methodCompetitionReview(report,episodes,state,day){
  if(!dayValid(day)||!Array.isArray(episodes))throw Error('Invalid method transfer review');
  const known=episodes.filter(e=>methodMetrics[e.skill]&&FIXED_PROTOCOLS[e.skill]?.includes(e.protocol)&&dayValid(e.from)&&dayValid(e.to)&&e.from<e.to&&e.to<=day&&typeof e.setting?.name==='string'&&Number.isFinite(e.delta)&&Number.isFinite(e.seconds)&&e.seconds>0);
  const eligible=known.filter(e=>dayGap(dateShift(e.from,-14),day)<84&&dateShift(e.to,14)<=day).sort((a,b)=>b.to.localeCompare(a.to)||b.from.localeCompare(a.from)||a.skill.localeCompare(b.skill)||a.protocol.localeCompare(b.protocol)||a.setting.name.localeCompare(b.setting.name));
  const rows=[];let overlapping=0;
  for(const p of report.profiles.filter(p=>p.context==='competition')){
   const used=new Map();
   for(const e of eligible){
    const metric=methodMetrics[e.skill],spec=metrics[metric],from=dateShift(e.from,-14),to=dateShift(e.to,14);
    const ranges=used.get(e.skill)??[];
    if(ranges.some(r=>r.from<=to&&from<=r.to)){overlapping++;continue}
    ranges.push({from,to});used.set(e.skill,ranges);
    const earlier=stageWindow(p,spec,from,dateShift(e.from,-1)),later=stageWindow(p,spec,dateShift(e.to,1),to);
    const confounders=[];
    if(recordedConfounder(state,from,to))confounders.push('Recorded practice conditions, equipment, technique, intervention or trial changed.');
    if((state.readiness??[]).some(r=>r.context==='competition'&&dayValid(r.day)&&r.day>=from&&r.day<=to&&(r.pain||r.fatigue==='high'||r.pressure==='high')))confounders.push('Player-reported competition readiness concern.');
    if((e.endpointPractice??[]).length)confounders.push('Practice occurred on a benchmark endpoint; ordering is unknown.');
    if(known.some(x=>x!==e&&x.skill===e.skill&&x.from<=to&&from<=x.to))confounders.push('Other same-skill training exposure overlaps these windows.');
    const difference=earlier.value===null||later.value===null?null:later.value-earlier.value;
    const status=difference===null?'not-measured':confounders.length?'confounded':earlier.days<3||later.days<3||earlier.opportunities<spec.min||later.opportunities<spec.min?'limited':'observed-comparison';
    rows.push({start:p.start,skill:e.skill,protocol:e.protocol,method:e.setting.name,seconds:e.seconds,from:e.from,to:e.to,practiceChange:e.delta,metric,units:spec.units,earlier,later,difference,status,confounders});
   }
  }
  return {rows,eligibleEpisodes:eligible.length,overlapping,limitation:'Observed chronological match follow-up of recorded training, not a controlled intervention or proof of match transfer. Other practice, opponents, tactics and unreported conditions can differ. No training allocation or difficulty change follows from this report.'};
 }
 export function methodCompetitionLines(report){
  const num=(x,u)=>x===null?'not measured':(u==='points'?x:x*100).toFixed(1)+(u==='points'?'':'%');
  const lines=['Recorded methods and real competition follow-up: '+report.eligibleEpisodes+' eligible dated practice exposures; '+report.overlapping+' overlapping scope windows not reused.'];
  if(!report.rows.length)lines.push('No eligible method-to-competition comparisons yet. Separate actual match records and fixed practice checks are needed before and after a delivered training method.');
  for(const r of report.rows.slice(0,20)){
   lines.push(r.method+' · '+r.skill+' · '+r.protocol+' · '+Math.round(r.seconds/60)+' delivered minutes, '+r.from+' to '+r.to+'; measured practice change '+(r.practiceChange>0?'+':'')+r.practiceChange.toFixed(1)+(r.skill==='scoring'?' average points.':' percentage points.'));
   lines.push(r.start+' straight-in competition · '+r.metric+': '+r.earlier.from+' to '+r.earlier.to+' '+num(r.earlier.value,r.units)+' ('+r.earlier.days+' days, '+r.earlier.opportunities+' opportunities); '+r.later.from+' to '+r.later.to+' '+num(r.later.value,r.units)+' ('+r.later.days+' days, '+r.later.opportunities+' opportunities). '+(r.difference===null?'No measured contrast.':'Observed match change '+(r.difference>0?'+':'')+(r.units==='points'?r.difference:r.difference*100).toFixed(1)+' '+r.units+'.')+' '+r.status.replaceAll('-',' ')+'.');
   if(r.confounders.length)lines.push('Recorded limitations: '+r.confounders.join(' '));
  }
  if(report.rows.length>20)lines.push('Showing 20 most recent available scope comparisons; remaining comparisons are not shown.');
  return [...lines,report.limitation];
 }
