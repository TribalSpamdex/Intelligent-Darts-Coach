import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveReview,adaptiveReviewLines,currentReferenceBoundary,currentConditionRows,warningReplay,reviewMethodChoice} from '../site/adaptive-review.mjs';
import {newMemory} from '../site/coach-memory.mjs';
import {legFromInput} from '../site/match-statistics.mjs';
import {competitionStageDevelopment,competitionStageDevelopmentLines} from '../site/match-stages.mjs';
import {integratedAsk,conversationTurn} from '../site/integrated-dialogue.mjs';
import {coachBrief} from '../site/proactive-coach.mjs';
import {planPreview} from '../site/personal-programme.mjs';
import {nextComparison} from '../site/trial-planning.mjs';
import {recordSetting} from '../site/challenge-setting.mjs';
import {saveArchive,readArchive,archiveStatus,deleteArchive} from '../site/storage-vault.mjs';
const day='2026-11-27',now=Date.parse(day+'T12:00Z'),shift=n=>new Date(now+n*86400000).toISOString().slice(0,10),host={games:[],sessions:[],bigSingles:[],assessmentHistory:[]},state=()=>newMemory().state;
const scope={skill:'doubles',context:'practice',protocol:'IDC precision fixed doubles'};
const samples=(f,{days=84,skill='doubles',protocol=scope.protocol,context='practice',attempts=60}={})=>Array.from({length:days},(_,i)=>{const age=days-i-1;return {id:protocol+'-'+age,day:shift(-age),skill,protocol,context,attempts,hits:f(age)}});
const lower=age=>age<28?12:42,better=age=>age<28?42:12,recover=age=>age<14?30:age<28?12:42;
const get=(observations,extra={},h=host)=>adaptiveReview(h,{...state(),observations,...extra},day,now);
const report={decision:'balanced',verification:{status:'passed'},strategy:{agenda:{questions:[]}},active:{mode:'balanced-until-accepted'}};
const second='IDC V6.2 assessment D1-D20 fixed 60';
test('DEV53 paired players and recovery: same historical coverage does not mean the same prescription',()=>{
 assert.equal(get(samples(lower)).focus.status,'confirmed-decline');assert.equal(get(samples(lower)).decision,'review');
 assert.equal(get(samples(better)).profiles[0].status,'improving');assert.equal(get(samples(better)).focus,null);
 assert.equal(get(samples(()=>30)).decision,'balanced');
 const r=get(samples(recover));assert.equal(r.profiles[0].status,'recovering');assert.equal(r.decision,'recovering');
 assert.equal(get(samples(lower,{days:12})).decision,'collect');
});
test('DEV53 contradictory comparable protocols block a broad coaching change without losing either denominator',()=>{
 const observations=[...samples(lower),...samples(better,{protocol:second})],s={...state(),observations},r=get(observations);
 assert.equal(r.decision,'disagree');assert.equal(r.conflicts.length,1);assert.equal(r.profiles.length,2);assert.equal(r.focus.trend.earlier.attempts,1680);
 assert.equal(coachBrief(host,s,report,[],[],day,now).kind,'competing-measurements');
 const before=JSON.stringify(s),p=planPreview(host,{...s,interventions:[{id:'i',...scope,status:'accepted',responseDay:shift(-2),proposedDay:shift(-3),reviewAfterDays:14}]},{...report,active:{mode:'accepted-temporary-focus',intervention:'i'}},[],day,now);
 assert.equal(p.focus,null);assert.equal(p.segments.reduce((a,b)=>a+b.minutes,0),60);assert.equal(JSON.stringify(s),before);
 const c={status:'selected',skill:'doubles'};assert.equal(reviewMethodChoice(c,r).status,'unchanged');assert.equal(reviewMethodChoice({...c,skill:'bull'},r).status,'selected');
});
test('DEV53 setup, reassessment, duplicate identity, future records and stale data cannot become current evidence',()=>{
 const observations=samples(lower),s={...state(),observations,changes:[{day:shift(-3)}]};
 assert.equal(currentConditionRows(observations,s,day).length,3);assert.equal(get(observations,{changes:s.changes}).focus,null);
 const h={...host,assessment:{version:6,finished:true,completedAt:now-7*86400000,offsetMinutes:0}};
 assert.equal(currentReferenceBoundary(h,state(),day,now),shift(-7));assert.equal(get(observations,{},h).focus,null);
 const old=observations.filter(o=>o.day<shift(-8));assert.equal(get(old).profiles[0].status,'stale');
 const mirrored=observations.concat(observations[0],{...observations[0],hits:1},{...observations[0],id:'future',day:shift(1)});
 assert.equal(get(mirrored).focus?.trend.recent.attempts,get(observations).focus?.trend.recent.attempts);
 assert.deepEqual(get(observations).profiles,get([...observations].reverse()).profiles);
});
test('DEV53 measured and reported conditions retain competing explanations; no mechanical diagnosis',()=>{
 const observations=samples(lower),r=get(observations,{answers:[{...scope,day,question:'fatigue',answer:'yes'},{...scope,day,question:'technique',answer:'yes'}]});
 assert.equal(r.decision,'investigate');assert.ok(r.diagnostic.hypotheses.some(h=>h.id==='fatigue'&&h.status==='supported-possibility'));assert.ok(r.knowledge.some(k=>k.id==='fatigue-mental'));
 assert.match(adaptiveReviewLines(r).join(' '),/No observed association establishes a cause/);
 assert.equal(get(observations,{readiness:[{day,context:'practice',pain:true}]}).decision,'readiness');
 assert.equal(get(observations,{readiness:[{day,context:'practice',fatigue:'high'}]}).decision,'readiness');
});
test('DEV53 retrospective warnings use distinct outcome windows and never classify future records as earlier data',()=>{
 const observations=samples(age=>age<56?12:42),s={...state(),observations};const row=warningReplay(s,day)[0];
 assert.equal(row.evaluations.length,1);assert.equal(row.warnings,1);assert.equal(row.continued,1);assert.equal(row.evaluations[0].anchor,shift(-28));
 const recovery={...s,observations:samples(age=>age<28?42:age<56?12:42)};const restored=warningReplay(recovery,day)[0];assert.equal(restored.warnings,1);assert.equal(restored.continued,0);
 const after={...s,observations:samples(age=>age<28?12:42)};assert.equal(warningReplay(after,day)[0].lowerWithoutWarning,1);
 assert.equal(warningReplay({...s,changes:[{day:shift(-14)}]},day)[0].evaluations.length,0);
 assert.deepEqual(warningReplay({...s,observations:[...observations,{...observations[0],id:'future',day:shift(1)}]},day),warningReplay(s,day));
});
function actualLegs(){const legs=[];for(let age=55;age>=0;age--)for(let i=0;i<4;i++)legs.push(legFromInput({id:'leg-'+age+'-'+i,day:shift(-age),start:301,doubleIn:false,context:'competition',result:'won',visits:age<28?'S20 S20 S20\nS20 S20 S20\nS20 S20 S20\nT20 S11 50':'T20 T20 T20\nT20 S11 50'},day).leg);return legs;}
test('DEV53 actual competition stage deterioration uses actual credited darts, not bot games or unknown aim',()=>{
 const legs=actualLegs(),s={...state(),legs};const rows=competitionStageDevelopment(s,day);const p=rows.find(r=>r.metric==='scoring-stage average');assert.equal(p.status,'declining');assert.equal(p.start,301);assert.equal(p.trend.earlier.value,180);assert.equal(p.trend.recent.value,60);assert.ok(!rows.some(r=>r.metric==='explicit finishing doubles'));
 assert.equal(competitionStageDevelopment({...s,changes:[{day:shift(-2)}]},day).length,0);assert.equal(competitionStageDevelopment({...s,legs:legs.map(l=>({...l,context:'practice'}))},day).length,0);
 assert.deepEqual(competitionStageDevelopment({...s,legs:[...legs].reverse()},day),rows);
 assert.match(competitionStageDevelopmentLines(rows).join(' '),/no causal conclusion/);
 const r=get(samples(age=>age<28?900:600,{skill:'scoring',protocol:'IDC precision fixed scoring',attempts:30}),{legs:[...legs].reverse()});assert.equal(r.decision,'disagree');
});
test('DEV53 current experiment choice never revives a pre-change comparison',()=>{
 const a=recordSetting({name:'Scoring Survival',tier:4,target:60,lives:3},{name:'Scoring Survival',tier:4,target:60,lives:3}).learningSetting,b=recordSetting({name:'Scoring Ladder',tier:4,targets:[55,59,63],lives:3},{name:'Scoring Ladder',tier:4,targets:[55,59,63],lives:3}).learningSetting;
 const c={kind:'method',skill:'scoring',protocol:'IDC precision fixed scoring',first:a.name,second:b.name,firstSetting:a,secondSetting:b,pairs:6,weeks:6,latest:day,status:'unclear',matched:[{aSeconds:600,bSeconds:600}]};
 const old={...state(),changes:[{day:shift(-7)}]};assert.equal(nextComparison(host,old,day,now,{comparisons:[c],currentComparisons:[]}).status,'collect-baseline');assert.equal(nextComparison(host,old,day,now,{comparisons:[c]}).status,'collect-baseline');
 assert.equal(nextComparison(host,old,day,now,{currentComparisons:[c]}).status,'comparison-candidate');assert.equal(nextComparison(host,state(),day,now,{comparisons:[{...c,matched:[]}]}).status,'collect-baseline');
});
test('DEV53 dialogue aliases and contextual followups use the same read-only evidence',()=>{
 const s={...state(),observations:samples(lower)},before=JSON.stringify(s);
 for(const [q,t] of [['current player profile','adaptive-profile'],['why am I getting worse?','adaptive-diagnosis'],['warning accuracy','warning-replay']])assert.equal(integratedAsk(host,s,q,day,now).type,t);
 const turn=conversationTurn(host,s,'Why has my performance changed?',day,now);assert.equal(turn.context.topic,'adaptive-diagnosis');const follow=conversationTurn(host,s,'How do you know?',day,now,[],[],{},[],turn.context);assert.equal(follow.answer.type,'review-followup');assert.match(follow.answer.lines.join(' '),/confirmed decline/);assert.equal(JSON.stringify(s),before);
});
// Transactional mock with staged writes, quota failure and concurrency injection.
// Browser CI independently tests the real IndexedDB path on both engines.
function mockDB(){
 let committed=new Map(),fail=null,inject=null,closed=0;
 const factory={open(){const request={};queueMicrotask(()=>{request.result={objectStoreNames:{contains:()=>true},close(){closed++},transaction(_,mode){
  if(mode==='readwrite'&&inject){inject(committed);inject=null}
  const staged=new Map([...committed].map(([k,v])=>[k,structuredClone(v)]));let pending=0,ended=false;
  const tx={error:null,abort(){if(ended)return;ended=true;queueMicrotask(()=>tx.onabort?.())},objectStore(){
   function op(type,key,value){const req={};pending++;queueMicrotask(()=>{if(ended)return;try{if(type==='put'&&key===fail){tx.error=new DOMException('quota','QuotaExceededError');tx.abort();return}if(type==='get')req.result=structuredClone(staged.get(key));if(type==='put')staged.set(key,structuredClone(value));if(type==='delete')staged.delete(key);req.onsuccess?.();}finally{pending--;if(!pending&&!ended){ended=true;if(mode==='readwrite')committed=staged;queueMicrotask(()=>tx.oncomplete?.())}}});return req}
   return {get:k=>op('get',k),put:(v,k)=>op('put',k,v),delete:k=>op('delete',k)}
  }};return tx;
 }};request.onsuccess()});return request}};
 return {factory,setFail:k=>fail=k,corrupt:()=>{const v=committed.get('manual');committed.set('manual',{...v,json:'damaged'})},inject:fn=>inject=fn,closed:()=>closed};
}
const json=n=>JSON.stringify({games:[],sessions:[],marker:n});
test('DEV53 atomic archive rotation, quota abort, duplicate snapshot and explicit prior recovery',async()=>{
 const mock=mockDB(),o={factory:mock.factory,now};await saveArchive(json('A'),o);assert.equal(await readArchive({...o,generation:'previous'}),null);
 await saveArchive(json('B'),o);assert.equal((await readArchive(o)).json,json('B'));assert.equal((await readArchive({...o,generation:'previous'})).json,json('A'));
 await saveArchive(json('B'),{...o,now:now+1});assert.equal((await readArchive({...o,generation:'previous'})).json,json('A'));
 mock.setFail('manual');await assert.rejects(saveArchive(json('C'),o),{name:'QuotaExceededError'});mock.setFail(null);assert.equal((await readArchive(o)).json,json('B'));assert.equal((await readArchive({...o,generation:'previous'})).json,json('A'));
 mock.corrupt();const r=await archiveStatus(o);assert.equal(r.latest.status,'unavailable');assert.equal(r.previous.status,'verified');assert.ok(!Object.hasOwn(r.previous.value,'json'));
 await saveArchive(json('C'),o);assert.equal((await readArchive(o)).json,json('C'));assert.equal((await readArchive({...o,generation:'previous'})).json,json('A'));
 await deleteArchive(o);assert.equal(await readArchive(o),null);assert.equal(await readArchive({...o,generation:'previous'}),null);assert.ok(mock.closed()>0);
});
test('DEV53 concurrent archive save lease aborts instead of overwriting another window',async()=>{
 const mock=mockDB(),o={factory:mock.factory,now};await saveArchive(json('A'),o);mock.inject(map=>map.set('manual',{...map.get('manual'),savedAt:now+1}));await assert.rejects(saveArchive(json('B'),o),/another window/);assert.equal((await readArchive(o)).json,json('A'));
});
test('DEV53 seeded paired-player simulation preserves distinct skills and no fabricated declines',()=>{
 let seed=530027;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<100;i++){
  const base=18+Math.floor(random()*23),decline=i%2===0,obs=samples(age=>base+(decline&&age<28?-14:0)+Math.floor(random()*3)-1,{days:56});
  const r=get(obs);assert.equal(r.focus?.status??null,decline?'confirmed-decline':null);
 }
});
