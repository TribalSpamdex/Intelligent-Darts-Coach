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
 assert.ok(html.includes('Intelligent Darts Coach V1.5.0-dev'));
 const cached=new Set(assets);
 const modules=new Set(Object.keys(imports));
 for(const [source,target] of Object.entries(imports)){
  assert.equal(target,source+'?v=1.5.0-dev');
  assert.ok(cached.has(target),target+' is not precached');
  const code=read(source);
  for(const m of code.matchAll(/(?:\bfrom\s*|\bimport\s*)['"](\.\.?\/[^'"]+)['"]/g)){
   const dependency='./'+path.posix.normalize(path.posix.join(path.posix.dirname(source),m[1]));
   assert.ok(modules.has(dependency),dependency+' imported by '+source+' has no map entry');
  }
 }
 for(const asset of assets)assert.ok(fs.existsSync(new URL(clean(asset),root)),asset);
 assert.ok(assets.includes('./index.html'));
 assert.ok(html.includes('src="./idc.mjs?v=1.5.0-dev"'));
 assert.ok(html.includes("register('./sw.js?v=1.5.0-dev'"));
});

test('all new statistics and manual evidence modules are included in the offline dependency map',()=>{
 for(const name of ['statistics','target-statistics','skill-statistics','visit-statistics','practice-statistics','context-statistics','weekly-statistics','evidence-coverage','match-statistics','actual-target-statistics','manual-target-samples','statistics-dialogue','statistics-view','finish-validation'])assert.ok(imports['./'+name+'.mjs'],name);
});

test('all precision progression modules are versioned and cached',()=>{for(const name of ['progression-bands','progression-evidence','progression-dialogue','precision-calibration','precision-checks','precision-games','precision-adapter','precision-audit'])assert.ok(imports['./'+name+'.mjs'],name)});
