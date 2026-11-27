import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectEvidence,masteryRows} from '../site/v62-evidence.mjs';
import {projectTargets} from '../site/host-targets.mjs';
import {gameProfile} from '../site/game-profile.mjs';
import {createPrecisionAdapter} from '../site/precision-adapter.mjs';
const day='2026-11-27',now=Date.parse(day+'T12:00:00Z');
const p={id:1,quick:true,quickGame:'Scoring Challenge',start:now-60000,date:day};
const g={name:p.quickGame,sessionId:1,quick:true,at:now-1000,day,completion:'natural',benchmark:true,visits:10,points:600,scores:Array(10).fill(60)};
const host=(games=[g],sessions=[p])=>({games,sessions,assessmentHistory:[],bigSingles:[]});
test('SOL49-01 malformed contradictory round vetoes every independent projection',()=>{
 for(const patch of [{completion:'partial'},{benchmark:false},{recovery:true},{scores:[]},{quick:false}]){
  const h=host([g,{...g,...patch}]);
  assert.equal(projectEvidence(h,{today:day,now}).observations.length,0,JSON.stringify(patch));
  assert.equal(gameProfile(h,day,now).scoring.visits,0,JSON.stringify(patch));
 }
});
test('SOL49-02 target contradictions cannot survive filtering a malformed mirror',()=>{
 const a={...g,name:'Doubles Streak',benchmark:false,variant:'doubles',thrown:2,hits:1,targetLog:[{ring:'D',target:16,hit:true},{ring:'D',target:16,hit:false}]};
 const h=host([a,{...a,thrown:3}],[{...p,quickGame:a.name}]);
 assert.equal(projectTargets(h,day,now).rows.length,0);
});
test('SOL49-03 reordered object properties and numeric/string session aliases are identical mirrors',()=>{
 const copy=Object.fromEntries(Object.entries(g).reverse());copy.sessionId='1';
 const h=host([g,copy]);assert.equal(projectEvidence(h,{today:day,now}).observations.length,1);
});
test('SOL49-04 calibration guard honours deliberate reassessment boundary',()=>{
 const ages=[1,2,7,8,14,15,21,22];
 const obs=ages.map(n=>({id:'old'+n,day:new Date(now-n*86400000).toISOString().slice(0,10),skill:'scoring',context:'practice',protocol:'IDC precision fixed scoring',attempts:30,hits:400}));
 const d={host:{...host([],[]),assessment:{finished:true,completedAt:now-3600000}},state:{observations:obs},day,now};
 assert.equal(createPrecisionAdapter(()=>d).tierGuard('scoring',5,4).status,'clear');
 d.host.assessment=null;assert.equal(createPrecisionAdapter(()=>d).tierGuard('scoring',5,4).status,'defer');
});
test('SOL49-05 native bridge snapshot includes active parent without fabricating attendance',()=>{
 const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 const match=html.match(/snapshot:\(\)=>JSON\.parse\(JSON\.stringify\((.*?)\)\),memory:/s);assert.ok(match);
 const data={...host([],[]),activeSession:p};
 const value=new Function('data','return '+match[1])(data);
 assert.equal(value.sessions.length,1);assert.equal(value.sessions[0].id,1);assert.equal(data.sessions.length,0);
 assert.equal(value.sessions[0].completed,undefined);
});
test('SOL49-06 novice single logs enter separate Quick Play target profiles',()=>{
 const a={...g,name:'Treble Hunt',benchmark:false,variant:'single',thrown:2,hits:1,targetLog:[{ring:'S',target:20,hit:true},{ring:'S',target:20,hit:false}]};
 const r=projectTargets(host([a],[{...p,quickGame:a.name}]),day,now).rows;
 assert.equal(r.length,1);assert.equal(r[0].target,'S20');assert.match(r[0].protocol,/Quick Play/);
 const bad={...a,targetLog:a.targetLog.map(x=>({...x,ring:'T'}))};assert.equal(projectTargets(host([bad],[{...p,quickGame:a.name}]),day,now).rows.length,0);
});
test('SOL49-07 Focused Checkouts retain exact targets and known successful dart counts',()=>{
 const a={...g,name:'Focused Checkouts',benchmark:false,success:1,fail:1,attempts:2,rangeStart:41,rangeEnd:61,pressure:'standard',attemptLog:[{target:41,hit:true,darts:2},{target:42,hit:false,darts:3}]};
 const r=gameProfile(host([a],[{...p,quickGame:a.name}]),day,now).checkout;
 assert.equal(r.length,2);assert.equal(r.find(x=>x.score===41).meanDartsOnSuccess,2);
});
test('SOL49-08 Mastery hides no targets behind an unexplained 35-row cap',()=>{
 const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 const start=html.indexOf('function dc23RenderMasteryProgress()'),end=html.indexOf('\nfunction ',start+1);
 assert.doesNotMatch(html.slice(start,end),/\.slice\(0,35\)/);
});
test('SOL49-09 linked timestamps beyond recorded session end are not valid Quick Play',()=>{
 const h=host([g],[{...p,end:now-2000}]);assert.equal(projectEvidence(h,{today:day,now}).observations.length,0);
});

import {quickFixedSamples,quickMeasurementCards} from '../site/precision-adapter.mjs';
import {quickAdaptiveMeasurements} from '../site/v62-evidence.mjs';
import {integratedAsk} from '../site/integrated-dialogue.mjs';
import {newMemory,assess} from '../site/coach-memory.mjs';
import {projectExposure} from '../site/host-exposure.mjs';
import {trainingLedger} from '../site/training-ledger.mjs';
test('SOL49-10 fixed native samples, cards and Coach all reconstruct saved Quick Play',()=>{
 const h=host(),r=quickFixedSamples(h,now);assert.equal(r.length,1);assert.equal(r[0].volume,10);assert.equal(r[0].points,600);assert.equal(r[0].verifiedQuick,true);
 assert.ok(quickMeasurementCards(h,day,now).some(c=>c.value==='60.0 average'));
 assert.match(integratedAsk(h,newMemory().state,'How am I doing in Quick Play?',day,now).lines.join(' '),/60.0 average/);
 assert.equal(projectExposure(h,day,now).exposure.length,0);assert.equal(trainingLedger(h,day,now).sessions.length,0);
 h.games=[];assert.equal(quickFixedSamples(h,now).length,0);
});
test('SOL49-11 bull rules and stopping protocols stay separate without invented 25/50 outcomes',()=>{
 const games=['50','25/50','CENTRE'].map((target,i)=>({...g,name:'Bull Streak',at:now-1000-i,sessionId:i+1,benchmark:false,target,thrown:4,hits:2,targetLog:Array.from({length:4},(_,j)=>({target,hit:j<2}))}));
 const h=host(games,games.map(a=>({...p,id:a.sessionId,quickGame:a.name}))),r=quickAdaptiveMeasurements(h,day,now);
 assert.equal(r.length,3);assert.ok(r.every(x=>x.hits===2&&x.attempts===4));assert.equal(projectEvidence(h,{today:day,now}).observations.length,0);
 assert.equal(quickMeasurementCards(h,day,now).length,3);h.games[0].targetLog[0].target='25/50';assert.equal(quickAdaptiveMeasurements(h,day,now).length,2);
});
test('SOL49-12 Staying Straight is sector evidence and never exact single or treble accuracy',()=>{
 const a={...g,name:'Staying Straight',targets:[20,19,18,17,16],hits:[2,1,0,0,0],misses:[1,1,1,1,1],counts:[4,3,0,0,0],darts:8,points:7,benchmark:false};
 const h=host([a],[{...p,quickGame:a.name}]),r=quickAdaptiveMeasurements(h,day,now);assert.equal(r.length,5);assert.equal(r[0].attempts,3);assert.match(r[0].key,/any ring/);
 a.counts[0]=7;assert.equal(quickAdaptiveMeasurements(h,day,now).length,0);
});
test('SOL49-13 native daily samples admit verified fixed rounds but cap volume and days',()=>{
 const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8'),start=html.indexOf('function dailySamples('),end=html.indexOf('\nfunction ',start+1);
 const run=new Function('num','dateKey',html.slice(start,end)+';return dailySamples')(x=>Number(x)||0,t=>new Date(t).toISOString().slice(0,10));
 const r=quickFixedSamples(host(),now)[0],rows=run(Array(100).fill(r));assert.equal(rows.length,1);assert.equal(rows[0].volume,35);assert.equal(rows[0].points/rows[0].volume,60);
 assert.equal(run([{...r,verifiedQuick:false}]).length,0);
});
test('SOL49-14 deterministic 2-year high-volume Quick Play chronology, corrections and dose isolation',()=>{
 const h=host([],[]),months=[];let seed=49017;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32};
 for(let d=729;d>=0;d--){
  const stamp=now-d*86400000,date=new Date(stamp).toISOString().slice(0,10),id='year-'+d,score=d>540?30:d>360?60:d>180?45:75;
  h.sessions.push({...p,id,start:stamp-60000,date});
  const a={...g,sessionId:id,day:date,at:stamp-1000,scores:Array(10).fill(score),points:score*10};h.games.push(a);
  if(rnd()<.5)h.games.push(structuredClone(a));
  if(d%30===0){const obs=projectEvidence(h,{today:date,now:stamp}).observations;assert.equal(obs.length,730-d);assert.ok(obs.every(o=>o.day<=date));months.push({day:date,observations:obs.length})}
 }
 assert.equal(projectEvidence(h,{today:day,now}).observations.length,730);
 assert.equal(projectExposure(h,day,now).exposure.length,0);assert.equal(trainingLedger(h,day,now).sessions.length,0);
 assert.equal(assess(h,null,day,now).report.decision,'balanced');
 const last=h.games.at(-1);h.games.push({...last,scores:[]});assert.equal(projectEvidence(h,{today:day,now}).observations.length,729);
 console.log('SOL49 synthetic two-year state transitions:',JSON.stringify({seed:49017,days:730,monthlyReviews:months.length,savedRows:h.games.length,protocols:1,trainingDose:0}));
});
