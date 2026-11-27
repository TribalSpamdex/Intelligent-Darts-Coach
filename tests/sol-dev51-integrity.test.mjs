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
