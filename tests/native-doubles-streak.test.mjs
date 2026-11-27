import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const slice=name=>{const a=html.indexOf('function '+name+'('),b=html.indexOf('\n}',a)+2;assert.ok(a>=0&&b>a,name);return html.slice(a,b)};
function fixture(version,lives=3,goal=2){
 const g={name:'Doubles Streak',variant:'doubles',ruleVersion:version,targets:[20,16,8],targetIndex:0,lives,goal,streak:0,best:0,hits:0,misses:0,thrown:0,targetLog:[]},ss={phase:'playing',pausedAt:null},data={game:g};
 let saved=0,ended=0,undo=null;
 const dart=new Function('activeGame','session','data','snapshot','save','endRound',slice('doublesStreakDart')+'\nreturn doublesStreakDart')(g,()=>ss,data,()=>{undo=structuredClone(g)},()=>saved++,()=>ended++);
 return {g,ss,dart,result:()=>({saved,ended,undo})};
}
test('Doubles Streak holds the target past the milestone and advances on first miss',()=>{
 for(const goal of [1,2,4,6,12])for(const lives of [2,3,8]){
  const f=fixture('same-target-streak-v1',lives,goal);
  for(let i=0;i<goal+5;i++){f.dart(true);assert.equal(f.g.targetIndex,0);assert.equal(f.result().ended,0)}
  f.dart(false);assert.equal(f.g.targetIndex,1);assert.equal(f.g.streak,0);assert.equal(f.g.lives,lives-1);assert.equal(f.g.best,goal+5);
  assert.equal(f.result().undo.streak,goal+5);
  f.dart(true);assert.equal(f.g.targetIndex,1);
  for(let i=0;i<lives-1;i++)f.dart(false);
  assert.equal(f.result().ended,1);assert.equal(f.g.lives,0);
  assert.equal(f.g.targetLog.length,f.g.thrown);assert.equal(f.g.targetLog.at(-1).hit,false);
 }
});
test('restored old round retains old advancement and finite goal; new protocol is distinct',()=>{
 const old=fixture('balanced-round-v1');old.dart(true);assert.equal(old.g.targetIndex,1);old.dart(false);assert.equal(old.g.targetIndex,1);old.dart(true);old.dart(true);assert.equal(old.result().ended,1);
 const expected=new Function(slice('dcRC2ExpectedRules')+'\nreturn dcRC2ExpectedRules')();
 for(let tier=1;tier<=7;tier++)assert.equal(expected('Doubles Streak',tier),'same-target-streak-v1');
});
test('recreational target variation memory cannot mutate scheduled practice history',()=>{
 const memory=new Function('data',slice('dcRC2Memory')+'\nreturn dcRC2Memory')({activeSession:{quick:true},targetVariation:{version:2,history:{x:['normal']},exposure:{S:[],D:[16],T:[]}}});
 const m=memory();assert.deepEqual(m.exposure.D,[]);m.exposure.D.push(20);assert.deepEqual(memory().exposure.D,[20]);
 const data={targetVariation:{version:2,history:{x:['normal']},exposure:{S:[],D:[16],T:[]}},activeSession:{quick:true}};
 const get=new Function('data',slice('dcRC2Memory')+'\nreturn dcRC2Memory')(data);
 get().history.x=['recreational'];get().exposure.D.push(20);data.activeSession=null;
 assert.deepEqual(get().history.x,['normal']);assert.deepEqual(get().exposure.D,[16]);
});
test('per-target progress never joins hits from different targets or invents missing locations',()=>{
 const view=new Function(slice('dcVisibleProgress')+'\nreturn dcVisibleProgress')();
 const g={name:'Doubles Streak',variant:'doubles',ruleVersion:'same-target-streak-v1',thrown:4,hits:4,targetLog:[{target:20,ring:'D',hit:true},{target:20,ring:'D',hit:true},{target:16,ring:'D',hit:true},{target:16,ring:'D',hit:true}]};
 assert.deepEqual(view(g,null,null,[]),{hits:4,streak:2,best:2,checkout:false});
 g.targetLog[3]={ring:'D',hit:true};assert.deepEqual(view(g,null,null,[]),{hits:4,streak:null,best:2,checkout:false,incomplete:true});
});
