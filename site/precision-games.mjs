import {dayValid,dayGap} from './engine/context.mjs';
// Only monotone scalar limits change. No target ring, timer, benchmark,
 // route, rule semantics or legacy tier is changed.
const specs={
 'Scoring Survival':['scoring','target',5,5,180],
 'Scoring Ladder':['scoring','targets',5,5,180],
 'Staying Straight':['scoring','roundPointGoal',2,3,75],
 'Treble Hunt':['scoring','lives',-1,3,50],
 'Doubles Streak':['doubles','lives',-1,3,50],
 'Doubles Survival':['doubles','allowed',-1,3,100],
 'Bull Survival':['bull','allowed',-1,1,100],
 'Bull Streak':['bull','allowedMisses',-1,3,50],
 'Bull Bank':['bull','dartsLeft',-2,3,100],
 'Bull Blackjack':['bull','allowed',-1,3,100],
 'Number Lock':['doubles','allowedMisses',-1,2,50],
 'Shanghai Combo':['scoring','lives',-1,2,50],
 'Outside Doubles':['doubles','allowed',-1,4,120],
 'Double Double':['doubles','allowed',-1,4,120],
 'Double Bull Bridge':['doubles','allowed',-1,3,120],
 'Golf Five':['doubles','par',-1,5,40],
 'Double-In 201':['checkout','maxVisits',-1,3,80],
 '101 Sprint':['checkout','allowed',-1,2,120],
 '170 Challenge':['checkout','maxVisits',-1,1,80],
 'Last Dart Rescue':['checkout','lives',-1,2,60],
 'Last Dart Standing':['checkout','lives',-1,2,60],
 'Checkout Poker':['checkout','allowed',-1,2,25],
 'Checkout Climb':['checkout','failedVisitLimit',-1,3,100],
 'Focused Checkouts':['checkout','lives',-1,3,100],
 'Pressure Cricket':['scoring','allowed',-1,3,120],
 'Cricket Countdown':['scoring','allowed',-1,5,120],
 'Switchback':['scoring','allowed',-1,7,120],
 'Halve It':['scoring','goal',5,5,999],
 'Risk or Reward':['scoring','goal',5,5,999],
 'First Nine Siege':['scoring','goal',5,5,540],
 'Neighbour Trap':['scoring','allowed',-1,2,120],
 'Double Jackpot':['doubles','allowed',-1,2,120],
 'Double Duel':['doubles','opponentEvery',-1,2,6],
 'Dartboard Bingo':['doubles','maxCalls',-1,5,100],
 'Split the Difference':['scoring','tolerance',-1,1,100],
 '301 Pressure':['scoring','maxDarts',-1,12,75],
 '501 Pressure':['scoring','maxDarts',-1,18,105]
};
export const SUPPORTED_GAMES=Object.freeze(Object.keys(specs));
export function validBaseBudget(name,field,value){if(!Object.hasOwn(specs,name))return false;const [,expected,,min,max]=specs[name];if(field!==expected)return false;const valid=x=>Number.isInteger(x)&&x>=min&&x<=max;return field==='targets'?Array.isArray(value)&&value.length>0&&value.length<=20&&value.every(valid):valid(value)}
const descriptions={lives:'Lives',allowed:'Dart allowance',allowedMisses:'Miss allowance',dartsLeft:'Dart budget',maxDarts:'Dart limit',maxVisits:'Visit limit',target:'Scoring target',targets:'Scoring ladder',goal:'Target score',roundPointGoal:'Point target',failedVisitLimit:'Failed visit allowance',maxCalls:'Call limit',par:'Par',tolerance:'Score tolerance',opponentEvery:'Darts between rival points'};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Four integer game configurations. Large score adjustments use smaller
// increments; small integer life/allowance budgets can change by 1, 2 or 3.
// A mathematical floor can legitimately collapse adjacent configurations.
export function quarterDelta(delta,quarter){
 if(!Number.isInteger(quarter)||quarter<0||quarter>3||!Number.isInteger(delta)||!delta)throw Error('Invalid quarter adjustment');
 if(!quarter)return 0;
 const magnitude=Math.abs(delta),steps=magnitude===1?[1,2,3]:magnitude===2?[1,2,3]:magnitude===3?[1,3,4]:[Math.max(1,Math.floor(magnitude/2)),magnitude,Math.ceil(magnitude*1.5)];
 return Math.sign(delta)*steps[quarter-1];
}
// Enumerate real integer budgets, interpolating only between the four
// established anchor settings. No rounding of a measured skill into a tier.
export function fineSteps(delta){
 const sign=Math.sign(delta),anchors=[0,1,2,3].map(q=>Math.abs(quarterDelta(delta,q))),out=[{quarter:0,step:0}];
 for(let q=1;q<=3;q++)for(let n=anchors[q-1]+1;n<=anchors[q];n++)out.push({quarter:q-1+(n-anchors[q-1])/(anchors[q]-anchors[q-1]),step:sign*n});
 return out;
}
export function configurationDelta(delta,quarter){return fineSteps(delta).find(x=>x.quarter===quarter)?.step??null}
const singleGames=new Set(['Treble Hunt','Doubles Streak','Doubles Survival','Number Lock','Shanghai Combo','Golf Five','Switchback','Double Jackpot','Dartboard Bingo','Double Duel']);
const trebleGames=new Set(['Treble Hunt','Number Lock','Switchback']);
function ringBasis(g){if(g.name==='Switchback'&&g.ring==='D')return 'doubles';if(singleGames.has(g.name)&&(g.variant==='single'||g.variant==='singles'||g.ring==='S'||g.name==='Double Duel'&&g.tier>=6))return 'singles';if(trebleGames.has(g.name)&&(g.variant==='treble'||g.ring==='T'))return 'trebles';return null}
const bounded=(v,delta,min,max)=>Math.max(min,Math.min(max,v+delta));
const quarterOf=d=>d?.quarter!==undefined?(Number.isInteger(d.quarter)&&d.quarter>=0&&d.quarter<=3?d.quarter:0):d?.half==='upper'?2:0;
const levelOf=d=>{
 const q=quarterOf(d),v=d?.challenge;
 const supported=Number.isInteger(d?.quarter)&&Number.isFinite(v)&&v>=0&&v<=3&&Math.floor(v+1e-8)===q?v:q;
 const cap=d?.recentCap;
 return d?.temporaryFormCap===true&&Number.isFinite(cap)&&cap>=0&&cap<=supported?cap:supported;
};
const hasContinuous=d=>Number.isFinite(d?.challenge)&&Number.isInteger(d?.quarter)&&d.quarter===Math.floor(d.challenge+1e-8)&&d.challenge>=0&&d.challenge<=3;
export function validPrecisionRecord(g){
 const p=g?.precision;
 if(!p||![1,2,3].includes(p.version)||!Object.hasOwn(specs,g.name)||p.tier!==g.tierAtStart||g.challengeTuning!=='precision')return false;
 const [skill,field,delta,min,max]=specs[g.name];
 if(p.skill!==skill||p.field!==field||!Number.isInteger(p.tier)||p.tier<1||p.tier>7)return false;
 if(p.version===1&&g.name==='Double Duel')return false;
 if(p.version===2&&(!Number.isInteger(p.quarter)||p.quarter<1||p.quarter>3))return false;
 if(p.version===3&&(!Number.isFinite(p.quarter)||p.quarter<=0||p.quarter>=3||Number.isInteger(p.quarter)||configurationDelta(delta,p.quarter)===null))return false;
 if(p.basis!==undefined&&(p.version===1||!(p.basis==='singles'&&singleGames.has(g.name)||p.basis==='trebles'&&trebleGames.has(g.name)||p.basis==='doubles'&&g.name==='Switchback')))return false;
 const step=p.version===1?delta:p.version===2?quarterDelta(delta,p.quarter):configurationDelta(delta,p.quarter);
 const valid=(a,b)=>Number.isInteger(a)&&a>=min&&a<=max&&b===bounded(a,step,min,max);
 return !same(p.before,p.after)&&(field==='targets'?Array.isArray(p.before)&&Array.isArray(p.after)&&p.before.length>0&&p.before.length===p.after.length&&p.before.every((a,i)=>valid(a,p.after[i])):valid(p.before,p.after));
}
function feasible(game,field,next){
 if(field==='targets')return Array.isArray(next)&&next.length===game.targets.length&&next.every((v,i)=>!i||v>=next[i-1]);
 switch(game.name){
 case 'Bull Bank':case 'Bull Blackjack':return next>=Math.ceil(game.goal/50);
 case 'Outside Doubles':case 'Double Double':case 'Cricket Countdown':case 'Pressure Cricket':return Array.isArray(game.targets)&&next>=game.targets.length;
 case 'Neighbour Trap':return next>=game.goal;
 case 'Double Jackpot':{
  // Targets cannot be reused. An exact score must be achievable inside
  // the proposed allowance, even if every chosen target is hit.
  if(!['D','S'].includes(game.ring)||!Number.isInteger(game.goal))return false;
  const values=[20,16,10,5].map(v=>v*(game.ring==='D'?2:1));
  for(let mask=1;mask<16;mask++){
   let total=0,count=0;
   for(let i=0;i<4;i++)if(mask&(1<<i)){total+=values[i];count++}
   if(total===game.goal&&count<=next)return true;
  }
  return false;
 }
 case 'Dartboard Bingo':return !!game.singleLineRound||next>=20;
 case 'Switchback':return Array.isArray(game.sequence)&&next>=game.sequence.length;
 default:return true;
 }
}
export function precisionRound(game,decisions,options={}){
 if(!game||typeof game!=='object'||!Object.hasOwn(specs,game.name)||game.precision||game.recovery||game.challengeTuning||!options.eligible||options.probe||options.safety||options.cooldown)return game;
 const [skill,field,delta,min,max]=specs[game.name],d=decisions?.[skill];
 if(!Number.isInteger(d?.tier)||!Number.isInteger(game.tier)||game.tier!==d.tier)return game;
 const legacy=!Number.isInteger(d.quarter);
 const basis=legacy?null:ringBasis(game);
 const primary=basis&&!legacy?decisions[basis]:d;
 let quarter=legacy?quarterOf(primary):levelOf(primary);
 const continuousMode=!legacy&&hasContinuous(primary);
 if(Number.isFinite(options.maxQuarter))quarter=Math.min(quarter,Math.max(0,options.maxQuarter));if(!quarter)return game;
 if(legacy&&game.name==='Double Duel')return game;
 if(legacy&&(game.beginner&&!['Scoring Survival','Scoring Ladder','First Nine Siege','Staying Straight'].includes(game.name)||game.variant==='single'||game.variant==='singles'||game.ring==='S'&&skill==='doubles'||game.name==='Number Lock'&&game.ring!=='D'))return game;
 if(!legacy&&game.name==='Number Lock'&&game.ring!=='D'&&!basis)return game;
 if(!legacy&&['Bull Survival','Bull Streak'].includes(game.name)&&game.target!=='25/50')return game;
 if(game.name==='Focused Checkouts'&&(!game.config?.balanced||game.config.tier!==game.tier||game.config.lives!==game.lives))return game;
 // Mixed skills never inherit an unsupported harder setting.
 if(['301 Pressure','501 Pressure'].includes(game.name))quarter=Math.min(quarter,legacy?quarterOf(decisions.checkout):levelOf(decisions.checkout));
 if(game.name==='Double Bull Bridge')quarter=Math.min(quarter,legacy?quarterOf(decisions.bull):levelOf(decisions.bull));
 if(!quarter)return game;
 const old=game[field];
 if(field==='targets'?(!Array.isArray(old)||!old.length||!old.every(v=>Number.isInteger(v)&&v>=min&&v<=max)):(!Number.isInteger(old)||old<min||old>max))return game;
 // Choose the hardest supported feasible configuration, falling back to
 // a less demanding quarter when a discrete dart budget reaches its floor.
 const levels=legacy?[{quarter:1,step:delta}]:fineSteps(delta).filter(x=>x.quarter>0&&x.quarter<=quarter+1e-8&&(continuousMode||Number.isInteger(x.quarter))).reverse();
 for(const {quarter:q,step} of levels){
 const next=field==='targets'?old.map(v=>bounded(v,step,min,max)):bounded(old,step,min,max);
 if(same(old,next)||!feasible(game,field,next))continue;
 let actualQuarter=q;
 if(!legacy)for(const {quarter:k,step} of fineSteps(delta).filter(x=>x.quarter>0&&x.quarter<q&&(continuousMode||Number.isInteger(x.quarter)))){const candidate=field==='targets'?old.map(v=>bounded(v,step,min,max)):bounded(old,step,min,max);if(same(candidate,next)){actualQuarter=k;break}}
 const provenance={version:legacy?1:Number.isInteger(actualQuarter)?2:3,skill,tier:d.tier,field,before:old,after:next,...(legacy?{}:{quarter:actualQuarter,...(basis?{basis}:{})})};
 const out={...game,[field]:next,precision:provenance,challengeTuning:'precision',challengeTuningVersion:legacy?'IDC-1.5':provenance.version===3?'IDC-1.8':'IDC-1.6',challengeMessage:'Personalised challenge: '+(descriptions[field]??field)+' '+(Array.isArray(old)?old.join(', '):old)+' → '+(Array.isArray(next)?next.join(', '):next)+'.'};
 if(field==='targets')out.target=next[game.step??0];
 if(game.name==='Focused Checkouts')out.config={...game.config,lives:next};
 if(field==='maxDarts'&&Number.isInteger(game.maxVisits))out.maxVisits=Math.ceil(next/3);
 delete out.prospectiveForecast;
 return out;
 }
 return game;
}
export function precisionOptions(games,name,day,tier,now=Date.now(),game=null){
 if(!dayValid(day)||!Number.isFinite(now)||!Array.isArray(games))throw Error('Invalid challenge history');
 const unique=new Map(),conflicts=new Set();
 for(const g of games){
 if(!g||g.name!==name||g.extra||g.recovery||!Number.isFinite(g.at)||g.at<=0||g.at>now||!dayValid(g.day)||g.day>day||dayGap(g.day,day)>=84||g.quick!==false||g.completion!=='natural'||g.tierAtStart!==tier||typeof g.win!=='boolean')continue;
 if(name==='Doubles Streak'&&game?.ruleVersion==='same-target-streak-v1'&&g.ruleVersion!==game.ruleVersion)continue;
 const id=g.at,signature=JSON.stringify([g.day,g.win,g.challengeTuning,g.precision??null]);
 if(unique.has(id)&&unique.get(id).signature!==signature)conflicts.add(id);
 else unique.set(id,{g,signature});
 }
 const rows=[...unique].filter(([id])=>!conflicts.has(id)).map(([,r])=>r.g).sort((a,b)=>b.at-a.at);
 const latest=rows.slice(0,3),probe=latest.length===3&&latest.every(r=>!!r.challengeTuning);
 const configs=new Map();
 for(const g of rows.filter(g=>validPrecisionRecord(g)&&dayGap(g.day,day)<28)){
 if(game&&g.precision.version>=2){
  const basis=ringBasis(game),recorded=g.precision.basis??null;
  // Older double Switchback records did not carry the correct ring
  // basis. Still respect their conservative failed-day cap if the base
  // budget agrees, but never use them as positive skill evidence.
  if(recorded!==basis&&!(game.name==='Switchback'&&basis==='doubles'&&recorded===null)||!same(g.precision.before,game[g.precision.field]))continue;
 }
 const key=JSON.stringify(g.precision),c=configs.get(key)??{p:g.precision,days:new Map()};
 const d=c.days.get(g.day)??{wins:0,losses:0};d[g.win?'wins':'losses']++;c.days.set(g.day,d);configs.set(key,c);
 }
 let maxQuarter=3,cooldown=false;
 for(const {p,days} of configs.values()){
 const recent=[...days].slice(0,3);
 if(recent.length!==3||dayGap(recent[0][0],day)>=7||recent.some(([,r])=>r.wins>0||r.losses===0))continue;
 // The old single modified rule has no finer recovery ladder; preserve its
 // conservative cooldown. New configurations step back only as far as needed.
 if(p.version===1){cooldown=true;maxQuarter=0}
 else if(p.version===2)maxQuarter=Math.min(maxQuarter,p.quarter-1);
 else {const delta=specs[name][2],previous=fineSteps(delta).filter(x=>x.quarter<p.quarter).at(-1)?.quarter??0;maxQuarter=Math.min(maxQuarter,previous)}
 }
 return {probe,cooldown:cooldown||maxQuarter===0,maxQuarter};
}
