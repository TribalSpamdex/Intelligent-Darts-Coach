import test from 'node:test';
import assert from 'node:assert/strict';
import {quickSkillGames,quickSkillMeasurements,quickSkillProfiles,quickSkillLines,projectEvidence,masteryMeasurements} from '../site/v62-evidence.mjs';
import {projectTargets} from '../site/host-targets.mjs';
import {precisionDecisions} from '../site/progression-evidence.mjs';
import {projectExposure} from '../site/host-exposure.mjs';
import {trainingLedger} from '../site/training-ledger.mjs';
import {snapshotView} from '../site/statistics-view.mjs';
import {integratedAsk} from '../site/integrated-dialogue.mjs';
import {newMemory} from '../site/coach-memory.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const host=()=>({sessions:[],games:[],assessmentHistory:[],bigSingles:[]});
function add(h,name,id,patch={},age=0){
 const d=ago(age),at=now-age*86400000-1000-id*100;
 h.sessions.push({id,quick:true,quickGame:name,start:at-10000,date:d,extra:true,completed:true,activities:[]});
 const g={name,at,day:d,offsetMinutes:0,sessionId:id,quick:true,completion:'natural',benchmark:true,...patch};
 h.games.push(g);return g;
}
const mastery={masteryMode:'segment',thrown:15,hits:9,targetLog:Array.from({length:15},(_,i)=>({ring:'D',target:16,hit:i<9}))};
const bull={thrown:30,inner:9,outer:12,misses:9};
test('Quick Play Target Mastery counts exact intended targets and appears in read-only statistics',()=>{
 const h=host();add(h,'Target Mastery',1,mastery);const before=JSON.stringify(h);
 const rows=quickSkillMeasurements(h,day,now);assert.equal(rows.length,15);
 const p=quickSkillProfiles(h,day,now)[0];assert.equal(p.attempts,15);assert.equal(p.hits,9);assert.equal(p.days.size,1);assert.equal(p.target,'D16');
 assert.equal(projectTargets(h,day,now).rows.length,15);
 assert.deepEqual(projectEvidence(h,{today:day,now}).observations,[]);
 assert.match(quickSkillLines(h,day,now).join(' '),/9\/15/);
 assert.equal(snapshotView(h,newMemory().state,'Quick Play statistics','',28,day,now).cards.length,1);
 assert.equal(integratedAsk(h,newMemory().state,'How am I doing in Quick Play?',day,now).type,'quick-skill-profile');
 assert.equal(JSON.stringify(h),before);
});
test('same measured fixed Bull Accuracy counts in its own scope but not training time',()=>{
 const h=host();add(h,'Bull Accuracy',1,bull);
 const r=projectEvidence(h,{today:day,now}).observations;assert.equal(r.length,1);assert.equal(r[0].hits,21);assert.equal(r[0].attempts,30);assert.match(r[0].protocol,/Quick Play/);
 assert.equal(quickSkillProfiles(h,day,now).length,3);
 assert.deepEqual(projectExposure(h,day,now).exposure,[]);
 assert.deepEqual(trainingLedger(h,day,now).sessions,[]);
 assert.equal(precisionDecisions(r,day,{bull:4}).bull.quarter,0);
});
test('repeated comparable Quick Play fixed benchmark can support finer calibration, single day cannot',()=>{
 const h=host();for(const [i,n] of [0,1,7,8,14,15,21,22].entries())add(h,'Bull Accuracy',i+1,bull,n);
 const r=projectEvidence(h,{today:day,now}).observations;
 assert.equal(r.length,8);assert.equal(precisionDecisions(r,day,{bull:4}).bull.quarter,3);
 assert.equal(precisionDecisions(r.slice(0,1),day,{bull:4}).bull.quarter,0);
});
test('wrong parent, contradictory flag, duplicate identity, future and incomplete rounds are excluded',()=>{
 for(const patch of [{quick:false},{quickGame:'High-Low'},{start:now+1}]){
  const h=host();add(h,'Target Mastery',1,mastery);Object.assign(h.sessions[0],patch);assert.equal(quickSkillGames(h,day,now).length,0);
 }
 for(const patch of [{completion:'partial'},{offsetMinutes:900},{day:ago(1)},{at:now+1},{recovery:true},{challengeTuning:'precision'}]){
  const h=host();add(h,'Target Mastery',1,{...mastery,...patch});assert.equal(quickSkillGames(h,day,now).length,0);
 }
 const h=host(),g=add(h,'Target Mastery',1,mastery);h.games.push(structuredClone(g));assert.equal(quickSkillGames(h,day,now).length,1);
 h.games.push({...g,quick:false});assert.equal(quickSkillGames(h,day,now).length,0);
 h.games=[g];h.sessions.push({...h.sessions[0],id:'1'});assert.equal(quickSkillGames(h,day,now).length,0);
});
test('active Quick Play can appear immediately and correction removes it without persistent derived data',()=>{
 const h=host();add(h,'Target Mastery',1,mastery);h.activeQuickSession=h.sessions.pop();
 assert.equal(quickSkillProfiles(h,day,now)[0].hits,9);h.games=[];assert.deepEqual(quickSkillProfiles(h,day,now),[]);
});
test('Mastery rejects fabricated totals, invalid rings, false checkout claims and bull mismatches',()=>{
 for(const g of [{...mastery,hits:10},{...mastery,thrown:14},{...mastery,targetLog:mastery.targetLog.map(x=>({...x,target:21}))}])assert.deepEqual(masteryMeasurements({name:'Target Mastery',...g}),[]);
 const a={name:'Target Mastery',masteryMode:'checkout',attempts:5,thrown:0,hits:5,attemptLog:Array.from({length:5},()=>({range:'101+',finish:101,allowance:3,success:true,dartsUsed:1}))};
 assert.deepEqual(masteryMeasurements(a),[]);a.attemptLog.forEach(x=>x.dartsUsed=2);assert.equal(masteryMeasurements(a).length,5);
 const b={name:'Target Mastery',masteryMode:'bull',thrown:15,hits:15,targetLog:Array.from({length:15},()=>({ring:'B',target:null,hit:true}))};assert.deepEqual(masteryMeasurements(b),[]);
});
test('adaptive scoring, target and finishing games remain separate from fixed ability; casual games have no skill evidence',()=>{
 const h=host();
 add(h,'Scoring Survival',1,{benchmark:false,visits:3,scores:[60,100,20],points:180});
 add(h,'Doubles Survival',2,{variant:'doubles',thrown:3,hits:2,targetLog:[{ring:'D',target:16,hit:true},{ring:'D',target:16,hit:true},{ring:'D',target:20,hit:false}]});
 add(h,'Checkout Climb',3,{success:1,fail:1,attemptLog:[{target:81,hit:1},{target:80,hit:0}]});
 add(h,'High-Low',4,{visits:10,scores:Array(10).fill(180),points:1800});
 assert.deepEqual(projectEvidence(h,{today:day,now}).observations,[]);
 const rows=quickSkillProfiles(h,day,now);assert.equal(rows.length,5);assert.ok(rows.every(r=>!r.protocol.includes('High-Low')));
 assert.equal(rows.find(r=>r.kind==='scoring').hits,180);
});
