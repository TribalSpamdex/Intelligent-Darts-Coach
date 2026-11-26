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
const singleGames=new Set(['Treble Hunt','Doubles Streak','Doubles Survival','Number Lock','Shanghai Combo','Golf Five','Switchback','Double Jackpot','Dartboard Bingo','Double Duel']);
const trebleGames=new Set(['Treble Hunt','Number Lock','Switchback']);
function ringBasis(g){if(singleGames.has(g.name)&&(g.variant==='single'||g.variant==='singles'||g.ring==='S'||g.name==='Double Duel'&&g.tier>=6))return 'singles';if(trebleGames.has(g.name)&&(g.variant==='treble'||g.ring==='T'))return 'trebles';return null}
const bounded=(v,delta,min,max)=>Math.max(min,Math.min(max,v+delta));
const quarterOf=d=>d?.quarter!==undefined?(Number.isInteger(d.quarter)&&d.quarter>=0&&d.quarter<=3?d.quarter:0):d?.half==='upper'?2:0;
export function validPrecisionRecord(g){
 const p=g?.precision;
 if(!p||![1,2].includes(p.version)||!Object.hasOwn(specs,g.name)||p.tier!==g.tierAtStart||g.challengeTuning!=='precision')return false;
 const [skill,field,delta,min,max]=specs[g.name];
 if(p.skill!==skill||p.field!==field||!Number.isInteger(p.tier)||p.tier<1||p.tier>7)return false;
 if(p.version===1&&g.name==='Double Duel')return false;
 if(p.version===2&&(!Number.isInteger(p.quarter)||p.quarter<1||p.quarter>3))return false;
 if(p.basis!==undefined&&(p.version!==2||!(p.basis==='singles'&&singleGames.has(g.name)||p.basis==='trebles'&&trebleGames.has(g.name))))return false;
 const step=p.version===1?delta:quarterDelta(delta,p.quarter);
 const valid=(a,b)=>Number.isInteger(a)&&a>=min&&a<=max&&b===bounded(a,step,min,max);
 return !same(p.before,p.after)&&(field==='targets'?Array.isArray(p.before)&&Array.isArray(p.after)&&p.before.length>0&&p.before.length===p.after.length&&p.before.every((a,i)=>valid(a,p.after[i])):valid(p.before,p.after));
}
function feasible(game,field,next){
 if(field==='targets')return Array.isArray(next)&&next.length===game.targets.length&&next.every((v,i)=>!i||v>=next[i-1]);
 switch(game.name){
 case 'Bull Bank':case 'Bull Blackjack':return next>=Math.ceil(game.goal/50);
 case 'Outside Doubles':case 'Double Double':case 'Cricket Countdown':case 'Pressure Cricket':return Array.isArray(game.targets)&&next>=game.targets.length;
 case 'Neighbour Trap':return next>=game.goal;
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
 let quarter=basis&&!legacy?quarterOf(decisions[basis]):quarterOf(d);
 if(Number.isInteger(options.maxQuarter))quarter=Math.min(quarter,Math.max(0,options.maxQuarter));if(!quarter)return game;
 if(legacy&&game.name==='Double Duel')return game;
 if(legacy&&(game.beginner&&!['Scoring Survival','Scoring Ladder','First Nine Siege','Staying Straight'].includes(game.name)||game.variant==='single'||game.variant==='singles'||game.ring==='S'&&skill==='doubles'||game.name==='Number Lock'&&game.ring!=='D'))return game;
 if(!legacy&&game.name==='Number Lock'&&game.ring!=='D'&&!basis)return game;
 if(!legacy&&['Bull Survival','Bull Streak'].includes(game.name)&&game.target!=='25/50')return game;
 if(game.name==='Focused Checkouts'&&(!game.config?.balanced||game.config.tier!==game.tier||game.config.lives!==game.lives))return game;
 // Mixed skills never inherit an unsupported harder setting.
 if(['301 Pressure','501 Pressure'].includes(game.name))quarter=Math.min(quarter,quarterOf(decisions.checkout));
 if(game.name==='Double Bull Bridge')quarter=Math.min(quarter,quarterOf(decisions.bull));
 if(!quarter)return game;
 const old=game[field];
 if(field==='targets'?(!Array.isArray(old)||!old.length||!old.every(v=>Number.isInteger(v)&&v>=min&&v<=max)):(!Number.isInteger(old)||old<min||old>max))return game;
 // Choose the hardest supported feasible configuration, falling back to
 // a less demanding quarter when a discrete dart budget reaches its floor.
 for(let q=quarter;q>=1;q--){
 const step=legacy?delta:quarterDelta(delta,q);
 const next=field==='targets'?old.map(v=>bounded(v,step,min,max)):bounded(old,step,min,max);
 if(same(old,next)||!feasible(game,field,next))continue;
 let actualQuarter=q;
 if(!legacy)for(let k=1;k<q;k++){const step=quarterDelta(delta,k),candidate=field==='targets'?old.map(v=>bounded(v,step,min,max)):bounded(old,step,min,max);if(same(candidate,next)){actualQuarter=k;break}}
 const provenance={version:legacy?1:2,skill,tier:d.tier,field,before:old,after:next,...(legacy?{}:{quarter:actualQuarter,...(basis?{basis}:{})})};
 const out={...game,[field]:next,precision:provenance,challengeTuning:'precision',challengeTuningVersion:legacy?'IDC-1.5':'IDC-1.6',challengeMessage:'Personalised challenge: '+(descriptions[field]??field)+' '+(Array.isArray(old)?old.join(', '):old)+' → '+(Array.isArray(next)?next.join(', '):next)+'.'};
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
 const id=g.at,signature=JSON.stringify([g.day,g.win,g.challengeTuning,g.precision??null]);
 if(unique.has(id)&&unique.get(id).signature!==signature)conflicts.add(id);
 else unique.set(id,{g,signature});
 }
 const rows=[...unique].filter(([id])=>!conflicts.has(id)).map(([,r])=>r.g).sort((a,b)=>b.at-a.at);
 const latest=rows.slice(0,3),probe=latest.length===3&&latest.every(r=>!!r.challengeTuning);
 const configs=new Map();
 for(const g of rows.filter(g=>validPrecisionRecord(g)&&dayGap(g.day,day)<28)){
 if(game&&g.precision.version===2&&((g.precision.basis??null)!==ringBasis(game)||!same(g.precision.before,game[g.precision.field])))continue;
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
 else maxQuarter=Math.min(maxQuarter,p.quarter-1);
 }
 return {probe,cooldown:cooldown||maxQuarter===0,maxQuarter};
}
