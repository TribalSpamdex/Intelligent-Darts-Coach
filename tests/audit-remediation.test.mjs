import test from 'node:test';
import assert from 'node:assert/strict';
import {newMemory,validateMemory} from '../site/coach-memory.mjs';
import {makeCheck} from '../site/precision-checks.mjs';
import {legalFinishCount} from '../site/finish-validation.mjs';
import {projectExposure} from '../site/host-exposure.mjs';
const day='2026-11-15',now=Date.parse(day+'T12:00:00Z');
test('Sol H6: reserved fixed protocol cannot be forged with ordinary identities or inflated denominators',()=>{
 const raw=newMemory();
 raw.state.observations=Array.from({length:21},(_,i)=>({id:'ordinary-'+i,day:new Date(Date.parse(day)-i*86400000).toISOString().slice(0,10),skill:'doubles',protocol:'IDC precision fixed doubles',context:'practice',attempts:1000,hits:1000}));
 assert.throws(()=>validateMemory(raw));
 for(const skill of ['doubles','scoring','checkout','bull','singles','trebles']){
  const m=newMemory(),valid=makeCheck(skill,0,day);
  m.state.observations=[valid];assert.equal(validateMemory(m).state.observations.length,1);
  for(const patch of [{id:'ordinary'},{attempts:valid.attempts+1},{context:'competition'},{protocol:'other'}]){
   assert.throws(()=>validateMemory({...m,state:{...m.state,observations:[{...valid,...patch}]}}));
  }
 }
});
test('Sol M5: missed darts may precede the exact legal finishing dart',()=>{
 for(const [score,darts] of [[2,2],[2,3],[3,3],[50,3]])assert.equal(legalFinishCount(score,darts),true);
 for(const [score,darts] of [[1,3],[3,1],[169,3],[170,2],[171,3],[2,0]])assert.equal(legalFinishCount(score,darts),false);
});
test('Sol M4: future or out-of-activity linked rounds cannot retroactively classify doubles exposure',()=>{
 const s={id:1,date:day,start:now-900000,quick:false,activities:[{name:'Doubles Survival',exerciseId:'e',exerciseIndex:0,seconds:600,at:now}]};
 const g={name:'Doubles Survival',sessionId:1,exerciseId:'e',quick:false,variant:'doubles',day,at:now-1000};
 const h={sessions:[s],games:[]};const original=projectExposure(h,day);
 for(const patch of [{day:'2026-11-16',at:now+86400000},{at:now+1},{at:s.start-1},{day:undefined},{at:undefined}]){
  h.games=[{...g,...patch}];assert.deepEqual(projectExposure(h,day),original);
 }
 h.games=[g];assert.deepEqual(projectExposure(h,day).exposure,[{day,skill:'doubles',minutes:10}]);
});
