import test from 'node:test';
import assert from 'node:assert/strict';
import {coachBrief} from '../site/proactive-coach.mjs';
import {planPreview,blockPreview,planLines,personalLearning,longProgramme,longProgrammeLines} from '../site/personal-programme.mjs';
import {addEvent} from '../site/competition-calendar.mjs';
import {newMemory} from '../site/coach-memory.mjs';
import {integratedAsk,QUESTIONS} from '../site/integrated-dialogue.mjs';
import {AUTONOMY_QUESTIONS} from '../site/autonomy-dialogue.mjs';
import {decideTransfer} from '../site/coach-policy.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),shift=n=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
const host={games:[],sessions:[],assessmentHistory:[],bigSingles:[]};
const state=()=>newMemory().state;
const scope={skill:'doubles',context:'practice',protocol:'IDC precision fixed doubles'};
const q={id:'protocol',scope,text:'Were conditions the same?',answers:['yes','no','unknown'],why:'Comparability matters.'};
const report=(extra={})=>({decision:'balanced',verification:{status:'passed'},strategy:{agenda:{questions:[q]}},active:{mode:'balanced-until-accepted'},...extra});
const events=n=>addEvent([],{id:'e',day:shift(n),name:'League night',kind:'league'},day);
test('proactive brief asks one relevant question and never edits player evidence',()=>{
 const s=state(),before=JSON.stringify(s),b=coachBrief(host,s,report(),[],[],day,now);
 assert.equal(b.kind,'question');assert.equal(b.question.id,'protocol');assert.equal(JSON.stringify(s),before);
 s.answers.push({...scope,question:'protocol',answer:'unknown',day});
 assert.notEqual(coachBrief(host,s,report(),[],[],day,now).kind,'question');
 s.answers[0].day=shift(-6);assert.notEqual(coachBrief(host,s,report(),[],[],day,now).kind,'question');
 s.answers[0].day=shift(-7);assert.equal(coachBrief(host,s,report(),[],[],day,now).kind,'question');
});
test('safety and existing adjustment review precede competition and new questions',()=>{
 const s=state();s.readiness.push({day,context:'practice',pain:true});
 assert.equal(coachBrief(host,s,report(),events(0),[],day,now).kind,'wellbeing');
 s.readiness=[];s.interventions.push({id:'i',...scope,status:'accepted',proposedDay:shift(-16),responseDay:shift(-15),reviewAfterDays:14});
 assert.equal(coachBrief(host,s,report(),events(0),[],day,now).kind,'intervention-review');
 s.interventions=[];assert.equal(coachBrief(host,s,report(),events(0),[],day,now).kind,'competition');
});
test('unverified coaching decisions cannot trigger diagnostic questions or a new focus',()=>{
 const s=state(),r=report({decision:'temporary-focus',verification:{status:'failed'}});
 assert.equal(coachBrief(host,s,r,[],[],day,now).kind,'balanced');
});
test('session preview preserves 60 minutes, warmup and application and does not change memory',()=>{
 const s=state(),before=JSON.stringify(s),p=planPreview(host,s,report(),[],day,now);
 assert.equal(p.segments.reduce((n,x)=>n+x.minutes,0),60);
 assert.equal(p.segments[0].minutes,10);assert.equal(p.segments.at(-1).minutes,10);
 assert.ok(p.segments.every(x=>x.minutes>=5));assert.equal(p.focus,null);
 assert.equal(JSON.stringify(s),before);assert.ok(planLines(p)[0].includes('preview only'));
 assert.equal(blockPreview(host,s,report(),[],day,now).weeks.length,4);
});
test('accepted focus preview reallocates only five minutes, with event, safety and expiry vetoes',()=>{
 const s=state();s.interventions.push({id:'i',...scope,status:'accepted',proposedDay:shift(-3),responseDay:shift(-2),reviewAfterDays:14});
 const r=report({active:{mode:'accepted-temporary-focus',intervention:'i'}});
 let p=planPreview(host,s,r,[],day,now);
 assert.equal(p.focus,'doubles');assert.equal(p.segments.find(x=>x.skill==='doubles').minutes,15);
 assert.equal(p.segments.reduce((n,x)=>n+x.minutes,0),60);assert.ok(p.segments.every(x=>x.minutes>=5));
 assert.equal(planPreview(host,s,r,events(1),day,now).focus,null);
 assert.equal(planPreview(host,s,r,events(0),day,now).segments.length,0);
 assert.equal(planPreview(host,s,{...r,active:{mode:'baseline-edited'}},[],day,now).focus,null);
 s.interventions[0].responseDay=shift(-14);assert.equal(planPreview(host,s,r,[],day,now).focus,null);
 s.readiness.push({day,context:'practice',fatigue:'high'});assert.equal(planPreview(host,s,r,[],day,now).segments.length,0);
});
test('all integrated autonomy queries work on empty validated state and do not mutate evidence',()=>{
 const s=state(),before=JSON.stringify(s);
 for(const q of AUTONOMY_QUESTIONS){assert.ok(QUESTIONS.includes(q));const a=integratedAsk(host,s,q,day,now);assert.equal(a.kind,'answer',q);assert.ok(a.lines.every(x=>typeof x==='string'),q)}
 assert.equal(JSON.stringify(s),before);assert.deepEqual(personalLearning(host,s,day,now),[]);
});
test('near-event gate defers only an optional independent transfer',()=>{
 const memory=newMemory();memory.events=events(2);
 const d=decideTransfer({report:report(),memory,day});
 assert.equal(d.status,'unchanged');assert.ok(d.reason.includes('competition'));
});

test('four and twelve week previews include known events without future knowledge or invented training',()=>{
 const s=state(),before=JSON.stringify(s);
 const es=[...events(8),{id:'future',day:shift(17),recordedDay:shift(1),name:'Unknown today',kind:'league'}];
 const b=blockPreview(host,s,report(),es,day,now);
 assert.equal(b.weeks[0].start,day);assert.equal(b.weeks[3].end,shift(27));
 assert.ok(b.weeks[0].competitions.some(e=>e.id==='e'));assert.ok(b.weeks[1].competitions.some(e=>e.id==='e'));
 assert.ok(!b.weeks.flatMap(w=>w.competitions).some(e=>e.id==='future'));
 const l=longProgramme(host,s,report(),es,day,now);
 assert.equal(l.later.length,8);assert.equal(l.later.at(-1).end,shift(83));assert.equal(l.phases.length,3);
 assert.ok(longProgrammeLines(l).at(-1).includes('conditional'));
 assert.equal(JSON.stringify(s),before);
});
test('programme reviews accepted intervention dates and honours current safety',()=>{
 const s=state();s.interventions.push({id:'i',...scope,status:'accepted',proposedDay:shift(-3),responseDay:shift(-2),reviewAfterDays:14});
 const b=blockPreview(host,s,report(),[],day,now);assert.ok(b.weeks[1].reviews.some(r=>r.day===shift(12)));
 s.readiness.push({day,context:'practice',pain:true});
 const stopped=blockPreview(host,s,report(),events(1),day,now);
 assert.equal(stopped.session.status,'wellbeing');assert.ok(stopped.weeks.every(w=>w.action.includes('readiness')));
});
