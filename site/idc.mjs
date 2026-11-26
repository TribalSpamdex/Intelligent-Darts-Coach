import {snapshotForCoach,compareCoaches,demo} from './bridge.mjs';
import {ask} from './engine/coach-dialogue.mjs';
const $=id=>document.getElementById(id);
const line=(p,s)=>{const e=document.createElement('p');e.textContent=s;p.append(e)};
function render(report,p){line(p,'Decision: '+report.decision+(report.focus?' • '+report.focus:''));line(p,report.reason||'');line(p,'Verification: '+report.verification.status);if(report.nextQuestion)line(p,'Next question: '+report.nextQuestion.text);for(const i of report.issues.slice(0,3))line(p,i.title+': '+i.summary+' '+i.followUp)}
function run(id,fn){const p=$(id);p.replaceChildren();try{fn(p)}catch(e){line(p,'Coach unavailable: '+e.message+' Existing training is unchanged.')}}
$('idcReview').onclick=()=>run('idcReport',p=>{const host=window.IDCTrainingBridge, x=compareCoaches(host.snapshot(),host.legacyDecision(),host.day());line(p,'Eligible measurements: '+x.evidence.observations.length+' • Exclusions: '+x.evidence.skipped.length);render(x.report,p);line(p,'Existing planner: '+(x.legacy.mastery?x.legacy.mastery.category+' mastery, '+x.legacy.mastery.minutes+' minutes':'No mastery intervention'));line(p,x.legacy.reason);line(p,'Comparison only: no training or memory changed.')});
$('idcExample').onclick=()=>run('idcReport',p=>{line(p,'SIMULATION ONLY — independent engine demonstration, not a comparison of real player data.');render(demo(),p)});
$('idcAsk').onclick=()=>run('idcAnswer',p=>{const host=window.IDCTrainingBridge,{state}=snapshotForCoach(host.snapshot(),host.day());const a=ask(state,$('idcQuestion').value,host.day());for(const s of a.lines??[a.reason])line(p,s)});
