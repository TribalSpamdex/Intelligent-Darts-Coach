import test from 'node:test';
import assert from 'node:assert/strict';
import {coachBrief,briefLines} from '../site/proactive-coach.mjs';
import {newMemory} from '../site/coach-memory.mjs';
import {delayedFollowups} from '../site/training-outcomes.mjs';
import {recordSetting} from '../site/challenge-setting.mjs';
import {legFromInput} from '../site/match-statistics.mjs';
import {stageProfiles,stageTransfer,competitionProgress,competitionProgressLines} from '../site/match-stages.mjs';
import {integratedAsk,QUESTIONS} from '../site/integrated-dialogue.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const host={games:[],sessions:[],assessmentHistory:[],bigSingles:[]};
const scope={skill:'doubles',context:'practice',protocol:'IDC precision fixed doubles'};
const report={decision:'balanced',verification:{status:'passed'},strategy:{agenda:{questions:[{id:'protocol',scope,text:'Same conditions?',answers:['yes','no','unknown'],why:'Comparability'}]}},active:{mode:'balanced-until-accepted'}};
test('a supported existing adjustment precedes optional new diagnostic questions',()=>{
 const s=newMemory().state;s.interventions.push({id:'i',...scope,status:'accepted',proposedDay:ago(3),responseDay:ago(2),reviewAfterDays:14});
 const b=coachBrief(host,s,{...report,active:{mode:'accepted-temporary-focus',intervention:'i'}},[],[],day,now);
 assert.ok(['active','intervention-review'].includes(b.kind));assert.equal(b.question,undefined);assert.ok(b.basis);assert.ok(briefLines(b).includes(b.basis));
});
test('explicit stop cannot be obscured by diagnostic questions or balanced practice',()=>{
 const b=coachBrief(host,newMemory().state,{...report,decision:'stop'},[],[],day,now);
 assert.equal(b.kind,'wellbeing');assert.equal(b.question,undefined);
});
test('question evidence wording and answer suppression remain nonmutating',()=>{
 const s=newMemory().state,b=coachBrief(host,s,report,[],[],day,now);assert.equal(b.kind,'question');assert.match(b.basis,/optional/);
 s.answers.push({...scope,question:'protocol',answer:'unknown',day});const saved=JSON.stringify(s);
 assert.notEqual(coachBrief(host,s,report,[],[],day,now).kind,'question');assert.equal(JSON.stringify(s),saved);
});
const setting=recordSetting({name:'Scoring Survival',tier:4,target:60,lives:3},{name:'Scoring Survival',tier:4,target:60,lives:3}).learningSetting;
const episode=delta=>({skill:'scoring',protocol:'IDC precision fixed scoring',setting,from:ago(20),to:ago(17),baseline:60,after:60+delta,delta,measurementIds:['before','after']});
const obs=(value,id='follow')=>({id,day:ago(6),skill:'scoring',context:'practice',protocol:'IDC precision fixed scoring',attempts:30,hits:value*10});
test('initial decline is reviewed instead of disappearing from delayed learning',()=>{
 const e=episode(-7),s={observations:[obs(52)]};assert.equal(delayedFollowups([e],s,host,day)[0].status,'decline-still-observed');
 assert.equal(delayedFollowups([e],{observations:[obs(61)]},host,day)[0].status,'decline-no-longer-clear');
 assert.equal(delayedFollowups([e],{observations:[obs(65)]},host,day)[0].status,'later-improvement-observed');
});
test('flat initial response may stay flat or change later, but never implies retention of a gain',()=>{
 for(const [value,status] of [[60,'no-clear-later-change'],[55,'later-decline-observed'],[65,'later-improvement-observed']])
 assert.equal(delayedFollowups([episode(0)],{observations:[obs(value)]},host,day)[0].status,status);
});
test('no duplicate follow-up benchmark or confounded unsuccessful exposure',()=>{
 const e=episode(0);assert.equal(delayedFollowups([e,{...e}],{observations:[obs(60)]},host,day).length,1);
 assert.equal(delayedFollowups([e],{observations:[obs(60)],readiness:[{day:ago(10),context:'practice',pain:true}]},host,day).length,0);
});
const leg=(id,date,visits,extra={})=>legFromInput({id,day:date,start:301,doubleIn:false,context:'competition',result:'won',visits,...extra},day).leg;
const slow='S1 S1 S1\nT20 T20 T20\nT20 S8 50';
const quick='T20 T20 T20\nT20 S11 50';
test('first-nine and next scoring visit use actual within-leg opportunities',()=>{
 const r=stageProfiles([leg('a',day,slow),leg('b',day,quick)],day).profiles[0].windows[0];
 assert.equal(r.firstNine.legs,1);assert.equal(r.firstNine.darts,9);assert.equal(r.firstNine.points,301);assert.equal(r.recovery.opportunities,1);assert.equal(r.recovery.average,180);
});
test('no recovery across legs or into checkout stage',()=>{
 const r=stageProfiles([leg('a',day,'S1 S1 S1',{result:'lost'}),leg('b',day,quick)],day).profiles[0].windows[0];assert.equal(r.recovery.opportunities,0);assert.equal(r.recovery.average,null);
});
test('competition progress uses disjoint dates and never substitutes practice',()=>{
 const rows=[leg('old',ago(28),slow),leg('new',ago(27),quick),leg('today',day,quick),leg('practice',day,slow,{context:'practice'}),leg('too-old',ago(56),slow)];
 const r=competitionProgress(stageProfiles(rows,day),day).find(x=>x.metric==='scoring-stage average');
 assert.equal(r.earlier.from,ago(55));assert.equal(r.earlier.to,ago(28));assert.equal(r.recent.from,ago(27));assert.equal(r.recent.to,day);
 assert.equal(r.earlier.days,1);assert.equal(r.earlier.opportunities,6);assert.equal(r.recent.days,2);assert.equal(r.recent.opportunities,6);
 assert.equal(r.difference,88.5);assert.equal(r.status,'limited');assert.match(competitionProgressLines([r]).at(-1),/does not establish a training effect/);
});
test('missing match windows and unknown opportunities remain null rather than zero',()=>{
 const rows=competitionProgress(stageProfiles([leg('new',day,quick)],day),day);
 assert.ok(rows.every(r=>r.difference===null&&r.status==='missing-window'));
 assert.equal(rows.find(r=>r.metric==='first-nine average').recent.value,null);
 assert.deepEqual(competitionProgress(stageProfiles([leg('p',day,quick,{context:'practice'})],day),day),[]);
});
test('new competition question uses existing local dialogue and preserves memory',()=>{
 const s=newMemory().state;s.legs=[leg('new',day,quick)];const before=JSON.stringify(s);
 const q='Is my real match performance improving?';assert.ok(QUESTIONS.includes(q));
 const r=integratedAsk(host,s,q,day,now);assert.equal(r.type,'competition-progress');assert.equal(JSON.stringify(s),before);
});
