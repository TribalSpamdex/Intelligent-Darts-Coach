import test from 'node:test';
import assert from 'node:assert/strict';
import {methodDeliveryEvidence,methodReviews,methodReviewGate,methodReviewLines,methodFollowupGate} from '../site/coaching-accountability.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),shift=(d,n)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
const protocol='IDC precision fixed scoring',skill='scoring';
const setting={version:1,name:'Scoring Ladder',skill,tier:3,rule:null,field:'targets',before:[40,50,60],after:[40,50,60],quarter:0,variant:{}};
function session(date,id){
 const start=Date.parse(date+'T09:00:00Z'),name=setting.name,eid=id+':exercise:2',normal='Scoring Survival';
 const d={status:'selected',day:date,skill,protocol,normal,alternative:name,seconds:600,at:start+120000,exerciseIndex:2,expectedSetting:structuredClone(setting)};
 const s={id,date,start,quick:false,extra:false,completed:true,wholeSessionAudit:{idcMethod:d},provenanceInitial:{kind:'initial-selection',at:start+1,exercises:[{name:normal,mode:'timed'}]},provenanceLocked:{kind:'post-allocation',at:start+120001,exercises:[{}, {},{id:eid,index:2,name,mode:'timed',plannedSeconds:600}]},activities:[{name,exerciseId:eid,exerciseIndex:2,at:start+720001,plannedSeconds:600,seconds:600,rounds:2}]};
 const games=[1,2].map(i=>({name,sessionId:id,day:date,exerciseId:eid,exerciseIndex:2,at:start+120001+i*60000,quick:false,extra:false,recovery:false,tierAtStart:3,ruleVersion:null,learningSetting:structuredClone(setting),completion:'natural',win:true}));
 return {s,games};
}
const fixture=(date='2026-11-18',id=1)=>{const x=session(date,id);return {host:{sessions:[x.s],games:x.games},s:x.s}};
const observation=(date,n,i)=>({id:'o'+i,day:date,skill,context:'practice',protocol,attempts:30,hits:n*10});
function measurements(date,values=[60,62,51,52],prefix='a'){return [-4,-2,2,4].map((n,i)=>observation(shift(date,n),values[i],prefix+i))}
test('exact recorded settings and matched completed activity establish eligible exposure',()=>{
 const {host}=fixture(),r=methodDeliveryEvidence(host,day,now)[0];assert.equal(r.status,'eligible-exposure');assert.equal(r.exactSetting,true);assert.equal(r.rounds,2);assert.equal(r.seconds,600);
});
test('selected plan alone, short elapsed activity or mismatched exact settings are not eligible exposure',()=>{
 for(const change of [(h,s)=>s.activities=[],(h,s)=>s.activities[0].seconds=299,(h,s)=>h.games=[],(h,s)=>s.completed=false,(h,s)=>{s.wholeSessionAudit.idcMethod.expectedSetting.before=[45,55,65];s.wholeSessionAudit.idcMethod.expectedSetting.after=[45,55,65]}]){const {host,s}=fixture();change(host,s);assert.notEqual(methodDeliveryEvidence(host,day,now)[0].status,'eligible-exposure')}
});
test('duplicate sessions, edited provenance and future timestamps fail closed',()=>{
 for(const change of [(h,s)=>h.sessions.push({...s}),(h,s)=>s.provenanceInitial.exercises[0].name='Other',(h,s)=>s.provenanceLocked.exercises[2].plannedSeconds=700,(h,s)=>s.wholeSessionAudit.idcMethod.at=now+1,(h,s)=>s.wholeSessionAudit.idcMethod.exerciseIndex=0]){const {host,s}=fixture();change(host,s);assert.equal(methodDeliveryEvidence(host,day,now)[0].status,'unverified')}
});
test('two fixed days either side with nonoverlapping directional change, not causal improvement',()=>{
 const {host,s}=fixture(),r=methodReviews(host,{observations:measurements(s.date)},day,now);
 assert.equal(r[0].outcome,'observed-lower');assert.equal(r[0].change,-9.5);assert.equal(methodReviewGate(r,day).length,0);
 assert.ok(methodReviewLines(r,day).at(-1).includes('not controlled'));
 assert.equal(methodReviews(host,{observations:measurements(s.date,[51,52,60,61])},day,now)[0].outcome,'observed-higher');
 assert.equal(methodReviews(host,{observations:measurements(s.date,[51,60,52,61])},day,now)[0].outcome,'no-clear-change');
});
test('deletion, other protocol, and reported setup changes invalidate outcome evidence',()=>{
 const {host,s}=fixture(),obs=measurements(s.date);
 assert.equal(methodReviews(host,{observations:obs.slice(0,3)},day,now)[0].outcome,'awaiting-comparable-checks');
 assert.equal(methodReviews(host,{observations:obs.map(o=>({...o,protocol:'other'}))},day,now)[0].outcome,'awaiting-comparable-checks');
 assert.equal(methodReviews(host,{observations:obs,setups:[{day:s.date}]},day,now)[0].outcome,'confounded');
});
test('two disjoint lower reviews defer optional method; corrected data or aging removes gate',()=>{
 const dates=['2026-10-28','2026-11-18'],a=session(dates[0],1),b=session(dates[1],2),host={sessions:[a.s,b.s],games:[...a.games,...b.games]};
 const obs=[...measurements(dates[0],undefined,'a'),...measurements(dates[1],undefined,'b')],r=methodReviews(host,{observations:obs},day,now);
 assert.deepEqual(r.map(x=>x.outcome),['observed-lower','observed-lower']);assert.equal(methodReviewGate(r,day).length,1);
 assert.equal(methodReviewGate(methodReviews(host,{observations:obs.slice(0,4)},day,now),day).length,0);
 assert.equal(methodReviewGate(r,'2027-02-01').length,0);
});
test('same-skill overlapping selections cannot independently validate one another',()=>{
 const a=session('2026-11-15',1),b=session('2026-11-18',2),host={sessions:[a.s,b.s],games:[...a.games,...b.games]},obs=measurements(a.s.date);
 assert.equal(methodReviews(host,{observations:obs},day,now)[0].outcome,'overlapping-selections');
});

test('pending review is time-limited and does not turn missing records into failure',()=>{
 const {host,s}=fixture(),obs=measurements(s.date).slice(0,3),rows=methodReviews(host,{observations:obs},day,now);
 assert.equal(methodFollowupGate(rows,day).length,1);
 assert.equal(methodFollowupGate(rows,'2026-12-03').length,0);
 assert.equal(methodReviewGate(rows,day).length,0);
 assert.equal(methodFollowupGate(methodReviews(host,{observations:measurements(s.date)},day,now),day).length,0);
});
test('impossible review chronology cannot manufacture a repeat-method veto',()=>{
 const {host,s}=fixture(),rows=methodReviews(host,{observations:measurements(s.date)},day,now);
 const broken={...rows[0],id:'bad',day:'2026-10-20',baselineDays:['2026-11-12','2026-10-10'],followupDays:['2026-10-21','2026-10-22']};
 assert.equal(methodReviewGate([broken,...rows],day).length,0);
});
