// Local tactical sandbox. Standard checkout advice remains authoritative.
// Only actual recorded board segments from complete fixed samples can
// supply an empirical miss model; binary misses cannot.
import {manualSamples} from './manual-target-samples.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
import {points,isDouble,SEGMENTS,rankedRoutes,visit} from './engine/engine.mjs';
import {preferredDoubles} from './engine/goals.mjs';
import {advice} from './engine/tactics.mjs';
import {REGIONS} from './engine/target-evidence.mjs';
const canonical=s=>/^[LI]/.test(s)?'S'+s.slice(1):s;
const sum=xs=>xs.reduce((a,b)=>a+b,0);
function model(samples){
 const counts={};
 for(const x of samples)for(const o of x.throws){const a=canonical(o.actual);counts[a]=(counts[a]??0)+1}
 const n=sum(Object.values(counts));
 return Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).map(([a,v])=>({score:points(a),double:isDouble(a),p:v/n}));
}
export function measuredTargets(throws,day){
 if(!dayValid(day))throw Error('Invalid tactical evidence date');
 const groups=new Map();
 for(const s of manualSamples(throws??[])){
  if(!SEGMENTS.includes(s.aim)||dayGap(s.day,day)<0||dayGap(s.day,day)>=84)continue;
  const g=groups.get(s.aim)??[];g.push(s);groups.set(s.aim,g);
 }
 const eligible=[],limited=[];
 for(const [aim,rows] of groups){
  rows.sort((a,b)=>a.day.localeCompare(b.day));
  const half=Math.floor(rows.length/2),a=rows.slice(0,half),b=rows.slice(half);
  const fresh=dayGap(rows.at(-1).day,day)<=14;
  if(a.length<4||b.length<4||!fresh){limited.push({aim,days:rows.length,attempts:20*rows.length,last:rows.at(-1).day});continue}
  eligible.push({aim,days:rows.length,attempts:20*rows.length,last:rows.at(-1).day,full:model(rows),first:model(a),second:model(b)});
 }
 return {eligible:eligible.sort((a,b)=>a.aim.localeCompare(b.aim)),limited:limited.sort((a,b)=>a.aim.localeCompare(b.aim))};
}
function policy(score,darts,targets,part){
 const memo=new Map();
 function best(left,n){
  if(n===0||left<2||left>60*(n-1)+50)return 0;
  const k=left+'/'+n;if(memo.has(k))return memo.get(k);
  let v=0;for(const t of targets)v=Math.max(v,value(left,n,t));memo.set(k,v);return v;
 }
 function value(left,n,t){
  let result=0;
  for(const o of t[part]){
   const remaining=left-o.score;
   if(remaining===0&&o.double)result+=o.p;
   else if(remaining>=2&&n>1)result+=o.p*best(remaining,n-1);
  }
  return Math.max(0,Math.min(1,result));
 }
 return targets.map(t=>({aim:t.aim,value:value(score,darts,t)})).sort((a,b)=>b.value-a.value||a.aim.localeCompare(b.aim));
}
export function tacticalModel(memory,score,darts,day){
 if(!Number.isInteger(score)||score<2||score>170||!Number.isInteger(darts)||darts<1||darts>3)throw Error('Choose a checkout from 2–170 and one to three darts');
 const standard=rankedRoutes(score,darts,{},preferredDoubles(memory))[0]?.path??null;
 const evidence=measuredTargets(memory.throws??[],day),targets=evidence.eligible;
 const base={score,darts,standard,coverage:targets.map(t=>({aim:t.aim,days:t.days,attempts:t.attempts,last:t.last})),limited:evidence.limited,limitation:'Conditional restricted empirical model of fixed practice. Unobserved outcomes have no estimated mass; independent stationary throws are assumed. Not a calibrated checkout probability or a match forecast. Standard advice is not overridden.'};
 if(!standard)return {...base,status:'no-legal-finish',options:[]};
 if(!targets.length)return {...base,status:'insufficient',options:[]};
 const full=policy(score,darts,targets,'full'),early=policy(score,darts,targets,'first'),late=policy(score,darts,targets,'second'),lookup=(list,aim)=>list.find(x=>x.aim===aim)?.value??null;
 const options=full.map(x=>({aim:x.aim,estimate:x.value,early:lookup(early,x.aim),late:lookup(late,x.aim)}));
 const candidate=options[0],baseline=options.find(x=>x.aim===standard[0]);
 if(candidate.estimate<=0)return {...base,status:'no-measured-path',options:[]};
 const agreement=early[0].aim===candidate.aim&&late[0].aim===candidate.aim;
 const supported=baseline&&candidate.aim!==baseline.aim&&agreement&&candidate.estimate-baseline.estimate>=.03&&candidate.early-baseline.early>=.03&&candidate.late-baseline.late>=.03;
 return {...base,status:!baseline?'standard-unmeasured':supported?'candidate-for-comparison':'no-stable-alternative',options:options.slice(0,12),candidate: candidate.aim,agreement,standardModel:baseline??null};
}
export function tacticalLines(r){
 const pct=x=>(100*x).toFixed(1)+'%';
 const lines=[r.score+' with '+r.darts+' darts. Standard legal route: '+(r.standard?r.standard.join(' → '):'none')+'. '+r.coverage.length+' eligible measured targets.'];
 if(r.status==='insufficient')lines.push('Need at least eight complete samples on separate days per target, with a recent sample. Binary hit/miss history is not enough.');
 else if(r.status==='no-measured-path')lines.push('The measured target set cannot establish a nonzero finish path.');
 else if(r.status==='standard-unmeasured')lines.push('Standard first aim is not adequately measured. Do not infer a preference.');
 else if(r.status==='candidate-for-comparison')lines.push(r.candidate+' is a candidate for a controlled comparison; its conditional estimate exceeds the measured standard first aim in both chronological halves.');
 else if(r.status==='no-stable-alternative')lines.push('No stable supported alternative to the standard first aim.');
 for(const o of r.options)lines.push(o.aim+' first aim with model-selected recovery: '+pct(o.estimate)+' (earlier '+pct(o.early)+', later '+pct(o.late)+').');
 if(r.coverage.length)lines.push('Measured coverage: '+r.coverage.map(x=>x.aim+' '+x.attempts+' darts / '+x.days+' days').join(' · ')+'.');
 return [...lines,r.limitation];
}
export function recoveryAdvice(memory,score,actual,darts=3){
 if(!Array.isArray(actual)||actual.length<1||actual.length>3||!actual.every(x=>REGIONS.includes(x)))throw Error('Record actual segments, not intended targets');
 const r=advice(memory,{score,darts,actual});
 return {status:r.status,remaining:r.remaining,dartsLeft:r.status==='bust'||r.status==='finished'?0:r.dartsLeft,options:r.options.map(x=>x.path),setup:r.setup.slice(0,5),guidance:r.guidance};
}
export function recoveryLines(r){
 const lines=[r.guidance,'Remaining score '+r.remaining+'; '+r.dartsLeft+' usable darts.'];
 for(const x of r.options.slice(0,5))lines.push(x.join(' → '));
 if(!r.options.length&&r.status==='setup-required')for(const x of r.setup)lines.push('Aim '+x.target+' to leave '+x.remaining+'.');
 return lines;
}
export function tacticalAnswer(state,q,day){
 const m=q.match(/^(?:model|analyse|analyze|measured) checkout (\d{1,3})(?: with ([123]) darts?)?$/);
 if(m)return {kind:'answer',type:'tactical-model',lines:tacticalLines(tacticalModel(state,Number(m[1]),m[2]?Number(m[2]):3,day))};
 const r=q.match(/^recovery from (\d{1,4}) after ([a-z0-9]+(?: [a-z0-9]+){0,2})$/);
 if(r)return {kind:'answer',type:'checkout-recovery',lines:recoveryLines(recoveryAdvice(state,Number(r[1]),r[2].toUpperCase().split(' ')))};
 return null;
}
