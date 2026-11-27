import test from 'node:test';
import assert from 'node:assert/strict';
import {masteryRows,projectEvidence,quickAbilityLines} from '../site/v62-evidence.mjs';
import {projectTargets,combinedDoubleComparison} from '../site/host-targets.mjs';
import {gameProfile} from '../site/game-profile.mjs';
import {projectExposure} from '../site/host-exposure.mjs';
import {trainingLedger} from '../site/training-ledger.mjs';
import {learningEpisodes} from '../site/challenge-episodes.mjs';
import {precisionDecisions,calibrationGuard} from '../site/progression-evidence.mjs';
import {newMemory,assemble,assess} from '../site/coach-memory.mjs';
import {integratedAsk} from '../site/integrated-dialogue.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10),at=n=>now-n*86400000-1000;
const parent=(name,n=0,id='s'+n,quick=true)=>({id,start:at(n)-60000,date:ago(n),startOffsetMinutes:0,quick,quickGame:quick?name:null,focus:[name],completed:false,extra:quick,activities:[]});
const row=(name,n=0,id='s'+n,quick=true)=>({name,at:at(n),day:ago(n),offsetMinutes:0,quick,sessionId:id,completion:'natural',benchmark:false,recovery:false,challengeTuning:null});
const h=(games=[],sessions=[])=>({games,sessions,bigSingles:[],assessmentHistory:[]});
const mastery=(mode='segment',n=0,id='s'+n,quick=true,patch={})=>({...row('Target Mastery',n,id,quick),masteryMode:mode,attempts:0,thrown:15,hits:10,targetLog:Array.from({length:15},(_,i)=>({ring:'D',target:16,hit:i<10})),attemptLog:[],...patch});
const bull=(n=0,id='s'+n,quick=true)=>({...row('Bull Accuracy',n,id,quick),benchmark:true,thrown:30,outer:18,inner:6,misses:6});
const score=(n=0,id='s'+n,quick=true)=>({...row('Scoring Challenge',n,id,quick),benchmark:true,visits:10,scores:Array(10).fill(75),points:750});
test('valid Quick Play Mastery is included with source and unchanged saved history',()=>{
 const g=mastery(),p=parent(g.name),x=h([g],[p]),before=JSON.stringify(x),r=masteryRows(x,now);
 assert.equal(r.length,15);assert.equal(r.reduce((n,o)=>n+o.hit,0),10);assert.ok(r.every(o=>o.quick&&o.key==='segment D16'));
 assert.equal(projectTargets(x,day,now).rows[0].attempts,15);
 assert.match(quickAbilityLines(x,day,now).join(' '),/10\/15/);assert.equal(JSON.stringify(x),before);
 x.games=[];assert.equal(masteryRows(x,now).length,0);
});
test('Quick Play parent must be linked and match its skill exercise, source and chronology',()=>{
 const g=mastery(),p=parent(g.name);
 for(const sessions of [[],[{...p,quick:false}],[{...p,quickGame:'Bull Accuracy'}],[{...p,start:now}],[p,{...p}],[{...p,date:ago(1)}]])assert.equal(masteryRows(h([g],sessions),now).length,0);
 assert.equal(masteryRows(h([{...g,quick:false}],[p]),now).length,0);
 assert.equal(masteryRows(h([g],[{...p,quickGame:null}]),now).length,15);
});
test('incomplete, malformed, conflicting and future Mastery logs never add measurements',()=>{
 const g=mastery(),p=parent(g.name);
 for(const patch of [{completion:'partial'},{hits:11},{thrown:14},{masteryMode:'bogus'},{at:now+1},{day:ago(1)},{targetLog:g.targetLog.map((x,i)=>i===0?{...x,target:20}:x)}]){
  assert.equal(masteryRows(h([{...g,...patch}],[p]),now).length,0,JSON.stringify(patch));
 }
 assert.equal(masteryRows(h([g,structuredClone(g)],[p]),now).length,15);
 assert.equal(masteryRows(h([g,{...g,hits:11}],[p]),now).length,0);
});
test('all genuine Mastery modes retain their actual segment, bull or exact checkout measurement',()=>{
 for(const mode of ['segment','straight','pressure','switch','setup','scoring']){
  const g=mastery(mode,0,'s0',true,{targetLog:Array.from({length:15},(_,i)=>({ring:mode==='setup'?'S':mode==='scoring'?'T':'D',target:['switch','setup','scoring'].includes(mode)?[16,17,18][i%3]:16,hit:i<10}))});
  assert.equal(masteryRows(h([g],[parent(g.name)]),now).length,15,mode);
 }
 const b=mastery('bull',0,'s0',true,{targetLog:Array.from({length:15},(_,i)=>({ring:'B',target:i<5?50:i<10?25:null,hit:i<10}))});
 assert.equal(masteryRows(h([b],[parent(b.name)]),now).filter(r=>r.outcome===50).length,5);
 const c=mastery('checkout',0,'s0',true,{thrown:0,attempts:5,hits:3,targetLog:[],attemptLog:Array.from({length:5},(_,i)=>({range:'61–80',finish:80,allowance:3,success:i<3,dartsUsed:i<3?2:null}))});
 const x=h([c],[parent(c.name)]),r=masteryRows(x,now);assert.equal(r.length,5);assert.equal(r[0].score,80);assert.equal(gameProfile(x,day,now).checkout[0].hits,3);
 c.attemptLog[0].dartsUsed=1;assert.equal(masteryRows(x,now).length,0);
});
test('fixed Quick Play scoring and bull enter separate eligible protocols and never dose or completion',()=>{
 const games=[score(0,'a'),bull(0,'b')],sessions=[parent('Scoring Challenge',0,'a'),parent('Bull Accuracy',0,'b')],x=h(games,sessions);
 const r=projectEvidence(x,{today:day,now}).observations;assert.equal(r.length,2);assert.ok(r.every(o=>o.protocol.includes('Quick Play')));
 assert.equal(r.find(o=>o.skill==='scoring').hits,750);assert.equal(r.find(o=>o.skill==='bull').hits,24);
 assert.equal(assemble(x,null,day,now).state.observations.length,2);
 assert.deepEqual(projectExposure(x,day,now).exposure,[]);assert.equal(trainingLedger(x,day,now).sessions.length,0);
 assert.equal(learningEpisodes(x,{observations:r},day,now).episodes.length,0);
 assert.equal(assess(x,null,day,now).report.decision,'balanced');
});
test('unlinked recreational scores, fake visits, wrong flags and modified rounds remain excluded',()=>{
 const g=score(),p=parent(g.name);
 for(const patch of [{quick:false},{scores:Array(10).fill(179),points:1790},{completion:'manual'},{challengeTuning:'precision'},{recovery:true}])assert.equal(projectEvidence(h([{...g,...patch}],[p]),{today:day,now}).observations.length,0);
 assert.equal(projectEvidence(h([g],[]),{today:day,now}).observations.length,0);
 const fun={...g,name:'Bot 501'};assert.equal(projectEvidence(h([fun],[parent(fun.name)]),{today:day,now}).observations.length,0);
});
test('repeated fixed Quick Play can inform finer calibration but one day cannot',()=>{
 const ages=[0,1,7,8,14,15,21,22],games=ages.map(n=>score(n)),sessions=ages.map(n=>parent('Scoring Challenge',n));
 const obs=projectEvidence(h(games,sessions),{today:day,now}).observations;
 assert.ok(precisionDecisions(obs,day,{scoring:4}).scoring.quarter>0);
 assert.equal(precisionDecisions(obs.slice(-1),day,{scoring:4}).scoring.quarter,0);
 assert.equal(calibrationGuard(obs,day,'scoring',4,5).status,'defer');
});
test('Quick Play exact target route comparison requires matched days and cannot override primary',()=>{
 const rows=[];
 for(let n=0;n<8;n++)for(const [target,hits] of [['D16',5],['D20',0]])rows.push({day:ago(n),protocol:'Quick Play · Target Mastery segment',target,attempts:5,hits});
 assert.equal(combinedDoubleComparison(rows,'D16','D20').status,'first-higher');
 assert.equal(combinedDoubleComparison(rows.slice(0,2),'D16','D20').status,'insufficient');
 const primary=rows.map(r=>({...r,protocol:'Fixed doubles assessment',hits:5-r.hits}));
 assert.equal(combinedDoubleComparison([...rows,...primary],'D16','D20').status,'second-higher');
});
test('coach question reports verified saved Quick Play and never adds data',()=>{
 const g=mastery(),x=h([g],[parent(g.name)]),state=newMemory().state,before=JSON.stringify([x,state]);
 const a=integratedAsk(x,state,'How am I doing in Quick Play?',day,now);
 assert.equal(a.type,'quick-ability');assert.match(a.lines.join(' '),/10\/15/);assert.equal(JSON.stringify([x,state]),before);
});
