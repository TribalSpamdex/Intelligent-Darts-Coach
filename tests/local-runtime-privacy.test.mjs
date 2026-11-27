import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=new URL('../site/',import.meta.url);
const paths=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?paths(new URL(e.name+'/',dir)):[new URL(e.name,dir)]);
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
  // Static module references must be relative to the local runtime.
  for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"\n]+)['"]/g)){
   const spec=m[1];
   assert.ok(spec.startsWith('./')||spec.startsWith('../'),name+' nonlocal import '+spec);
  }
 }
 console.log('Static local runtime privacy inventory: '+scanned+' files; '+referenceURLs+' source reference URLs');
});
