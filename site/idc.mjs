import {coachBrief,briefLines} from './proactive-coach.mjs';
import {AUTONOMY_QUESTIONS} from './autonomy-dialogue.mjs';
import {INTELLIGENCE_QUESTIONS} from './coaching-intelligence.mjs';
import {developmentAgenda,agendaLines} from './development-review.mjs';
import {createPrecisionAdapter} from './precision-adapter.mjs';
import {milestoneCards,progressionAnswer,progressHighlights} from './progression-dialogue.mjs';
import {CHECKS,makeCheck} from './precision-checks.mjs';
import {makeTargetSample} from './manual-target-samples.mjs';
import {REGIONS,targetSummaries} from './engine/target-evidence.mjs';
import {snapshotView,PERIODS} from './statistics-view.mjs';
import {legFromInput} from './match-statistics.mjs';
import {contextualQuestions} from './contextual-questions.mjs';
import {questionFor,label as reflectionLabel,key as reflectionKey,reflectionInsights} from './reflections.mjs';
import {demo} from './bridge.mjs';
import {integratedAsk,QUESTIONS} from './integrated-dialogue.mjs';
import {projectTargets,targetProfile} from './host-targets.mjs';
import {gameProfile} from './game-profile.mjs';
import {goalProgress} from './engine/goals.mjs';
import {explainReport} from './engine/explanation.mjs';
import {DOMAINS,OBSERVATIONS,CONDITIONS,METHODS} from './engine/clinic.mjs';
import {SETUP_FIELDS} from './engine/equipment-profile.mjs';
import {assess,assemble,changeMemory,memorySummary,compareSetups,interventionReview,previewRetention,validateMemory,recordReflection,removeReflection} from './coach-memory.mjs';
import {decideTransfer,applyTransfer} from './coach-policy.mjs';
import {chooseLearnedMethod} from './personal-programme.mjs';
import {measuredGamePreferences} from './engine/session-intelligence.mjs';
import {competitionSchedulePolicy} from './competition-calendar.mjs';
const $=id=>document.getElementById(id);
const host=window.IDCTrainingBridge;
// Display labels only; protocol identities and stored evidence stay exact.
const publicLabel=s=>String(s).replace(/([·:]\s*)tier\s*(?:[1-7]|unspecified)\b/gi,'$1separate setting');
const el=(tag,s)=>{const e=document.createElement(tag);if(s!==undefined)e.textContent=publicLabel(s);return e};
const line=(p,s)=>p.append(el('p',s));
const button=(p,s,fn)=>{const b=el('button',s);b.type='button';b.onclick=fn;p.append(b);return b};
const select=(node,items)=>{const old=node.value;node.replaceChildren();for(const item of items){const [v,t]=Array.isArray(item)?item:[item,item];const o=el('option',t);o.value=v;node.append(o)}if([...node.options].some(o=>o.value===old))node.value=old};
const data=()=>({host:host.snapshot(),raw:host.memory(),day:host.day()});
// A dismissal is UI preference only, never an answer or player observation.
let skippedBriefDay=null;
function briefSkipped(day){try{return skippedBriefDay===day||localStorage.getItem('IDC:brief-dismissed-day')===day}catch{return skippedBriefDay===day}}
function dismissBrief(day){skippedBriefDay=day;try{localStorage.setItem('IDC:brief-dismissed-day',day)}catch{}}

window.IDCPrecision=createPrecisionAdapter(()=>{const d=data();return {...d,now:Date.now(),state:validateMemory(d.raw).state}},(name,day,now)=>host.precisionHistory(name,day,now));
host.installCalibration(window.IDCPrecision.calibrationChoices(),window.IDCPrecision.legacyPrecisionChoices());
function run(id,fn){const p=$(id);p.replaceChildren();try{fn(p)}catch(e){line(p,'Coach unavailable: '+e.message+' Existing training is unchanged.')}}
function mutate(type,payload){const x=data();const next=changeMemory(x.host,x.raw,x.day,type,payload);host.writeMemory(next,JSON.stringify(x.raw));refresh();$('idcReport').replaceChildren();$('idcAnswer').replaceChildren();line($('idcMemoryStatus'),'Saved locally.');return next}
function action(type,payload,after){try{mutate(type,payload);if(after)after()}catch(e){line($('idcMemoryStatus'),e.message);line($('idcReport'),e.message)}}
function render(report,p){line(p,'Decision: '+report.decision+(report.focus?' • '+report.focus:''));line(p,report.reason||'');line(p,'Verification: '+report.verification.status);if(report.nextQuestion)line(p,'Next question: '+report.nextQuestion.text);for(const i of report.issues.slice(0,3))line(p,i.title+': '+i.summary+' '+i.followUp)}
function reviewReal(){refresh();run('idcReport',p=>{const d=data(),x=assess(d.host,d.raw,d.day),report=x.report,readable=explainReport(report,x.state),legacy=host.legacyDecision();line(p,'Eligible measurements: '+x.evidence.observations.length+' • Exclusions: '+x.evidence.skipped.length);const coachingBrief=coachBrief(d.host,x.state,report,x.memory.events,x.memory.reflections,d.day);render({...report,...readable,nextQuestion:!host.active()&&!briefSkipped(d.day)&&coachingBrief.question?{text:coachingBrief.detail}:null},p);if(readable.wellbeing)line(p,readable.wellbeing);try{const agenda=developmentAgenda(d.host,x.state,d.day,{report,now:Date.now()});p.append(el('h3','Current development priorities'));for(const t of agendaLines(agenda,3))line(p,t)}catch{line(p,'Additional development analysis unavailable; existing coaching review remains authoritative.');}line(p,'Existing planner: '+(legacy.mastery?legacy.mastery.category+' mastery, '+legacy.mastery.minutes+' minutes':'No mastery intervention'));line(p,legacy.reason);for(const concern of x.reflectionReview.repeated)line(p,'Player-reported concern across '+concern.days+' days: '+reflectionLabel(concern.topic)+'. '+concern.question);line(p,'Classified training time: '+x.practice.exposure.reduce((n,e)=>n+e.minutes,0)+' recorded minutes; mixed or unlogged practice is not assumed.');for(const q of x.questionableOutcomes)line(p,'Previous '+q.skill+' coaching outcome requires verification ('+q.reason+'). Do not automatically repeat that adjustment.');
 line(p,'Active policy: '+report.active.mode+'. No automatic technique change.');
 const q=coachingBrief.question;if(q&&!host.active()&&!briefSkipped(d.day)){const box=el('div');const answers=el('div');answers.className='idc-answers';box.append(answers);for(const answer of q.answers)button(answers,answer,()=>{if(host.active()||briefSkipped(d.day))return;const fresh=data(),a=assess(fresh.host,fresh.raw,fresh.day),next=coachBrief(fresh.host,a.state,a.report,a.memory.events,a.memory.reflections,fresh.day);if(fresh.day!==d.day||JSON.stringify(next.question)!==JSON.stringify(q)){reviewReal();return}action('answer',{...q.scope,day:d.day,question:q.id,answer},reviewReal)});p.append(box)}
 const open=x.state.interventions.find(i=>['proposed','accepted'].includes(i.status));
 if(open){line(p,open.skill+' intervention: '+open.status);if(x.edited.includes(open.id))line(p,'Original baseline changed. This intervention cannot alter training.');if(open.status==='proposed'&&!x.edited.includes(open.id))button(p,'Accept five-minute adjustment',()=>{if(confirm('Allow at most one five-minute transfer on a scheduled training day when both coaching policies allow it?'))action('respond',{id:open.id,decision:'accepted'},reviewReal)});button(p,'Cancel / decline intervention',()=>{if(confirm('Cancel this intervention?'))action('cancel',{id:open.id},reviewReal)});
 if(open.status==='accepted'){const label=el('label','Adherence (% of agreed sessions) '),n=el('input');n.type='number';n.min='0';n.max='100';n.placeholder='0–100';label.append(n);p.append(label);const c=el('input');c.type='checkbox';const cl=el('label','Other changes affected results ');cl.append(c);p.append(cl);const get=()=>{if(n.value.trim()===''||!Number.isFinite(Number(n.value))||Number(n.value)<0||Number(n.value)>100)throw Error('Enter actual adherence from 0 to 100');return {id:open.id,adherence:Number(n.value)/100,confounders:c.checked?['Player reported other influential changes']:[]}};button(p,'Review intervention',()=>{try{const o=get(),r=interventionReview(d.host,d.raw,o.id,d.day,o.adherence,o.confounders);line(p,'Outcome: '+r.status)}catch(e){line(p,e.message)}});button(p,'Save reviewed outcome',()=>{try{const o=get();if(confirm('Save this outcome?'))action('finish',o,reviewReal)}catch(e){line(p,e.message)}})}
 }else if(report.decision==='temporary-focus'&&report.verification.status==='passed'&&['scoring','doubles','checkout','bull'].includes(report.focus)){button(p,'Save focus proposal',()=>action('propose',{id:crypto.randomUUID()},reviewReal))}
 line(p,'Independent focus is optional. It never adds session time or overrides a competing legacy intervention.');})}
$('idcReview').onclick=reviewReal;
$('idcExample').onclick=()=>{refresh();run('idcReport',p=>{line(p,'SIMULATION ONLY — independent engine demonstration, not a comparison of real player data.');render(demo(),p)})};
$('idcAsk').onclick=()=>{refresh();run('idcAnswer',p=>{const d=data(),{state}=assemble(d.host,d.raw,d.day);const a=integratedAsk(d.host,state,$('idcQuestion').value,d.day,Date.now(),memorySummary(d.raw).targetChecks,memorySummary(d.raw).reflections,validateMemory(d.raw).baselines,validateMemory(d.raw).events);if((a.type==='training'&&a.request?.payload?.number===1||a.type==='session-preview')&&window.IDCPolicy?.mayStart()===true){const native=host.nativePlanPreview();if(native.status==='assessment-required'){line(p,'Complete the assessment or choose Quick Start before generating the native session.');return}line(p,native.status==='locked'?'Current locked native session.':'Proposed native session. Final timed allocation is locked after the warm-up and benchmark; an eligible trial or adjustment may change the initial selection.');for(const e of native.segments)line(p,(e.minutes===null?'Fixed benchmark':e.minutes+' min')+' · '+e.name);return}for(const s of a.lines??[a.reason])line(p,s);if(a.type==='training')line(p,'Readiness and the native training schedule remain authoritative.')})};
const deepQuestions=new Set([...INTELLIGENCE_QUESTIONS,'Model checkout 81 with 2 darts','Recovery from 81 after S19']);for(const q of QUESTIONS)button($(AUTONOMY_QUESTIONS.includes(q)?'idcAutonomyQuestions':deepQuestions.has(q)?'idcDeepQuestions':'idcExamples'),q,()=>{$('idcQuestion').value=q;$('idcAsk').click();$('idcAnswer').scrollIntoView({block:'nearest'})});
$('idcTargetReview').onclick=()=>{refresh();run('idcTargetsResult',p=>{const d=data(),raw=projectTargets(d.host,d.day,Date.now(),memorySummary(d.raw).targetChecks),x=targetProfile(raw.rows);line(p,raw.rows.length+' target-day records • '+raw.conflicts+' conflicting identities excluded');line(p,'Supported stronger doubles: '+(x.strong.map(o=>o.target).join(', ')||'Not established'));line(p,'Supported weaker doubles: '+(x.weak.map(o=>o.target).join(', ')||'Not established'));let last='';for(const g of x.groups){if(last!==g.protocol){p.append(el('h3',g.protocol));last=g.protocol}line(p,g.target+' · '+g.hits+'/'+g.attempts+' · '+(100*g.rate).toFixed(1)+'% · '+g.days+' days · '+g.status)}line(p,raw.limitation);line(p,x.limitation)})};
$('idcGameReview').onclick=()=>{refresh();run('idcTargetsResult',p=>{const d=data(),x=gameProfile(d.host,d.day),s=x.scoring;p.append(el('h3','Fixed scoring rounds'));line(p,s.visits?s.visits+' visits • '+s.average.toFixed(1)+' average • '+s.hundreds+' visits of 100+ • '+s.lowVisits+' below 40':'No comparable scoring rounds recorded');p.append(el('h3','Checkout-score results'));for(const g of x.checkout)line(p,g.score+' · '+g.hits+'/'+g.attempts+' · '+g.days+' days · '+g.protocol);line(p,x.limitation)})};
const statsType=$('idcStatsType'),statsPeriod=$('idcStatsPeriod'),statsFilter=$('idcStatsFilter');
function updateStatsControls(){
 const t=statsType.value,periods=PERIODS[t]??[],filterable=['Detailed skill statistics','Detailed target statistics','Detailed checkout statistics','Actual miss patterns','Manual practice miss patterns','Weekly statistics'].includes(t);
 statsPeriod.disabled=!periods.length;for(const o of statsPeriod.options)o.disabled=periods.length>0&&!periods.includes(Number(o.value));
 if(periods.length&&!periods.includes(Number(statsPeriod.value)))statsPeriod.value=String(periods.includes(28)?28:periods[0]);
 statsFilter.disabled=!filterable;if(!filterable)statsFilter.value='';
}
function renderStatsCards(p,r){
 if(!r.cards.length)line(p,'No eligible recorded measurements for this selection.');
 for(const c of r.cards){const box=el('section');box.className='idc-stat-card';box.append(el('h3',c.title));const grid=el('div');grid.className='idc-stat-metrics';for(const m of c.metrics){const item=el('div');item.className='idc-stat-metric';item.append(el('small',m.label),el('strong',m.value));grid.append(item)}box.append(grid);
 for(const d of c.detail)line(box,d);
 for(const b of c.bars){const label=el('div');label.className='idc-stat-bar-label';label.append(el('span',b.label),el('span',b.value+' / '+b.total));const bar=el('div');bar.className='idc-stat-bar';bar.setAttribute('aria-hidden','true');const fill=el('span');fill.style.width=(b.total?100*b.value/b.total:0)+'%';bar.append(fill);box.append(label,bar)}
 p.append(box)}
 if(r.total>r.cards.length)line(p,'Showing '+r.cards.length+' of '+r.total+' profiles. Use the filter to narrow the selection.');
 line(p,r.note);
}
statsType.onchange=()=>{updateStatsControls();$('idcStatsResult').replaceChildren()};
statsPeriod.onchange=()=>{$('idcStatsResult').replaceChildren()};
statsFilter.oninput=()=>{$('idcStatsResult').replaceChildren()};
updateStatsControls();
$('idcStatsReview').onclick=()=>{refresh();run('idcStatsResult',p=>{const d=data(),x=assemble(d.host,d.raw,d.day),checks=x.memory.targetChecks,t=statsType.value,f=statsFilter.disabled?'':statsFilter.value.trim();if(PERIODS[t])renderStatsCards(p,snapshotView(d.host,x.state,t,f,Number(statsPeriod.value),d.day,Date.now(),checks));else{const r=integratedAsk(d.host,x.state,t+(f?' '+f:''),d.day,Date.now(),checks,x.memory.reflections,x.memory.baselines,x.memory.events);for(const v of r.lines??[r.reason])line(p,v)}})};
const legForm=$('idcLegForm'),legPreview=$('idcLegPreview');
legForm.elements.day.value=host.day();legForm.elements.day.max=host.day();
legForm.oninput=()=>legPreview.replaceChildren();
legForm.onsubmit=e=>{e.preventDefault();legPreview.replaceChildren();try{
 const d=Object.fromEntries(new FormData(legForm)),payload={...d,id:crypto.randomUUID(),doubleIn:legForm.elements.doubleIn.checked};
 const a=legFromInput(payload,host.day());line(legPreview,'Validated: '+a.thrown+' darts, '+a.points+' credited points, '+a.average.toFixed(1)+' average, '+a.remaining+' remaining.');
  line(legPreview,a.firstNineDarts===9?'First-nine average: '+a.firstNine.toFixed(1)+' (nine actual darts).':'First-nine benchmark unavailable: fewer than nine darts in the first three visits.');
  if(a.finishAttempts)line(legPreview,a.finishHits+'/'+a.finishAttempts+' explicitly aimed finishing doubles'+(a.unknownIntent?' (partial aim log; not a complete-leg accuracy sample).':'.'));
 line(legPreview,a.checkoutWins+'/'+a.checkoutVisits+' checkout visits; '+a.unknownIntent+' unknown aims. Review the entries before saving.');
 button(legPreview,'Save this actual leg',()=>{try{if(!confirm('Save this recorded leg locally?'))return;mutate('leg',payload);legForm.elements.visits.value='';legPreview.replaceChildren();line(legPreview,'Leg saved locally.')}catch(e){line(legPreview,e.message)}});
 }catch(e){line(legPreview,e.message)}};
const sampleForm=$('idcSampleForm'),samplePreview=$('idcSamplePreview');
select($('idcSampleAim'),REGIONS.filter(r=>r!=='MISS'));$('idcSampleAim').value='D16';
sampleForm.oninput=()=>samplePreview.replaceChildren();
sampleForm.onsubmit=e=>{e.preventDefault();samplePreview.replaceChildren();try{
 const payload={...Object.fromEntries(new FormData(sampleForm)),id:crypto.randomUUID(),day:host.day()},rows=makeTargetSample(payload,host.day()),r=targetSummaries(rows)[0];
 line(samplePreview,r.aim+': '+r.hits+'/20 exact hits. '+Object.entries(r.directions).map(([k,v])=>k+' '+v).join(' · '));
 button(samplePreview,'Save this practice sample',()=>{try{if(!confirm('Save this fixed target sample locally?'))return;mutate('target-sample',payload);sampleForm.elements.actual.value='';samplePreview.replaceChildren();line(samplePreview,'Sample saved locally.')}catch(e){line(samplePreview,e.message)}});
 }catch(e){line(samplePreview,e.message)}};
const checkForm=$('idcPrecisionCheckForm'),checkSkill=$('idcPrecisionCheckSkill'),checkStatus=$('idcPrecisionCheckStatus');
select(checkSkill,Object.keys(CHECKS));function updateCheck(){const c=CHECKS[checkSkill.value];$('idcPrecisionCheckRules').textContent=c.instructions;checkForm.elements.hits.max=c.max;checkForm.elements.hits.value='';checkForm.elements.complete.checked=false;checkStatus.replaceChildren()}
checkSkill.onchange=updateCheck;updateCheck();
checkForm.onsubmit=e=>{e.preventDefault();checkStatus.replaceChildren();try{if(!checkForm.elements.complete.checked||checkForm.elements.hits.value==='')throw Error('Complete the full check and enter its measured result');const payload={skill:checkSkill.value,hits:Number(checkForm.elements.hits.value)};const o=makeCheck(payload.skill,payload.hits,host.day());if(!confirm('Save this complete measured '+payload.skill+' check?'))return;mutate('precision-check',payload);window.IDCPrecision.invalidate();updateCheck();line(checkStatus,'Saved: '+(o.skill==='scoring'?(o.hits*3/o.attempts).toFixed(1)+' three-dart average':o.hits+'/'+o.attempts+' hits / attempts'))}catch(e){line(checkStatus,e.message)}};
$('idcMilestoneReview').onclick=()=>{refresh();run('idcMilestoneResult',p=>{const d=data(),x=assemble(d.host,d.raw,d.day),cards=milestoneCards(x.state,d.day);renderStatsCards(p,{cards:cards.slice(0,40),total:cards.length,note:'Observed milestone bands are separate from hidden gameplay difficulty.'})})};
$('idcLearningReview').onclick=()=>{refresh();run('idcLearningResult',p=>{const d=data(),x=assemble(d.host,d.raw,d.day),a=progressionAnswer(d.host,x.state,'difficulty learning',d.day);for(const t of a.lines)line(p,t)})};
$('idcChallengeReview').onclick=()=>{refresh();run('idcChallengeResult',p=>{const d=data(),x=assemble(d.host,d.raw,d.day),a=progressionAnswer(d.host,x.state,'challenge progression',d.day);for(const t of a.lines)line(p,t)})};
let briefSignature=null;
function refreshBrief(d,x,signature){
 const nextSignature=d.day+'|'+String(host.active())+'|'+signature;
 if(nextSignature===briefSignature)return;
 briefSignature=nextSignature;
 run('idcBrief',p=>{
  const review=assess(d.host,d.raw,d.day),brief=coachBrief(d.host,x.state,review.report,x.memory.events,x.memory.reflections,d.day);
  p.append(el('h3',brief.question&&briefSkipped(d.day)?'Continue balanced practice':brief.title));line(p,brief.question&&briefSkipped(d.day)?'Optional check skipped for today. Your training and player evidence are unchanged.':brief.detail);
  if(brief.basis&&(!brief.question||!briefSkipped(d.day)))line(p,brief.basis);
  if(brief.why&&!briefSkipped(d.day)){const why=el('details');why.append(el('summary','Why this check?'),el('p',brief.why));p.append(why)}
  if(brief.question&&!host.active()&&!briefSkipped(d.day)){
   const q=brief.question,actions=el('div');actions.className='idc-answers';p.append(actions);
   for(const answer of q.answers)button(actions,answer,()=>{
    try{
     const fresh=data(),a=assess(fresh.host,fresh.raw,fresh.day),next=coachBrief(fresh.host,a.state,a.report,a.memory.events,a.memory.reflections,fresh.day);
     if(host.active()||briefSkipped(d.day)||fresh.day!==d.day||JSON.stringify(next.question)!==JSON.stringify(q))throw Error('Coaching evidence changed; review the current question.');
     mutate('answer',{...q.scope,day:fresh.day,question:q.id,answer});
    }catch(e){line(p,e.message)}
   });
   button(actions,'Skip for today',()=>{if(host.active())return;dismissBrief(d.day);briefSignature=null;refresh();}).className='secondary';
  }
  button(p,'Review coaching evidence',reviewReal).className='secondary';
  line(p,x.memory.learnedMethods?'Personalised drill choice is enabled. The coach may choose one evidence-supported equivalent drill per week, without adding minutes.':'Personalised drill choice is off. The existing planner chooses exercises.');
  if(!host.active())button(p,x.memory.learnedMethods?'Disable personalised drill choice':'Enable personalised drill choice',()=>{const enabled=!x.memory.learnedMethods;if(!enabled||confirm('Allow the coach to choose an equivalent drill from the existing planner when your recorded training evidence supports it? No extra training or automatic technique change. You can turn this off at any time.'))action('learned-methods',{enabled});}).className='secondary';
 });
 const eventList=$('idcEvents');eventList.replaceChildren();
 const eventForm=$('idcEventForm');eventForm.elements.day.min=d.day;
 for(const e of [...x.memory.events].sort((a,b)=>a.day.localeCompare(b.day))){
  line(eventList,e.day+' · '+e.name+' ('+e.kind+')');
  button(eventList,'Remove competition',()=>{if(confirm('Remove this saved competition?')){try{mutate('remove-competition-event',{id:e.id});$('idcEventStatus').textContent='Competition removed.'}catch(err){$('idcEventStatus').textContent=err.message}}});
 }
 if(!x.memory.events.length)line(eventList,'No saved competitions.');
}
let lastEvidence=null;function refresh(){try{const d=data(),x=assemble(d.host,d.raw,d.day),m=memorySummary(d.raw);const signature=JSON.stringify([x.evidence.observations,x.practice.exposure,d.host.sessions,d.host.games,d.host.assessment,d.host.assessmentHistory,d.host.bigSingles,d.raw]);if(lastEvidence!==null&&lastEvidence!==signature){$('idcReport').replaceChildren();$('idcAnswer').replaceChildren();$('idcTargetsResult').replaceChildren();$('idcStatsResult').replaceChildren();$('idcMilestoneResult').replaceChildren();$('idcChallengeResult').replaceChildren();$('idcLearningResult').replaceChildren();window.IDCPrecision.invalidate()}lastEvidence=signature;refreshBrief(d,x,signature);$('idcSync').textContent=x.evidence.observations.length+' eligible saved measurements • '+m.facts.length+' player facts';select($('idcScopes'),[...new Set(x.state.observations.map(o=>JSON.stringify({skill:o.skill,context:o.context,protocol:o.protocol})))].map(v=>{const o=JSON.parse(v);return [v,o.skill+' · '+o.protocol]}));select($('idcGoalScopes'),[...$('idcScopes').options].map(o=>[o.value,o.textContent]));const pair=$('idcPairHistory');pair.replaceChildren();line(pair,m.targetChecks.length+' saved checks');for(const c of m.targetChecks.slice(-10)){line(pair,c.day+' · '+c.first+' '+c.firstHits+'/10 vs '+c.second+' '+c.secondHits+'/10'+(c.comparable?'':' · excluded from comparison'));button(pair,'Remove check',()=>{if(confirm('Remove this check?'))action('remove-target-check',{id:c.id})})}const reflection=$('idcReflectionHistory');reflection.replaceChildren();const review=reflectionInsights(m.reflections,d.host,d.day);line(reflection,review.count+' recent reflections linked to saved training');for(const c of review.repeated)line(reflection,reflectionLabel(c.topic)+' · '+c.days+' days. '+c.question);for(const v of m.reflections.slice(-30).reverse()){line(reflection,v.day+' · '+v.name+' · '+reflectionLabel(v.answer)+(v.note?' · '+v.note:''));button(reflection,'Remove reflection',()=>{try{if(!confirm('Remove this reflection?'))return;const raw=host.memory();host.writeMemory(removeReflection(raw,reflectionKey(v)),JSON.stringify(raw));refresh()}catch(e){line(reflection,e.message)}})}const checks=$('idcPrecisionCheckHistory');checks.replaceChildren();line(checks,m.precisionChecks.length+' saved complete skill checks');for(const o of m.precisionChecks.slice(-20).reverse()){line(checks,o.day+' · '+o.skill+' · '+o.hits+'/'+o.attempts);button(checks,'Remove check',()=>{if(confirm('Remove this recorded skill check?'))action('remove-precision-check',{id:o.id})})}const samples=$('idcSampleHistory');samples.replaceChildren();line(samples,m.manualSamples.length+' saved fixed target samples');for(const t of m.manualSamples.slice(-20).reverse()){line(samples,t.day+' · '+t.aim+' · '+t.hits+'/20');button(samples,'Remove this sample',()=>{if(confirm('Remove this sample and its actual segment measurements?'))action('remove-target-sample',{id:t.id})})}const legs=$('idcLegHistory');legs.replaceChildren();legForm.elements.day.max=d.day;line(legs,m.legs.length+' saved actual legs');for(const l of m.legs.slice(-20).reverse()){line(legs,l.day+' · '+l.start+' · '+l.context+' · '+l.result);button(legs,'Remove this leg',()=>{if(confirm('Remove this actual leg and its derived measurements?'))action('remove-leg',{id:l.id})})}const p=$('idcMemoryHistory');p.replaceChildren(el('h3','Saved coaching memory'));for(const f of m.facts){line(p,f.key+': '+f.value+' ('+f.kind+')');button(p,'Remove '+f.key,()=>{if(confirm('Remove this fact and its history?'))action('remove-fact',{key:f.key})})}for(const o of m.readiness.slice(-7))line(p,o.day+' • fatigue '+o.fatigue+' • pressure '+o.pressure+' • confidence '+o.confidence+(o.pain?' • discomfort reported':''));for(const o of m.clinic.slice(-15)){line(p,o.day+' • '+o.domain+' • '+o.observation);button(p,'Remove observation',()=>{if(confirm('Remove observation?'))action('remove-clinic',{id:o.id})})}for(const o of m.setups.slice(-15)){line(p,o.day+' • '+o.name+' • '+Object.entries(o.values).map(([k,v])=>k+': '+v).join(', '));button(p,'Remove setup',()=>{if(confirm('Remove setup?'))action('remove-setup',{id:o.id})})}if(m.setups.length>=2){const a=el('select'),b=el('select'),items=m.setups.map(o=>[o.id,o.name]);select(a,items);select(b,items);b.selectedIndex=items.length-1;p.append(a,b);button(p,'Compare selected setups',()=>{try{if(a.value===b.value)throw Error('Choose two different setups');const r=compareSetups(host.memory(),a.value,b.value);line(p,r.guidance);line(p,'Changed: '+r.changed.join(', ')+' • Unknown: '+r.unknown.join(', '))}catch(e){line(p,e.message)}})}for(const g of m.goals.filter(g=>g.status==='active')){const progress=goalProgress(x.state,g,d.day);line(p,'Goal: '+g.skill+' · '+(['scoring','firstNine'].includes(g.skill)?g.target:(g.target*100)+'%')+' · '+progress.status+' · review '+g.review);button(p,'Close goal',()=>{if(confirm('Close this goal?'))action('close-goal',{id:g.id})})}for(const i of m.interventions.slice(-15)){
 line(p,i.skill+' • '+i.status+' • '+i.proposedDay+(i.outcome?' • '+i.outcome.status:''));
 if(i.status==='completed'&&i.outcome?.status==='observed-improvement'){
 const result=el('div');p.append(result);
 button(p,'Check retained improvement',()=>{result.replaceChildren();try{const fresh=data(),r=previewRetention(fresh.host,fresh.raw,i.id,fresh.day);line(result,'Retention: '+r.status+(r.daysRemaining?' · '+r.daysRemaining+' days until review':''));if(['observed-retention','retention-not-established','confounded'].includes(r.status))button(result,'Save retention review',()=>{if(confirm('Save this review of your recorded results?'))action('retention',{id:i.id})});}catch(e){line(result,e.message)}});
 }
}}catch(e){$('idcSync').textContent='Coach memory or evidence unavailable: '+e.message+' — original training unchanged.'}}
function form(id,fn){$(id).onsubmit=e=>{e.preventDefault();$('idcMemoryStatus').replaceChildren();try{fn(Object.fromEntries(new FormData(e.currentTarget)),e.currentTarget)}catch(err){line($('idcMemoryStatus'),err.message)}}}
for(const [id,items] of [['idcDomains',DOMAINS],['idcObservations',OBSERVATIONS],['idcConditions',CONDITIONS],['idcMethods',METHODS]])select($(id),items);
for(const name of SETUP_FIELDS){const l=el('label',name+' '),i=el('input');i.name='setup:'+name;i.maxLength=100;l.append(i);$('idcSetupFields').append(l)}
form('idcFact',(d,f)=>{const key=d.key.trim().toLowerCase(),value=d.value.trim();if(!key||!value)throw Error('Enter both fact and value');mutate('fact',{key,value,evidence:'reported'});$('idcFactStatus').textContent='Saved: '+key+' — '+value;f.reset()});
form('idcReady',(d,f)=>mutate('readiness',{day:host.day(),context:'practice',fatigue:d.fatigue,pressure:d.pressure,confidence:d.confidence,pain:f.elements.pain.checked,note:''}));
form('idcClinic',(d,f)=>{if(!d.scope)throw Error('Record a comparable benchmark first');mutate('clinic',{...JSON.parse(d.scope),id:crypto.randomUUID(),day:host.day(),domain:d.domain,observation:d.observation,condition:d.condition,method:d.method,note:d.note,pain:f.elements.pain.checked})});
form('idcSetup',d=>mutate('setup',{id:crypto.randomUUID(),day:host.day(),name:d.name,comfort:d.comfort,values:Object.fromEntries(SETUP_FIELDS.map(k=>[k,d['setup:'+k]?.trim()]).filter(([,v])=>v))}));
const doubleOptions=Array.from({length:20},(_,i)=>'D'+(i+1));select($('idcPairA'),doubleOptions);select($('idcPairB'),doubleOptions);$('idcPairA').value='D16';$('idcPairB').value='D20';
form('idcPair',(d,f)=>{const p=$('idcPairStatus');p.replaceChildren();try{if(d.firstHits===''||d.secondHits==='')throw Error('Enter both hit counts');mutate('target-check',{id:crypto.randomUUID(),day:host.day(),first:d.first,second:d.second,firstHits:Number(d.firstHits),secondHits:Number(d.secondHits),comparable:f.elements.comparable.checked});line(p,'Saved locally.');f.elements.firstHits.value='';f.elements.secondHits.value=''}catch(e){line(p,e.message)}});
form('idcGoal',d=>{if(!d.scope)throw Error('Record a comparable benchmark first');const scope=JSON.parse(d.scope),value=Number(d.target);mutate('goal',{...scope,id:crypto.randomUUID(),start:host.day(),review:d.review,target:['scoring','firstNine'].includes(scope.skill)?value:value/100})});
$('idcEventForm').onsubmit=e=>{e.preventDefault();const form=e.currentTarget,p=$('idcEventStatus');try{mutate('competition-event',{id:crypto.randomUUID(),name:form.elements.name.value,day:form.elements.day.value,kind:form.elements.kind.value});p.textContent='Competition saved locally.';form.elements.name.value='';form.elements.day.value=''}catch(err){p.textContent=err.message}};
let lastBoundary='';
function refreshBoundary(){
 const b=host.boundary(),id=b?.kind==='exercise'?'idcExerciseCheck':'idcSessionCheck';
 for(const name of ['idcExerciseCheck','idcSessionCheck'])if(!b||name!==id){$(name).classList.add('hidden');$(name).replaceChildren()}
 if(!b){lastBoundary='';return}
 const p=$(id);try{
 const raw=host.memory(),history=memorySummary(raw).reflections,q=questionFor(b,history);
 if(q&&!q.saved&&b.kind==='exercise'){
 const past=contextualQuestions(history,host.snapshot(),b)[0];
 if(past){q.question=past.question+' You reported a similar concern on '+past.days+' earlier practice days.';if(!q.choices.includes(past.topic))q.choices.splice(1,0,past.topic);}
 }
 if(!q){p.classList.add('hidden');lastBoundary='';return}
 const signature=JSON.stringify([b,q]);if(signature===lastBoundary&&!p.classList.contains('hidden'))return;
 lastBoundary=signature;p.replaceChildren();p.classList.remove('hidden');p.append(el('h3','Coach check-in'));
 if(q.saved){line(p,q.saved.answer==='skip'?'Check-in skipped.':'Saved: '+reflectionLabel(q.saved.answer));return}
 line(p,q.question);line(p,'Optional. Your answer helps the coach investigate patterns; it does not change your recorded score.');
 const note=el('textarea');note.placeholder='Optional note';note.maxLength=300;note.setAttribute('aria-label','Optional practice note');p.append(note);
 const saveAnswer=answer=>{try{const current=host.boundary();if(JSON.stringify(b)!==JSON.stringify(current))throw Error('Training has moved on');const latest=host.memory();host.writeMemory(recordReflection(latest,current,answer,note.value.trim()),JSON.stringify(latest),current);lastBoundary='';refreshBoundary()}catch(e){line(p,e.message)}};
 for(const answer of q.choices)button(p,reflectionLabel(answer),()=>saveAnswer(answer));
 button(p,'Skip check-in',()=>saveAnswer('skip')).className='secondary';
 }catch(e){p.classList.add('hidden');lastBoundary=''}
}
for(const [caption,fatigue,pressure,confidence,pain] of [['Feeling ready','normal','unknown','unknown',false],['Feeling tired','high','unknown','unknown',false],['Throwing feels uncomfortable or painful','unknown','unknown','unknown',true]]){
 button($('idcPreOptions'),caption,()=>{const p=$('idcPreStatus');try{const d=data(),prior=memorySummary(d.raw).readiness.find(x=>x.day===d.day&&x.context==='practice');mutate('readiness',{day:d.day,context:'practice',fatigue,pressure:prior?.pressure??pressure,confidence:prior?.confidence??confidence,pain,note:prior?.note??''});p.textContent=pain?'Saved. Stop throwing while it is painful. Seek qualified advice for significant or persistent pain.':'Readiness saved. You can continue when comfortable.'}catch(e){p.textContent=e.message}}).className='secondary';
}
let scheduled=false;function queueRefresh(){refreshBoundary();if(scheduled||$('technique').classList.contains('hidden'))return;scheduled=true;setTimeout(()=>{scheduled=false;if(!$('technique').classList.contains('hidden')){refresh()}},150)}
function refreshProgressHighlights(){if($('progress').classList.contains('hidden'))return;run('idcProgressHighlights',p=>{const d=data(),x=assemble(d.host,d.raw,d.day),rows=progressHighlights(x.state,d.day);if(!rows.length)line(p,'Keep recording comparable practice to establish your next confirmed improvement.');for(const r of rows)line(p,r.skill+' · '+r.protocol+' · '+r.context+': '+r.milestone.toFixed(1)+(['scoring','firstNine'].includes(r.skill)?' average':'%')+' milestone supported by '+r.days+' recent measured days.');})}
window.addEventListener('idc-training-saved',queueRefresh);window.addEventListener('idc-view-changed',()=>{queueRefresh();refreshProgressHighlights()});
window.IDCPolicy=Object.freeze({competitionPlan:()=>{const d=data(),x=assess(d.host,d.raw,d.day);return competitionSchedulePolicy(x.state,x.memory.events,d.day,x.report)},preferredDrills:()=>{const d=data();return measuredGamePreferences(assemble(d.host,d.raw,d.day).state.observations,d.day)},methodEnabled:()=>{try{return validateMemory(host.memory()).learnedMethods}catch{return false}},methodChoice:(options,policy)=>{try{if(!Array.isArray(options)||!options.length)return {status:'unchanged',reason:'No eligible candidates'};const d=data();if(!validateMemory(d.raw).learnedMethods)return {status:'unchanged',reason:'Player has not enabled learned method selection'};return chooseLearnedMethod(d.host,assess(d.host,d.raw,d.day),options,policy,d.day)}catch{return {status:'unchanged',reason:'Independent method evidence unavailable'}}},validateMemory:raw=>validateMemory(raw),mayStart:()=>{try{const d=data();if(d.raw==null)return true;const report=assess(d.host,d.raw,d.day).report;return report.verification?.status==='passed'&&!['stop','reduce-load'].includes(report.decision)}catch{return false}},transfer:(session,queue,legacyTransfer,legacyPolicy)=>{const d=data();if(!d.raw)return {status:'unchanged',reason:'No independent player memory'};const x=assess(d.host,d.raw,d.day),decision=decideTransfer({...x,session,queue,legacyTransfer,legacyPolicy,priorSessions:d.host.sessions,day:d.day});applyTransfer(queue,decision);return decision}});
refresh();
