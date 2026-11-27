import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const extract=name=>{const i=html.indexOf('function '+name+'(');assert.ok(i>=0);const j=html.indexOf('\nfunction ',i+1);assert.ok(j>i);return html.slice(i,j)};
test('Native background pause revokes pending modal resume permission across session phases',()=>{
 const i=html.indexOf('function dc74PauseForBackground()'),j=html.indexOf("\ndocument.addEventListener('visibilitychange'",i);
 assert.ok(i>=0&&j>i);
 const make=new Function('s','let dc88Resume={id:1,index:0,at:100},paused=0,expired=0;const session=()=>s,finishExpiredExercise=()=>{expired++;return false},pauseSession=()=>{paused++};\n'+html.slice(i,j)+'\nreturn ()=>{dc74PauseForBackground();return {resume:dc88Resume,paused,expired}}');
 for(const s of [null,{phase:'playing',pausedAt:100},{phase:'playing',pausedAt:null},{phase:'rules',pausedAt:null},{phase:'complete',pausedAt:100}]){
  const expected=s?.phase==='playing'&&!s.pausedAt?1:0;
  assert.deepEqual(make(s)(),{resume:null,paused:expected,expired:expected});
 }
});