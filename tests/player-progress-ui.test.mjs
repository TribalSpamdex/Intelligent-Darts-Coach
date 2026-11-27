import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const start=source.indexOf('function dcVisibleProgress('),end=source.indexOf('function endRound(){',start);
assert.ok(start>=0&&end>start);
const ctx=vm.createContext({});
vm.runInContext(source.slice(start,end),ctx);
const progress=(g,s,e,history)=>JSON.parse(JSON.stringify(ctx.dcVisibleProgress(g,s,e,history)));
const s={id:'session'},e={provenanceId:'exercise'};
const dart=(hits,extra={})=>({name:'Doubles Survival',variant:'doubles',thrown:hits.length,targetLog:hits.map(hit=>({hit})),...extra});
const past=(hits,extra={})=>dart(hits,{sessionId:s.id,exerciseId:e.provenanceId,completion:'natural',...extra});
const expected=(hits,streak,best,checkout=false)=>({hits,streak,best,checkout});
test('real dart streak crosses completed rounds, resets on miss and follows Undo',()=>{
 const history=[past([true,true,true])];
 assert.deepEqual(progress(dart([true,true]),s,e,history),expected(5,5,5));
 assert.deepEqual(progress(dart([true,true,false]),s,e,history),expected(5,0,5));
 assert.deepEqual(progress(dart([true,true,false,true]),s,e,history),expected(6,1,5));
 assert.deepEqual(progress(dart([true,true]),s,e,history),expected(5,5,5));
 assert.deepEqual(progress(dart([true,true]),s,e,[]),expected(2,2,2));
});
test('exercise identity, different rings, missing logs and incomplete rounds never fabricate streaks',()=>{
 assert.deepEqual(progress(dart([true]),s,e,[past([true,true],{exerciseId:'other'})]),expected(1,1,1));
 assert.deepEqual(progress(dart([true]),s,e,[past([true,true],{variant:'singles'})]),{...expected(1,1,1),incomplete:true});
 assert.deepEqual(progress(dart([true]),s,e,[past([true,true]),past([true],{thrown:5})]),{...expected(3,1,2),incomplete:true});
 assert.deepEqual(progress(dart([true]),s,e,[past([true,true]),past([true],{completion:'partial'})]),{...expected(3,1,2),incomplete:true});
});
test('checkout streak measures completed attempts, not missed individual darts',()=>{
 const checkout=(values,extra={})=>({name:'Checkout Climb',success:values.filter(Boolean).length,fail:values.filter(x=>!x).length,attemptLog:values.map(hit=>({hit})),...extra});
 const history=[checkout([1,1],{sessionId:s.id,exerciseId:e.provenanceId,completion:'natural'})];
 assert.deepEqual(progress(checkout([0,1],{attempt:2}),s,e,history),expected(3,1,2,true));
 assert.deepEqual(progress(checkout([],{attempt:2}),s,e,history),expected(2,2,2,true));
});
test('round overlays are disabled and historical outcome labels hidden without modifying stored results',()=>{
 assert.match(source,/function announceRound\(\)\{hideRoundAnnouncement\(\)\}/);
 assert.doesNotMatch(source,/WIN \/|W \/ '\+losses|· Previous round/);
 assert.equal(ctx.dcVisibleRoundResult('RECOVERY · WIN · 4/8 hits'),'RECOVERY · 4/8 hits');
 assert.equal(ctx.dcVisibleRoundResult('LOSE · Doubles Survival · 2/6 hits'),'Doubles Survival · 2/6 hits');
 assert.match(source,/e\.win=won;e\.loss=!won/);
 assert.match(source,/data\.games\.push\(result\);s\.roundsCompleted\+\+;s\.round\+\+/);
});
