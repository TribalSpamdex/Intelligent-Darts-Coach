import test from 'node:test';
import assert from 'node:assert/strict';
import {precisionRound,precisionOptions,validPrecisionRecord,SUPPORTED_GAMES,quarterDelta} from '../site/precision-games.mjs';
import {precisionAudit} from '../site/precision-audit.mjs';
import {snapshotPrecision,applyPrecision,createPrecisionAdapter} from '../site/precision-adapter.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const tiers={scoring:4,doubles:4,checkout:4,bull:4},decisions=Object.fromEntries(Object.keys(tiers).map(k=>[k,{tier:4,half:'upper'}]));
const fixtures={
 'Scoring Survival':{target:60},'Scoring Ladder':{targets:[55,59,63,67],step:0,target:55},'Staying Straight':{roundPointGoal:13},
 'Treble Hunt':{variant:'treble',lives:14},'Doubles Streak':{variant:'doubles',lives:14},'Doubles Survival':{variant:'doubles',allowed:8,sequence:[1,2,3,4,5,6]},
 'Bull Survival':{allowed:6},'Bull Streak':{allowedMisses:23},'Bull Bank':{goal:125,dartsLeft:15},'Bull Blackjack':{goal:150,allowed:19},
 'Number Lock':{ring:'D',allowedMisses:9},'Shanghai Combo':{lives:4},'Outside Doubles':{allowed:22,targets:[20,16,8,4]},'Double Double':{allowed:12,targets:[20,16,8,4]},
 'Double Bull Bridge':{allowed:8,stages:['D20','BULL','D16']},'Golf Five':{ring:'D',par:12},'Double-In 201':{maxVisits:9,entryLimit:5},
 '101 Sprint':{allowed:5},'170 Challenge':{maxVisits:3},'Last Dart Rescue':{lives:15},'Last Dart Standing':{lives:10},'Checkout Poker':{allowed:9},'Checkout Climb':{failedVisitLimit:8,finishGoal:5},'Focused Checkouts':{lives:11,config:{tier:4,lives:11,balanced:true,start:52,end:55}},'Pressure Cricket':{allowed:21,targets:[20,19,18]},
 'Cricket Countdown':{allowed:24,targets:[20,19,18,17,16,15]},'Switchback':{allowed:30,sequence:[20,19,20,18,20,17,20]},
 'Halve It':{goal:175},'Risk or Reward':{goal:310},'First Nine Siege':{goal:225},'Neighbour Trap':{allowed:13,goal:5},
 'Double Jackpot':{allowed:8,ring:'D',goal:72},'Double Duel':{opponentEvery:3},'Dartboard Bingo':{maxCalls:22,singleLineRound:false},'Split the Difference':{tolerance:19},
 '301 Pressure':{maxDarts:30,maxVisits:10},'501 Pressure':{maxDarts:28}
};
const base=(name,extra={})=>({name,tier:4,...fixtures[name],...extra});
const record=(n,i=0,extra={})=>{const g=precisionRound(base('Scoring Survival'),decisions,{eligible:true});return {name:g.name,day:ago(n),at:now-n*86400000-i-1,quick:false,extra:false,completion:'natural',tierAtStart:g.tier,ruleVersion:'rule',win:false,challengeTuning:g.challengeTuning,precision:g.precision,...extra}};
test('every supported rule has a concrete fixture; change only a feasible scalar or scoring ladder',()=>{assert.deepEqual([...SUPPORTED_GAMES].sort(),Object.keys(fixtures).sort());for(const name of SUPPORTED_GAMES.filter(n=>n!=='Double Duel')){const g=base(name),before=JSON.stringify(g),r=precisionRound(g,decisions,{eligible:true});assert.notEqual(r,g,name);assert.equal(r.tier,4);assert.equal(JSON.stringify(g),before);assert.equal(r.challengeTuning,'precision');assert.equal(validPrecisionRecord({...r,tierAtStart:r.tier}),true,name);assert.deepEqual(precisionRound(r,decisions,{eligible:true}),r);const fields=Object.keys(g).filter(k=>JSON.stringify(g[k])!==JSON.stringify(r[k]));assert.ok(fields.every(k=>k===r.precision.field||['target','maxVisits','config'].includes(k)),name)}});
test('precision adjustment does not touch fixed benchmarks or unsupported game semantics',()=>{for(const name of ['Scoring Challenge','Bull Accuracy','Big Singles','Target Mastery','High-Low','Double Duel']){const g=base(name,{target:60,goal:30});assert.equal(precisionRound(g,decisions,{eligible:true}),g)}});
test('quick, special, recovery, probe and prior tuning take precedence',()=>{const g=base('Scoring Survival');for(const opts of [{},{eligible:false},{eligible:true,probe:true},{eligible:true,safety:true},{eligible:true,cooldown:true}])assert.equal(precisionRound(g,decisions,opts),g);for(const p of [{recovery:true},{challengeTuning:'stretch'},{tier:3}]){const x={...g,...p};assert.equal(precisionRound(x,decisions,{eligible:true}),x)}});
test('beginner scalar scoring adjustment leaves foundation rings intact',()=>{const d={scoring:{tier:7,half:'upper'},doubles:{tier:7,half:'upper'}};const g=base('Scoring Survival',{tier:7,beginner:true,target:15});assert.equal(precisionRound(g,d,{eligible:true}).target,20);for(const name of ['Doubles Survival','Doubles Streak','Treble Hunt']){const x=base(name,{tier:7,beginner:true,variant:'singles'});assert.equal(precisionRound(x,d,{eligible:true}),x)}});
test('mixed-skill games and ring-specific Number Lock require appropriate evidence',()=>{for(const name of ['301 Pressure','501 Pressure','Double Bull Bridge']){const g=base(name),d={...decisions,[name==='Double Bull Bridge'?'bull':'checkout']:{tier:4,half:'foundation'}};assert.equal(precisionRound(g,d,{eligible:true}),g)}const g=base('Number Lock',{ring:'T'});assert.equal(precisionRound(g,decisions,{eligible:true}),g)});
test('cannot make a round mathematically impossible by reducing an allowance',()=>{for(const [name,extra] of [['Bull Bank',{goal:250,dartsLeft:5}],['Bull Blackjack',{goal:150,allowed:3}],['Outside Doubles',{allowed:4,targets:[20,16,8,4]}],['Double Double',{allowed:4,targets:[20,16,8,4]}],['Neighbour Trap',{allowed:5,goal:5}],['Dartboard Bingo',{maxCalls:20,singleLineRound:false}],['Switchback',{allowed:7}],['Cricket Countdown',{allowed:6}]]){const g=base(name,extra);assert.equal(precisionRound(g,decisions,{eligible:true}),g,name)}});
test('ladder thresholds and pressure visit ceiling stay synchronized',()=>{const g=precisionRound(base('Scoring Ladder'),decisions,{eligible:true});assert.deepEqual(g.targets,[60,64,68,72]);assert.equal(g.target,60);const p=precisionRound(base('301 Pressure'),decisions,{eligible:true});assert.equal(p.maxDarts,29);assert.equal(p.maxVisits,10);const c=precisionRound(base('Focused Checkouts'),decisions,{eligible:true});assert.equal(c.lives,10);assert.equal(c.config.lives,10);assert.equal(c.config.start,52);assert.equal(c.config.end,55)});
test('three consecutive modified rounds force a standard probe, but do not manufacture three days',()=>{const r=[record(0,0),record(0,1),record(0,2)];assert.equal(precisionOptions(r,'Scoring Survival',day,4,now).probe,true);assert.equal(precisionOptions(r,'Scoring Survival',day,4,now).cooldown,false);assert.equal(precisionOptions([record(0,0,{challengeTuning:null,precision:null,at:now}),...r],'Scoring Survival',day,4,now).probe,false)});
test('three independently failed precision days pause the adjustment and expire after seven days',()=>{const r=[record(0),record(1),record(2)];assert.equal(precisionOptions(r,'Scoring Survival',day,4,now).cooldown,true);assert.equal(precisionOptions(r,'Scoring Survival','2026-12-04',4,now+8*86400000).cooldown,false);assert.equal(precisionOptions(r.map(x=>({...x,quick:true})),'Scoring Survival',day,4,now).cooldown,false);assert.equal(precisionOptions(r.map(x=>({...x,at:now+1})),'Scoring Survival',day,4,now).cooldown,false)});
test('tampered precision provenance fails the audit and rule configurations do not pool',()=>{const a=record(0),b=record(1),c=record(2,0,{challengeTuning:null,precision:null,win:true}),bad={...record(3),precision:{...a.precision,after:180}};assert.equal(validPrecisionRecord(bad),false);const rows=precisionAudit([a,b,c,bad,a],day);assert.equal(rows.length,2);assert.equal(rows.find(r=>r.mode==='precision').rounds,2);assert.equal(rows.find(r=>r.mode==='standard').wins,1);assert.equal(precisionAudit([a,{...a,win:true}],day).length,0)});
const host={games:[],sessions:[],assessmentHistory:[],bigSingles:[]},obs=[0,1,7,8,14,15,21,22].map(n=>({id:'r'+n,day:ago(n),skill:'scoring',context:'practice',protocol:'IDC precision fixed scoring',attempts:30,hits:720}));
test('adapter respects calibration date, fatigue, pain and missing evidence',()=>{const state={observations:obs,readiness:[],clinic:[]};assert.equal(snapshotPrecision(host,state,day,tiers,null,now).decisions.scoring.half,'upper');assert.equal(snapshotPrecision(host,state,day,tiers,ago(3),now).decisions.scoring.half,'foundation');const x=snapshotPrecision(host,{...state,readiness:[{day,fatigue:'high'}]},day,tiers,null,now);assert.equal(x.safety,true);assert.equal(applyPrecision(base('Scoring Survival'),x,[],day,{eligible:true,now}).target,60);assert.equal(snapshotPrecision(host,{...state,clinic:[{day:ago(2),pain:true}]},day,tiers,null,now).safety,true)});
test('adapter recomputes after exercise changes or explicit invalidation and fails closed',()=>{let state={observations:obs},games=[];const adapter=createPrecisionAdapter(()=>({host:{...host,games},state,day,now})),ctx={eligible:true,sessionId:'s',exerciseIndex:0,tiers};assert.equal(adapter.adjust(base('Scoring Survival'),ctx).target,67);state={observations:[]};assert.equal(adapter.adjust(base('Scoring Survival'),ctx).target,67);assert.equal(adapter.adjust(base('Scoring Survival'),{...ctx,exerciseIndex:1}).target,60);state={observations:obs};adapter.invalidate();assert.equal(adapter.adjust(base('Scoring Survival'),ctx).target,67);assert.equal(createPrecisionAdapter(()=>{throw Error('broken')}).adjust(base('Scoring Survival'),ctx).target,60)});

const quarters=q=>Object.fromEntries(Object.keys(tiers).map(k=>[k,{tier:4,quarter:q}]).concat([['singles',{quarter:q}],['trebles',{quarter:q}]]));
test('all supported game configurations support monotone whole-number adjustments or a legal floor',()=>{for(const name of SUPPORTED_GAMES){const g=base(name,['Bull Survival','Bull Streak'].includes(name)?{target:'25/50'}:{});const a=[0,1,2,3].map(q=>precisionRound(g,quarters(q),{eligible:true}));assert.equal(a[0],g);for(let q=1;q<4;q++){const r=a[q];assert.notEqual(r,g,name+' '+q);assert.equal(r.precision.version,2);assert.ok(r.precision.quarter>=1&&r.precision.quarter<=q,name);assert.ok(validPrecisionRecord({...r,tierAtStart:4}),name);const prev=a[q-1],field=r.precision.field;const v=Array.isArray(r[field])?r[field]:[r[field]],p=Array.isArray(prev[field])?prev[field]:[prev[field]];const direction=Math.sign(quarterDelta(r.precision.after instanceof Array?5:r.precision.after-r.precision.before,1));assert.ok(v.every((x,i)=>Number.isInteger(x)&&(direction>0?x>=p[i]:x<=p[i])),name)}}});
test('four real lives and score budgets, not merely extra statistical bands',()=>{assert.deepEqual([0,1,2,3].map(q=>precisionRound(base('Doubles Streak'),quarters(q),{eligible:true}).lives),[14,13,12,11]);assert.deepEqual([0,1,2,3].map(q=>precisionRound(base('Scoring Survival'),quarters(q),{eligible:true}).target),[60,62,65,68]);assert.deepEqual([0,1,2,3].map(q=>precisionRound(base('301 Pressure'),quarters(q),{eligible:true}).maxDarts),[30,29,28,27]);assert.deepEqual([0,1,2,3].map(q=>precisionRound(base('Focused Checkouts'),quarters(q),{eligible:true}).config.lives),[11,10,9,8])});
test('when a higher quarter is infeasible the strongest legal lower setting is selected',()=>{const g=base('Bull Bank',{goal:250,dartsLeft:7});const r=precisionRound(g,quarters(3),{eligible:true});assert.equal(r.dartsLeft,5);assert.equal(r.precision.quarter,2);const d=base('Double Double',{allowed:5,targets:[20,16,8,4]});const x=precisionRound(d,quarters(3),{eligible:true});assert.equal(x.allowed,4);assert.equal(x.precision.quarter,1);assert.ok(validPrecisionRecord({...x,tierAtStart:4}))});
test('new ring-specific beginner adjustments require their own skill evidence',()=>{const g=base('Doubles Streak',{tier:7,beginner:true,variant:'singles',lives:12});const d={doubles:{tier:7,quarter:3},singles:{quarter:0}};assert.equal(precisionRound(g,d,{eligible:true}),g);const x=precisionRound(g,{...d,doubles:{tier:7,quarter:0},singles:{quarter:3}},{eligible:true});assert.equal(x.lives,9);assert.equal(x.precision.basis,'singles');assert.ok(validPrecisionRecord({...x,tierAtStart:7}));const t=base('Treble Hunt');assert.equal(precisionRound(t,{...quarters(3),trebles:{quarter:0}},{eligible:true}),t);assert.equal(precisionRound(t,quarters(3),{eligible:true}).precision.basis,'trebles')});
test('centre and inner-bull variants remain unchanged without matching evidence',()=>{for(const target of ['CENTRE','50'])for(const name of ['Bull Survival','Bull Streak']){const g=base(name,{target});assert.equal(precisionRound(g,quarters(3),{eligible:true}),g)}});
function qrecord(n,q,extra={}){const g=precisionRound(base('Scoring Survival'),quarters(q),{eligible:true});return {...record(n),precision:g.precision,...extra}}
test('three failed days at a harder configuration step back only one subdivision',()=>{const history=[qrecord(0,3),qrecord(1,3),qrecord(2,3)];const x=precisionOptions(history,'Scoring Survival',day,4,now);assert.equal(x.maxQuarter,2);assert.equal(x.cooldown,false);assert.equal(precisionRound(base('Scoring Survival'),quarters(3),{eligible:true,maxQuarter:x.maxQuarter}).target,65);assert.equal(precisionOptions(history,'Scoring Survival','2026-12-04',4,now+8*86400000).maxQuarter,3)});
test('mixed configurations, duplicates and mixed-result days never fake three matching failure days',()=>{const r=[qrecord(0,3),qrecord(1,2),qrecord(2,3)];assert.equal(precisionOptions(r,'Scoring Survival',day,4,now).maxQuarter,3);const a=qrecord(0,3),b=qrecord(1,3),c=qrecord(2,3);assert.equal(precisionOptions([a,a,a],'Scoring Survival',day,4,now).probe,false);assert.equal(precisionOptions([a,b,c,{...a,at:now-2,win:true}],'Scoring Survival',day,4,now).maxQuarter,3);assert.equal(precisionOptions([a,b,c,{...a,win:true}],'Scoring Survival',day,4,now).maxQuarter,3)});
test('historical one-step records and new quarter settings remain independently valid',()=>{const a=record(0),b=qrecord(1,1),c=qrecord(2,3);assert.ok([a,b,c].every(validPrecisionRecord));assert.equal(precisionAudit([a,b,c],day).length,3);assert.equal(validPrecisionRecord({...c,precision:{...c.precision,quarter:2}}),false);assert.equal(precisionRound(base('Scoring Survival'),{scoring:{tier:4,quarter:8,half:'upper'}},{eligible:true}).target,60)});

test('Double Duel rival uses legal fixed intervals and never makes perfect play unwinnable',()=>{const g=base('Double Duel',{tier:7,opponentEvery:6}),d={doubles:{tier:7,quarter:0},singles:{quarter:3}};assert.equal(precisionRound(g,d,{eligible:true}).opponentEvery,3);assert.equal(precisionRound(g,{...d,singles:{quarter:0}},{eligible:true}),g);const a=[0,1,2,3].map(q=>precisionRound(g,{...d,singles:{quarter:q}},{eligible:true}).opponentEvery);assert.deepEqual(a,[6,5,4,3]);const x=precisionRound(base('Double Duel'),quarters(3),{eligible:true});assert.equal(x.opponentEvery,2);assert.equal(x.precision.quarter,1);assert.ok(validPrecisionRecord({...x,tierAtStart:4}));assert.equal(validPrecisionRecord({...x,tierAtStart:4,precision:{...x.precision,version:1}}),false);for(const n of [2,3,4,5,6])assert.ok(Math.floor(4/n)<4)});

test('continuous scoring settings use real intermediate points with exact provenance',()=>{
 const g=base('Scoring Survival'),d=q=>({scoring:{tier:4,quarter:Math.floor(q+1e-8),challenge:q}});
 const levels=[0,.5,1,1+1/3,1+2/3,2,2+1/3,2+2/3,3];
 assert.deepEqual(levels.map(q=>precisionRound(g,d(q),{eligible:true}).target),[60,61,62,63,64,65,66,67,68]);
 for(const q of levels.slice(1)){
  const r=precisionRound(g,d(q),{eligible:true});
  assert.equal(r.precision.version,Number.isInteger(q)?2:3);
  assert.ok(validPrecisionRecord({...r,tierAtStart:4}));
  assert.equal(validPrecisionRecord({...r,tierAtStart:4,precision:{...r.precision,after:r.target+1}}),false);
 }
 assert.equal(precisionRound(g,d(3),{eligible:true,maxQuarter:1+1/3}).target,63);
 assert.equal(precisionRound(g,d(3),{eligible:true,probe:true}).target,60);
});
test('fractional three-day failure cooldown steps back to previous real setting',()=>{
 const g=base('Scoring Survival'),d={scoring:{tier:4,quarter:2,challenge:2+2/3}};
 const r=precisionRound(g,d,{eligible:true});
 const history=[0,1,2].map(n=>({...record(n),precision:r.precision}));
 const cap=precisionOptions(history,g.name,day,4,now,g);
 assert.equal(cap.maxQuarter,2+1/3);
 assert.equal(precisionRound(g,d,{eligible:true,maxQuarter:cap.maxQuarter}).target,66);
});
test('continuous measured profiles retain all 37 integer game configurations and safety constraints',()=>{
 for(const name of SUPPORTED_GAMES){
  const g=base(name,['Bull Survival','Bull Streak'].includes(name)?{target:'25/50'}:{});
  const runs=Array.from({length:301},(_,i)=>{
   const v=i/100,d=Object.fromEntries(Object.entries(quarters(Math.floor(v))).map(([k,x])=>[k,{...x,challenge:v}]));
   const r=precisionRound(g,d,{eligible:true});
   assert.ok(r===g||validPrecisionRecord({...r,tierAtStart:4}),name);
   assert.equal(precisionRound(g,d,{eligible:true,safety:true}),g);
   return r;
  });
  const field=runs.find(r=>r.precision)?.precision.field;
  if(!field)continue;
  for(let i=1;i<runs.length;i++){
   const prev=runs[i-1][field],next=runs[i][field],end=runs.at(-1)[field],start=g[field];
   const a=Array.isArray(prev)?prev:[prev],b=Array.isArray(next)?next:[next],z=Array.isArray(end)?end:[end],s=Array.isArray(start)?start:[start];
   assert.ok(b.every((v,j)=>Number.isInteger(v)&&(z[j]>=s[j]?v>=a[j]:v<=a[j])),name);
  }
 }
});
