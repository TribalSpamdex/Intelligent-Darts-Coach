import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {dayGap} from './engine/context.mjs';
import {summarise} from './engine/engine.mjs';
import {distribution} from './statistics.mjs';
import {measurementBand,tierRange,SKILL_THRESHOLDS,bandEdges} from './progression-bands.mjs';
const isScore=s=>['scoring','firstNine'].includes(s);
const scale=s=>isScore(s)?1:100;
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
 return {skill,context,protocol,nextMilestone,days:d.n,weeks,attempts:b?.attempts??0,value,band,prior:old,change:old===null||value===null?null:value-old,confirmedMilestone:achieved,adequate,daily,confirm,margin,last:rows.at(-1).day};
 }).sort((a,b)=>a.skill.localeCompare(b.skill)||a.protocol.localeCompare(b.protocol)||a.context.localeCompare(b.context));
}
// Only identical fixed practice protocols can justify a harder half. Any
// adequately sampled contradictory protocol vetoes the change.
const fixed=(skill,p)=>({scoring:'IDC V6.2 assessment scoring 60 darts',doubles:'IDC V6.2 assessment D1-D20 fixed 60',checkout:'IDC V6.2 assessment fixed 12 three-dart visits',bull:'IDC V6.2 assessment any bull 30'}[skill]===p)||skill==='scoring'&&p==='IDC V6.2 Scoring Challenge fixed 30 darts'||skill==='bull'&&p==='IDC V6.2 Bull Accuracy any bull 30'||p==='IDC precision fixed '+skill;
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
 const ability=confirmedAbility(rows,max);
 return {confirmedAbility:ability,challenge:continuous(ability,lower,width),evidence:rows.map(r=>({protocol:r.protocol,days:r.days,attempts:r.attempts,weeks:r.weeks,median28:r.value,median7:distribution(r.daily.filter(x=>dayGap(x.day,day)<7).map(x=>x.value)).median}))};
}
export function precisionDecisions(observations,day,tiers){
 const rows=progressEvidence(observations,day),out={};
 for(const skill of Object.keys(SKILL_THRESHOLDS)){
 const tier=tiers[skill];if(!Number.isInteger(tier)||tier<1||tier>7)continue;
 const {lower,upper,midpoint,quarters}=tierRange(skill,tier);
 const eligible=rows.filter(r=>r.skill===skill&&r.context==='practice'&&fixed(skill,r.protocol)&&r.adequate&&dayGap(r.last,day)<=7);
 const quarter=eligible.length?quarters.filter(boundary=>eligible.every(r=>r.confirm(boundary))).length:0;
 const qualifying=quarter?eligible.filter(r=>r.confirm(quarters[quarter-1])):[];
 out[skill]={tier,quarter,...model(eligible,day,isScore(skill)?180:100,lower,upper-lower),half:quarter>=2?'upper':'foundation',midpoint,quarters,protocols:qualifying.map(r=>r.protocol),reason:!eligible.length?'insufficient-comparable-evidence':quarter?'confirmed':'not-confirmed'};
 }
 // Ring-specific foundation exercises require actual single/treble measurements.
 for(const [skill,boundaries] of [['singles',[50,65,80]],['trebles',[10,20,30]]]){
 const eligible=rows.filter(r=>r.skill===skill&&r.context==='practice'&&r.adequate&&dayGap(r.last,day)<=7&&(r.protocol==='IDC precision fixed '+skill||skill==='singles'&&['IDC V6.2 assessment large singles 60','IDC V6.2 daily large singles 60'].includes(r.protocol)));
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
