// Historical summaries are descriptive ONLY. Never inject them into current
// measurements, training dose, calibration, or intervention evidence.
import {dayValid} from './engine/context.mjs';
import {projectEvidence,recordedDay,quickAdaptiveMeasurements} from './v62-evidence.mjs';
import {projectTargets} from './host-targets.mjs';
import {gameProfile} from './game-profile.mjs';
import {canonicalRows} from './longitudinal.mjs';
const KEYS=['sessions','games','bigSingles'];
const monthOK=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m)&&dayValid(m+'-01');
const monthShift=(m,n)=>{const d=new Date(m+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7)};
const monthEnd=m=>new Date(Date.parse(monthShift(m,1)+'-01')-86400000).toISOString().slice(0,10);
const id=x=>(typeof x==='string'&&x.length>0||typeof x==='number'&&Number.isSafeInteger(x))?String(x):null;
const safeCount=n=>Number.isSafeInteger(n)&&n>=0;
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const rowMonth=(r,k)=>{const d=k==='sessions'?r?.date:r?.day;return dayValid(d)?d.slice(0,7):null};
const preserved=(r,k)=>k==='bigSingles'&&r?.source==='assessment';
const validDate=(r,k)=>{const d=k==='sessions'?r?.date:r?.day,at=k==='sessions'?r?.start:r?.at,offset=k==='sessions'?r?.startOffsetMinutes:r?.offsetMinutes;return dayValid(d)&&Number.isFinite(at)&&at>0&&Number.isInteger(offset)&&recordedDay(at,offset)===d};
export function validateRetention(raw){
 if(raw==null)return {version:1,months:[]};
 if(raw.version!==1||!Array.isArray(raw.months)||raw.months.length>1200)throw Error('Invalid historical summary');
 const seen=new Set();for(const m of raw.months){
  if(!monthOK(m?.month)||seen.has(m.month)||!KEYS.every(k=>safeCount(m.counts?.[k]))||!finite(m.minutes)||!Array.isArray(m.measurements)||!Array.isArray(m.targets)||!Array.isArray(m.nativeSkills)||!Array.isArray(m.gamesByName)||!Array.isArray(m.contextual)||!Array.isArray(m.finishes)||!Array.isArray(m.personalBests)||!m.scoringMilestones||!m.records||!['bestDouble','bestCheckout','doublesHit','doublesThrown'].every(k=>finite(m.records[k])))throw Error('Invalid historical month');
  seen.add(m.month);
  if(m.measurements.length>5000||m.targets.length>20000||m.gamesByName.length>100||m.nativeSkills.length>5||m.contextual.length>20000||m.finishes.length>20000||m.personalBests.length>500)throw Error('Historical summary exceeds limit');
  for(const r of [...m.measurements,...m.targets,...m.contextual,...m.finishes])if(typeof r.protocol!=='string'||r.protocol.length>250||!safeCount(r.attempts)||r.attempts<1||!finite(r.hits)||r.hits>60*r.attempts||!safeCount(r.days)||r.days<1||r.days>31||!safeCount(r.rows)||r.rows<r.days||typeof r.skill!=='string')throw Error('Invalid historical measurement');
  for(const r of m.nativeSkills)if(!['scoring','doubles','checkout','bull','singles'].includes(r.key)||!safeCount(r.volume)||!safeCount(r.rounds)||!finite(r.total))throw Error('Invalid historical skill total');
  for(const r of m.personalBests)if(typeof r.name!=='string'||r.name.length>100||typeof r.label!=='string'||r.label.length>100||!Number.isFinite(r.value)||!Number.isFinite(r.at)||r.at<=0||typeof r.higher!=='boolean'||typeof r.quick!=='boolean')throw Error('Invalid historical record');
  for(const k of ['total180','training180','quick180','hundreds','oneForties'])if(!finite(m.scoringMilestones[k]))throw Error('Invalid historical scoring milestone');
  if(m.scoringMilestones.training180+m.scoringMilestones.quick180!==m.scoringMilestones.total180)throw Error('Historical scoring split does not balance');
  if(new Set(m.nativeSkills.map(r=>r.key)).size!==m.nativeSkills.length)throw Error('Duplicate historical skill');
  for(const r of m.gamesByName)if(typeof r.name!=='string'||r.name.length>100||!safeCount(r.rounds)||!safeCount(r.completed)||r.completed>r.rounds||!safeCount(r.recordedCompleted)||r.recordedCompleted>r.completed)throw Error('Invalid historical game count');
  if(m.gamesByName.reduce((n,r)=>n+r.rounds,0)!==m.counts.games)throw Error('Historical game counts do not balance');
 }
 return raw;
}
export function historicalTotals(raw){const m=validateRetention(raw).months;return {sessions:m.reduce((n,r)=>n+r.counts.sessions,0),games:m.reduce((n,r)=>n+r.counts.games,0),bigSingles:m.reduce((n,r)=>n+r.counts.bigSingles,0),minutes:m.reduce((n,r)=>n+r.minutes,0),bestDouble:Math.max(0,...m.map(r=>r.records.bestDouble)),bestCheckout:Math.max(0,...m.map(r=>r.records.bestCheckout)),doublesHit:m.reduce((n,r)=>n+r.records.doublesHit,0),doublesThrown:m.reduce((n,r)=>n+r.records.doublesThrown,0)};}
function aggregate(rows,target=false){const groups=new Map();for(const r of rows){const key=JSON.stringify(target?[r.protocol,r.target,r.config??null]:[r.skill,r.context,r.protocol]);let g=groups.get(key);if(!g){g={skill:target?'exact-target':r.skill,protocol:r.protocol,context:target?'practice':r.context,...(target?{target:r.target,config:r.config??null}:{}),attempts:0,hits:0,rows:0,days:new Set()};groups.set(key,g)}g.attempts+=r.attempts;g.hits+=r.hits;g.rows++;g.days.add(r.day)}return [...groups.values()].map(r=>({...r,days:r.days.size}));}
function protectedMonths(profile){const out=new Set(),ranges=[],m=profile.idcCoachMemory;
 for(const rows of Object.values(m?.baselines??{}))for(const r of rows??[])if(dayValid(r?.day))out.add(r.day.slice(0,7));
 // Protect review/delivery windows, including pre-intervention reference and follow-up.
 for(const i of m?.state?.interventions??[]){if(!dayValid(i.proposedDay))continue;const start=monthShift(i.proposedDay.slice(0,7),-3),end=monthShift((dayValid(i.reviewDay)?i.reviewDay:i.proposedDay).slice(0,7),3);ranges.push([start,end])}
 return {out,ranges};
}
export function retentionPlan(profile,day){
 if(!dayValid(day)||!KEYS.every(k=>Array.isArray(profile[k]??(k==='bigSingles'?[]:null))))throw Error('Invalid retention input');
 const old=validateRetention(profile.idcHistoryRetention),current=day.slice(0,7),dueBefore=monthShift(current,-24),recentBefore=monthShift(current,-18),pinned=protectedMonths(profile),blocked=new Set(pinned.out),months=new Set(),parents=new Map(),duplicates=new Set(),archived=new Set(old.months.map(m=>m.month));
 if(profile.activeSession||profile.game||profile.idcCoachMemory?.state?.interventions?.some(i=>['accepted','proposed'].includes(i.status))||profile.idcCoachMemory?.state?.trials?.some(t=>t.status==='active'))return {months:[],reason:'Finish active practice, assessment or coaching experiment first.',protected:0};
 for(const k of KEYS)for(const r of profile[k]??[]){if(preserved(r,k))continue;const m=rowMonth(r,k);if(!m){const inferred=recordedDay(k==='sessions'?r?.start:r?.at,k==='sessions'?r?.startOffsetMinutes:r?.offsetMinutes);if(inferred)blocked.add(inferred.slice(0,7));continue}months.add(m);if(pinned.ranges.some(([a,b])=>m>=a&&m<=b))blocked.add(m);if(!validDate(r,k)||archived.has(m))blocked.add(m);if(k==='sessions'){const x=id(r.id);if(!x)blocked.add(m);else if(parents.has(x)){duplicates.add(x);blocked.add(m);blocked.add(parents.get(x))}else parents.set(x,m)}}
 // A cross-month parent link (including malformed/undated children) must not
 // be split. Assessment mirrors and unlinked legacy records remain raw.
 for(const k of ['games','bigSingles'])for(const r of profile[k]??[]){const m=rowMonth(r,k),x=id(r?.sessionId),parent=parents.get(x);if(preserved(r,k)){if(parent)blocked.add(parent);continue;}if(!parent||duplicates.has(x)||parent!==m){if(m)blocked.add(m);if(parent)blocked.add(parent)}}
 const sorted=[...months].sort(),first=sorted.find(m=>m<dueBefore&&!blocked.has(m));
 if(!first)return {months:[],reason:sorted.some(m=>m<dueBefore)?'Older records are protected or have ambiguous dates or links.':'No complete month is over 24 months old.',protected:[...blocked].filter(m=>m<recentBefore).length};
 const end=monthShift(first,6),selected=sorted.filter(m=>m>=first&&m<end&&m<recentBefore&&!blocked.has(m));
 return {months:selected,reason:'Oldest eligible six-calendar-month batch. Recent and protected records remain detailed.',protected:[...blocked].filter(m=>m<recentBefore).length};
}
export function consolidateHistory(profile,day,nativeMonth){
 const plan=retentionPlan(profile,day);if(!plan.months.length)return {plan,profile};
 const old=validateRetention(profile.idcHistoryRetention),chosen=new Set(plan.months),months=[];
 for(const month of plan.months){const part=Object.fromEntries(KEYS.map(k=>[k,(profile[k]??[]).filter(r=>!preserved(r,k)&&rowMonth(r,k)===month)])),end=monthEnd(month),now=Date.parse(monthShift(month,1)+'-01')+86400000;
  const host={...part,assessmentHistory:[]};const measurements=aggregate(canonicalRows(projectEvidence(host,{today:end,now}).observations,end));const targets=aggregate(projectTargets(host,end,now,[],{includeConfiguration:true}).rows.filter(r=>r.day.startsWith(month)),true);
  const contextual=aggregate(quickAdaptiveMeasurements(host,end,now,{daily:true}).flatMap(g=>g.records.map(r=>({day:r.day,protocol:g.key+' · '+(g.scoring?'points per dart':g.unit),target:'contextual',config:r.config,hits:r.hits,attempts:r.attempts*(g.scoring&&!g.perDart?3:1)}))),true);
  const finishes=aggregate(gameProfile(host,end,now,{includeRecords:true,includeConfiguration:true}).records.flatMap(r=>(r.rows??[]).map(x=>({day:r.day,protocol:r.protocol,target:String(x.score),config:r.config??null,hits:Number(x.success),attempts:1}))),true);
  const names=new Map(),records={bestDouble:0,bestCheckout:0,doublesHit:0,doublesThrown:0};for(const g of part.games){if(typeof g.name!=='string'||!g.name||g.name.length>100)throw Error('Unrecognised historical game; keep raw records');const n=names.get(g.name)??{name:g.name,rounds:0,completed:0};n.rounds++;n.completed+=Number(g.completion==='natural');names.set(g.name,n);if(g.completion!=='natural')continue;if(g.name==='Doubles Survival'&&g.variant==='doubles'){records.bestDouble=Math.max(records.bestDouble,Number(g.highest)||0);records.doublesHit+=Number(g.hits)||0;records.doublesThrown+=Number(g.thrown)||0}if(g.name==='Checkout Climb'&&g.success>0)records.bestCheckout=Math.max(records.bestCheckout,Number(g.highest)||0)}
  const native=nativeMonth(month);for(const g of names.values())g.recordedCompleted=native?.recordedCompleted?.[g.name]??g.completed;const nativeSkills=Array.isArray(native)?native:native?.skills;if(!Array.isArray(nativeSkills))throw Error('Monthly statistics unavailable');const personalBests=native.personalBests??[],scoringMilestones=native.scoringMilestones??{total180:0,training180:0,quick180:0,hundreds:0,oneForties:0};
  months.push({month,counts:Object.fromEntries(KEYS.map(k=>[k,part[k].length])),minutes:part.sessions.reduce((n,s)=>n+(Number(s.minutes)||0),0),measurements,targets,contextual,finishes,nativeSkills,personalBests,scoringMilestones,gamesByName:[...names.values()],records});
 }
 const next={...profile,...Object.fromEntries(KEYS.map(k=>[k,(profile[k]??[]).filter(r=>preserved(r,k)||!chosen.has(rowMonth(r,k)))])),idcHistoryRetention:{version:1,months:[...old.months,...months].sort((a,b)=>a.month.localeCompare(b.month))}};
 validateRetention(next.idcHistoryRetention);
 for(const k of KEYS)if((profile[k]??[]).length!==next[k].length+months.reduce((n,m)=>n+m.counts[k],0))throw Error('Retention count mismatch');
 // Retain original intervention evidence exactly, even if an unusual baseline
 // refers outside the protected date windows. Do not rewrite historical IDs.
 const before=projectEvidence(profile,{today:day}).observations,afterRows=projectEvidence(next,{today:day}).observations,after=new Map(afterRows.map(r=>[r.id,JSON.stringify(r)])),original=new Map(before.map(r=>[r.id,JSON.stringify(r)]));
 const required=new Set(Object.values(profile.idcCoachMemory?.baselines??{}).flatMap(r=>r.map(o=>o.id)));
 if(before.some(r=>required.has(r.id)&&after.get(r.id)!==JSON.stringify(r)))throw Error('Coaching baseline would change. No consolidation performed.');
 const retained=before.filter(r=>!chosen.has(r.day.slice(0,7)));if(retained.some(r=>after.get(r.id)!==JSON.stringify(r))||afterRows.some(r=>original.get(r.id)!==JSON.stringify(r)))throw Error('Current evidence would change. No consolidation performed.');
 const beforeBytes=new TextEncoder().encode(JSON.stringify(profile)).length,afterBytes=new TextEncoder().encode(JSON.stringify(next)).length;
 if(afterBytes>=beforeBytes)return {plan:{...plan,months:[],reason:'This batch would not reduce storage; detailed records retained.'},profile};
 return {plan,profile:next,months,beforeBytes,afterBytes};
}
