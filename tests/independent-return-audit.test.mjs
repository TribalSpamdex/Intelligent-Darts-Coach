import test from 'node:test';
import assert from 'node:assert/strict';
import {recordSetting} from '../site/challenge-setting.mjs';
import {extractLearningExposure} from '../site/challenge-exposure.mjs';
import {trainingLedger} from '../site/training-ledger.mjs';
import {chooseLearnedMethod} from '../site/personal-programme.mjs';
import {newMemory} from '../site/coach-memory.mjs';
import {makeCheck} from '../site/precision-checks.mjs';
import {routes,visit} from '../site/engine/engine.mjs';
const day='2026-11-27',now=Date.parse(day+'T12:00:00Z');
const ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const stamp=(d,m=0)=>Date.parse(d+'T09:00:00Z')+m*60000;
const normal={name:'Scoring Survival',tier:4,target:60,lives:3};
const alternative={name:'Scoring Ladder',tier:4,targets:[55,59,63],lives:3};
function history(){
 const host={sessions:[],games:[],assessmentHistory:[],bigSingles:[]},memory=newMemory();memory.learnedMethods=true;
 for(let i=0;i<12;i++){
  const before=ago(90-i*7),date=ago(89-i*7),after=ago(87-i*7),better=i%4===1||i%4===2,g=better?alternative:normal,id=i+1,eid=id+':exercise:0';
  host.sessions.push({id,date,start:stamp(date),quick:false,extra:false,completed:true,activities:[{name:g.name,exerciseId:eid,exerciseIndex:0,seconds:600,rounds:3,at:stamp(date,10)}]});
  for(let j=1;j<=3;j++)host.games.push({name:g.name,sessionId:id,exerciseId:eid,exerciseIndex:0,day:date,at:stamp(date,j),quick:false,extra:false,recovery:false,completion:'natural',win:j<3,tierAtStart:4,ruleVersion:null,learningSetting:recordSetting(g,g).learningSetting});
  memory.state.observations.push(makeCheck('scoring',600,before),makeCheck('scoring',better?670:600,after));
 }
 return {host,memory};
}
const choose=f=>chooseLearnedMethod(f.host,{memory:f.memory,state:f.memory.state,report:{decision:'balanced',verification:{status:'passed'}}},[{normal:normal.name,alternative:alternative.name,skill:'scoring',normalTier:4,alternativeTier:4,seconds:600,normalScore:10,alternativeScore:11}],{categories:{scoring:{}}},day,now);
test('independent: impossible elapsed exposures cannot grant an integrated learned method switch',()=>{
 const f=history();assert.equal(choose(f).status,'selected');
 // Keep 600-second claims and complete rounds, compress every session to four seconds.
 for(const s of f.host.sessions){s.activities[0].at=s.start+4000;for(const [j,g] of f.host.games.filter(g=>g.sessionId===s.id).entries())g.at=s.start+(j+1)*1000;}
 assert.equal(choose(f).status,'unchanged');
 assert.equal(extractLearningExposure(f.host,day,now).exposures.length,0);
 assert.equal(trainingLedger(f.host,day,now).rows.length,0);
});
test('independent: duplicate session identity contaminates both recorded dates',()=>{
 const f=history(),s=f.host.sessions[0],other=ago(2);
 f.host.sessions.push({...structuredClone(s),date:other,start:stamp(other),activities:[]});
 const r=extractLearningExposure(f.host,day,now);
 assert.ok(r.blockedDays.includes(s.date));assert.ok(r.blockedDays.includes(other));
});
test('independent: cumulative activity time cannot exceed elapsed wall time',()=>{
 const f=history(),s=f.host.sessions[0];
 s.activities.push({name:'Warm-up',exerciseId:'overlap',exerciseIndex:1,seconds:600,rounds:0,at:s.activities[0].at});
 const r=extractLearningExposure(f.host,day,now);
 assert.ok(!r.exposures.some(e=>e.sessionId===s.id));
 assert.ok(r.blockedDays.includes(s.date));
 assert.ok(!trainingLedger(f.host,day,now).rows.some(e=>e.sessionId===s.id));
});
test('independent: plausible rounding and pauses preserve valid evidence',()=>{
 const f=history();
 for(const s of f.host.sessions){s.activities[0].at-=400;}
 assert.equal(choose(f).status,'selected');
 for(const s of f.host.sessions){s.activities[0].at+=600000;}
 assert.equal(choose(f).status,'selected');
});
test('independent: route sets equal separately enumerated segment sequences',()=>{
 const segments=Array.from({length:20},(_,i)=>i+1).flatMap(n=>[['S'+n,n],['D'+n,2*n],['T'+n,3*n]]).concat([['25',25],['50',50]]);
 const expected=new Map();
 function add(path,total){if(total>170)return;const k=path.length+'/'+total;if(!expected.has(k))expected.set(k,new Set());expected.get(k).add(path.join(','));}
 const finals=segments.filter(([s])=>s[0]==='D'||s==='50');
 for(const [s,n] of finals){add([s],n);for(const [a,x] of segments){add([a,s],x+n);for(const [b,y] of segments)add([b,a,s],y+x+n);}}
 let queries=0,paths=0;
 for(let darts=1;darts<=3;darts++)for(let score=2;score<=170;score++){
  const want=new Set();for(let d=1;d<=darts;d++)for(const p of expected.get(d+'/'+score)??[])want.add(p);
  const actual=routes(score,darts).map(p=>p.join(','));assert.equal(new Set(actual).size,actual.length);assert.deepEqual(new Set(actual),want);queries++;paths+=actual.length;
 }
 console.log(JSON.stringify({independentRouteQueries:queries,returnedPaths:paths}));
});
test('independent: seeded straight-in visits match a separate state machine',()=>{
 let seed=0x27b00b5;const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
 const labels=['MISS','25','50',...Array.from({length:20},(_,i)=>i+1).flatMap(n=>['S'+n,'D'+n,'T'+n])];
 const value=s=>s==='MISS'?0:/^[0-9]+$/.test(s)?Number(s):Number(s.slice(1))*({S:1,D:2,T:3}[s[0]]);
 for(let i=0;i<100000;i++){
  const start=2+next()%500,darts=Array.from({length:3},()=>labels[next()%labels.length]);
  let remaining=start,bust=false,used=0;for(const s of darts){used++;const v=remaining-value(s);if(v<0||v===1||v===0&&!(s[0]==='D'||s==='50')){bust=true;remaining=start;break;}remaining=v;if(v===0)break;}
  assert.deepEqual(visit(start,darts),{remaining,bust,finished:remaining===0,opened:true,used});
 }
 console.log('Independent visits: 100000; xorshift32 initial seed 0x27b00b5');
});
