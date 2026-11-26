import test from 'node:test';
import assert from 'node:assert/strict';
import {learnedMethodChoice} from '../site/personal-programme.mjs';
import {newMemory,validateMemory,changeMemory} from '../site/coach-memory.mjs';
const day='2026-11-26',prev='2026-11-20';
const scoring=(name,field,before)=>({version:1,name,skill:'scoring',tier:3,rule:null,field,before,after:before,quarter:0,variant:{}});
const a=scoring('Scoring Survival','target',60),b=scoring('Scoring Ladder','targets',[40,50,60]);
const comparison={kind:'method',skill:'scoring',protocol:'IDC precision fixed scoring',status:'second-associated',pairs:8,weeks:8,latest:prev,firstSetting:a,secondSetting:b};
const opt={normal:a.name,alternative:b.name,skill:'scoring',normalTier:3,alternativeTier:3,seconds:600,normalScore:10,alternativeScore:11};
const fixture=()=>({memory:{learnedMethods:true},state:newMemory().state,report:{decision:'balanced',verification:{status:'passed'}},events:[],history:[],policy:{categories:{scoring:{}}},options:[{...opt}],comparisons:[structuredClone(comparison)],day});
const pick=patch=>learnedMethodChoice({...fixture(),...patch});
test('supported same-skill native near-tie may be selected prospectively',()=>{
 const x=fixture(),before=JSON.stringify(x),r=learnedMethodChoice(x);
 assert.equal(r.status,'selected');assert.equal(r.alternative,b.name);assert.equal(r.seconds,600);assert.equal(r.pairs,8);assert.equal(JSON.stringify(x),before);
});
test('default and legacy backup opt-out, strict preference validation, explicit revocation',()=>{
 const m=newMemory(),host={sessions:[],games:[],assessmentHistory:[],bigSingles:[]};
 assert.equal(m.learnedMethods,false);delete m.learnedMethods;assert.equal(validateMemory(m).learnedMethods,false);
 assert.throws(()=>validateMemory({...m,learnedMethods:'true'}));
 assert.throws(()=>changeMemory(host,m,day,'learned-methods',{enabled:1}));
 const yes=changeMemory(host,m,day,'learned-methods',{enabled:true});assert.equal(yes.learnedMethods,true);
 assert.equal(changeMemory(host,yes,day,'learned-methods',{enabled:false}).learnedMethods,false);
 assert.equal(pick({memory:m}).status,'unchanged');
});
test('current coaching, competition, trial, and weekly selection caps take precedence',()=>{
 assert.equal(pick({report:{decision:'temporary-focus',verification:{status:'passed'}}}).status,'unchanged');
 assert.equal(pick({report:{decision:'balanced',verification:{status:'failed'}}}).status,'unchanged');
 assert.equal(pick({events:[{id:'event',day:'2026-11-29',recordedDay:day,name:'League',kind:'league'}]}).status,'unchanged');
 const x=fixture();x.state.trials=[{status:'active'}];assert.equal(learnedMethodChoice(x).status,'unchanged');
 const y=fixture();y.state.interventions=[{status:'proposed'}];assert.equal(learnedMethodChoice(y).status,'unchanged');
 assert.equal(pick({history:[{date:prev,wholeSessionAudit:{idcMethod:{status:'selected'}}}]}).status,'unchanged');
 assert.equal(pick({history:[{date:'2026-11-19',wholeSessionAudit:{idcMethod:{status:'selected'}}}]}).status,'selected');
});
test('native workload and score, duration and tier protections cannot be bypassed',()=>{
 for(const p of [{policySafety:true},{overexposed:true},{learning:{protect:true}},{learning:{permissionToEscalate:true}}])assert.equal(pick({policy:{categories:{scoring:p}}}).status,'unchanged');
 for(const p of [{alternativeScore:12.51},{alternativeScore:9},{alternativeScore:NaN},{seconds:299},{seconds:1201},{normalTier:2},{alternativeTier:2},{skill:'doubles'},{alternative:'Big Singles'}])assert.equal(pick({options:[{...opt,...p}]}).status,'unchanged',JSON.stringify(p));
});
test('stale, future, weak, reversed, contradictory or malformed evidence is not actionable',()=>{
 for(const p of [{latest:'2026-10-28'},{latest:'2026-11-27'},{pairs:5},{weeks:5},{status:'unclear'},{status:'first-associated'},{kind:'dose'},{firstSetting:{name:a.name}},{secondSetting:{...b,skill:'bull'}}])assert.equal(pick({comparisons:[{...comparison,...p}]}).status,'unchanged',JSON.stringify(p));
 assert.equal(pick({comparisons:[]}).status,'unchanged');
 assert.equal(pick({comparisons:[comparison,{...comparison,status:'first-associated'}]}).status,'unchanged');
 assert.equal(pick({comparisons:[comparison,{...comparison,protocol:'Different fixed protocol'}]}).status,'unchanged');
 assert.equal(pick({comparisons:[comparison,{...comparison,secondSetting:{...b,before:[45,55,65],after:[45,55,65]}}]}).status,'unchanged');
});
test('recent reported equipment or readiness changes veto selection',()=>{
 const x=fixture();x.state.setups=[{day:'2026-11-22'}];assert.equal(learnedMethodChoice(x).status,'unchanged');
 const y=fixture();y.state.readiness=[{day,context:'practice',fatigue:'high'}];assert.equal(learnedMethodChoice(y).status,'unchanged');
});
test('deterministic tie-breaking and evidence deletion',()=>{
 const x=fixture();x.options.push({...opt,alternativeScore:12});assert.equal(learnedMethodChoice(x).scoreGap,1);
 x.comparisons=[];assert.equal(learnedMethodChoice(x).status,'unchanged');
});
