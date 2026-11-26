import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=new URL('../site/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const html=read('index.html'),sw=read('sw.js');
const imports=JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]).imports;
const assets=JSON.parse(sw.match(/const ASSETS=(\[.*?\]);/s)[1]);
const clean=s=>s.split('?')[0];
test('release import map and offline precache cover every local module',()=>{
 assert.ok(html.includes('Intelligent Darts Coach V2.0.0-dev'));
 const cached=new Set(assets);
 const modules=new Set(Object.keys(imports));
 for(const [source,target] of Object.entries(imports)){
  assert.equal(target,source+'?v=2.0.0-dev');
  assert.ok(cached.has(target),target+' is not precached');
  const code=read(source);
  for(const m of code.matchAll(/(?:\bfrom\s*|\bimport\s*)['"](\.\.?\/[^'"]+)['"]/g)){
   const dependency='./'+path.posix.normalize(path.posix.join(path.posix.dirname(source),m[1]));
   assert.ok(modules.has(dependency),dependency+' imported by '+source+' has no map entry');
  }
 }
 for(const asset of assets)assert.ok(fs.existsSync(new URL(clean(asset),root)),asset);
 assert.ok(assets.includes('./index.html'));
 assert.ok(html.includes('src="./idc.mjs?v=2.0.0-dev"'));
 assert.ok(html.includes("register('./sw.js?v=2.0.0-dev'"));
});

test('all new statistics and manual evidence modules are included in the offline dependency map',()=>{
 for(const name of ['statistics','target-statistics','skill-statistics','visit-statistics','practice-statistics','context-statistics','weekly-statistics','evidence-coverage','match-statistics','actual-target-statistics','manual-target-samples','statistics-dialogue','statistics-view','finish-validation'])assert.ok(imports['./'+name+'.mjs'],name);
});

test('all precision progression modules are versioned and cached',()=>{for(const name of ['progression-bands','progression-evidence','progression-dialogue','precision-calibration','precision-checks','precision-games','precision-adapter','precision-audit'])assert.ok(imports['./'+name+'.mjs'],name)});

test('challenge learning dependency graph is versioned and offline',()=>{for(const n of ['challenge-setting','challenge-exposure','challenge-episodes','challenge-learning'])assert.equal(imports['./'+n+'.mjs'],'./'+n+'.mjs?v=2.0.0-dev')});

test('new independent intelligence modules are versioned and cached offline',()=>{for(const n of ["training-ledger","training-outcomes","match-stages","development-review","coaching-intelligence","tactical-learning","session-learning","trial-planning"])assert.equal(imports['./'+n+'.mjs'],'./'+n+'.mjs?v=2.0.0-dev')});

test('autonomous coaching modules are available offline',()=>{for(const n of ["performance-forecast","competition-calendar","coaching-accountability","proactive-coach","personal-programme","autonomy-dialogue"])assert.equal(imports['./'+n+'.mjs'],'./'+n+'.mjs?v=2.0.0-dev')});

import vm from 'node:vm';
test('activated offline generation retires old IDC caches without touching unrelated caches',async()=>{
 const handlers={},deleted=[],events=[];
 const active=sw.match(/const CACHE='([^']+)'/)[1];
 const old=['IDC:assets:1.9.0-dev','IDC:assets:2.0.0-dev2','IDC:assets:2.0.0-dev3'].filter(n=>n!==active);
 const names=[...old,active,'dartsCoachV4','IDC:player-backups','other-app:assets:1.0.0'];
 vm.runInNewContext(sw,{self:{addEventListener:(name,fn)=>{handlers[name]=fn},clients:{claim:async()=>events.push('claimed')}},caches:{keys:async()=>names,delete:async n=>{deleted.push(n);events.push(n);return true}},Set,Promise});
 let task;handlers.activate({waitUntil:p=>task=p});await task;
 assert.deepEqual(deleted.sort(),old.sort());
 assert.equal(events.at(-1),'claimed');
});

test('offline worker serves an internally consistent cached shell while a later network release is waiting',async()=>{
 const handlers={},calls=[],scope='https://example.test/site/';
 const cached={'./index.html':'old shell','./idc.mjs?v=2.0.0-dev':'old module'};
 vm.runInNewContext(sw,{
  self:{registration:{scope},addEventListener:(n,fn)=>handlers[n]=fn},
  caches:{open:async name=>({match:async request=>cached[typeof request==='string'?request:'./'+new URL(request.url).pathname.split('/').at(-1)+new URL(request.url).search]})},
  fetch:async req=>{calls.push(req.url);return 'new network release'},URL,Set,Promise
 });
 const dispatch=async (url,mode='navigate',method='GET')=>{let response;handlers.fetch({request:{url,mode,method},respondWith:p=>response=p});return response};
 assert.equal(await dispatch(scope+'index.html'),'old shell');
 assert.equal(await dispatch(scope),'old shell');
 assert.equal(await dispatch(scope+'index.html?source=home'),'old shell');
 assert.equal(await dispatch(scope+'idc.mjs?v=2.0.0-dev','cors'),'old module');
 assert.equal(await dispatch(scope+'other.html'),undefined);
 assert.equal(await dispatch('https://other.test/site/index.html'),undefined);
 assert.equal(await dispatch(scope+'index.html','navigate','POST'),undefined);
 assert.deepEqual(calls,[]);
});
test('failed install cannot activate, claim clients or delete the previous complete generation',async()=>{
 const handlers={},effects=[],scope='https://example.test/site/';
 vm.runInNewContext(sw,{
  self:{registration:{scope},addEventListener:(n,fn)=>handlers[n]=fn,clients:{claim:async()=>effects.push('claim')}},
  caches:{open:async()=>({addAll:async requests=>{assert.ok(requests.length>=160);assert.ok(requests.every(r=>r.cache==='reload'));throw Error('simulated precache failure')}}),keys:async()=>['IDC:assets:1.9.0-dev'],delete:async n=>effects.push(n)},
  URL,Request,Set,Promise
 });
 let install;handlers.install({waitUntil:p=>install=p});
 await assert.rejects(install,/simulated precache failure/);
 assert.deepEqual(effects,[]);
});
