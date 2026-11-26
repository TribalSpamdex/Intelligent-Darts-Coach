import test from 'node:test';
import assert from 'node:assert/strict';
import {readinessProfiles,techniqueProfiles,contextLines,techniqueLines} from '../site/context-profile.mjs';
import {integratedAsk} from '../site/integrated-dialogue.mjs';
import {newMemory,assemble} from '../site/coach-memory.mjs';
const day='2026-11-26',now=Date.parse(day+'T12:00:00Z');
const ago=n=>new Date(now-n*86400000).toISOString().slice(0,10);
const row=(n,hits,patch={})=>({id:'o'+n,day:ago(n),skill:'doubles',context:'practice',protocol:'fixed',attempts:60,hits,...patch});
const ready=(n,fatigue,patch={})=>({day:ago(n),context:'practice',fatigue,confidence:'normal',pressure:'normal',pain:false,note:'',...patch});
function paired(){
 const observations=[],readiness=[];
 for(let w=0;w<4;w++)for(let d=0;d<4;d++){const n=w*7+d,high=d<2;observations.push(row(n,high?12:30));readiness.push(ready(n,high?'high':'normal'))}
 return {observations,readiness,clinic:[]};
}
const technical=(n,patch={})=>({id:'t'+n,day:ago(n),skill:'doubles',context:'practice',protocol:'fixed',domain:'release',observation:'repeated difference',condition:'normal practice',method:'video review',pain:false,note:'',...patch});
test('matched-week readiness evidence reports association without claiming causation',()=>{const s=paired(),r=readinessProfiles(s,day).find(r=>r.field==='fatigue');assert.equal(r.status,'association');assert.equal(r.pairs,4);assert.equal(r.daysA,8);assert.equal(r.daysB,8);assert.ok(Math.abs(r.delta+.3)<1e-10);assert.ok(contextLines(s,day).join(' ').includes('not a diagnosis'))});
test('unmatched or unknown condition is insufficient even with many throws',()=>{const s=paired();s.readiness=s.readiness.map(r=>({...r,fatigue:'unknown'}));assert.equal(readinessProfiles(s,day).find(r=>r.field==='fatigue').status,'insufficient')});
test('protocol and practice/competition scopes cannot be pooled',()=>{const s=paired();s.observations=s.observations.map((o,i)=>i%4<2?{...o,protocol:'alternate'}:o);assert.equal(readinessProfiles(s,day).length,6);assert.ok(readinessProfiles(s,day).every(r=>r.status==='insufficient'));s.observations=s.observations.map(o=>o.protocol==='alternate'?{...o,context:'competition',protocol:'fixed'}:o);assert.ok(readinessProfiles(s,day).every(r=>r.status==='insufficient'))});
test('future and stale readiness measurements excluded from current profile',()=>{const s={observations:[row(-1,30),row(56,30)],readiness:[ready(-1,'high'),ready(56,'normal')]};assert.deepEqual(readinessProfiles(s,day),[])});
test('technical observations split by condition and scope',()=>{const s={clinic:[technical(1),technical(2,{condition:'late practice'}),technical(3,{context:'competition'})]};const r=techniqueProfiles(s,day);assert.equal(r.length,3);assert.ok(r.every(x=>x.status==='reported-observation'))});
test('corroboration requires separate days and at least one non-self report',()=>{const a=technical(1,{method:'self report'}),b=technical(2,{method:'self report'});assert.equal(techniqueProfiles({clinic:[a,b]},day)[0].status,'reported-observation');assert.equal(techniqueProfiles({clinic:[a,{...b,method:'video review'}]},day)[0].status,'corroborated-observation');assert.equal(techniqueProfiles({clinic:[a,{...b,day:a.day,method:'video review'}]},day)[0].status,'reported-observation')});
test('contrary observations remain visible and discomfort takes priority',()=>{const s={clinic:[technical(1),technical(2,{observation:'no observed difference'}),technical(3,{domain:'grip',pain:true})]};const r=techniqueProfiles(s,day);assert.equal(r[0].domain,'grip');assert.equal(r[1].status,'mixed');assert.equal(r[1].contraryDays,1);assert.ok(techniqueLines(s,day).join(' ').includes('stop aggravating practice'))});
test('technical profiles ignore future and stale observations',()=>{assert.deepEqual(techniqueProfiles({clinic:[technical(-1),technical(28)]},day),[])});
test('new dialogue reports absence of evidence without inventing data',()=>{const h={games:[],sessions:[],assessmentHistory:[],bigSingles:[]};const s=assemble(h,newMemory(),day,now).state;assert.equal(integratedAsk(h,s,'Does fatigue affect my darts?',day,now).type,'context-profile');assert.equal(integratedAsk(h,s,'What have we observed about my technique?',day,now).type,'technique-profile');assert.ok(contextLines(s,day)[0].includes('No comparable'));assert.ok(techniqueLines(s,day)[0].includes('No recent'))});
