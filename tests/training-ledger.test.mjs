import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingLedger,ledgerWindows,ledgerLines} from '../site/training-ledger.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z'),ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const stamp=(d,m=0)=>Date.parse(d+'T09:00:00Z')+m*60000;
function fixture(names=['Scoring Challenge','Doubles Streak','Warm-up','301 Pressure']){
 const s={id:1,date:day,start:stamp(day),quick:false,extra:false,completed:true,activities:names.map((name,i)=>({name,exerciseId:'e'+i,exerciseIndex:i,seconds:300,plannedSeconds:600,rounds:0,at:stamp(day,(i+1)*10)}))};
 const host={sessions:[s],games:[]};
 return {host,s,round:(i,p={})=>({name:names[i],sessionId:s.id,exerciseId:'e'+i,exerciseIndex:i,day:s.date,at:stamp(s.date,i*10+1),quick:false,extra:s.extra,completion:'natural',win:true,...p})};
}
test('ledger separates classified, routine, and mixed training without double counting',()=>{
 const {host,s,round}=fixture();host.games.push(round(1,{variant:'doubles'}));s.activities[1].rounds=1;
 const x=trainingLedger(host,day,now),w=ledgerWindows(x,day)[0];
 assert.equal(w.total,1200);assert.equal(w.direct,600);assert.equal(w.routine,300);assert.equal(w.unclassified,300);
 assert.equal(w.total,w.direct+w.routine+w.unclassified+w.interrupted);
 assert.equal(w.skills.find(s=>s.skill==='doubles').seconds,300);
 assert.equal(w.skills.find(s=>s.skill==='doubles').plannedSeconds,600);
 assert.equal(w.skills.find(s=>s.skill==='doubles').observedComparableSeconds,300);
 assert.ok(ledgerLines(x,day).some(l=>l.includes('doubles: 5.0 min')));
});
test('extra practice is measured separately and quick play never enters ledger',()=>{
 const {host,s}=fixture(['Scoring Survival']);host.sessions.push({...s,id:2,extra:true},{...s,id:3,quick:true});
 const w=ledgerWindows(trainingLedger(host,day,now),day)[0];
 assert.equal(w.sessions,2);assert.equal(w.scheduled,300);assert.equal(w.extra,300);
 assert.equal(w.skills.find(s=>s.skill==='scoring').extraSeconds,300);
});
test('duplicate session identities and conflicting activity indexes fail closed',()=>{
 const {host,s}=fixture();host.sessions.push({...s,id:'1'});
 let r=trainingLedger(host,day,now);assert.equal(r.rows.length,0);assert.equal(r.rejected.duplicate,1);
 host.sessions.pop();s.activities.push({...s.activities[0]});
 r=trainingLedger(host,day,now);assert.equal(r.rows.length,0);assert.equal(r.rejected.activity,1);
});
test('interrupted activity native schema preserves observed minutes separately',()=>{
 const {host,s}=fixture(['Scoring Survival']);s.completed=false;
 s.interruptedExercise={name:'Double Double',exerciseId:'e1',exerciseIndex:1,seconds:120,roundsCompleted:0,interrupted:true};
 const r=trainingLedger(host,day,now),w=ledgerWindows(r,day)[0];
 assert.equal(w.total,420);assert.equal(w.interrupted,120);assert.equal(w.direct,300);assert.equal(w.completedSessions,0);assert.deepEqual(r.blockedDays,[day]);
});
test('future, malformed and overlong activity records cannot inflate exposure',()=>{
 const {host,s}=fixture();s.activities[0].at=now+1;
 assert.equal(trainingLedger(host,day,now).rows.length,0);
 s.activities[0].at=stamp(day,10);s.activities[0].seconds=3601;
 assert.equal(trainingLedger(host,day,now).rows.length,0);
 s.activities[0].seconds=300;host.sessions=[{...s,date:'2026-11-27'}];
 assert.equal(trainingLedger(host,day,now).rows.length,0);
});
test('mixed variants cannot be called doubles or trebles by name alone',()=>{
 const {host,s,round}=fixture(['Doubles Streak','Treble Hunt','Number Lock','Bull Survival','Switchback']);
 for(let i=0;i<5;i++)s.activities[i].rounds=1;
 host.games=[round(0,{variant:'singles'}),round(1,{variant:'treble'}),round(2,{ring:'S'}),round(3,{target:'50'}),round(4,{details:{ring:'D'}})];
 const r=trainingLedger(host,day,now);
 assert.deepEqual(r.rows.map(x=>x.skill),['singles','trebles','singles',null,'switching']);
 host.games.push(round(0,{variant:'doubles',at:stamp(day,2)}));s.activities[0].rounds=2;
 assert.equal(trainingLedger(host,day,now).rows[0].skill,null);
});
test('missing round count and wrong saved round identity cannot fabricate variant exposure',()=>{
 const {host,s,round}=fixture(['Doubles Streak']);s.activities[0].rounds=1;
 let r=trainingLedger(host,day,now);assert.equal(r.rows[0].skill,null);assert.equal(r.rejected.round,1);
 host.games.push(round(0,{variant:'doubles',exerciseId:'wrong'}));
 r=trainingLedger(host,day,now);assert.equal(r.rows[0].skill,null);assert.deepEqual(r.blockedDays,[day]);
});
test('identical duplicate round is deduplicated but conflicting outcome rejects activity',()=>{
 const {host,s,round}=fixture(['Doubles Streak']);s.activities[0].rounds=1;
 const g=round(0,{variant:'doubles'});host.games=[g,{...g}];
 assert.equal(trainingLedger(host,day,now).rows[0].skill,'doubles');
 host.games.push({...g,win:false});
 assert.equal(trainingLedger(host,day,now).rows[0].skill,null);
});
test('recorded recovery time and unmeasured routines are not claimed as fixed skill exposure',()=>{
 const {host,s,round}=fixture(['Scoring Survival','Review']);s.activities[0].rounds=1;
 host.games=[round(0,{recovery:true})];
 const r=trainingLedger(host,day,now);assert.equal(r.rows[0].kind,'recovery');assert.equal(r.rows[0].skill,null);
 assert.equal(r.rows[1].kind,'routine');
});
test('year-long ledger respects calendar boundaries and actual denominators',()=>{
 const {host,s}=fixture(['Scoring Survival']);host.sessions=Array.from({length:400},(_,i)=>{
  const d=ago(i);return {...s,id:i+1,date:d,start:stamp(d),activities:[{...s.activities[0],at:stamp(d,10)}]};
 });
 const r=trainingLedger(host,day,now),w=ledgerWindows(r,day);
 assert.deepEqual(w.map(x=>x.sessions),[7,28,84,365]);assert.deepEqual(w.map(x=>x.total),[2100,8400,25200,109500]);
});

test('duplicate session ID on different dates blocks both dates',()=>{
 const {host,s}=fixture(['Scoring Survival']);const d=ago(1);
 host.sessions.push({...s,date:d,start:stamp(d),activities:[{...s.activities[0],at:stamp(d,10)}]});
 const r=trainingLedger(host,day,now);assert.deepEqual(r.blockedDays,[d,day]);assert.equal(r.rows.length,0);
});
test('a completed session cannot contain an interrupted exercise or contradictory activity marker',()=>{
 const {host,s}=fixture(['Scoring Survival']);s.interruptedExercise={name:'Scoring Ladder',exerciseIndex:1,seconds:100};
 assert.equal(trainingLedger(host,day,now).rows.length,0);
 delete s.interruptedExercise;s.activities[0].interrupted=true;
 assert.equal(trainingLedger(host,day,now).rows.length,0);
});
