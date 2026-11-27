import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const extract=(source,name)=>{const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);assert.ok(start>=0&&end>start,name);return source.slice(start,end)};
const names=['gameTime','quickEvidenceEligible','dc68CheckoutLogValid','dc5CheckoutEvidence','dc68RecordedCount','dc68EvidenceCounts','skillSamples','quickWeight','dc63QuickEvidence','dailySamples','completedRows'];
const api=(source,data)=>new Function('data','num','dateKey','clamp',names.map(n=>extract(source,n)).join('\n')+'\nreturn {skillSamples,completedRows,dailySamples,quickEvidenceEligible,quickWeight}')(data,x=>Number(x)||0,x=>new Date(x).toISOString().slice(0,10),(x,a,b)=>Math.max(a,Math.min(b,x)));
const at=Date.now()-3600000;
const games=[
 {name:'Scoring Challenge',visits:10,points:600},
 {name:'Doubles Survival',variant:'doubles',thrown:20,hits:6},
 {name:'Checkout Climb',success:2,fail:3},
 {name:'Bull Accuracy',thrown:30,outer:8,inner:2,misses:20}
].map(g=>({...g,at,sessionId:1,quick:false,completion:'natural',benchmark:true}));
const base={sessions:[{id:1,quick:false,completed:true,minutes:60}],games,bigSingles:[]};
const view=(a)=>({samples:a.skillSamples(),trends:Object.fromEntries(['scoring','doubles','checkout','bull'].map(k=>[k,a.completedRows(k)])),daily:Object.fromEntries(Object.entries(a.skillSamples()).map(([k,rows])=>[k,a.dailySamples(rows)]))});
test('native sample and trend invariance to recreational duration, volume, and outcomes',()=>{
 const expected=view(api(html,base));
 for(const minutes of [5,10,15,20,30])for(const count of [1,30])for(const high of [false,true]){
  const rec=Array.from({length:count},(_,i)=>games.map(g=>({...g,at:at-i*1000,sessionId:2,quick:true,points:high?1800:0,hits:high?20:0,success:high?5:0,fail:high?0:5,outer:high?30:0,inner:0,misses:high?0:30}))).flat();
  const p={...base,sessions:[...base.sessions,{id:2,quick:true,completed:true,minutes}],games:[...games,...rec]};
  assert.deepEqual(view(api(html,p)),expected);
  assert.equal(p.games.length,games.length+rec.length);
 }
});
test('recreational session provenance fences missing and contradictory game flags',()=>{
 const p={...base,sessions:[...base.sessions,{id:2,quick:true,completed:false,minutes:0}],activeSession:{id:3,quick:true},games:[...games,...games.map(g=>({...g,sessionId:'2',quick:false})),...games.map(g=>({...g,sessionId:3,quick:undefined}))]};
 const a=api(html,p);
 assert.deepEqual(view(a),view(api(html,base)));
 assert.equal(a.quickWeight({quick:true}),0);
 assert.equal(a.quickWeight({quick:false,sessionId:1}),1);
 assert.equal(a.quickWeight({sessionId:2}),0);
});
test('daily aggregation rejects direct recreational samples even when weighted',()=>{
 const a=api(html,base),normal={time:at,volume:10,points:600};
 assert.deepEqual(a.dailySamples([normal,{time:at,volume:100,points:18000,quick:true,weight:.75}]),a.dailySamples([normal]));
});
test('extra training focus is invariant to recreational session count',()=>{
 const line=html.split('\n').find(l=>l.startsWith('function focusForDay('));
 const run=data=>new Function('data','dateKey','FOCUS',line+'\nreturn focusForDay(true)')(data,()=> 'today',['a','b','c','d','e']);
 const p={days:[1,2,3,4,5],sessions:[{date:'today',quick:false}]};
 assert.equal(run(p),run({...p,sessions:[...p.sessions,...Array.from({length:4},()=>({date:'today',quick:true}))]}));
});
