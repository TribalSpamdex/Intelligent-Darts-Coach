import test from 'node:test';
import assert from 'node:assert/strict';
import {scoringDetail,checkoutDetail} from '../site/visit-statistics.mjs';
import {practiceProfile} from '../site/practice-statistics.mjs';
import {gameProfile} from '../site/game-profile.mjs';
import {snapshotView} from '../site/statistics-view.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z');
const ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const empty=()=>({games:[],sessions:[],assessmentHistory:[],bigSingles:[]});
const game=(n,patch={})=>({name:'Scoring Challenge',quick:false,completion:'natural',at:now-n*86400000,day:ago(n),benchmark:true,visits:10,scores:[0,26,40,60,80,100,120,140,160,180],points:906,...patch});
const activity=(id,name,seconds)=>({exerciseIndex:id,name,seconds});
test('scoring visit distribution reconciles every recorded visit and the exact average',()=>{
 const h=empty();h.games=[game(1),game(8),game(30)];
 const r=scoringDetail(h,day,now),w=r.windows[2];
 assert.equal(w.visits.n,30);assert.equal(w.visits.mean,90.6);
 assert.equal(w.bands.reduce((n,b)=>n+b.count,0),30);
 assert.equal(w.hundreds,15);assert.equal(w.oneForties,9);assert.equal(w.maximums,3);assert.equal(w.low,6);
 assert.deepEqual(r.windows.map(x=>x.visits.n),[10,20,30]);
});
test('invalid or adaptive scoring data excluded from all statistics',()=>{
 const h=empty();h.games=[game(0,{quick:true}),game(1,{benchmark:false}),game(2,{recovery:true}),game(3,{points:1}),game(4,{scores:[...game(4).scores.slice(0,-1),179],points:905}),game(5)];
 assert.equal(scoringDetail(h,day,now).windows[2].visits.n,10);
});
test('conflicting identical native scoring identity excluded from detailed statistics',()=>{
 const h=empty();h.games=[game(1),game(1,{scores:Array(10).fill(60),points:600})];
 assert.equal(scoringDetail(h,day,now).conflicts,1);assert.equal(scoringDetail(h,day,now).windows[2].visits.n,0);
});
test('optional validated records do not mutate host data or expose unvalidated results',()=>{
 const h=empty();h.games=[game(1)];const before=JSON.stringify(h),r=gameProfile(h,day,now,{includeRecords:true});
 assert.equal(r.records.length,1);r.records[0].scores[0]=180;assert.equal(JSON.stringify(h),before);assert.equal(gameProfile(h,day,now).records,undefined);
});
test('checkout detail preserves unknown success dart count and separates protocols',()=>{
 const h=empty(),targets=[41,46,52,60,68,76,81,90,101,110,120,130];h.assessmentHistory=[{version:6,finished:true,completedAt:now-86400000,checkout:targets.map(target=>({target,hit:target===81,darts:target===81?2:3}))}];
 h.games=[{name:'Checkout Climb',quick:false,completion:'natural',at:now-2*86400000,day:ago(2),success:1,fail:1,attemptLog:[{target:81,hit:1},{target:81,hit:0}]}];
 const groups=checkoutDetail(h,day,now).groups.filter(g=>g.score===81);
 assert.equal(groups.length,2);
 const fixed=groups.find(g=>g.protocol==='Fixed checkout assessment').windows[0],adaptive=groups.find(g=>g.protocol.includes('adaptive')).windows[0];
 assert.equal(fixed.twoDart,1);assert.equal(fixed.meanDartsOnSuccess,2);
 assert.equal(adaptive.hits,1);assert.equal(adaptive.attempts,2);assert.equal(adaptive.unknownSuccessDarts,1);assert.equal(adaptive.meanDartsOnSuccess,null);
});
test('practice volume counts only eligible saved classified time and actual day coverage',()=>{
 const h=empty();h.sessions=[{id:1,date:ago(1),quick:false,activities:[activity(0,'Scoring Challenge',600),activity(1,'Bull Accuracy',300),activity(2,'Warm-up',600)]},{id:2,date:ago(8),quick:false,activities:[activity(0,'Big Singles',600)]},{id:3,date:ago(1),quick:true,activities:[activity(0,'Scoring Challenge',600)]}];
 const r=practiceProfile(h,day);
 assert.equal(r.windows[0].sessions,1);assert.equal(r.windows[0].total,15);assert.equal(r.windows[0].minutesPerCalendarWeek,15);assert.equal(r.windows[1].total,25);assert.equal(r.windows[1].sessionDays,2);
 assert.equal(r.windows[0].skills.find(s=>s.skill==='scoring').share,2/3);
});
test('practice duplicate sessions cannot inflate counts or minutes',()=>{const h=empty();h.sessions=[{id:1,date:ago(1),quick:false,activities:[activity(0,'Big Singles',600)]},{id:'1',date:ago(1),quick:false,activities:[activity(0,'Big Singles',600)]}];const r=practiceProfile(h,day);assert.equal(r.duplicates,1);assert.equal(r.windows[0].sessions,0);assert.equal(r.windows[0].total,0)});
test('statistics cards maintain exact counts and valid chart denominators',()=>{
 const h=empty();h.games=[game(1)];const r=snapshotView(h,{observations:[],legs:[]},'Detailed scoring statistics','',28,day,now);
 assert.equal(r.cards.length,1);assert.equal(r.cards[0].bars.reduce((n,b)=>n+b.value,0),10);assert.ok(r.cards[0].bars.every(b=>b.total===10&&b.value<=b.total));
 assert.throws(()=>snapshotView(h,{observations:[]},'Detailed scoring statistics','',365,day,now));
});

import {legalFinishCount} from '../site/finish-validation.mjs';
import {projectEvidence} from '../site/v62-evidence.mjs';
test('exact legal checkout dart counts reject impossible or bust routes',()=>{
 assert.equal(legalFinishCount(40,1),true);assert.equal(legalFinishCount(41,1),false);assert.equal(legalFinishCount(41,2),true);assert.equal(legalFinishCount(170,2),false);assert.equal(legalFinishCount(170,3),true);assert.equal(legalFinishCount(169,3),false);assert.equal(legalFinishCount(2,2),true);assert.equal(legalFinishCount(2,3),true);assert.equal(legalFinishCount(3,3),true);assert.equal(legalFinishCount(3,1),false);
});
test('impossible assessment successful dart count is excluded consistently',()=>{
 const h=empty(),targets=[41,46,52,60,68,76,81,90,101,110,120,130];h.assessmentHistory=[{version:6,finished:true,completedAt:now-86400000,checkout:targets.map(target=>({target,hit:target===41,darts:target===41?1:3}))}];
 assert.equal(checkoutDetail(h,day,now).groups.length,0);assert.equal(projectEvidence(h,{today:day,now}).observations.filter(o=>o.skill==='checkout').length,0);
 h.assessmentHistory[0].checkout[0].darts=2;assert.equal(checkoutDetail(h,day,now).groups.length,12);assert.equal(projectEvidence(h,{today:day,now}).observations.filter(o=>o.skill==='checkout').length,1);
});
