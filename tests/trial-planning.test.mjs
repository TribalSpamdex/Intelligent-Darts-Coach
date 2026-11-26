import test from 'node:test';
import assert from 'node:assert/strict';
import {nextComparison,comparisonPlanLines} from '../site/trial-planning.mjs';
import {recordSetting} from '../site/challenge-setting.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const host={sessions:[],games:[]},state=()=>({observations:[],goals:[],legs:[],interventions:[],trials:[],readiness:[],clinic:[]});
const setting=(name,fields)=>recordSetting({name,tier:4,...fields},{name,tier:4,...fields}).learningSetting;
const a=setting('Scoring Survival',{target:60,lives:3}),b=setting('Scoring Ladder',{targets:[55,59,63],lives:3});
const c=(extra={})=>({kind:'method',skill:'scoring',protocol:'IDC precision fixed scoring',first:'Scoring Survival',second:'Scoring Ladder',firstSetting:a,secondSetting:b,pairs:4,weeks:6,latest:day,status:'unclear',matched:[{aSeconds:600,bSeconds:600},{aSeconds:660,bSeconds:600}],...extra});
test('empty history recommends baseline collection, not invented exercise choices',()=>{
 const p=nextComparison(host,state(),day,now);
 assert.equal(p.status,'collect-baseline');assert.ok(comparisonPlanLines(p)[0].includes('Not enough'));
});
test('a recent exact-rule comparison yields one bounded comparison plan',()=>{
 const p=nextComparison(host,state(),day,now,{comparisons:[c()]});
 assert.equal(p.status,'comparison-candidate');assert.equal(p.existingPairs,4);assert.deepEqual(p.observed,{first:[600,660],second:[600,600]});
 assert.ok(p.constraints.some(x=>x.includes('do not reuse benchmark')));
 assert.ok(comparisonPlanLines(p).at(-1).includes('has not started a trial'));
});
test('candidate selection prioritizes coverage and goal relevance rather than effect magnitude',()=>{
 const s=state();s.goals=[{id:'g',skill:'scoring',context:'practice',protocol:'IDC precision fixed scoring',target:70,start:ago(10),review:ago(-10),status:'active'}];
 const p=nextComparison(host,s,day,now,{comparisons:[c({skill:'bull',protocol:'bull',pairs:9,status:'first-associated'}),c({pairs:3})]});
 assert.equal(p.skill,'scoring');assert.equal(p.goalRelevant,true);
 const q=nextComparison(host,state(),day,now,{comparisons:[c({pairs:8,status:'unclear'}),c({pairs:4,status:'first-associated'})]});
 assert.equal(q.existingPairs,8);
});
test('existing intervention or active trial prevents a competing comparison',()=>{
 for(const key of ['interventions','trials']){
  const s=state();s[key]=key==='interventions'?[{status:'proposed',proposedDay:day}]:[{status:'active',start:day}];
  assert.equal(nextComparison(host,s,day,now,{comparisons:[c()]}).status,'existing-change');
 }
});
test('wellbeing, stale evidence, future evidence and one matched pair veto a proposed comparison',()=>{
 const s=state();s.readiness=[{day,context:'practice',pain:true}];
 assert.equal(nextComparison(host,s,day,now,{comparisons:[c()]}).status,'wellbeing');
 for(const extra of [{latest:ago(29)},{latest:ago(-1)},{pairs:1}])assert.equal(nextComparison(host,state(),day,now,{comparisons:[c(extra)]}).status,'collect-baseline');
});
test('dose comparison preserves the same rule and reports observed durations without increasing training automatically',()=>{
 const p=nextComparison(host,state(),day,now,{comparisons:[c({kind:'dose',secondSetting:a,matched:[{aSeconds:300,bSeconds:600}]})]});
 assert.equal(p.variable,'recorded duration at the same exact rule');assert.deepEqual(p.first,p.second);assert.deepEqual(p.observed,{first:[300,300],second:[600,600]});
 assert.ok(p.constraints.some(x=>x.includes('Do not force fatigue')));
});
