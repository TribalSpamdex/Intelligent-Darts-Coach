import {assessments,SKILLS,plan} from './engine.mjs';
import {robustTrend,matchedContext,exposureSummary,dayGap,dayValid} from './context.mjs';
import {library,variant,difficultyDecision} from './training.mjs';
import {relevant} from './knowledge.mjs';
import {dailyDistribution} from './learning.mjs';
export const EQUIPMENT_FIELDS=['weight','barrel shape','grip position','grip intensity','balance point','point length','stem length','flight shape','integrated flight','entry angle'];
export function equipmentInvestigation({changed=[],discomfort=false,measuredDecline=false}={}){
 if(!Array.isArray(changed)||new Set(changed).size!==changed.length||!changed.every(x=>EQUIPMENT_FIELDS.includes(x))||typeof discomfort!=='boolean'||typeof measuredDecline!=='boolean')throw Error('Invalid equipment evidence');
 if(discomfort)return {decision:'stop-and-review',hypotheses:['Fit or discomfort','Other physical factors'],action:'Do not persist with an uncomfortable setup. If pain persists seek qualified advice; no purchase is prescribed.'};
 if(!changed.length||!measuredDecline)return {decision:'preserve',hypotheses:['Normal variation','Practice distribution','Context','Equipment remains unestablished'],action:'Keep a functioning setup and establish comparable evidence before changing it.'};
 if(changed.length>1)return {decision:'isolate',hypotheses:changed,action:'Compare a known comfortable baseline with one changed variable at a time; allow adaptation and use alternating order.'};
 return {decision:'controlled-comparison',hypotheses:[changed[0],'Context or adaptation','Normal variation'],action:'Compare matched baseline and changed setup in counterbalanced sessions; record accuracy, comfort and later retention.'};
}
export function mentalSupport(readiness){
 if(!readiness.length)return {decision:'ask',action:'Optional: record fatigue, pressure and confidence alongside comparable benchmarks.'};
 const latest=[...readiness].sort((a,b)=>b.day.localeCompare(a.day))[0].day;
 const current=readiness.filter(x=>x.day===latest);
 const recent={pain:current.some(x=>x.pain),fatigue:current.some(x=>x.fatigue==='high')?'high':'normal',pressure:current.some(x=>x.pressure==='high')?'high':'normal',confidence:current.some(x=>x.confidence==='low')?'low':'normal'};
 if(recent.pain)return {decision:'stop',action:'Avoid the aggravating activity and seek qualified advice if pain persists or is significant.'};
 if(recent.fatigue==='high')return {decision:'reduce-load',action:'Consider shorter low-pressure practice or rest today. Do not downgrade ability from self-report.'};
 if(recent.pressure==='high'||recent.confidence==='low')return {decision:'routine-trial',action:'Try a brief repeatable pre-throw routine and a controllable process goal; compare it with your normal routine.'};
 return {decision:'maintain',action:'Maintain a comfortable routine; do not introduce a psychological intervention without a reason.'};
}
export function learningHistory(memory,skill,protocol){
 const rows=memory.interventions.filter(i=>i.skill===skill&&i.protocol===protocol);
 const successes=rows.filter(i=>i.outcome?.status==='observed-improvement'),failures=rows.filter(i=>i.outcome?.status==='observed-decline'||i.outcome?.status==='unclear');
 return {observedImprovements:successes.length,nonImprovements:failures.length,confounded:rows.filter(i=>i.outcome?.status==='confounded').length,declined:rows.filter(i=>i.status==='declined').length,policy:failures.length?'review-alternatives-before-repeat':'no-personal-causal-conclusion'};
}
export function evidenceReview(memory,day){
 if(!dayValid(day))throw Error('Invalid report date');
 const recentReady=(memory.readiness??[]).filter(x=>dayGap(x.day,day)>=0&&dayGap(x.day,day)<56);
 const exposure=exposureSummary(memory,day),profiles=[];
 for(const a of assessments({...memory,observations:memory.observations.filter(o=>dayGap(o.day,day)>=0)})){
 const rows=memory.observations.filter(o=>o.skill===a.skill&&o.context===a.context&&o.protocol===a.protocol&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<56);
 const trend=robustTrend(rows,{asOf:day});
 const fatigue=matchedContext(rows,recentReady,'fatigue'),pressure=matchedContext(rows,recentReady,'pressure'),confidence=matchedContext(rows,recentReady,'confidence','low','normal');
 const learning=learningHistory(memory,a.skill,a.protocol),hypotheses=[];
 const share=exposure.total?exposure.skills[a.skill]/exposure.total:null;
 hypotheses.push({id:'allocation',status:exposure.adequacy==='exploratory'&&share<.1?'supported-as-possibility':'unresolved',support:share===null?[]:['Recorded practice share '+Math.round(share*100)+'%'],against:exposure.adequacy==='exploratory'&&share>=.1?['Low exposure not apparent in recorded minutes']:[],unknown:['Whether practice logging is complete','Whether the drill transfers to the assessed skill']});
 for(const [id,x] of [['fatigue',fatigue],['pressure',pressure],['confidence',confidence]])hypotheses.push({id,status:x.status==='association'&&x.change<0?'supported-as-possibility':'unresolved',support:x.status==='association'&&x.change<0?['Lower matched performance in reported condition']:[],against:x.status==='association'&&x.change>0?['Observed association in opposite direction']:[],unknown:['Other contextual differences','Causal direction']});
 hypotheses.push({id:'technique-equipment',status:'unresolved',support:[],against:[],unknown:['Controlled comparison','Mechanics observation']});
 profiles.push({distribution:dailyDistribution(rows),skill:a.skill,context:a.context,protocol:a.protocol,trend,shortTrend:a.trend.status,learning,hypotheses,knowledge:relevant(a.skill).map(k=>k.id),fatigue,pressure,confidence});
 }
 const issues=profiles.filter(p=>p.trend.status==='declining').map(p=>{
 const conflicts=profiles.filter(q=>q.skill===p.skill&&q!==p&&q.trend.status==='improving').map(q=>({context:q.context,protocol:q.protocol}));
 const contextEvidence=p.hypotheses.some(h=>['fatigue','pressure','confidence'].includes(h.id)&&h.status==='supported-as-possibility');
 const severity=Math.abs(p.trend.change)/(['scoring','firstNine'].includes(p.skill)?3:.05);
 const eligible=['scoring','doubles','checkout','singles','switching','bull','setup'].includes(p.skill);
 return {...p,conflicts,priority:severity,action:conflicts.length||contextEvidence||p.learning.nonImprovements||p.context!=='practice'||!eligible?'investigate':'candidate-focus'};
 }).sort((a,b)=>b.priority-a.priority||a.skill.localeCompare(b.skill)||a.protocol.localeCompare(b.protocol));
 const today=recentReady.filter(x=>x.day===day);
 const wellbeing=mentalSupport(today);
 const focus=wellbeing.decision==='stop'||wellbeing.decision==='reduce-load'?null:issues.find(x=>x.action==='candidate-focus')??null;
 return {day,profiles,issues,focus:focus?.skill??null,focusProtocol:focus?.protocol??null,wellbeing,exposure,decision:wellbeing.decision==='stop'?'stop':wellbeing.decision==='reduce-load'?'reduce-load':focus?'consider-focus':issues.length?'investigate':'balanced',limitations:['Priority is magnitude relative to provisional practical threshold, not a scientific probability.','Long-window assessment is intentionally conservative; it does not replace a fixed benchmark.','Reported conditions are associations, never diagnoses.']};
}
export function drillPlan(memory,day,focus=null){
 const records=memory.difficulty??[],chosen=plan(focus),extras=['switching','firstNine','trebles','pressure','grouping'];
 // Rotate optional skills without claiming equivalence of their measurements.
 const rotation=Math.floor(Date.parse(day)/86400000)%extras.length;
 const optional=extras[(rotation+extras.length)%extras.length];
 const slot=chosen.find(x=>x.skill==='switching'&&x.minutes===5&&focus!=='switching');
 if(slot)slot.skill=optional;
 return chosen.map(s=>{if(s.skill==='warmup')return {...s,instructions:'Comfortable throws; no difficulty assessment.'};
 const rows=records.filter(o=>o.skill===s.skill&&o.protocol===s.skill+'-core'&&o.day<=day).sort((a,b)=>b.day.localeCompare(a.day));
 const current=rows[0]?.level??1;
 const decision=difficultyDecision(records,s.skill,s.skill+'-core',current,day);
 return {...s,drill:variant(s.skill,decision.next),progression:decision}});
}

export function selectCoaching(memory,base,day){
 const review=evidenceReview(memory,day);
 if(['stop','reduce-load'].includes(review.decision))return {...base,decision:review.decision,focus:null,plan:[],review};
 const existing=[...base.issues];
 for(const i of review.issues){if(i.action!=='candidate-focus'||existing.some(x=>x.skill===i.skill&&x.context===i.context&&x.protocol===i.protocol)||memory.interventions.some(x=>x.skill===i.skill&&['accepted','unsuccessful'].includes(x.status)))continue;
 existing.push({skill:i.skill,context:i.context,protocol:i.protocol,evidence:i.trend,hypotheses:i.hypotheses,knowledge:i.knowledge,action:'temporary-focus',review:'Repeat the same benchmark on later days and evaluate adherence.'})}
 const eligible=existing.filter(i=>i.action==='temporary-focus').map(i=>{
 const p=review.profiles.find(q=>q.skill===i.skill&&q.context===i.context&&q.protocol===i.protocol);
 const longIssue=review.issues.find(q=>q.skill===i.skill&&q.context===i.context&&q.protocol===i.protocol);
 const recent=p?.trend.recent;
 const stale=!recent||recent.days<5||dayGap(recent.daily.at(-1).day,day)>7;
 const contradictory=p?.trend.status==='improving'||longIssue?.action==='investigate'||p?.hypotheses.some(h=>['fatigue','pressure','confidence'].includes(h.id)&&h.status==='supported-as-possibility');
 return {issue:i,eligible:!stale&&!contradictory,priority:Math.abs(i.evidence.change)/(['scoring','firstNine'].includes(i.skill)?3:.05)};
 }).filter(x=>x.eligible).sort((a,b)=>b.priority-a.priority||a.issue.skill.localeCompare(b.issue.skill)||a.issue.protocol.localeCompare(b.issue.protocol));
 const candidate=eligible[0]?.issue;
 const issues=existing.map(i=>({...i,action:eligible.some(x=>x.issue===i)?'temporary-focus':'investigate'}));
 return {...base,issues,focus:candidate?.skill??null,focusProtocol:candidate?.protocol??null,focusContext:candidate?.context??null,decision:candidate?'temporary-focus':issues.length?'investigate':'balanced',plan:plan(candidate?.skill),review};
}
