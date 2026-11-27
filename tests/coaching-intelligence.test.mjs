import test from 'node:test';
import assert from 'node:assert/strict';
import {integratedAsk,QUESTIONS} from '../site/integrated-dialogue.mjs';
import {newMemory} from '../site/coach-memory.mjs';
import {INTELLIGENCE_QUESTIONS} from '../site/coaching-intelligence.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z');
const host={sessions:[],games:[],assessmentHistory:[],bigSingles:[]};
test('every new coach question is accessible and read-only on a brand new player',()=>{
 const state=newMemory().state,original=JSON.stringify(state),before=JSON.stringify(host);
 const questions=[...INTELLIGENCE_QUESTIONS,'Model checkout 81 with 2 darts','Recovery from 81 after S19'];
 const types=['development-agenda','training-ledger','training-progress','training-method','training-dose','training-followup','match-stages','match-transfer','goal-runway','quick-development','individual-methods','match-direction','performance-watch','exercise-sequence','comparison-plan','competition-progress','adaptive-profile','adaptive-diagnosis','warning-replay','tactical-model','checkout-recovery'];
 for(const [i,q] of questions.entries()){
  assert.ok(QUESTIONS.includes(q),q);
  const a=integratedAsk(host,state,q,day,now);
  assert.equal(a.type,types[i],q);assert.equal(a.kind,'answer');assert.ok(a.lines.length>0);assert.ok(a.lines.every(l=>typeof l==='string'));
 }
 assert.equal(JSON.stringify(state),original);assert.equal(JSON.stringify(host),before);
});
test('bounded aliases and match period selection use the same intelligence path',()=>{
 const state=newMemory().state;
 for(const [q,t] of [['AM I PLATEAUING?','training-progress'],['match stages 365 days','match-stages'],['my development priorities','development-agenda'],['practice duration learning','training-dose'],['analyse checkout 40 with 1 dart','tactical-model']])assert.equal(integratedAsk(host,state,q,day,now).type,t);
 assert.notEqual(integratedAsk(host,state,'checkout 81 with 2 darts',day,now).type,'tactical-model');
});
