// Advisory engineering screen; never evidence of real coaching efficacy.
import {targetDevelopment,contextualDrillPreferences} from '../site/host-targets.mjs';
import {fixedQuickScoringGate} from '../site/precision-adapter.mjs';
import {newMemory} from '../site/coach-memory.mjs';
import assert from 'node:assert/strict';
const now=Date.parse('2026-11-27T12:00Z'),day='2026-11-27',ms=86400000;
let seed=510027;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32};
const state=newMemory().state,summary=[];
const scenarios=[['novice-flat',.15,.15],['intermediate-flat',.45,.45],['elite-flat',.85,.85],['improving',.25,.65],['deteriorating',.75,.25],['plateau',.55,.55],['small-drift',.55,.48]];
for(const [name,earlier,recent] of scenarios){let focus=0,missing=0;for(let player=0;player<50;player++){
 const h={games:[],sessions:[],bigSingles:[]};let form=0;
 for(let age=55;age>=0;age--){form=.6*form+(random()-.5)*.12;const at=now-age*ms-1000,d=new Date(at).toISOString().slice(0,10),id=name+'-'+player+'-'+age;let hits=0;
 for(let dart=0;dart<15;dart++)if(random()<Math.max(0,Math.min(1,(age<28?recent:earlier)+form)))hits++;
 h.sessions.push({id,quick:true,quickGame:'Target Mastery',start:at-1000,date:d});h.games.push({name:'Target Mastery',sessionId:id,quick:true,at,day:d,offsetMinutes:0,completion:'natural',benchmark:false,masteryMode:'segment',thrown:15,hits,targetLog:Array.from({length:15},(_,i)=>({ring:'D',target:16,hit:i<hits}))});
 }
 const r=targetDevelopment(h,state,day,now);if(r.focus)focus++;if(!r.profiles.length)missing++;
 assert.equal(contextualDrillPreferences(targetDevelopment(h,{...state,changes:[{day}]},day,now),{}).doubles,undefined);
 const past=now-28*ms,pastDay=new Date(past).toISOString().slice(0,10);assert.equal(targetDevelopment(h,state,pastDay,past).focus,null);
 // Round order, duplicate mirrors and a backup round-trip do not change review.
 const restored=JSON.parse(JSON.stringify({...h,games:[...h.games].reverse().concat(h.games[0])}));
 assert.equal(targetDevelopment(restored,state,day,now).focus?.target,r.focus?.target);
 }summary.push({scenario:name,players:50,contextualTargetChecks:focus,emptyProfiles:missing});}
const gates=[];
for(const average of [20,45,60,79,80,82,90,120]){const h={games:[],sessions:[],bigSingles:[]};for(const age of [0,1,7,8,14,15,21,22]){const at=now-age*ms-1000,d=new Date(at).toISOString().slice(0,10),id='gate-'+age;h.sessions.push({id,quick:true,quickGame:'Scoring Challenge',start:at-1000,date:d});h.games.push({name:'Scoring Challenge',sessionId:id,quick:true,at,day:d,offsetMinutes:0,completion:'natural',benchmark:true,visits:10,points:average*10,scores:Array(10).fill(average)})}const r=fixedQuickScoringGate(h,state,day,now);gates.push({average,status:r.status,allowed:r.allowed,conservativeAbility:r.average});assert.equal(r.allowed,average>=82)}
assert.ok(summary.find(r=>r.scenario==='deteriorating').contextualTargetChecks>=40);
assert.ok(summary.filter(r=>r.scenario.endsWith('-flat')).every(r=>r.contextualTargetChecks<=5));
console.log(JSON.stringify({seed:510027,players:350,daysPerPlayer:56,scope:'Seeded synthetic screen with correlated form, mirror/order/restore invariance, dated changes and retrospective recommendations; advisory thresholds only, no human efficacy claim.',summary,gates},null,2));
