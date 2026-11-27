import {manualTargetRows} from './manual-target-samples.mjs';
import {skillProfiles} from './skill-statistics.mjs';
import {projectTargets} from './host-targets.mjs';
import {detailedTargets} from './target-statistics.mjs';
import {scoringDetail,checkoutDetail} from './visit-statistics.mjs';
import {practiceProfile} from './practice-statistics.mjs';
import {matchProfiles,actualLegObservations} from './match-statistics.mjs';
const pct=v=>v===null?'Not recorded':(100*v).toFixed(1)+'%';
const num=v=>v===null?'Not recorded':v.toFixed(1);
const fmt=(v,skill)=>['scoring','firstNine'].includes(skill)?num(v):pct(v);
const window=(r,days)=>r.windows.find(w=>w.days===days);
const card=(title,metrics,detail=[],bars=[])=>({title,metrics,detail,bars});
const field=(label,value)=>({label,value:String(value)});
export const PERIODS=Object.freeze({'Detailed skill statistics':[7,28,84,365],'Detailed target statistics':[7,28,84],'Detailed scoring statistics':[7,28,84],'Detailed checkout statistics':[7,28,84],'Practice volume':[7,28,84,365],'Actual match statistics':[7,28,84,365]});
export function snapshotView(host,state,type,filter,days,day,now=Date.now(),checks=[]){
 if(!PERIODS[type]?.includes(days))throw Error('Choose an available statistics period');
 const f=String(filter??'').trim().toLowerCase(),cards=[];
 if(type==='Detailed skill statistics'){
 const skill=f==='first nine'?'firstNine':f;
 for(const r of skillProfiles([...state.observations,...actualLegObservations(state.legs??[],day)],day).filter(r=>!f||r.skill===skill)){
 const w=window(r,days),d=w.distribution;
 cards.push(card(r.skill+' · '+r.context+' · '+r.protocol,[field('Pooled result',fmt(w.pooled,r.skill)),field('Median day',fmt(d.median,r.skill)),field('Recorded days',d.n),field('Attempts',w.attempts)],[ 'Middle 50%: '+fmt(d.q1,r.skill)+' to '+fmt(d.q3,r.skill)+'. Recent trend: '+r.trend.status+'. Last measured '+r.last+'.']));
 }
 }else if(type==='Detailed target statistics'){
 for(const r of detailedTargets([...projectTargets(host,day,now,checks).rows,...manualTargetRows(state.throws??[],day)],day).filter(r=>!f||r.target.toLowerCase()===f)){
 const w=window(r,days);
 cards.push(card(r.target+' · '+r.protocol,[field('Hit rate',pct(w.pooled)),field('Hits / attempts',w.hits+' / '+w.attempts),field('Median day',pct(w.daily.median)),field('Recorded days',w.daily.n)],['Middle 50%: '+pct(w.daily.q1)+' to '+pct(w.daily.q3)+'. Recent trend: '+r.trend.status+'.'],w.attempts?[{label:'Hit rate',value:w.hits,total:w.attempts}]:[]));
 }
 }else if(type==='Detailed scoring statistics'){
 const r=scoringDetail(host,day,now),w=window(r,days);
 if(w.visits.n)cards.push(card('Fixed Scoring Challenge',[field('Three-dart average',num(w.visits.mean)),field('Median visit',num(w.visits.median)),field('Visits',w.visits.n),field('Recorded days',w.daily.n),field('100+ / 140+',w.hundreds+' / '+w.oneForties),field('180s',w.maximums)],['Visit standard deviation '+num(w.visits.sd)+'. Recent trend '+r.trend.status+'. '+r.limitation],w.bands.map(b=>({label:b.label,value:b.count,total:w.visits.n}))));
 }else if(type==='Detailed checkout statistics'){
 for(const r of checkoutDetail(host,day,now).groups.filter(r=>!f||String(r.score)===f)){
 const w=window(r,days);
 cards.push(card(r.score+' · '+r.protocol,[field('Finish rate',pct(w.rate)),field('Finishes / attempts',w.hits+' / '+w.attempts),field('Recorded days',w.daily.n),field('Darts on success',num(w.meanDartsOnSuccess))],['Successful attempts with 1 / 2 / 3 darts: '+w.oneDart+' / '+w.twoDart+' / '+w.threeDart+'; unknown '+w.unknownSuccessDarts+'.'],w.attempts?[{label:'Finishes',value:w.hits,total:w.attempts}]:[]));
 }
 }else if(type==='Practice volume'){
 const r=practiceProfile(host,day,now),w=window(r,days);
 if(w.sessions)cards.push(card('Classified practice',[field('Saved sessions',w.sessions),field('Session days',w.sessionDays),field('Classified minutes',w.total),field('Minutes / calendar week',num(w.minutesPerCalendarWeek))],[r.limitation],w.skills.map(s=>({label:s.skill,value:s.minutes,total:w.total}))));
 }else if(type==='Actual match statistics'){
 for(const r of matchProfiles(state.legs??[],day)){
 const w=window(r,days);if(!w.legs&&!w.abandoned)continue;
 cards.push(card(r.start+' · '+(r.doubleIn?'double-in':'straight-in')+' · '+r.context,[field('Average',num(w.average)),field('First nine',num(w.firstNine)),field('Wins / completed',w.wins+' / '+w.legs),field('Darts thrown',w.darts),field('Checkout visits',pct(w.checkoutVisitRate)),field('Finishing doubles',pct(w.finishingDoubleRate)),field('Median winning darts',num(w.winningDarts.median)),field('Busts',w.busts)],['Checkout visits '+w.checkoutWins+'/'+w.checkoutVisits+'; finishing darts '+w.finishHits+'/'+w.finishAttempts+' from '+w.fullyAimedLegs+' fully aimed legs. '+w.firstNineLegs+' eligible first-nine legs. '+w.abandoned+' abandoned legs excluded.']));
 }
 }
 return {cards:cards.slice(0,40),total:cards.length,days,note:'Comparable recorded data only. Missing samples are not zero scores; descriptive variation is not a forecast. Filter to narrow the results.'};
}
