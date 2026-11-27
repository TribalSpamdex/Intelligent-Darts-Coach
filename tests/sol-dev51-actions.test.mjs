import test from 'node:test';
import assert from 'node:assert/strict';
import {fixedQuickScoringGate} from '../site/precision-adapter.mjs';
import {targetDevelopment,targetDevelopmentLines,contextualDrillPreferences} from '../site/host-targets.mjs';
import {newMemory,assess} from '../site/coach-memory.mjs';
import {integratedAsk} from '../site/integrated-dialogue.mjs';
import {coachBrief} from '../site/proactive-coach.mjs';
import {projectExposure} from '../site/host-exposure.mjs';
const day='2026-11-27',now=Date.parse(day+'T12:00Z'),ms=86400000,state=newMemory().state;
function fixed(ages=[0,1,7,8,14,15,21,22],score=90){
 const h={games:[],sessions:[],bigSingles:[]};for(const age of ages){const at=now-age*ms-1000,d=new Date(at).toISOString().slice(0,10),id='fixed-'+age;h.sessions.push({id,quick:true,quickGame:'Scoring Challenge',start:at-1000,date:d});h.games.push({name:'Scoring Challenge',sessionId:id,quick:true,at,day:d,offsetMinutes:0,completion:'natural',benchmark:true,visits:10,points:score*10,scores:Array(10).fill(score)})}return h;
}
export function targetHistory(decline=true,years=0){
 const h={games:[],sessions:[],bigSingles:[]};for(let age=(years?years*365:56)-1;age>=0;age--){
 const at=now-age*ms-1000,d=new Date(at).toISOString().slice(0,10),id='target-'+age,hits=decline&&age<28?3:12;
 h.sessions.push({id,quick:true,quickGame:'Target Mastery',start:at-1000,date:d});h.games.push({name:'Target Mastery',sessionId:id,quick:true,at,day:d,offsetMinutes:0,completion:'natural',benchmark:false,masteryMode:'segment',thrown:15,hits,targetLog:Array.from({length:15},(_,i)=>({ring:'D',target:16,hit:i<hits}))});
 }return h;
}
test('SOL51 501 gate requires fresh multi-week fixed Quick Play, not a single hot day',()=>{
 const gate=fixedQuickScoringGate(fixed(),state,day,now);assert.equal(gate.allowed,true);assert.equal(gate.status,'supported');assert.equal(gate.days,8);assert.ok(gate.average>=80);
 for(const h of [fixed([0]),fixed([0,1,2,3,4,5,6,7]),fixed([35,36,42,43,49,50,56,57]),fixed(undefined,79)])assert.equal(fixedQuickScoringGate(h,state,day,now).allowed,false);
 const adaptive=fixed();for(const g of adaptive.games)g.name='Scoring Survival';assert.equal(fixedQuickScoringGate(adaptive,state,day,now).allowed,false);
});
test('SOL51 501 gate respects contradictions, current lower form, changes and reassessment',()=>{
 const low=Array.from({length:8},(_,i)=>({id:'low-'+i,day:new Date(now-[0,1,7,8,14,15,21,22][i]*ms).toISOString().slice(0,10),skill:'scoring',context:'practice',protocol:'IDC precision fixed scoring',attempts:30,hits:600}));
 assert.equal(fixedQuickScoringGate(fixed(),{...state,observations:low},day,now).status,'blocked');
 assert.equal(fixedQuickScoringGate(fixed(),{...state,changes:[{day}]},day,now).allowed,false);
 assert.equal(fixedQuickScoringGate({...fixed(),assessment:{finished:true,completedAt:now-ms}},state,day,now).allowed,false);
 const form=fixed([0,1,2,7,8,14,15,21,22]);for(const g of form.games.filter(g=>g.at>now-3*ms)){g.scores=Array(10).fill(82);g.points=820}assert.equal(fixedQuickScoringGate(form,state,day,now).status,'blocked');
 const corrupt=fixed();corrupt.games.push({...corrupt.games[0],scores:[]});assert.equal(fixedQuickScoringGate(corrupt,state,day,now).allowed,false);
});
test('SOL51 paired players receive different bounded next actions from actual saved target evidence',()=>{
 const a=targetHistory(),b=targetHistory(false),r=targetDevelopment(a,state,day,now),flat=targetDevelopment(b,state,day,now);
 assert.equal(r.focus.target,'D16');assert.equal(flat.focus,null);assert.equal(r.focus.trend.earlier.attempts,420);assert.equal(r.focus.trend.recent.hits,84);
 assert.equal(contextualDrillPreferences(r,{doubles:'Double Double'}).doubles,'Doubles Streak');assert.equal(contextualDrillPreferences(flat,{doubles:'Double Double'}).doubles,'Double Double');
 const lines=targetDevelopmentLines(r).join(' '),answer=integratedAsk(a,state,'What target should I practise next?',day,now);assert.equal(answer.lines.join(' '),lines);assert.match(lines,/D16/);assert.doesNotMatch(lines,/tier [1-7]/);
 const x=assess(a,null,day,now),brief=coachBrief(a,x.state,x.report,[],[],day,now);assert.equal(brief.kind,'target-check');assert.equal(brief.target,'D16');assert.match(brief.detail,/84\/420/);
 assert.equal(projectExposure(a,day,now).exposure.length,0);
});
test('SOL51 contextual review rejects hot-day volume, missing current evidence, mixed protocols and changes',()=>{
 const h=targetHistory();assert.equal(targetDevelopment({...h,games:h.games.filter(g=>g.at<now-8*ms)},state,day,now).focus,null);
 assert.equal(targetDevelopment(h,{...state,changes:[{day}]},day,now).focus,null);
 assert.equal(targetDevelopment({...h,assessment:{version:6,finished:true,completedAt:now-28*ms,offsetMinutes:0}},state,day,now).focus,null);
 const hot=targetHistory();for(const g of hot.games){g.day=day;g.at=now-1000}hot.sessions=hot.sessions.map(s=>({...s,date:day,start:now-2000}));assert.equal(targetDevelopment(hot,state,day,now).focus,null);
 const reversed=targetHistory(false);for(const g of reversed.games){g.masteryMode='straight';g.sessionId+='-reverse';if(g.at<now-28*ms){g.hits=3;g.targetLog=g.targetLog.map((x,i)=>({...x,hit:i<3}))}}reversed.sessions=reversed.sessions.map(s=>({...s,id:s.id+'-reverse'}));
 const mixed=targetDevelopment({...h,games:[...h.games,...reversed.games],sessions:[...h.sessions,...reversed.sessions]},state,day,now);assert.equal(mixed.focus,null);assert.ok(mixed.mixed.length);
});
test('SOL51 retrospective target recommendations cannot see future rounds and rebuild after deletion/restore',()=>{
 const h=targetHistory(),before=JSON.stringify(h),past=now-28*ms,pastDay=new Date(past).toISOString().slice(0,10);
 assert.equal(targetDevelopment(h,state,pastDay,past).focus,null);assert.equal(JSON.stringify(h),before);
 assert.equal(targetDevelopment({...h,games:h.games.slice(0,28)},state,day,now).focus,null);
 assert.equal(targetDevelopment(JSON.parse(before),state,day,now).focus.target,'D16');
});
