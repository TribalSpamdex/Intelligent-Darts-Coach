import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=new URL('../site/',import.meta.url);
const paths=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?paths(new URL(e.name+'/',dir)):[new URL(e.name,dir)]);
// Lightweight source inventory, not a full JavaScript parser. Restrict static
// matches to import/export declarations rather than prose containing "from".
function moduleSpecifiers(source){
 const declarations=/(?:^|[;\n])\s*(?:import\s+(?:(?:[\w$*,{}\s]+?)\bfrom\s*)?|export\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*)['"]([^'"\n]+)['"]/g;
 const dynamic=/\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*[,)]/g;
 return [...source.matchAll(declarations),...source.matchAll(dynamic)].map(m=>m[1]);
}
test('Module inventory distinguishes declarations from ordinary coaching prose',()=>{
 const source=["import {a} from './a.mjs';","import './b.mjs';","export * from './c.mjs';","export {a} from './d.mjs';","import {\n a,\n b\n} from './e.mjs';","const summary='The recorded result changed from '+evidence.earlier+' to '+evidence.recent;","const x=import('https://example.invalid/remote.mjs');","import x from 'external-package';"].join('\n');
 assert.deepEqual(moduleSpecifiers(source),['./a.mjs','./b.mjs','./c.mjs','./d.mjs','./e.mjs','external-package','https://example.invalid/remote.mjs']);
});
test('Local runtime has no common direct network transport APIs or remote embedded assets',()=>{
 const files=paths(root);
 assert.ok(files.length>=86);
 const transport=/\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon\s*\(|importScripts\s*\(|RTCPeerConnection\b)/g;
 const remoteAsset=/(?:\b(?:src|href|action)\s*=\s*["'](?:https?:|\/\/)|url\(\s*["']?(?:https?:|\/\/)|@import\s+["'](?:https?:|\/\/))/gi;
 const allowedLink='https://tribalspamdex.github.io/Intelligent-Darts-Coach/';
 let scanned=0,referenceURLs=0;
 for(const file of files){
  const name=decodeURIComponent(file.pathname.slice(root.pathname.length));
  assert.match(name,/\.(?:mjs|js|html)$/i,'Review additional runtime file type: '+name);
  const source=fs.readFileSync(file,'utf8');scanned++;
  assert.deepEqual(source.match(transport)??[],[],name+' introduces a direct network transport; review before publication');
  assert.deepEqual(source.match(remoteAsset)??[],[],name+' introduces a remote resource');
  const urls=[...source.matchAll(/https?:\/\/[^\s"'<>\\]+/g)];
  for(const m of urls){
   if(name==='engine/knowledge.mjs'){
    assert.match(source.slice(Math.max(0,m.index-12),m.index),/"url": "$/,'Unexpected knowledge URL use');
    referenceURLs++;
   }else{
    assert.equal(name,'index.html');assert.equal(m[0],allowedLink);
    assert.ok(source.slice(Math.max(0,m.index-100),m.index).includes('function shareDartsApp()'));
   }
  }
  // Literal module references must resolve within the local runtime.
  for(const spec of moduleSpecifiers(source)){
   assert.ok(spec.startsWith('./')||spec.startsWith('../'),name+' nonlocal import '+spec);
   assert.ok(new URL(spec,file).href.startsWith(root.href),name+' import escapes runtime '+spec);
  }
 }
 console.log('Static local runtime privacy inventory: '+scanned+' files; '+referenceURLs+' source reference URLs');
});
