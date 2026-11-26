import {validPrecisionRecord,validBaseBudget} from './precision-games.mjs';
// Only named drills whose primary measurement has an unambiguous fixed
// counterpart are eligible for learning. Mixed-skill drills remain on V1.6.
const rules=Object.freeze({
 'Scoring Survival':{skill:'scoring',field:'target',keys:['lives','goal','visitLimit','beginner']},
 'Scoring Ladder':{skill:'scoring',field:'targets',keys:['lives','goal','beginner']},
 'First Nine Siege':{skill:'scoring',field:'goal',keys:['visitLimit','beginner']},
 'Doubles Survival':{skill:'doubles',field:'allowed',keys:['variant','sequence','stageLength','beginner']},
 'Doubles Streak':{skill:'doubles',field:'lives',keys:['variant','targets','goal','beginner']},
 'Treble Hunt':{skill:'trebles',field:'lives',keys:['variant','targets','goal','beginner']},
 'Bull Survival':{skill:'bull',field:'allowed',keys:['target','goal','beginner']},
 'Bull Streak':{skill:'bull',field:'allowedMisses',keys:['target','goal','beginner']},
 'Focused Checkouts':{skill:'checkout',field:'lives',keys:['config','beginner']},
 'Checkout Climb':{skill:'checkout',field:'failedVisitLimit',keys:['target','finishGoal','priorFirstCheckout','beginner']}
});
export const LEARNING_GAMES=Object.freeze(Object.keys(rules));
const scalar=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000;
const budget=v=>scalar(v)||Array.isArray(v)&&v.length>=1&&v.length<=20&&v.every(scalar);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function clone(v){return JSON.parse(JSON.stringify(v))}
function plain(v,depth=0){return depth<=3&&(v===null||typeof v==='boolean'||typeof v==='string'&&v.length<=80||scalar(v)||Array.isArray(v)&&v.length<=30&&v.every(x=>plain(x,depth+1))||v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=12&&Object.entries(v).every(([k,x])=>/^[a-zA-Z][a-zA-Z0-9]*$/.test(k)&&plain(x,depth+1)))}
export function learningBasis(game){
 const spec=rules[game?.name];if(!spec)return null;
 if(['Bull Survival','Bull Streak'].includes(game.name)&&game.target!=='25/50')return null;
 if(['Doubles Survival','Doubles Streak'].includes(game.name)&&game.variant!=='doubles')return game.variant==='singles'?'singles':null;
 if(game.name==='Treble Hunt'&&game.variant!=='treble')return game.variant==='single'?'singles':null;
 if(game.name==='Focused Checkouts'&&!game.config?.balanced)return null;
 return spec.skill;
}
export function settingSnapshot(base,played){
 const spec=rules[base?.name],skill=learningBasis(base);
 if(!spec||!skill||!Number.isInteger(base.tier)||base.tier<1||base.tier>7||base.name!==played?.name||base.recovery||base.challengeTuning||played.recovery||played.challengeTuning&&played.challengeTuning!=='precision')return null;
 const field=spec.field,before=base[field],after=played[field];
 if(!validBaseBudget(base.name,field,before)||!validBaseBudget(base.name,field,after))return null;
 const p=played.precision,quarter=p?.quarter??0;
 if(p&&(!validPrecisionRecord({...played,tierAtStart:base.tier})||![2,3].includes(p.version)||p.field!==field||!same(p.before,before)||!same(p.after,after)))return null;
 if(!p&&!same(before,after))return null;
 const variant={};for(const k of spec.keys)if(base[k]!==undefined){if(!plain(base[k]))return null;variant[k]=clone(base[k])}
 const record={version:1,name:base.name,skill,tier:base.tier,rule:base.ruleVersion??null,field,before:clone(before),after:clone(after),quarter,variant};
 return validSetting(record)?record:null;
}
export function validSetting(s){
 if(!s||s.version!==1||!Object.hasOwn(rules,s.name)||!Number.isInteger(s.tier)||s.tier<1||s.tier>7||!Number.isFinite(s.quarter)||s.quarter<0||s.quarter>3||s.field!==rules[s.name].field||!(s.rule===null||typeof s.rule==='string'&&s.rule.length<=80)||!validBaseBudget(s.name,s.field,s.before)||!validBaseBudget(s.name,s.field,s.after)||!s.variant||Array.isArray(s.variant)||!plain(s.variant)||Object.keys(s.variant).some(k=>!rules[s.name].keys.includes(k)))return false;
 const base={name:s.name,tier:s.tier,...s.variant,[s.field]:s.before};if(learningBasis(base)!==s.skill)return false;
 if(s.quarter===0)return same(s.before,s.after);
 const basis=['singles','trebles'].includes(s.skill)?s.skill:undefined,skill=rules[s.name].skill==='trebles'?'scoring':rules[s.name].skill;
 return validPrecisionRecord({name:s.name,tierAtStart:s.tier,challengeTuning:'precision',precision:{version:Number.isInteger(s.quarter)?2:3,skill,tier:s.tier,field:s.field,before:s.before,after:s.after,quarter:s.quarter,...(basis?{basis}:{})}});
}
export const baseKey=s=>JSON.stringify([s.name,s.skill,s.tier,s.rule,s.field,s.before,s.variant]);
export const settingKey=s=>JSON.stringify([baseKey(s),s.quarter,s.after]);
export function recordSetting(base,played){const s=settingSnapshot(base,played);return s?{...played,learningSetting:s}:played}
