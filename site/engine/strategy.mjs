import {SKILLS,plan,summarise} from './engine.mjs';
import {dayValid,dayGap} from './context.mjs';
import {goalProgress} from './goals.mjs';
import {trialOutcome} from './experiments.mjs';
import {followupReview} from './followup.mjs';
const id=i=>JSON.stringify([i.skill,i.context,i.protocol]);
const same=(a,b)=>id(a)===id(b);
const scope=(o,i)=>same(o,i);
const related={
 scoring:['firstNine','trebles'],firstNine:['scoring','trebles'],trebles:['scoring','firstNine'],doubles:['checkout'],checkout:['doubles','setup'],setup:['checkout'],singles:['switching','grouping'],switching:['singles'],grouping:['singles'],bull:[],pressure:[]
};
export function learningLedger(m,i,day){
 const rows=m.interventions.filter(x=>same(x,i)&&x.reviewDay&&x.reviewDay<=day);
 const trials=(m.trials??[]).filter(x=>same(x,i)&&x.status==='completed'&&x.pairs.every(p=>p.day<=day));
 const entries=rows.map(x=>{
 const later=(x.retentionHistory??[]).filter(o=>o.reviewDay<=day).sort((a,b)=>b.reviewDay.localeCompare(a.reviewDay))[0];
 return {id:x.id,kind:'training-allocation',outcome:x.outcome?.status??'unknown',retention:later?.status??'not-assessed',reviewDay:x.reviewDay,adherence:x.adherence??null};
 });
 for(const t of trials){const out=trialOutcome(t),delayed=followupReview(m,t,day),retention=delayed.find(x=>x.kind==='retention')?.status??'not-assessed';entries.push({id:t.id,kind:t.approach,outcome:out.status,baseline:t.baseline,alternative:t.alternative,retention,delayed:delayed.map(x=>({kind:x.kind,protocol:x.protocol,context:x.context,status:x.status})),reviewDay:t.pairs.at(-1)?.day??t.start})}
 const blocked=entries.filter(x=>x.outcome==='observed-decline'||x.outcome==='unclear'&&x.kind==='training-allocation'||['retention-not-established','benefit-not-established','observed-decline'].includes(x.retention)||x.outcome==='baseline-favoured');
 const promising=entries.filter(x=>x.outcome==='observed-improvement'||x.outcome==='alternative-favoured');
 return {entries,blocked,promising,retained:promising.filter(x=>['observed-retention','observed-benefit'].includes(x.retention)&&!blocked.some(b=>b.id===x.id)),policy:blocked.length?'review-previous-outcomes':'no-established-causal-effect'};
}
export function questionAgenda(m,issues,day){
 const entries=[];
 const priority={comfort:100,protocol:90,equipment:65,technique:60,fatigue:55,pressure:45,logging:35};
 for(const i of issues){
 for(const q of i.investigation?.questions??[]){
 const history=(m.answers??[]).filter(o=>scope(o,i)&&o.question===q.id&&o.day<=day).sort((a,b)=>a.day.localeCompare(b.day));
 // Unknown is a real answer. Do not immediately repeat it; request a measurement instead.
 if(history.at(-1)?.answer==='unknown'&&dayGap(history.at(-1).day,day)<7)continue;
 let rank=priority[q.id]??20;
 if(q.id==='logging'&&i.investigation.exposure?.status==='incomplete-logging')rank+=20;
 if(q.id==='pressure'&&i.context==='competition')rank+=20;
 if(q.id==='equipment'&&i.investigation.hypotheses.some(h=>h.id==='equipment'&&h.support.length))rank+=10;
 entries.push({...q,scope:{skill:i.skill,context:i.context,protocol:i.protocol},rank,why:q.id==='comfort'?'Safety can override every training recommendation.':q.id==='protocol'?'An incomparable benchmark can invalidate the decline.':'The answer may distinguish competing explanations; it is not a causal diagnosis.'});
 }}
 entries.sort((a,b)=>b.rank-a.rank||id(a.scope).localeCompare(id(b.scope))||a.id.localeCompare(b.id));
 return {next:entries[0]??null,questions:entries,limit:'Ordinal engineering priorities, not information-gain probabilities.'};
}
export function resolvePriorities(m,report,day){
 if(!dayValid(day))throw Error('Invalid strategy date');
 const issues=report.issues.map(i=>{
 const ledger=learningLedger(m,i,day);
 const goals=(m.goals??[]).filter(g=>g.status==='active'&&same(g,i)&&g.start<=day).map(g=>({id:g.id,...goalProgress(m,g,day)}));
 const severity=Math.abs(i.evidence?.change??0)/(['scoring','firstNine'].includes(i.skill)?5:.08);
 const previous=ledger.blocked.some(x=>x.kind==='training-allocation');
 const action=previous?'investigate':i.action;
 return {...i,action,strategy:{severity,goalRelevant:goals.some(g=>g.status!=='target-observed'),goals,ledger,reason:previous?'A prior focused-training outcome was unsuccessful or not retained; investigate an alternative rather than repeat it automatically.': 'Prioritise confirmed current change and relevant measured goals.'}};
 }).sort((a,b)=>Number(b.action==='temporary-focus')-Number(a.action==='temporary-focus')||Number(b.strategy.goalRelevant)-Number(a.strategy.goalRelevant)||b.strategy.severity-a.strategy.severity||id(a).localeCompare(id(b)));
 const clusters=[];
 for(const i of issues){const matches=clusters.filter(g=>g.context===i.context&&g.skills.some(s=>s===i.skill||related[s]?.includes(i.skill)||related[i.skill]?.includes(s)));const group={context:i.context,skills:[...new Set([i.skill,...matches.flatMap(g=>g.skills)])],issues:[id(i),...matches.flatMap(g=>g.issues)]};for(const g of matches)clusters.splice(clusters.indexOf(g),1);clusters.push(group)}
 const safe=['stop','reduce-load'].includes(report.decision);
 const candidate=safe?null:issues.find(i=>i.action==='temporary-focus');
 const agenda=questionAgenda(m,issues,day);
 return {...report,issues,focus:candidate?.skill??null,focusProtocol:candidate?.protocol??null,focusContext:candidate?.context??null,decision:safe?report.decision:candidate?'temporary-focus':issues.length?'investigate':'balanced',plan:safe?[]:plan(candidate?.skill),strategy:{clusters,agenda,primary:candidate?{skill:candidate.skill,context:candidate.context,protocol:candidate.protocol}:null,policy:'One temporary focus at a time. Related skills are grouped for investigation, not assumed to share a cause.'}};
}
export function developmentReview(m,report,day){
 const goals=(m.goals??[]).filter(g=>g.status==='active'&&g.start<=day).map(g=>({...g,progress:goalProgress(m,g,day)}));
 const skills=SKILLS.map(skill=>{
 const rows=m.observations.filter(o=>o.skill===skill&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<28);
 const groups=new Map();for(const o of rows){const k=id(o),g=groups.get(k)??[];g.push(o);groups.set(k,g)}
 const benchmarks=[...groups.values()].map(g=>({context:g[0].context,protocol:g[0].protocol,summary:summarise(g)}));
 return {skill,benchmarks,adequate:benchmarks.some(b=>b.summary.days>=7&&b.summary.attempts>=60),issues:report.issues.filter(i=>i.skill===skill).length}
 });
 const reviews=m.interventions.filter(i=>i.status==='accepted'&&i.responseDay<=day).map(i=>({id:i.id,skill:i.skill,due:dayGap(i.responseDay,day)>=i.reviewAfterDays,daysUntilReview:Math.max(0,i.reviewAfterDays-dayGap(i.responseDay,day))}));
 return {day,phase:['stop','reduce-load'].includes(report.decision)?'wellbeing':report.decision==='temporary-focus'?'consider-focused-block':report.decision==='investigate'?'investigation':skills.some(s=>!s.adequate)?'benchmark-coverage':'balanced-development',goals,skills,reviews,missingBenchmarks:skills.filter(s=>!s.adequate).map(s=>s.skill),next:'Maintain comparable benchmarks and review outcomes before changing a development block.'};
}
