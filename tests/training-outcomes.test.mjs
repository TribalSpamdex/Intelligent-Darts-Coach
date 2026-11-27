import test from 'node:test';
import assert from 'node:assert/strict';
import {methodComparisons,delayedFollowups,trainingOutcomes,outcomeReportLines,followupLines,durationReview,doseBand} from '../site/training-outcomes.mjs';
import {recordSetting} from '../site/challenge-setting.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const first=recordSetting({name:'Scoring Survival',tier:4,target:60,lives:3},{name:'Scoring Survival',tier:4,target:60,lives:3}).learningSetting;
const second=recordSetting({name:'Scoring Ladder',tier:4,targets:[55,59,63],lives:3},{name:'Scoring Ladder',tier:4,targets:[55,59,63],lives:3}).learningSetting;
function episode(i,{setting=first,delta=7,seconds=600,age=100,extra={}}={}){
 const from=ago(age-i*7),to=ago(age-i*7-3);
 return {skill:'scoring',protocol:'IDC precision fixed scoring',key:'fixture',setting,from,to,gap:3,baseline:60,after:60+delta,delta,attempts:[30,30],measurementIds:['b'+i,'a'+i],sessions:1,seconds,otherSeconds:600,otherGames:['Warm-up'],otherDose:{'Warm-up':600},endpointPractice:[],dominance:1,rounds:3,...extra};
}
function fixture({kind='method',count=6,balanced=true,firstDelta=7,secondDelta=0}={}){
 return Array.from({length:count*2},(_,i)=>{
  const b=balanced?i%4===1||i%4===2:i%2===1;
  return episode(i,{setting:kind==='method'&&b?second:first,seconds:kind==='dose'&&b?1200:600,delta:b?secondDelta:firstDelta});
 });
}
test('method matching uses separate drills at similar dose and both chronological orders',()=>{
 const r=methodComparisons(fixture(),day);
 assert.equal(r.length,1);const c=r[0];
 assert.equal(c.kind,'method');assert.equal(c.pairs,6);assert.equal(c.weeks,12);
 assert.ok(c.aFirst>=2&&c.bFirst>=2);
 assert.equal(c.status,c.first.includes('Survival')?'first-associated':'second-associated');
 assert.equal(new Set(c.matched.flatMap(x=>[...x.a,...x.b])).size,24);
 assert.ok(Math.abs(c.difference.median)===7);
});
test('dose matching uses same exact game rule and materially different minutes',()=>{
 const r=methodComparisons(fixture({kind:'dose'}),day);
 assert.equal(r.length,1);const c=r[0];assert.equal(c.kind,'dose');assert.equal(c.status,'first-associated');assert.equal(c.pairs,6);
 assert.ok(c.matched.every(x=>x.aSeconds===600&&x.bSeconds===1200));
});
test('a longer dose can be associated with greater gain but cannot become automatic instruction',()=>{
 const r=methodComparisons(fixture({kind:'dose',firstDelta:0,secondDelta:7}),day);
 assert.equal(r[0].status,'second-associated');
 assert.ok(outcomeReportLines({comparisons:r,exposures:12,episodes:Array(12),limitation:'No automatic changes.'},'dose').at(-1).includes('No automatic'));
});
test('five pairs, one order, stale results and flat changes cannot support a preference',()=>{
 for(const opts of [{count:5},{balanced:false},{firstDelta:0,secondDelta:0}]){
  const r=methodComparisons(fixture(opts),day)[0];
  assert.ok(['unclear','insufficient'].includes(r.status));
 }
 const r=methodComparisons(fixture(),ago(-40))[0];assert.equal(r.status,'insufficient');
});
test('one outlier cannot manufacture stable method advantage',()=>{
 const rows=fixture({firstDelta:0,secondDelta:0});rows[0].delta=100;
 assert.equal(methodComparisons(rows,day)[0].status,'unclear');
});
test('starting ability, other training, endpoint sessions and protocol differences veto matching',()=>{
 for(const extra of [{baseline:80},{otherGames:['Other']},{otherDose:{'Warm-up':3000}},{endpointPractice:['after']},{protocol:'different'}]){
  const rows=fixture().map(x=>x.setting.name===second.name?{...x,...extra}:x);
  assert.equal(methodComparisons(rows,day).length,0,JSON.stringify(extra));
 }
});
test('different settings of same drill are not falsely treated as different methods or same dose',()=>{
 const modified={...first,quarter:1,after:62};
 const rows=fixture().map(x=>x.setting.name===second.name?{...x,setting:modified}:x);
 assert.equal(methodComparisons(rows,day).length,0);
});
test('delayed independent benchmark preserves observed gain, sample and elapsed days',()=>{
 const e=episode(0,{age:20}),d=ago(6),o={id:'follow',day:d,skill:'scoring',context:'practice',protocol:e.protocol,attempts:30,hits:670};
 const r=delayedFollowups([e],{observations:[o]}, {sessions:[]},day);
 assert.equal(r.length,1);assert.equal(r[0].status,'gain-still-observed');assert.equal(r[0].delay,11);assert.equal(r[0].attempts,30);assert.equal(r[0].independentOfRecordedTraining,true);
 assert.ok(followupLines({followups:r}).some(l=>l.includes('unlogged practice remains unknown')));
});
test('delayed followup excludes shared endpoint IDs, insufficient sample, future data, and confounders',()=>{
 const e=episode(0,{age:20}),d=ago(6),o={id:'follow',day:d,skill:'scoring',context:'practice',protocol:e.protocol,attempts:30,hits:670};
 for(const x of [{...o,id:'a0'},{...o,attempts:1,hits:20},{...o,day:ago(-1)},{...o,protocol:'other'}])assert.equal(delayedFollowups([e],{observations:[x]}, {sessions:[]},day).length,0);
 assert.equal(delayedFollowups([e],{observations:[o],readiness:[{day:d,context:'practice',fatigue:'high'}]}, {sessions:[]},day).length,0);
 assert.equal(delayedFollowups([e],{observations:[o]}, {sessions:[]},day,[ago(10)]).length,0);
});
test('intervening saved practice means a delayed check is not isolated retention',()=>{
 const e=episode(0,{age:20}),d=ago(6),o={id:'follow',day:d,skill:'scoring',context:'practice',protocol:e.protocol,attempts:30,hits:600};
 const r=delayedFollowups([e],{observations:[o]}, {sessions:[{quick:false,date:ago(10)}]},day);
 assert.equal(r[0].independentOfRecordedTraining,false);assert.equal(r[0].status,'gain-not-observed');
});
test('empty authentic history stays explicitly insufficient',()=>{
 const r=trainingOutcomes({games:[],sessions:[]},{observations:[]},day,now);
 assert.deepEqual(r.comparisons,[]);assert.deepEqual(r.followups,[]);
 assert.ok(outcomeReportLines(r).some(x=>x.includes('No comparable')));
});

test('duration evidence keeps distinct five, ten and fifteen minute contrasts separate',()=>{
 const rows=fixture({kind:'dose'}).map((e,i)=>({...e,seconds:e.seconds===1200?(i%2===0?900:600):300}));
 const comparisons=methodComparisons(rows,day);
 assert.ok(comparisons.length>=2);
 for(const c of comparisons){assert.ok(c.matched.every(x=>doseBand(x.aSeconds)===c.shortSeconds&&doseBand(x.bSeconds)===c.longSeconds));assert.ok(c.pairs<6);}
 assert.deepEqual(durationReview(comparisons,day),[]);
 for(const [seconds,band] of [[240,300],[360,300],[361,null],[600,600],[900,900],[1200,1200],[1500,null]])assert.equal(doseBand(seconds),band);
 assert.equal(methodComparisons(fixture({kind:'dose'}).map(x=>({...x,sessions:2})),day).length,0);
});
test('duration preference needs direct evidence against every compared alternative',()=>{
 const c=methodComparisons(fixture({kind:'dose'}),day)[0];
 const make=(short,long,status)=>({...c,shortSeconds:short,longSeconds:long,status,matched:c.matched.map(m=>({...m,aSeconds:short,bSeconds:long}))});
 assert.equal(durationReview([c],day)[0].preferred,600);
 const a=make(300,600,'second-associated'),b=make(600,900,'first-associated'),r=make(300,900,'first-associated');
 assert.equal(durationReview([a,b],day)[0].preferred,600);
 assert.equal(durationReview([a,b,r],day)[0].preferred,600);
 assert.equal(durationReview([a,make(600,900,'second-associated')],day)[0].preferred,null);
 assert.equal(durationReview([a,b,make(600,900,'unclear')],day)[0].preferred,null);
 assert.equal(durationReview([a,b,make(300,600,'first-associated')],day)[0].preferred,null);
 assert.deepEqual(durationReview([{...c,latest:'2026-11-27'}],day),[]);
 assert.deepEqual(durationReview([{...c,matched:c.matched.map(m=>({...m,aSessions:2}))}],day),[]);
 assert.deepEqual(durationReview([{...c,firstSetting:{}}],day),[]);
});
