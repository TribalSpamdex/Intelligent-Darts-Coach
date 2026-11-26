import {SKILLS} from './engine.mjs';
import {dayValid,dayGap} from './context.mjs';
const drills=[
 ['singles','Big singles','3 darts at each large single 1–20; only large singles count.','large-single accuracy'],
 ['doubles','Doubles rotation','3 darts at each assigned double; record attempts and hits.','double accuracy'],
 ['checkout','Checkout practice','Attempt assigned scores in up to 3 darts, double out; record successful visits.','checkout visit success'],
 ['scoring','Scoring visits','Throw at a chosen scoring target; record points and darts.','three-dart scoring average'],
 ['firstNine','First nine','Play the opening nine darts of repeated 501 legs; record total points and darts.','opening scoring average'],
 ['trebles','Treble target rotation','Aim at assigned trebles; count exact hits.','treble accuracy'],
 ['bull','Bull practice','Record 25, 50 or miss individually; keep outer and inner bull distinct.','bull accuracy'],
 ['switching','Target sequence','Aim one dart at each of three specified distinct targets; record exact hits.','switching accuracy'],
 ['setup','Setup practice','Choose a legal route to a defined finishing score; record successful visits.','setup success'],
 ['pressure','One-visit challenge','Repeat a fixed familiar task under a self-selected realistic consequence; record outcomes separately.','pressure task success'],
 ['grouping','Grouping observation','Throw three darts at one target; record whether all three land within the predefined region.','region-grouping success; not physical dispersion']
];
export const library=drills.map(([skill,name,instructions,metric])=>({id:skill+'-core',skill,name,instructions,metric,benchmarkStable:true}));
export const bands=['foundation','foundation','developing','developing','established','advanced','advanced'];
export function validateDifficulty(o){
 if(!o||!SKILLS.includes(o.skill)||typeof o.protocol!=='string'||!o.protocol.trim()||o.protocol.length>100||!Number.isInteger(o.level)||o.level<1||o.level>7||!dayValid(o.day)||!Number.isInteger(o.attempts)||o.attempts<1||o.attempts>10000||!Number.isInteger(o.successes)||o.successes<0||o.successes>o.attempts||typeof o.id!=='string'||!o.id.trim()||o.id.length>100)throw Error('Invalid difficulty observation');
 return {id:o.id,skill:o.skill,protocol:o.protocol,level:o.level,day:o.day,attempts:o.attempts,successes:o.successes};
}
export function recordDifficulty(m,o){o=validateDifficulty(o);if((m.difficulty??[]).some(x=>x.id===o.id))throw Error('Duplicate difficulty observation');return {...m,difficulty:[...(m.difficulty??[]),o]}}
export function difficultyDecision(records,skill,protocol,level,day){
 if(!SKILLS.includes(skill)||!Number.isInteger(level)||level<1||level>7||!dayValid(day))throw Error('Invalid difficulty query');
 const rows=records.filter(o=>o.skill===skill&&o.protocol===protocol&&o.level===level&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<28),byDay=new Map();
 for(const o of rows){const v=byDay.get(o.day)??[0,0];v[0]+=o.successes;v[1]+=o.attempts;byDay.set(o.day,v)}
 const daily=[...byDay].sort().slice(-7),n=daily.reduce((a,[d,v])=>a+v[1],0);
 if(daily.length<5||n<40)return {level,next:level,decision:'hold',reason:'Insufficient comparable observations',days:daily.length,attempts:n};
 const ratios=daily.map(([d,v])=>v[0]/v[1]),high=ratios.filter(p=>p>=.8).length,low=ratios.filter(p=>p<=.25).length;
 const next=high===ratios.length?Math.min(7,level+1):low===ratios.length?Math.max(1,level-1):level;
 return {level,next,decision:next>level?'increase':next<level?'reduce':'hold',days:daily.length,attempts:n,reason:'Provisional repeated-day task success policy, not a population ability rating.'};
}
export function variant(skill,level){
 if(!SKILLS.includes(skill)||!Number.isInteger(level)||level<1||level>7)throw Error('Invalid drill variant');
 const base=library.find(d=>d.skill===skill),novice=level<=2;
 const settings={
 singles:['Large singles only', 'Large singles in a shuffled order','Large singles under a visit limit'],
 doubles:['Large singles as preparation for doubles','Assigned doubles with generous attempts','Assigned doubles with fewer attempts'],
 checkout:['Simple single-target setup; no double-out requirement','Two-dart finishes with recovery','Mixed finishes under a three-dart limit'],
 scoring:['Whole-number scoring, no treble requirement','Scoring visits with chosen target','Scoring with switching when blocked'],
 firstNine:['Nine darts at preferred large number','Repeated nine-dart openings','Opening nine in match-like legs'],
 trebles:['Large singles before treble work','Assigned treble with generous attempts','Treble switching under a visit limit'],
 bull:['Outer bull or larger central target as preparation','25 or 50, recorded separately','Inner bull targets'],
 switching:['Two large singles, no time pressure','Three assigned segments','Mixed segment sequence'],
 setup:['Reach a specified large-single target','Leave an accessible double','Avoid bogeys and recover after misses'],
 pressure:['Familiar large-single task with no consequence','Familiar task with mild self-selected consequence','Match-like one-visit challenge'],
 grouping:['Three darts at same large single','Three darts at a smaller region','Repeat same target under realistic switching']
 };
 return {...base,level,band:bands[level-1],instructions:novice?settings[skill][0]:level<=4?settings[skill][1]:settings[skill][2],difficultyNote:'Levels 1–2 share easiest variant; fixed benchmarks are not changed.'};
}
