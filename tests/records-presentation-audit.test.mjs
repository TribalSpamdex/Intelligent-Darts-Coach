import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const start=html.indexOf('function dcRecordHistory('),end=html.indexOf('/* V5.15.4:',start);
const nodes={recordOverview:{},recordGames:{}};
const now=Date.parse('2026-11-27T12:00Z');
const original={name:'Bull Streak',sessionId:1,exerciseId:'1:e:0',at:now-1000,completion:'natural',oneEighties:0,best:4,tierAtStart:5};
const ctx=vm.createContext({Date:class extends Date{static now(){return now}},data:{games:[]},QUICK_GAMES:['Bull Streak'],gameTime:g=>Number(g.at)||0,$:id=>nodes[id],num:x=>Number(x)||0,monthString:()=>'',weekStart:()=>now-604800000,esc:String,formatDate:()=>'',recordMetrics:g=>[{label:'Longest streak',value:g.best,higher:true}]});
assert.ok(start>=0);vm.runInContext(html.slice(start,end),ctx);
const read=rows=>JSON.parse(JSON.stringify(ctx.dcRecordHistory(rows,now)));
test('future, undated, exact duplicate and conflicting record identities cannot inflate personal records',()=>{
 const valid=structuredClone(original),future={...valid,sessionId:2,at:now+1,best:99},bad={...valid,sessionId:3,at:NaN};
 const rows=[valid,structuredClone(valid),future,bad],before=JSON.stringify(rows),r=read(rows);
 assert.equal(r.rows.length,1);assert.equal(r.duplicates,1);assert.equal(r.excluded,2);assert.equal(JSON.stringify(rows),before);
 const conflict=read([valid,{...valid,best:100}]);assert.equal(conflict.rows.length,0);assert.equal(conflict.conflicts,1);
 const distinct=read([valid,{...valid,exerciseId:'1:e:1'}]);assert.equal(distinct.rows.length,2);
});
test('rendered record cards keep the actual achievement and hide internal tier numbers',()=>{
 ctx.data.games=[original];ctx.renderRecords();
 assert.match(nodes.recordGames.innerHTML,/Longest streak/);assert.match(nodes.recordGames.innerHTML,/>4</);
 assert.doesNotMatch(nodes.recordGames.innerHTML,/Tier 5|tier5/);
 assert.equal(ctx.data.games[0].tierAtStart,5);
});
test('Coach display labels hide tier suffixes while preserving distinct raw protocol identities',()=>{
 const src=fs.readFileSync(new URL('../site/idc.mjs',import.meta.url),'utf8');
 const label=src.split('\n').find(x=>x.startsWith('const publicLabel='));
 const c=vm.createContext({});vm.runInContext(label+'\nglobalThis.label=publicLabel',c);
 assert.equal(c.label('Doubles Streak · tier 5'),'Doubles Streak · separate setting');
 assert.equal(c.label('Scoring Survival:tier2'),'Scoring Survival:separate setting');
 assert.equal(c.label('Preferred double: D16'),'Preferred double: D16');
 assert.match(src,/o\.value=v/); // display is separate from the protocol form value.
});
