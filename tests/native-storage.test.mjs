import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const a=html.indexOf('function dc63PackBytes('),b=html.indexOf('// One exclusive writer',a);
assert.ok(a>=0&&b>a);
const source=html.slice(a,b);
const api=new Function('let dc63PackedPrefix=null;const RECOVERY_FENCE="f";const localStorage={getItem:()=>"fence"};\n'+source+'\nreturn {dc63PackSnapshot,dc998Pack,dc998Unpack,dc998CheckpointPayload,dc999PrimaryPayload}')();
const encoder=new TextEncoder();
test('Native compression round-trips exact Unicode JSON across changing prefixes and tails',()=>{
 let seed=0x9c71;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const alphabet=['a','Z','0','\\','"','🎯','é','日本語','\n','\u0000','\ud800'];
 let prefix=[];
 for(let i=0;i<180;i++){
  if(i%3===0)prefix=[...prefix,{day:i,notes:Array.from({length:25},()=>alphabet[Math.floor(random()*alphabet.length)]).join('')}];
  const obj={sessions:prefix,activeSession:{notes:Array.from({length:80},()=>alphabet[Math.floor(random()*alphabet.length)]).join('')},games:[i]};
  const raw=JSON.stringify(obj),x=api.dc63PackSnapshot(raw);
  assert.equal(x.length,encoder.encode(raw).length);assert.equal(api.dc998Unpack(x.packed,x.length),raw);
  assert.equal(api.dc998Unpack(api.dc998Pack(raw),x.length),raw);
 }
 const raw=JSON.stringify({notes:'🎯日本語é'.repeat(30000)});
 const x=api.dc63PackSnapshot(raw);assert.equal(api.dc998Unpack(x.packed,x.length),raw);
});
test('Primary and checkpoint compression use compatible readable formats',()=>{
 const d={sessions:[],activeSession:null,games:[],notes:'Résumé 🎯 日本語 '.repeat(15000)};
 const p=JSON.parse(api.dc999PrimaryPayload(d)),c=JSON.parse(api.dc998CheckpointPayload(d));
 assert.equal(p.format,'dc-lzw1-primary');assert.equal(c.format,'dc-lzw1');assert.equal(c.fence,'fence');
 for(const x of [p,c])assert.deepEqual(JSON.parse(api.dc998Unpack(x.packed,x.length)),d);
});
test('Decoder rejects invalid type, oversize, truncated and malformed streams',()=>{
 const raw='A résumé 🎯',x=api.dc63PackSnapshot(raw);
 for(const [p,n] of [[null,x.length],[{},x.length],[x.packed,-1],[x.packed,50000001],[x.packed,x.length-1],[x.packed.slice(0,-1),x.length],['\u0000',1],['',2],['ab',1]])assert.throws(()=>api.dc998Unpack(p,n));
 assert.equal(api.dc998Unpack('',0),'');
});
test('Malformed primary profile roots or active plans are rejected before normalization',()=>{
 const a=html.indexOf('function isValidPlayerData('),b=html.indexOf('\nlet recoveryNotice',a);
 const validate=new Function(html.slice(a,b)+'\nreturn isValidPlayerData')();
 const profile={sessions:[],games:[],assessment:{},skills:{}};
 assert.equal(validate(profile),true);
 for(const bad of [{...profile,assessment:[]},{...profile,skills:[]},{...profile,activeSession:{}},{...profile,activeSession:{plan:[{name:'Bull Accuracy'}],index:1}},{...profile,activeSession:{plan:[{name:'Bull Accuracy'}],index:0},game:{name:'Other'}}])assert.equal(validate(bad),false);
 assert.equal(validate({...profile,activeSession:{plan:[{name:'Bull Accuracy'}],index:0},game:null}),true);
});
