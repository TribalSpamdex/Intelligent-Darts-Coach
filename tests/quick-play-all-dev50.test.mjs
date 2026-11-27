import test from 'node:test';
import assert from 'node:assert/strict';
import {extraQuickRounds,EXTRA_QUICK_GAMES,quickAdaptiveMeasurements,projectEvidence} from '../site/v62-evidence.mjs';
import {projectTargets} from '../site/host-targets.mjs';
import {gameProfile} from '../site/game-profile.mjs';
import {quickMeasurementCards} from '../site/precision-adapter.mjs';
import {projectExposure} from '../site/host-exposure.mjs';
import {integratedAsk} from '../site/integrated-dialogue.mjs';
import {newMemory} from '../site/coach-memory.mjs';
const day='2026-11-27',now=Date.parse(day+'T12:00Z'),at=now-1000;
const row=(name,d,top={})=>({name,day,at,offsetMinutes:0,sessionId:'s',quick:true,completion:'natural',benchmark:false,tierAtStart:4,recovery:false,challengeTuning:null,thrown:d.thrown??0,hits:d.hits??0,points:d.points??0,visits:d.visits,success:d.success??0,details:{name,...d},...top});
const host=(g,patch={})=>({games:[g],sessions:[{id:'s',start:at-10000,end:now,date:day,startOffsetMinutes:0,quick:true,quickGame:g.name,focus:[g.name],activities:[]}],bigSingles:[],assessmentHistory:[],...patch});
const fixture={
 'Shanghai Combo':()=>row('Shanghai Combo',{target:20,stage:3,hits:3,thrown:4,combinations:1,lives:2,skillTrace:[{hit:true},{hit:false},{hit:true},{hit:true}]}),
 'Number Lock':()=>row('Number Lock',{ring:'D',targets:[20,16,8],allowedMisses:4,locked:[20,8,16],hits:3,misses:1,thrown:4,skillTrace:[{value:20},{value:0},{value:8},{value:16}]}),
 'Halve It':()=>row('Halve It',{targets:['S20','D20','T20','BULL','S19','S18'],index:6,visits:6,thrown:18,points:176,halves:1,skillTrace:[1,0,2,1,0,0].map(action=>({action}))}),
 '101 Sprint':()=>row('101 Sprint',{allowed:5,used:4,success:1,hits:1,skillTrace:[{action:'miss'},{action:'miss'},{finish:2}]}),
 'Golf Five':()=>row('Golf Five',{ring:'S',holes:[20,1,18,4,13],index:5,shots:0,strokes:8,hits:4,thrown:7,skillTrace:['hit','miss','miss','miss','hit','hit','hit'].map(action=>({action}))},{score:8}),
 'Cricket Countdown':()=>row('Cricket Countdown',{targets:[20,25],marks:[3,3],index:2,allowed:15,hits:3,thrown:4,skillTrace:[{action:3},{action:2},{action:0},{action:1}]}),
 'Double-In 201':()=>row('Double-In 201',{entryLimit:5,maxVisits:10,entered:true,entryDouble:20,entryMisses:1,entryDarts:2,points:201,remaining:0,visits:3,busts:1,thrown:10,dartsUsed:10,wins:1,scores:[60,0,101,40],skillTrace:[{kind:'entry',score:60,double:20,entry:2,darts:3},{kind:'bust',score:0,darts:3},{kind:'visit',score:101,darts:3},{kind:'finish',score:40,darts:1}]},{dartsUsed:10}),
 'Switchback':()=>row('Switchback',{ring:'D',sequence:[20,19,20],index:3,allowed:10,hits:4,misses:1,thrown:5,skillTrace:['hit','miss','hit','hit','hit'].map(action=>({action}))}),
 'Last Dart Rescue':()=>row('Last Dart Rescue',{targets:[40,50],aim:null,index:2,lives:1,thrown:3,hits:2,skillTrace:[{choice:'D16'},{choice:'D20'},{hit:false},{choice:'D20'},{hit:true},{choice:'BULL'},{hit:true}]}),
 'Last Dart Standing':()=>row('Last Dart Standing',{scores:[40,39],index:2,lives:1,thrown:3,hits:2,choice:null,skillTrace:[{choice:'SETUP',value:'hit'},{choice:'FINISH',value:'hit'},{choice:'SETUP',value:'hit'}]}),
 'Pressure Cricket':()=>row('Pressure Cricket',{targets:[20,19,18],marks:[3,3,3],index:3,allowed:12,hits:3,thrown:4,skillTrace:[3,0,3,3].map(value=>({value}))}),
 'Neighbour Trap':()=>row('Neighbour Trap',{target:20,goal:2,allowed:10,progress:2,neighbours:1,hits:3,thrown:4,skillTrace:['20','1','20','20'].map(value=>({value}))}),
 'Double Jackpot':()=>row('Double Jackpot',{ring:'D',allowed:10,goal:72,points:72,usedTargets:[20,16],hits:2,thrown:3,skillTrace:[{choice:20,value:'miss'},{choice:20,value:'hit'},{choice:16,value:'hit'}]}),
 'Checkout Poker':()=>row('Checkout Poker',{cards:[80,72,64],allowed:4,attempts:3,wins:2,failures:1,thrown:7,dartsUsed:4,cardsUsed:[80,72],skillTrace:[{score:80,value:'miss',darts:3},{score:80,value:'hit',darts:2},{score:72,value:'hit',darts:2}]}),
 'Double Bull Bridge':()=>row('Double Bull Bridge',{stages:['D20','BULL','D16'],index:3,allowed:10,hits:3,thrown:4,skillTrace:['hit','miss','hit','hit'].map(value=>({value}))})
};
// 20 -> 10 -> 130 -> 155 -> 77 -> 38; three halves, raw hits retained.
fixture['Halve It']=()=>row('Halve It',{targets:['S20','D20','T20','BULL','S19','S18'],index:6,visits:6,thrown:18,points:38,halves:3,skillTrace:[1,0,2,1,0,0].map(action=>({action}))});
test('every formerly excluded game now has a validated saved measurement and a visible card',()=>{
 assert.deepEqual(Object.keys(fixture),[...EXTRA_QUICK_GAMES]);
 for(const [name,make] of Object.entries(fixture)){
  const g=make(),h=host(g),before=JSON.stringify(h),r=extraQuickRounds(h,day,now);
  assert.equal(r.length,1,name);assert.ok(r[0].metrics.length+r[0].targets.length+r[0].finishes.length>0,name);
  assert.ok(quickMeasurementCards(h,day,now).some(c=>c.key.includes(name)),name);
  assert.equal(projectEvidence(h,{today:day,now}).observations.length,0,name);
  assert.deepEqual(projectExposure(h,day,now).exposure,[],name);
  assert.equal(JSON.stringify(h),before,name);
 }
});
test('trace replay distinguishes actual intended target from pool/sector/decision evidence',()=>{
 const r=name=>extraQuickRounds(host(fixture[name]()),day,now)[0];
 assert.deepEqual(r('Shanghai Combo').targets.map(x=>x.target),['S20','D20','D20','T20']);
 assert.equal(r('Number Lock').targets.length,0);assert.equal(r('Number Lock').metrics[0].attempts,4);
 assert.equal(r('Halve It').targets.reduce((n,x)=>n+x.attempts,0),15);
 assert.equal(r('Cricket Countdown').targets.length,0);
 assert.equal(r('Last Dart Rescue').metrics[0].unit,'decisions');assert.equal(r('Last Dart Rescue').metrics[0].hits,3);
 assert.equal(r('Last Dart Rescue').targets.length,3);
 assert.equal(r('Last Dart Standing').metrics[0].hits,2);
 assert.equal(r('Double Bull Bridge').metrics[0].attempts,2);
});
test('checkout poker uses exact legal attempts; 101 sprint and double-in opening are distinct denominators',()=>{
 const poker=gameProfile(host(fixture['Checkout Poker']()),day,now);
 assert.equal(poker.checkout.reduce((n,x)=>n+x.attempts,0),3);assert.equal(poker.checkout.reduce((n,x)=>n+x.hits,0),2);
 const sprint=quickAdaptiveMeasurements(host(fixture['101 Sprint']()),day,now);assert.equal(sprint[0].unit,'rounds');assert.equal(sprint[0].attempts,1);
 const double=quickAdaptiveMeasurements(host(fixture['Double-In 201']()),day,now);assert.ok(double.some(x=>x.scoring&&x.attempts===10&&x.hits===201));assert.ok(double.some(x=>!x.scoring&&x.attempts===2&&x.hits===1));
});
test('inconsistent native traces and conflicts are excluded, Undo/deletion rebuilds the evidence',()=>{
 for(const make of Object.values(fixture)){
  const g=make(),h=host(g);assert.equal(extraQuickRounds({...h,games:[g,structuredClone(g)]},day,now).length,1,g.name);
  const altered=structuredClone(g);altered.details.skillTrace.push({bad:true});
  assert.equal(extraQuickRounds({...h,games:[altered]},day,now).length,0,g.name);
  assert.equal(extraQuickRounds({...h,games:[g,altered]},day,now).length,0,g.name);
  assert.equal(extraQuickRounds({...h,games:[]},day,now).length,0,g.name);
  for(const patch of [{completion:'partial'},{quick:false},{at:now+1000},{recovery:true}])assert.equal(extraQuickRounds(host({...g,...patch}),day,now).length,0,g.name);
 }
});
test('impossible checkout, out-of-order opening, unlinked round and false marker never qualify',()=>{
 for(const name of ['Checkout Poker','101 Sprint','Double-In 201']){
  const g=fixture[name]();if(name==='Checkout Poker')g.details.skillTrace[1].darts=1;
  else if(name==='101 Sprint')g.details.skillTrace[2].finish=1;
  else g.details.skillTrace[0].entry=4;
  assert.equal(extraQuickRounds(host(g),day,now).length,0,name);
 }
 const g=fixture['Shanghai Combo']();assert.equal(extraQuickRounds(host(g,{sessions:[]}),day,now).length,0);
 assert.equal(extraQuickRounds(host({...g,completion:'partial',verifiedQuick:true}),day,now).length,0);
});
test('old unlogged rounds are not retroactively invented; explicit historical set/round counts remain useful',()=>{
 const g=fixture['Shanghai Combo']();delete g.details.skillTrace;assert.equal(extraQuickRounds(host(g),day,now).length,0);
 const p=fixture['Number Lock']();delete p.details.skillTrace;Object.assign(p,{ring:p.details.ring,targets:p.details.targets,locked:p.details.locked,misses:p.details.misses});assert.equal(extraQuickRounds(host(p),day,now)[0].targets.length,0);
 const q=fixture['101 Sprint']();delete q.details.skillTrace;assert.equal(extraQuickRounds(host(q),day,now)[0].metrics[0].unit,'rounds');
});
test('exact-target observations are available to coach statistics and not scored twice',()=>{
 const g=fixture['Golf Five'](),h=host(g),rows=projectTargets(h,day,now).rows;
 assert.equal(rows.reduce((n,x)=>n+x.attempts,0),7);
 assert.equal(rows.reduce((n,x)=>n+x.hits,0),4);
 const a=integratedAsk(h,newMemory().state,'How am I doing in Quick Play?',day,now);
 assert.equal(a.type,'quick-ability');assert.match(a.lines.join(' '),/Golf Five/);assert.doesNotMatch(a.lines.join(' '),/No eligible completed Quick Play/);
});
