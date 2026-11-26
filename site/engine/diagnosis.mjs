import {SKILLS,summarise,mean,sd,plan,serialMargin} from './engine.mjs';
import {dayValid,dayGap,robustTrend} from './context.mjs';
import {targetSummaries} from './target-evidence.mjs';
export const CHANGE_FIELDS=['equipment','technique','routine','practice schedule','environment','injury or discomfort'];
export const QUESTIONS=[
 {id:'logging',text:'Was all practice logged during both comparison periods?',answers:['yes','no','unknown']},
 {id:'protocol',text:'Were the target, rules and measurement conditions the same?',answers:['yes','no','unknown']},
 {id:'equipment',text:'Did equipment change before the decline?',answers:['yes','no','unknown']},
 {id:'technique',text:'Did you deliberately change your throw before the decline?',answers:['yes','no','unknown']},
 {id:'fatigue',text:'Did the decline coincide with unusual fatigue?',answers:['yes','no','unknown']},
 {id:'pressure',text:'Is the problem mainly present during competition?',answers:['yes','no','unknown']},
 {id:'comfort',text:'Is throwing uncomfortable or painful?',answers:['yes','no','unknown']}
];
export function validateAnswer(o){
 if(!o||!SKILLS.includes(o.skill)||!dayValid(o.day)||!['practice','competition'].includes(o.context)||typeof o.protocol!=='string'||!o.protocol.trim()||o.protocol.length>100||!QUESTIONS.some(q=>q.id===o.question&&q.answers.includes(o.answer)))throw Error('Invalid investigation answer');
 return {day:o.day,skill:o.skill,context:o.context,protocol:o.protocol,question:o.question,answer:o.answer};
}
const key=o=>JSON.stringify([o.skill,o.context,o.protocol,o.question]);
export function recordAnswer(m,o){o=validateAnswer(o);return {...m,answers:[...(m.answers??[]),o]}}
export function answersFor(m,issue,day){
 const rows=(m.answers??[]).filter(o=>o.skill===issue.skill&&o.context===issue.context&&o.protocol===issue.protocol&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<28).sort((a,b)=>a.day.localeCompare(b.day));
 const result=new Map();for(const o of rows)result.set(o.question,o.answer);return result;
}
export function validateChange(o){
 if(!o||!dayValid(o.day)||!CHANGE_FIELDS.includes(o.field)||typeof o.id!=='string'||!o.id.trim()||o.id.length>100||typeof o.description!=='string'||!o.description.trim()||o.description.length>500)throw Error('Invalid change event');
 return {id:o.id,day:o.day,field:o.field,description:o.description.trim()};
}
export function recordChange(m,o){o=validateChange(o);if((m.changes??[]).some(x=>x.id===o.id))throw Error('Duplicate change event');return {...m,changes:[...(m.changes??[]),o]}}
export function exposureComparison(m,issue,day,answers){
 const cutoff=issue.evidence?.recent?.daily?.[0]?.day,first=issue.evidence?.earlier?.daily?.[0]?.day;
 const end=issue.evidence?.recent?.daily?.at(-1)?.day;
 if(!cutoff||!first||!end)return {status:'insufficient'};
 function window(lo,hi,exclusive){const rows=m.exposure.filter(e=>e.day>=lo&&(exclusive?e.day<hi:e.day<=hi));const total=rows.reduce((n,e)=>n+e.minutes,0),minutes=rows.filter(e=>e.skill===issue.skill).reduce((n,e)=>n+e.minutes,0),days=new Set(rows.map(e=>e.day)).size,span=dayGap(lo,hi)+(exclusive?0:1);return {total,minutes,days,perWeek:span>0?minutes*7/span:null,share:total?minutes/total:null}}
 const earlier=window(first,cutoff,true),recent=window(cutoff,end,false);
 if(earlier.days<5||recent.days<5||earlier.total<120||recent.total<120)return {status:'insufficient',earlier,recent};
 if(answers.get('logging')!=='yes')return {status:'incomplete-logging',earlier,recent};
 const ratio=earlier.perWeek>0?recent.perWeek/earlier.perWeek:null;
 return {status:ratio!==null&&ratio<=.75&&earlier.perWeek-recent.perWeek>=10?'decreased':ratio!==null&&ratio>=1.25?'increased':'no-material-reduction',earlier,recent,ratio};
}
export function matchedWithinWeeks(m,issue,day,field,condition){
 const rows=m.observations.filter(o=>o.skill===issue.skill&&o.context===issue.context&&o.protocol===issue.protocol&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<56);
 const ready=new Map((m.readiness??[]).filter(o=>o.context===issue.context).map(o=>[o.day,o[field]])),groups=new Map();
 for(const o of rows){const label=ready.get(o.day);if(label!==condition&&label!=='normal')continue;const week=Math.floor(dayGap(o.day,day)/7);const g=groups.get(week)??{a:[],b:[]};g[label===condition?'a':'b'].push(o);groups.set(week,g)}
 const pairs=[...groups.values()].filter(g=>g.a.length&&g.b.length).map(g=>({a:summarise(g.a),b:summarise(g.b)}));
 const daysA=pairs.reduce((n,p)=>n+p.a.days,0),daysB=pairs.reduce((n,p)=>n+p.b.days,0),attemptsA=pairs.reduce((n,p)=>n+p.a.attempts,0),attemptsB=pairs.reduce((n,p)=>n+p.b.attempts,0);
 if(pairs.length<3||daysA<5||daysB<5||attemptsA<60||attemptsB<60)return {status:'insufficient',pairs:pairs.length,daysA,daysB};
 const deltas=pairs.map(p=>p.a.dayMean-p.b.dayMean),delta=mean(deltas),noise=2*sd(deltas)/Math.sqrt(deltas.length),floor=['scoring','firstNine'].includes(issue.skill)?3:.05;
 return {status:Math.abs(delta)>=Math.max(floor,noise)&&deltas.filter(x=>Math.sign(x)===Math.sign(delta)).length>=Math.ceil(deltas.length*.75)?'association':'unclear',delta,noise,pairs:pairs.length,daysA,daysB,causality:'not established'};
}
export function targetPattern(m,issue,day){
 const match=s=>issue.skill==='doubles'?s.startsWith('D'):issue.skill==='trebles'?s.startsWith('T'):issue.skill==='singles'?/^[SLI]/.test(s):issue.skill==='bull'?['25','50'].includes(s):false;
 const all=(m.throws??[]).filter(o=>o.context===issue.context&&o.protocol===issue.protocol&&match(o.aim)&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<28);
 const groups=targetSummaries(all).filter(g=>g.adequacy==='exploratory');
 return groups.map(g=>({aim:g.aim,hits:g.hits,attempts:g.attempts,accuracy:g.accuracy,directions:g.directions,days:g.days})).sort((a,b)=>a.accuracy-b.accuracy||a.aim.localeCompare(b.aim));
}
export function investigateIssue(m,issue,day){
 const a=answersFor(m,issue,day),exposure=exposureComparison(m,issue,day,a),fatigue=matchedWithinWeeks(m,issue,day,'fatigue','high'),pressure=matchedWithinWeeks(m,issue,day,'pressure','high'),confidence=matchedWithinWeeks(m,issue,day,'confidence','low'),targets=targetPattern(m,issue,day);
 const hypotheses=[];
 function h(id,title,support=[],against=[],unknown=[],next){const status=support.length&&against.length?'mixed':support.length?'supported-possibility':against.length?'less-supported':'unresolved';hypotheses.push({id,title,status,support,against,unknown,next})}
 h('practice','Reduced practice exposure',exposure.status==='decreased'?['Recorded minutes fell across comparable periods; player reports complete logging.']:[],exposure.status==='no-material-reduction'||exposure.status==='increased'?['Recorded minutes did not materially decline.']:[],['Practice quality and transfer remain unknown.'],'Compare a stable benchmark after a modest change in practice allocation.');
 for(const [id,title,x] of [['fatigue','Fatigue',fatigue],['pressure','Pressure',pressure],['confidence','Confidence',confidence]])h(id,title,[...(x.status==='association'&&x.delta<0?['Lower performance in matched weeks under this reported condition.']:[]),...(a.get(id)==='yes'?['Player reports a relevant association.']:[])],x.status==='association'&&x.delta>0?['Measured association is in the opposite direction.']:[],['Other simultaneous changes may explain the association.'],'Record comparable normal and affected days; do not infer causation.');
 for(const id of ['equipment','technique']){const start=issue.evidence?.earlier?.daily?.[0]?.day,events=(m.changes??[]).filter(c=>c.field===id&&start&&c.day>=start&&c.day<=day&&c.day<= (issue.evidence?.recent?.daily?.[0]?.day??day));h(id,id==='equipment'?'Equipment change':'Deliberate technique change',[...(a.get(id)==='yes'?['Player reports a change before deterioration.']:[]),...events.map(e=>'Reported change: '+e.description)],a.get(id)==='no'?['Player reports no change before deterioration.']:[],['Unobserved mechanical variation remains possible.'],'Compare the known comfortable baseline with one change at a time.')}
 h('target','Target-specific difficulty',targets.length>=2&&targets.at(-1).accuracy-targets[0].accuracy>=.15?['Measured target accuracies differ materially.']:[],[],['Segment outcomes cannot establish a mechanical fault.'],'Repeat fixed target-specific samples before adding a targeted drill.');
 h('measurement','Incomparable measurements',a.get('protocol')==='no'?['Player reports that measurement conditions differed.']:[],a.get('protocol')==='yes'?['Player reports matched measurement conditions.']:[],['Unrecorded conditions can still differ.'],'Repeat the same protocol under comparable conditions.');
 const questions=QUESTIONS.filter(q=>!a.has(q.id)||a.get(q.id)==='unknown').sort((x,y)=>['comfort','protocol','logging','equipment','technique','fatigue','pressure'].indexOf(x.id)-['comfort','protocol','logging','equipment','technique','fatigue','pressure'].indexOf(y.id));
 const veto=a.get('comfort')==='yes'?'comfort':a.get('protocol')==='no'?'measurement':hypotheses.some(x=>['equipment','technique','fatigue','pressure','confidence'].includes(x.id)&&['supported-possibility','mixed'].includes(x.status))?'competing-evidence':null;
 return {hypotheses,exposure,fatigue,pressure,confidence,targets,questions,veto,knowledgePolicy:'An explanation is never proven by association; contrary evidence only reduces support.'};
}

export function confirmCurrentDecline(m,issue,day){
 const rows=m.observations.filter(o=>o.skill===issue.skill&&o.context===issue.context&&o.protocol===issue.protocol&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<56);
 const days=[...new Set(rows.map(o=>o.day))].sort(),recentDays=days.slice(-7),baselineDays=days.slice(-21,-7);
 const recent=summarise(rows.filter(o=>recentDays.includes(o.day))),baseline=summarise(rows.filter(o=>baselineDays.includes(o.day)));
 if(!recent||!baseline||recent.days<7||baseline.days<7||recent.attempts<60||baseline.attempts<60||dayGap(recentDays[0],day)>28||dayGap(recentDays.at(-1),day)>7)return {status:'insufficient',reason:'Require seven recent and seven preceding comparable measured days, with recent data current.'};
 const floor=['scoring','firstNine'].includes(issue.skill)?5:.08;
 const change=recent.dayMean-baseline.dayMean,noise=serialMargin(baseline,recent);
 const halves=[recent.daily.slice(0,3),recent.daily.slice(3)].map(x=>mean(x.map(o=>o.value))-baseline.dayMean);
 const consistent=halves.every(x=>x<=-floor*.75);
 const short=consistent&&change<=-Math.max(floor,noise);
 const last14=days.slice(-14),older14=days.slice(-28,-14);
 const longBase=summarise(rows.filter(o=>older14.includes(o.day))),longRecent=summarise(rows.filter(o=>last14.includes(o.day)));
 let persistent=false,long=null;
 if(longBase&&longRecent&&longBase.days>=7&&longRecent.days===14&&longBase.attempts>=60&&dayGap(last14[0],day)<=35){
 const delta=longRecent.dayMean-longBase.dayMean,margin=serialMargin(longBase,longRecent);
 const weeks=[longRecent.daily.slice(0,7),longRecent.daily.slice(7)].map(x=>mean(x.map(o=>o.value))-longBase.dayMean);
 persistent=weeks.every(x=>x<=-floor)&&delta<=-Math.max(floor,margin)&&halves.every((_,i)=>mean(recent.daily.slice(i===0?0:3,i===0?3:7).map(o=>o.value))-longBase.dayMean<=-floor*.75);
 long={change:delta,noise:margin,weeks,baselineDays:longBase.days,recentDays:longRecent.days};
 }
 // Once an established decline has lasted a month, two adjacent short
 // windows can both be low. Check that the independent long-window signal
 // remains present in both halves of the latest seven measured days.
 const broad=robustTrend(rows,{asOf:day});
 const broadHalves=broad.earlier? [recent.daily.slice(0,3),recent.daily.slice(3)].map(x=>mean(x.map(o=>o.value))-broad.earlier.dayMean):[];
 // A broad window can still contain a resolved slump. Two recent seven-day
 // blocks rising materially above the immediately preceding fortnight
 // veto a long-window-only prescription, even if the old peak is not restored.
 const recovering=long!==null&&long.change>=floor&&long.weeks.every(x=>x>=floor*.75);
 const sustained=!recovering&&broad.status==='declining'&&broad.change<=-floor&&broadHalves.length===2&&broadHalves.every(x=>x<=-floor);
 return {status:short||persistent||sustained?'confirmed':'not-confirmed',mode:short?'recent':persistent?'persistent':sustained?'sustained-long-window':recovering?'recovering':'none',recovering,change,noise,halves,floor,baselineDays:baseline.days,recentDays:recent.days,long,broad:{status:broad.status,change:broad.change??null,halves:broadHalves},reason:'Conservative engineering gate: confirm recent or sustained decline against disjoint earlier measurements; require both latest subperiods to remain low. Not a calibrated statistical test.'};
}

export function deepenReport(m,report,day){
 const issues=report.issues.map(i=>{const investigation=investigateIssue(m,i,day),confirmation=confirmCurrentDecline(m,i,day);return {...i,investigation,confirmation,action:investigation.veto||confirmation.status!=='confirmed'?'investigate':i.action}});
 const latestComfort=new Map();for(const o of (m.answers??[]).filter(o=>o.question==='comfort'&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<7).sort((a,b)=>a.day.localeCompare(b.day)))latestComfort.set(JSON.stringify([o.skill,o.context,o.protocol]),o.answer);
 const comfort=issues.some(i=>i.investigation.veto==='comfort')||[...latestComfort.values()].includes('yes');
 const selected=issues.find(i=>i.skill===report.focus&&i.protocol===report.focusProtocol&&i.context===report.focusContext&&i.action==='temporary-focus');
 const candidate=selected??issues.filter(i=>i.action==='temporary-focus').sort((a,b)=>Math.abs(b.evidence.change)/(['scoring','firstNine'].includes(b.skill)?3:.05)-Math.abs(a.evidence.change)/(['scoring','firstNine'].includes(a.skill)?3:.05)||a.skill.localeCompare(b.skill))[0];
 const safe=['stop','reduce-load'].includes(report.decision)||comfort;
 return {...report,issues,decision:comfort?'stop':safe?report.decision:candidate?'temporary-focus':issues.length?'investigate':'balanced',focus:safe?null:candidate?.skill??null,focusProtocol:safe?null:candidate?.protocol??null,focusContext:safe?null:candidate?.context??null,plan:safe?[]:plan(candidate?.skill),review:comfort?{...report.review,wellbeing:{decision:'stop',action:'Stop throwing if uncomfortable or painful; seek qualified advice for persistent or significant pain.'}}:report.review};
}
