import test from 'node:test';
import assert from 'node:assert/strict';
import {performanceForecasts,forecastBlocks,measuredBlocks,forecastLines} from '../site/performance-forecast.mjs';
const day='2026-11-26',ago=n=>new Date(Date.parse(day)-n*86400000).toISOString().slice(0,10);
function fixture(skill='scoring',context='practice',protocol='fixed',fn=()=>60){
 const rows=[];
 for(let w=0;w<32;w++)for(const i of [0,2,4]){
  const value=fn(31-w,i),attempts=skill==='checkout'?12:60;
  rows.push({id:skill+context+protocol+w+'-'+i,day:ago(7*w+i),skill,context,protocol,attempts,hits:skill==='scoring'?Math.round(value*attempts/3):Math.round(value*attempts)});
 }
 return rows;
}
test('stable performance yields a bounded historical range and eight chronological calibration blocks',()=>{
 const r=performanceForecasts(fixture(),day)[0];
 assert.equal(r.status,'historical-range');assert.equal(r.point,60);assert.deepEqual(r.range,[57,63]);
 assert.equal(r.calibrationBlocks,8);assert.equal(r.calibrationMAE,0);assert.equal(r.calibrationWithin,8);
 assert.ok(forecastLines([r]).at(-1).includes('not a guaranteed result'));
});
test('candidate model selection uses only earlier blocks, never calibration observations',()=>{
 const blocks=Array.from({length:24},(_,i)=>({value:50+i,end:ago(23-i)}));
 const a=forecastBlocks(blocks,'scoring');
 const changed=blocks.map((b,i)=>i>=16?{...b,value:100-i}:b);
 const b=forecastBlocks(changed,'scoring');
 assert.deepEqual(a.selection,b.selection);assert.equal(a.method,b.method);
 assert.notEqual(a.calibrationMAE,b.calibrationMAE);
});
test('sparse or stale measurements break the consecutive weekly evidence chain',()=>{
 const rows=fixture();
 for(const age of [0,1,10]){
  const x=rows.filter(o=>Math.floor((Date.parse(day)-Date.parse(o.day))/86400000/7)!==age);
  assert.equal(performanceForecasts(x,day)[0].status,'insufficient');
 }
 const x=rows.filter(o=>o.day<=ago(15*7+6));
 assert.equal(performanceForecasts(x,day)[0].status,'insufficient');
});
test('practice and competition, separate metrics and protocols never pool',()=>{
 const a=fixture('scoring','practice','fixed',()=>50),b=fixture('scoring','competition','fixed',()=>40),c=fixture('doubles','practice','fixed',()=>.25),d=fixture('scoring','practice','other',()=>70);
 const r=performanceForecasts([...a,...b,...c,...d],day);
 assert.equal(r.length,4);
 assert.equal(r.find(x=>x.skill==='doubles').point,.25);
 assert.equal(r.find(x=>x.context==='competition').point,40);
 assert.equal(r.find(x=>x.protocol==='other').point,70);
});
test('future observations and exact duplicate observations do not alter a historical forecast',()=>{
 const rows=fixture(),future={...rows[0],id:'future',day:ago(-1),hits:3600};
 assert.deepEqual(performanceForecasts([...rows,rows[0],future],day),performanceForecasts(rows,day));
});
test('probability and scoring estimates remain inside physical measurement bounds',()=>{
 for(const [skill,values,max] of [['scoring',[0,180],180],['doubles',[0,1],1]]){
  const r=performanceForecasts(fixture(skill,'practice','fixed',w=>values[w%2]),day)[0];
  assert.ok(r.range[0]>=0&&r.range[1]<=max&&r.range[0]<=r.point&&r.range[1]>=r.point);
 }
});
test('weekly measurement uses actual daily means and never treats missing days as zero',()=>{
 const rows=fixture().filter(o=>o.day===day||o.day===ago(2));
 const blocks=measuredBlocks(rows,day,'scoring');
 assert.equal(blocks.at(-1).days,2);assert.equal(blocks.at(-1).attempts,120);assert.equal(blocks.at(-1).value,60);assert.equal(blocks.at(-2).value,null);
});
