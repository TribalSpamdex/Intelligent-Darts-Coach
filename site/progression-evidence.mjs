import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {dayGap} from './engine/context.mjs';
import {summarise} from './engine/engine.mjs';
import {distribution} from './statistics.mjs';
import {measurementBand,tierRange,SKILL_THRESHOLDS,bandEdges} from './progression-bands.mjs';
const isScore=s=>['scoring','firstNine'].includes(s);
const scale=s=>isScore(s)?1:100;
// Disjoint calendar windows keep a hot or cold week separate from the
// longer baseline. Pooled measurements use actual denominators; daily
// medians give each recorded day one vote.
function windowStats(rows,day,skill,from,to,minDays,minWeeks,minAttempts){
 const s=summarise(rows.filter(o=>{const age=dayGap(o.day,day);return age>=from&&age<to}));
 const daily=(s?.daily??[]).map(x=>({day:x.day,value:x.value*scale(skill)}));
 const d=distribution(daily.map(x=>x.value)),weeks=new Set(daily.map(x=>Math.floor(dayGap(x.day,day)/7))).size,attempts=s?.attempts??0;
 return {from,to,days:d.n,weeks,attempts,median:d.median,pooled:s?s.value*scale(skill):null,iqr:d.iqr,daily,adequate:d.n>=minDays&&weeks>=minWeeks&&attempts>=minAttempts};
}
function formAndStability(rows,day,skill,minAttempts,lastDay){
 const floor=isScore(skill)?3:5;
 const short=windowStats(rows,day,skill,0,7,3,1,Math.ceil(minAttempts/3));
 const usual=windowStats(rows,day,skill,7,28,5,2,Math.ceil(minAttempts*2/3));
 const periods=[0,28,56].map(n=>windowStats(rows,day,skill,n,n+28,8,3,minAttempts));
 let status='insufficient',change=null;
 if(short.adequate&&usual.adequate){
  change=short.median-usual.median;
  const margin=Math.max(floor,(usual.iqr??0)/2),direction=Math.sign(change);
  const supporting=short.daily.filter(x=>direction*(x.value-usual.median)>=floor).length;
  status=Math.abs(change)>=margin&&supporting>=Math.ceil(short.days*2/3)?(direction>0?'above-usual':'below-usual'):'no-clear-shift';
 }
 let stability='insufficient',weeklyChange=null;
 if(periods.every(p=>p.adequate)&&dayGap(lastDay,day)<=7){
  const medians=periods.map(p=>p.median),spread=Math.max(...medians)-Math.min(...medians);
  weeklyChange=(medians[0]-medians[2])/8;
  stability=periods.some(p=>p.iqr>2*floor)?'variable':spread<floor?'stable-measurements':'changing';
 }
 return {form:{status,change,short,usual},stability:{status:stability,periods,weeklyChange}};
}
export function progressEvidence(observations,day){
 const groups=new Map();
 for(const o of canonicalRows(observations,day)){const k=scopeKey(o);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o)}
 return [...groups.values()].map(rows=>{
 const {skill,context,protocol}=rows[0],recent=rows.filter(o=>dayGap(o.day,day)<28),prior=rows.filter(o=>dayGap(o.day,day)>=28&&dayGap(o.day,day)<56);
 const a=summarise(prior),b=summarise(recent);
 const daily=(b?.daily??[]).map(o=>({day:o.day,value:o.value*scale(skill)})),d=distribution(daily.map(x=>x.value));
 const minAttempts=skill==='checkout'?60:isScore(skill)?90:120;
 const weeks=new Set(daily.map(o=>Math.floor(dayGap(o.day,day)/7))).size;
 const adequate=d.n>=8&&weeks>=3&&b.attempts>=minAttempts;
 const value=d.median,band=value===null?null:measurementBand(skill,value);
 const old=a&&a.days>=8&&a.attempts>=minAttempts&&new Set(a.daily.map(o=>Math.floor(dayGap(o.day,day)/7))).size>=3?distribution(a.daily.map(o=>o.value*scale(skill))).median:null;
 const margin=isScore(skill)?2:1.25;
 const first=daily.slice(0,Math.floor(daily.length/2)),last=daily.slice(Math.floor(daily.length/2));
 const confirm=boundary=>adequate&&first.length>=4&&last.length>=4&&[first,last].every(g=>g.filter(o=>o.value>=Math.min(isScore(skill)?180:100,boundary+margin)).length>=Math.ceil(.75*g.length));
 let achieved=null;
 if(band&&adequate){const edges=bandEdges(skill).filter(x=>x<=value);for(let i=edges.length-1;i>=0;i--){const candidate=edges[i];if(candidate===0||confirm(candidate)){achieved=candidate;break}}}
 const nextMilestone=achieved===null?null:bandEdges(skill).find(v=>v>achieved)??null;
 return {skill,context,protocol,nextMilestone,days:d.n,weeks,attempts:b?.attempts??0,value,band,prior:old,change:old===null||value===null?null:value-old,confirmedMilestone:achieved,adequate,daily,confirm,margin,last:rows.at(-1).day,...formAndStability(rows,day,skill,minAttempts,rows.at(-1).day)};
 }).sort((a,b)=>a.skill.localeCompare(b.skill)||a.protocol.localeCompare(b.protocol)||a.context.localeCompare(b.context));
}
// Only identical fixed practice protocols can justify a harder half. Any
// adequately sampled contradictory protocol vetoes the change.
const fixed=(skill,p)=>({scoring:'IDC V6.2 assessment scoring 60 darts',doubles:'IDC V6.2 assessment D1-D20 fixed 60',checkout:'IDC V6.2 assessment fixed 12 three-dart visits',bull:'IDC V6.2 assessment any bull 30'}[skill]===p)||skill==='scoring'&&p==='IDC V6.2 Scoring Challenge fixed 30 darts'||skill==='bull'&&p==='IDC V6.2 Bull Accuracy any bull 30'||p==='IDC precision fixed '+skill||skill==='scoring'&&p==='IDC V6.2 Quick Play Scoring Challenge fixed 30 darts'||skill==='bull'&&p==='IDC V6.2 Quick Play Bull Accuracy any bull 30';
const ringFixed=(skill,p)=>p==='IDC precision fixed '+skill||skill==='singles'&&['IDC V6.2 assessment large singles 60','IDC V6.2 daily large singles 60'].includes(p);
const fixedSkill=(skill,protocol)=>['singles','trebles'].includes(skill)?ringFixed(skill,protocol):Object.hasOwn(SKILL_THRESHOLDS,skill)&&fixed(skill,protocol);
const fresh=(r,day)=>r.adequate&&dayGap(r.last,day)<=7;
// Reuse the established independent-day confirmation test to find the
// highest supported continuous measurement. This is an engineering bound,
// not a statistical confidence interval or a forecast of match performance.
export function confirmedAbility(rows,max){
 if(!rows.length)return null;
 return Math.min(...rows.map(r=>{
  if(!r.confirm(0))return 0;
  if(r.confirm(max))return max;
  let low=0,high=max;
  for(let i=0;i<44;i++){const mid=(low+high)/2;if(r.confirm(mid))low=mid;else high=mid}
  return low;
 }));
}
const continuous=(ability,lower,width)=>ability===null?0:Math.max(0,Math.min(3,4*(ability-lower)/width));
function model(rows,day,max,lower,width){
 const ability=confirmedAbility(rows,max),challenge=continuous(ability,lower,width);
 // Temporary conservative cap from independently repeated recent form.
 // Never escalates difficulty, replaces the long-term estimate, or
 // changes a current round. A single bad day is insufficient.
 const below=rows.filter(r=>r.form.status==='below-usual');
 const recentCap=below.length?Math.min(challenge,...below.map(r=>continuous(Math.max(0,r.form.short.median-r.margin),lower,width))):challenge;
 return {confirmedAbility:ability,challenge,recentCap,temporaryFormCap:recentCap<challenge-1e-8,evidence:rows.map(r=>({protocol:r.protocol,days:r.days,attempts:r.attempts,weeks:r.weeks,median28:r.value,median7:r.form.short.median,form:r.form.status,stability:r.stability.status}))};
}
export function precisionDecisions(observations,day,tiers){
 const rows=progressEvidence(observations,day),out={};
 for(const skill of Object.keys(SKILL_THRESHOLDS)){
 const tier=tiers[skill];if(!Number.isInteger(tier)||tier<1||tier>7)continue;
 const {lower,upper,midpoint,quarters}=tierRange(skill,tier);
 const eligible=rows.filter(r=>r.skill===skill&&r.context==='practice'&&fixedSkill(skill,r.protocol)&&fresh(r,day));
 const quarter=eligible.length?quarters.filter(boundary=>eligible.every(r=>r.confirm(boundary))).length:0;
 const qualifying=quarter?eligible.filter(r=>r.confirm(quarters[quarter-1])):[];
 out[skill]={tier,quarter,...model(eligible,day,isScore(skill)?180:100,lower,upper-lower),half:quarter>=2?'upper':'foundation',midpoint,quarters,protocols:qualifying.map(r=>r.protocol),reason:!eligible.length?'insufficient-comparable-evidence':quarter?'confirmed':'not-confirmed'};
 }
 // Ring-specific foundation exercises require actual single/treble measurements.
 for(const [skill,boundaries] of [['singles',[50,65,80]],['trebles',[10,20,30]]]){
 const eligible=rows.filter(r=>r.skill===skill&&r.context==='practice'&&fixedSkill(skill,r.protocol)&&fresh(r,day));
 const quarter=eligible.length?boundaries.filter(boundary=>eligible.every(r=>r.confirm(boundary))).length:0;
 out[skill]={quarter,...model(eligible,day,100,boundaries[0]-(boundaries[1]-boundaries[0]),4*(boundaries[1]-boundaries[0])),protocols:quarter?eligible.map(r=>r.protocol):[],reason:!eligible.length?'insufficient-comparable-evidence':quarter?'confirmed':'not-confirmed'};
 }
 return out;
}
export function progressionLines(rows,skill=null){
 const selected=rows.filter(r=>!skill||r.skill===skill);
 if(!selected.length)return ['No comparable recorded measurements for progression yet.'];
 const f=(v,s)=>v===null?'not recorded':v.toFixed(1)+(isScore(s)?'':'%');
 return [...selected.slice(0,20).flatMap(r=>[r.skill+' · '+r.context+' · '+r.protocol,'Recent daily median '+f(r.value,r.skill)+'; '+r.days+' measured days, '+r.attempts+' attempts, '+r.weeks+' weeks.','Confirmed milestone: '+f(r.confirmedMilestone,r.skill)+'; next confirmed-milestone target '+f(r.nextMilestone,r.skill)+'.',r.change===null?'Earlier comparable period insufficient.':'Previous daily median '+f(r.prior,r.skill)+'. Difference '+(r.change>=0?'+':'')+r.change.toFixed(1)+(isScore(r.skill)?' points.':' percentage points.')]),'Milestones are descriptive. Confirmed boundaries require repeated measured days and a margin. No visible gameplay tier, no promotion from a single good session.'];
}

export function abilityProfiles(observations,day){
 const rows=progressEvidence(observations,day).filter(r=>r.context==='practice'&&fixedSkill(r.skill,r.protocol));
 return [...Object.keys(SKILL_THRESHOLDS),'singles','trebles'].map(skill=>{
  const protocols=rows.filter(r=>r.skill===skill),eligible=protocols.filter(r=>fresh(r,day));
  return {skill,confirmed:confirmedAbility(eligible,isScore(skill)?180:100),protocols:protocols.map(r=>({protocol:r.protocol,last:r.last,adequate:fresh(r,day),measured:r.value,days:r.days,attempts:r.attempts,form:r.form,stability:r.stability}))};
 });
}
export function abilityProfileLines(profiles){
 const f=(n,s)=>n===null?'not recorded':n.toFixed(1)+(isScore(s)?'':'%');
 const lines=[];
 for(const r of profiles){
  lines.push(r.skill+' · '+(r.confirmed===null?'Not enough comparable recent evidence for a confirmed estimate.':'Conservative supported ability '+f(r.confirmed,r.skill)+'.'));
  for(const p of r.protocols){
   const {short,usual,status}=p.form;
   lines.push(p.protocol+': last measured '+p.last+'; 28-day daily median '+f(p.measured,r.skill)+' from '+p.days+' measured days and '+p.attempts+' attempts.');
   lines.push('Last 7 days '+f(short.median,r.skill)+' ('+short.days+' measured days) versus preceding 21 days '+f(usual.median,r.skill)+' ('+usual.days+' measured days). '+({insufficient:'More comparable days needed.', 'above-usual':'Recent form above the earlier range.', 'below-usual':'Recent form below the earlier range.', 'no-clear-shift':'No clear recent form shift.'}[status]));
   const s=p.stability;
   if(s.status!=='insufficient')lines.push('Three separate 28-day windows: '+[...s.periods].reverse().map(w=>f(w.median,r.skill)).join(' / ')+'. '+({variable:'Measurements are variable; do not infer a plateau.',changing:'Longer-term measured results are changing.', 'stable-measurements':'Measured results are stable; practice exposure must be reviewed before calling this a training plateau.'}[s.status]));
  }
 }
 return [...lines,'These are descriptive measurements and conservative evidence bounds, not calibrated probabilities. Missing days are not misses; practice and competition remain separate.'];
}

 // A read-only current calibration review. It never exposes the seven
 // native tiers to the player or fabricates historical decision provenance.
 export function calibrationReview(observations,day){
  const profiles=progressEvidence(observations,day),out=[];
  for(const skill of Object.keys(SKILL_THRESHOLDS)){
   const rows=profiles.filter(r=>r.skill===skill&&r.context==='practice'&&fixedSkill(skill,r.protocol));
   const eligible=rows.filter(r=>fresh(r,day));
   const max=skill==='scoring'?180:100,confirmed=confirmedAbility(eligible,max);
   const spread=eligible.length>1?Math.max(...eligible.map(r=>r.value))-Math.min(...eligible.map(r=>r.value)):0;
   const inconsistent=eligible.length>1&&spread>(skill==='scoring'?10:12.5);
   const below=eligible.some(r=>r.form.status==='below-usual'),above=eligible.some(r=>r.form.status==='above-usual');
   const status=!eligible.length?'more-evidence':inconsistent||below&&above?'mixed-evidence':below?'recent-lower-form':'supported-measurement';
   out.push({skill,status,confirmed:inconsistent?null:confirmed,protocols:eligible.map(r=>({name:r.protocol,days:r.days,weeks:r.weeks,attempts:r.attempts,value:r.value})),staleOrLimited:rows.length-eligible.length});
  }
  return out;
 }
 export function calibrationReviewLines(rows){
  return [...rows.flatMap(r=>[
   r.skill+': '+({ 'more-evidence':'Repeat the same fixed benchmark on separate days before reconsidering difficulty.','mixed-evidence':'Comparable protocols or recent form disagree. Keep the established routine and investigate the difference.','recent-lower-form':'Recent form is below the earlier measured range. Review conditions before increasing challenge.','supported-measurement':'Current fixed evidence is available for a calibration review.'}[r.status]),
   ...(r.confirmed===null?[]:['Conservative supported benchmark: '+r.confirmed.toFixed(1)+(r.skill==='scoring'?' average':'%')+'.']),
   ...r.protocols.map(p=>p.name+' · '+p.value.toFixed(1)+(r.skill==='scoring'?' average':'%')+'; '+p.days+' days, '+p.attempts+' attempts across '+p.weeks+' weeks.'),
   ...(r.staleOrLimited?[r.staleOrLimited+' other protocols lack fresh multi-week coverage.']:[])
  ]),'Previously saved difficulty decisions cannot be reconstructed reliably without their original evidence. Existing calibration and records are retained; this review does not reset difficulty.'];
 }

 // An independent contradiction check, not a new promotion engine.
 // Two chronologically separate parts of a fresh fixed protocol must
 // contradict the candidate boundary. Missing coverage does not veto it.
 export function calibrationGuard(observations,day,skill,current,next){
  if(!Object.hasOwn(SKILL_THRESHOLDS,skill)||!Number.isInteger(current)||!Number.isInteger(next)||current<1||current>7||next<1||next>7||Math.abs(current-next)!==1)return {status:'unchanged',contradictions:[]};
  const promoting=next<current,boundary=SKILL_THRESHOLDS[skill][promoting?current-2:current-1];
  const profiles=progressEvidence(observations,day).filter(r=>r.skill===skill&&r.context==='practice'&&fixedSkill(skill,r.protocol)&&fresh(r,day));
  const contradictions=profiles.filter(r=>{
   if(!promoting)return r.confirm(boundary);
   const split=Math.floor(r.daily.length/2),halves=[r.daily.slice(0,split),r.daily.slice(split)];
   return r.value<=boundary-r.margin&&halves.every(g=>g.length>=4&&g.filter(o=>o.value<=boundary-r.margin).length>=Math.ceil(.75*g.length));
  }).map(r=>({protocol:r.protocol,days:r.days,attempts:r.attempts,value:r.value}));
  return {status:contradictions.length?'defer':'clear',contradictions,protocols:profiles.length};
 }
