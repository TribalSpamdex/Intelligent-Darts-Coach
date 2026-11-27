import test from 'node:test';
import assert from 'node:assert/strict';
import {projectEvidence,extraQuickRounds,canonicalSkillGames} from '../site/v62-evidence.mjs';
import {quickFixedSamples} from '../site/precision-adapter.mjs';
import {projectTargets} from '../site/host-targets.mjs';
import {gameProfile} from '../site/game-profile.mjs';
const day='2026-11-27',now=Date.parse(day+'T12:00Z'),at=now-1000;
const game=(sessionId,quick=true,score=60)=>({name:'Scoring Challenge',sessionId,quick,at,day,offsetMinutes:0,completion:'natural',benchmark:true,visits:10,points:score*10,scores:Array(10).fill(score)});
const host=games=>({games,sessions:games.map(g=>({id:g.sessionId,quick:g.quick,quickGame:g.name,start:at-1000,date:day})),bigSingles:[]});
test('SOL51 identity: distinct same-millisecond sessions retain both fixed rounds',()=>{
 const h=host([game('one'),game('two',true,90)]),o=projectEvidence(h,{today:day,now}).observations;
 assert.equal(o.length,2);assert.equal(new Set(o.map(x=>x.id)).size,2);assert.equal(gameProfile(h,day,now).scoring.visits,20);
});
test('SOL51 identity: fixed Quick Play cannot select a training twin',()=>{
 const h=host([game('one'),game('two',false)]),r=quickFixedSamples(h,now);
 assert.equal(r.length,1);assert.equal(r[0].points,600);assert.equal(r[0].verifiedQuick,true);
});
test('SOL51 identity: exact-target totals retain distinct sessions',()=>{
 const games=['one','two'].map(sessionId=>({...game(sessionId),name:'Treble Hunt',variant:'treble',benchmark:false,hits:1,thrown:2,targetLog:[{ring:'T',target:20,hit:true},{ring:'T',target:20,hit:false}]}));
 assert.equal(projectTargets(host(games),day,now).rows.reduce((s,r)=>s+r.attempts,0),4);
});
test('SOL51 conflict-first identity includes legacy set measurements',()=>{
 const a={...game('one'),name:'Number Lock',benchmark:false,ring:'D',targets:[20,16,8],locked:[20],misses:3,hits:1,thrown:4};
 assert.equal(extraQuickRounds(host([a]),day,now).length,1);
 assert.equal(canonicalSkillGames([a,{...a,locked:[16]}]).length,0);
});
test('SOL51 trace: negative or contradictory life budget cannot become measurements',()=>{
 const make=details=>({...game('one'),name:'Shanghai Combo',benchmark:false,hits:3,thrown:3,details:{name:'Shanghai Combo',target:20,stage:3,hits:3,thrown:3,combinations:1,lives:-2,skillTrace:[{hit:true},{hit:true},{hit:true}],...details}});
 assert.equal(extraQuickRounds(host([make({})]),day,now).length,0);
 assert.equal(extraQuickRounds(host([make({lives:2,skillTraceVersion:1,skillStartLives:3})]),day,now).length,0);
});
test('SOL51 trace: a dart after exhausted lives is rejected',()=>{
 const g={...game('one'),name:'Shanghai Combo',benchmark:false,hits:3,thrown:4,details:{name:'Shanghai Combo',target:20,stage:3,hits:3,thrown:4,combinations:1,lives:0,skillTrace:[{hit:false},{hit:true},{hit:true},{hit:true}]}};
 assert.equal(extraQuickRounds(host([g]),day,now).length,0);
});

test('SOL51 windowed canonical projection preserves conflict-first validation without serializing ancient traces',()=>{
 const a=game('one'),bad={...a,completion:'partial'},ancient={...a,at:at-3650*86400000};
 Object.defineProperty(ancient,'details',{get(){throw Error('Ancient trace should not be inspected')}});
 assert.equal(canonicalSkillGames([ancient,a,bad],null,{since:now-84*86400000,until:now}).length,0);
 assert.equal(canonicalSkillGames([ancient,a],null,{since:now-84*86400000,until:now}).length,1);
});

import fs from 'node:fs';
import cp from 'node:child_process';
function cricketNative(code){
 const start=code.indexOf('function newGameDart('),end=code.indexOf('\nfunction ',start+1),g={name:'Cricket Countdown',targets:[25],marks:[0],index:0,allowed:5,thrown:0,hits:0,skillTrace:[]},data={};let snapshots=0;
 const run=new Function('session','activeGame','snapshot','data','save','endRound',code.slice(start,end)+';return newGameDart')(()=>({phase:'playing',pausedAt:null}),g,()=>snapshots++,data,()=>{},()=>{});
 return {g,run,snapshots:()=>snapshots};
}
test('SOL51 native bull marks fail before snapshot and traces; baseline reproduction is independent',()=>{
 const current=cricketNative(fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8'));
 const baseline=cricketNative(cp.execFileSync('git',['show','3695ed4fbe2b516c4d66fc6397374daf283bed4b:site/index.html'],{encoding:'utf8',maxBuffer:2e6}));
 baseline.run(3);assert.equal(baseline.g.thrown,1);assert.equal(baseline.snapshots(),1);
 current.run(3);assert.equal(current.g.thrown,0);assert.equal(current.snapshots(),0);assert.deepEqual(current.g.skillTrace,[]);
 current.run(2);assert.equal(current.g.thrown,1);assert.deepEqual(current.g.skillTrace,[{action:2}]);
});
test('SOL51 duplicate top-level trace totals cannot disagree even for a descriptive metric',()=>{
 const g={...game('one'),name:'Last Dart Standing',benchmark:false,thrown:1,hits:0,points:900,details:{name:'Last Dart Standing',scores:[40],index:0,lives:0,thrown:1,hits:0,points:0,choice:null,skillTrace:[{choice:'FINISH',value:'miss'}]}};
 assert.equal(extraQuickRounds(host([g]),day,now).length,0);
});
test('SOL51 legacy benchmark IDs stay unchanged when no real provenance collision exists',()=>{
 const h=host([game('one')]),r=projectEvidence(h,{today:day,now}).observations;
 assert.equal(r[0].id,'IDC:host-v62:game:'+at+':Scoring Challenge:scoring');
 assert.equal(JSON.stringify(h),JSON.stringify(host([game('one')])));
});
