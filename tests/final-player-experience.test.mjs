import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const ctx=vm.createContext({});
vm.runInContext(html.slice(html.indexOf('function dcVisibleProgress('),html.indexOf('function endRound(){')),ctx);
const read=(g,history=[])=>JSON.parse(JSON.stringify(ctx.dcVisibleProgress(g,{id:1},{provenanceId:'e'},history)));
const game=(bits,over={})=>({name:'Doubles Survival',variant:'doubles',thrown:bits.length,hits:bits.filter(Boolean).length,targetLog:bits.map(hit=>({ring:'D',target:16,hit})),...over});
const past=g=>({...g,sessionId:1,exerciseId:'e',completion:'natural'});
test('independent binary sequence oracle: every eight-dart sequence at all nine round splits',()=>{
 let cases=0;
 for(let mask=0;mask<256;mask++){
  const bits=Array.from({length:8},(_,i)=>Boolean(mask&(1<<i)));
  let total=0,current=0,best=0;
  for(const hit of bits){if(hit){total++;current++;best=Math.max(best,current)}else current=0}
  for(let split=0;split<=8;split++){
   assert.deepEqual(read(game(bits.slice(split)),[past(game(bits.slice(0,split)))]),{hits:total,streak:current,best,checkout:false});cases++;
  }
 }
 assert.equal(cases,2304);console.log('Independent sequence/split helper cases: '+cases);
});
test('missing chronology preserves recorded totals and marks the current streak unknown',()=>{
 assert.deepEqual(read(game([],{thrown:12,hits:7,targetLog:undefined})),{hits:7,streak:null,best:0,checkout:false,incomplete:true});
 assert.deepEqual(read(game([true]),[past(game([],{thrown:12,hits:7,targetLog:undefined}))]),{hits:8,streak:1,best:1,checkout:false,incomplete:true});
});
test('wrong ring, impossible target, null and untyped hits cannot join genuine streaks',()=>{
 for(const entry of [{ring:'T',target:16,hit:true},{ring:'D',target:21,hit:true},null,{hit:'true'}]){
  const r=read(game([true,true,true],{targetLog:[{ring:'D',target:16,hit:true},entry,{ring:'D',target:16,hit:true}]}));
  assert.equal(r.hits,2);assert.equal(r.streak,1);assert.equal(r.best,1);assert.equal(r.incomplete,true);
 }
});
test('legacy numeric counts are accepted without concatenating checkout attempts',()=>{
 const g={name:'Checkout Climb',success:'1',fail:'1',attemptLog:[{target:61,hit:0},{target:60,hit:1}]};
 assert.deepEqual(read(g),{hits:1,streak:1,best:1,checkout:true});
});
test('bull rounds keep target variants separate, and new double drills use actual saved logs',()=>{
 const bull=(target,bits)=>({name:'Bull Survival',target,thrown:bits.length,hits:bits.filter(Boolean).length,targetLog:bits.map(hit=>({target,hit}))});
 assert.deepEqual(read(bull('50',[true]),[past(bull('50',[false,true]))]),{hits:2,streak:2,best:2,checkout:false});
 assert.deepEqual(read(bull('50',[true]),[past(bull('25/50',[true]))]),{hits:1,streak:1,best:1,checkout:false,incomplete:true});
 for(const name of ['Outside Doubles','Double Double']){
  const old=game([true,false,true],{name});old.details={targetLog:old.targetLog};delete old.targetLog;
  assert.equal(read(game([true],{name}),[past(old)]).hits,3);
 }
});
test('opening the simulation synchronizes evidence before rendering, so queued refresh cannot erase it',()=>{
 const source=fs.readFileSync(new URL('../site/idc.mjs',import.meta.url),'utf8');
 const handler=source.slice(source.indexOf("$('idcExample').onclick="),source.indexOf("$('idcAsk').onclick="));
 const nodes={idcExample:{},idcReport:{text:''}};
 let prior='old',current='changed';
 const refresh=()=>{if(prior!==current)nodes.idcReport.text='';prior=current};
 const c=vm.createContext({$:id=>nodes[id],refresh,run:(id,fn)=>{nodes[id].text='';fn(nodes[id])},line:(p,s)=>p.text+=s,render:()=>{},demo:()=>({})});
 vm.runInContext(handler,c);nodes.idcExample.onclick();refresh();
 assert.match(nodes.idcReport.text,/SIMULATION ONLY/);
});
