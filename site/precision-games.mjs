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
 'Cricket Countdown':['scoring','allowed',-1,5,120],
 'Switchback':['scoring','allowed',-1,7,120],
 'Halve It':['scoring','goal',5,5,999],
 'Risk or Reward':['scoring','goal',5,5,999],
 'First Nine Siege':['scoring','goal',5,5,540],
 'Neighbour Trap':['scoring','allowed',-1,2,120],
 'Double Jackpot':['doubles','allowed',-1,2,120],
 'Dartboard Bingo':['doubles','maxCalls',-1,5,100],
 'Split the Difference':['scoring','tolerance',-1,1,100],
 '301 Pressure':['scoring','maxDarts',-1,12,75],
 '501 Pressure':['scoring','maxDarts',-1,18,105]
};
export const SUPPORTED_GAMES=Object.freeze(Object.keys(specs));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function precisionRound(game,decisions,options={}){
 if(!game||typeof game!=='object'||!Object.hasOwn(specs,game.name)||game.precision||game.recovery||game.challengeTuning||!options.eligible||options.probe||options.safety||options.cooldown)return game;
 const [skill,field,delta,min,max]=specs[game.name],d=decisions?.[skill];
 if(d?.half!=='upper'||!Number.isInteger(d.tier)||!Number.isInteger(game.tier)||game.tier!==d.tier)return game;
 // Singles foundation versions do not measure doubles. Mixed-skill games
 // require separate confirmation for their second skill as well.
 if(game.beginner&&!['Scoring Survival','Scoring Ladder','First Nine Siege','Staying Straight'].includes(game.name)||game.variant==='single'||game.variant==='singles'||game.ring==='S'&&skill==='doubles'||game.name==='Number Lock'&&game.ring!=='D')return game;
 if(game.name==='Bull Bank'&&field==='dartsLeft'&&game.dartsLeft+delta<Math.ceil(game.goal/50))return game;
 if(game.name==='Bull Blackjack'&&field==='allowed'&&game.allowed+delta<Math.ceil(game.goal/50))return game;
 if(game.name==='Outside Doubles'&&game.allowed+delta<game.targets?.length)return game;
 if(game.name==='Double Double'&&game.allowed+delta<game.targets?.length)return game;
 if(game.name==='Neighbour Trap'&&game.allowed+delta<game.goal)return game;
 if(['301 Pressure','501 Pressure'].includes(game.name)&&decisions.checkout?.half!=='upper')return game;
 if(game.name==='Double Bull Bridge'&&decisions.bull?.half!=='upper')return game;
 if(game.name==='Dartboard Bingo'&&!game.singleLineRound&&game.maxCalls+delta<20)return game;
 if(game.name==='Switchback'&&game.allowed+delta<game.sequence?.length)return game;
 if(game.name==='Cricket Countdown'&&game.allowed+delta<game.targets?.length)return game;
 const old=game[field];
 const adjust=v=>Math.max(min,Math.min(max,v+delta));
 const next=field==='targets'&&Array.isArray(old)&&old.length&&old.every(v=>Number.isInteger(v)&&v>=min&&v<=max)?old.map(adjust):Number.isInteger(old)&&old>=min&&old<=max?adjust(old):old;
 if(same(old,next))return game;
 const out={...game,[field]:next,precision:{version:1,skill,tier:d.tier,field,before:old,after:next},challengeTuning:'precision',challengeTuningVersion:'IDC-1.5',challengeMessage:'Personalised challenge: '+field+' '+(Array.isArray(old)?old.join(', '):old)+' → '+(Array.isArray(next)?next.join(', '):next)+'.'};
 if(field==='targets')out.target=next[game.step??0];
 if(field==='maxDarts'&&Number.isInteger(game.maxVisits))out.maxVisits=Math.ceil(next/3);
 delete out.prospectiveForecast;
 return out;
}
export function precisionOptions(games,name,day,tier){
 const rows=games.filter(g=>g&&g.name===name&&!g.extra&&!g.recovery&&Number.isFinite(g.at)&&/^\d{4}-\d{2}-\d{2}$/.test(g.day)&&Number.isFinite(Date.parse(g.day))&&g.quick===false&&g.completion==='natural'&&g.day<=day&&g.tierAtStart===tier&&typeof g.win==='boolean').sort((a,b)=>b.at-a.at);
 const latest=rows.slice(0,3);
 const probe=latest.length===3&&latest.every(r=>!!r.challengeTuning);
 const byDay=new Map();for(const g of rows.filter(g=>g.challengeTuning==='precision'&&g.precision?.version===1)){if(!byDay.has(g.day))byDay.set(g.day,g)}
 const recent=[...byDay.values()].slice(0,3);
 const cooldown=recent.length===3&&recent.every(r=>r.win===false)&&Date.parse(day)-Date.parse(recent[0].day)<7*86400000;
 return {probe,cooldown};
}
