import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sw=fs.readFileSync(new URL('../site/sw.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const generation=sw.match(/const CACHE='([^']+)'/)[1],scope='https://example.test/site/';
const assets=JSON.parse(sw.match(/const ASSETS=(\[.*?\]);/s)[1]);
const keys=[...new Set(assets.flatMap(a=>[a,a.split('?')[0]]))].map(a=>({url:new URL(a,scope).href}));
const client={id:'app',url:scope+'index.html'};
async function request({windows=[client],source=client,missing=false,shell=html,requested=generation,type='IDC_APPLY_UPDATE'}={}){
 const handlers={},effects=[];let reply,job;
 vm.runInNewContext(sw,{self:{registration:{scope},addEventListener:(n,f)=>handlers[n]=f,clients:{matchAll:async()=>windows},skipWaiting:async()=>effects.push('activate')},caches:{keys:async()=>[generation],open:async()=>({keys:async()=>missing?keys.slice(1):keys,match:async()=>({text:async()=>shell})})},URL,Set,Promise});
 handlers.message({data:{type,generation:requested},source,ports:[{postMessage:r=>reply=r}],waitUntil:p=>job=p});await job;
 return {reply,effects};
}
test('manual activation accepts complete version-matched release and sole requester',async()=>{
 const {reply,effects}=await request();assert.equal(reply.ok,true);assert.deepEqual(effects,['activate']);
});
test('manual activation rejects incomplete, mismatched, stale, outside-scope and multi-window requests',async()=>{
 for(const options of [{missing:true},{shell:html.replace(/<title>[^<]+/,'<title>Intelligent Darts Coach V0.0.0')},{requested:'old'},{source:{id:'other',url:'https://example.test/preview-v2/'}},{windows:[client,{id:'other',url:scope}]},{windows:[]}]){
  const {reply,effects}=await request(options);assert.equal(reply.ok,false);assert.deepEqual(effects,[]);
 }
});
test('unrelated same-origin pages do not prevent scoped update',async()=>{
 const {reply}=await request({windows:[client,{id:'outside',url:'https://example.test/preview-v2/'}]});assert.equal(reply.ok,true);
});
test('status reports cached shell version without activating',async()=>{
 const {reply,effects}=await request({type:'IDC_ASSET_STATUS'});assert.equal(reply.shellVersion,generation.replace('IDC:assets:',''));assert.deepEqual(effects,[]);
});
test('settings update UI saves before sending activation request',()=>{
 assert.match(html,/id="idcCheckUpdate"/);assert.match(html,/id="idcApplyUpdate"/);assert.match(html,/id="idcWalkthroughSettings"/);
 assert.ok(html.indexOf('if(!save(false)||!checkpointData())')<html.indexOf("rpc(candidate.worker,'IDC_APPLY_UPDATE'"));
 assert.match(html,/if\(session\(\)\|\|activeStage\)/);
 assert.match(html,/controllerchange/);assert.match(html,/updateViaCache:'none'/);
});
