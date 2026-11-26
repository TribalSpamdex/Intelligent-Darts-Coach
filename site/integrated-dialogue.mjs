import {progressionAnswer,PROGRESSION_QUESTIONS} from './progression-dialogue.mjs';
import {statisticsAnswer,STAT_QUESTIONS} from './statistics-dialogue.mjs';
import {contextLines,techniqueLines} from './context-profile.mjs';
import {longitudinal,profileLines,investigationQueue} from './longitudinal.mjs';
import {outcomeAudit,outcomeLines,verifiedLearningState} from './intervention-audit.mjs';
import {reflectionInsights,label as reflectionLabel} from './reflections.mjs';
import {ask,interpret} from './engine/coach-dialogue.mjs';
import {projectTargets,summaries,compareTargets,combinedDoubleComparison,personalisedCheckout,targetProfile} from './host-targets.mjs';
import {gameProfile} from './game-profile.mjs';
import {currentFacts} from './engine/engine.mjs';
import {goalProgress} from './engine/goals.mjs';
import {nextActions} from './engine/next-actions.mjs';
import {fullReport} from './engine/executive.mjs';
const pct=x=>(x*100).toFixed(1)+'%';
const targetName=s=>s==='50'?'Bullseye':s;
export const QUESTIONS=['What do you know about me?','What are my strongest doubles?','What are my weakest doubles?','Compare D16 and D20','Checkout 81 with 2 darts','How consistent is my scoring?','How am I finishing?','What are my goals?','What should I investigate next?','How did my practice feel?','How have I progressed this year?','What happened to my interventions?','Does fatigue affect my darts?','What have we observed about my technique?',...STAT_QUESTIONS,...PROGRESSION_QUESTIONS];
function reply(type,lines){return {kind:'answer',type,lines}}
function describe(g){return targetName(g.target)+': '+g.hits+'/'+g.attempts+' ('+pct(g.rate)+') across '+g.days+' days · '+g.protocol+' · '+g.status}
export function integratedAsk(host,state,text,day,now=Date.now(),checks=[],reflections=[],baselines={}){
 if(typeof text!=='string'||!text.trim()||text.length>300)return ask(state,text,day);
 const q=text.trim().toLowerCase().replace(/[?!.]+$/,'').replace(/\s+/g,' ');
 const progression=progressionAnswer(host,state,q,day);if(progression)return progression;
 const statistical=statisticsAnswer(host,state,q,day,now,checks);if(statistical)return statistical;
 if(/^(what do you know about me|show (my )?memory|player memory)$/.test(q)){
 const lines=[state.observations.length+' eligible performance measurements; '+host.sessions.filter(s=>s?.quick===false).length+' saved scheduled-training session records. No inferred player facts.'];
 for(const f of currentFacts(state))lines.push(f.key+': '+f.value+' ('+f.kind+')');
 if(state.setups.length){const setup=[...state.setups].sort((a,b)=>b.day.localeCompare(a.day)).at(0);lines.push('Latest recorded setup: '+setup.name+' · '+Object.entries(setup.values).map(([k,v])=>k+': '+v).join(', '))}
 return reply('memory-summary',lines)
 }
 if(/^(what are my goals|show (my )?goals|goal progress)$/.test(q)){const g=state.goals.filter(x=>x.status==='active');return reply('goals',g.length?g.map(x=>{const p=goalProgress(state,x,day);return x.skill+' · '+x.protocol+' · '+p.status+' · '+p.days+' recent days · review '+x.review}):['No active measurable goals. Set one from a specific benchmark.'])}
 if(/^(how consistent is my scoring|scoring consistency|scoring profile)$/.test(q)){
 const s=gameProfile(host,day,now).scoring;
 return reply('scoring-profile',s.visits?['Fixed Scoring Challenge: '+s.visits+' visits on '+s.days+' days.','Three-dart average: '+s.average.toFixed(1)+'; visit standard deviation: '+(s.visitSD===null?'not available':s.visitSD.toFixed(1))+'.','100+ visits: '+s.hundreds+'; below 40: '+s.lowVisits+'; 180s: '+s.maximums+'.','These are observed visit totals, not target accuracy or a match prediction.']:['No eligible completed fixed Scoring Challenge rounds in the last 84 days.'])
 }
 if(/^(how am i finishing|checkout profile|finishing profile)$/.test(q)){
 const x=gameProfile(host,day,now);
 return reply('checkout-profile',x.checkout.length?[...x.checkout.slice(0,24).map(g=>g.score+' · '+g.hits+'/'+g.attempts+' ('+pct(g.rate)+') · '+g.days+' days · '+g.protocol),x.limitation]:['No eligible checkout-score records in the last 84 days.'])
 }
 if(/^(how have i progressed this year|long term progress|long-term progress|show my progress history)$/.test(q))return reply('longitudinal',profileLines(longitudinal(state.observations,day)));
 if(/^(what happened to my interventions|intervention history|did the advice work)$/.test(q))return reply('intervention-audit',outcomeLines(outcomeAudit(host,state,baselines,day)));
 if(/^(what should i investigate next|next investigation)$/.test(q)){
 const base=ask(verifiedLearningState(state,baselines,day).state,text,day),r=reflectionInsights(reflections,host,day),items=investigationQueue(longitudinal(state.observations,day),r.repeated);
 return reply('next-actions',[...(base.lines??[base.reason]).filter(Boolean),...items.slice(0,3).map(i=>i.kind==='reported'?i.question:JSON.parse(i.scope).join(' · ')+': '+i.question)]);
 }
 if(/^(does fatigue affect my darts|how do my practice conditions affect performance|readiness profile)$/.test(q))return reply('context-profile',contextLines(state,day));
 if(/^(what have we observed about my technique|technical observations|technique profile)$/.test(q))return reply('technique-profile',techniqueLines(state,day));
 const cmp=q.match(/^compare (d(?:[1-9]|1[0-9]|20)) (?:and|with|vs) (d(?:[1-9]|1[0-9]|20))$/);
 if(cmp){const rows=projectTargets(host,day,now,checks).rows,c=combinedDoubleComparison(rows,cmp[1].toUpperCase(),cmp[2].toUpperCase());return reply('target-comparison',[c.first+' vs '+c.second+' · '+c.days+' matched days · '+c.attemptsA+' / '+c.attemptsB+' attempts · '+c.protocol+'.',c.status==='insufficient'?'Insufficient comparable evidence.':c.status==='unclear'?'No consistent advantage established.':targetName(c.status==='first-higher'?c.first:c.second)+' has the observed advantage in fixed practice.',c.limitation])}
 const single=q.match(/^(?:how good am i at|accuracy on|show) ([dst](?:[1-9]|1[0-9]|20))$/);
 if(single){const a=summaries(projectTargets(host,day,now,checks).rows).filter(g=>g.target===single[1].toUpperCase());return reply('target',a.length?a.map(describe):['No eligible target-specific evidence for '+single[1].toUpperCase()+'.'])}
 if(/^(what are my (strongest|weakest|best|worst) doubles|double profile)$/.test(q)){
 const p=targetProfile(projectTargets(host,day,now,checks).rows),kind=/weakest|worst/.test(q)?'weak':'strong',x=p[kind];
 return reply('target-profile',[x.length?x.map(o=>o.target+' ('+o.comparisons+' peer comparisons)').join(', '):'No consistent '+(kind==='weak'?'weak':'strong')+' double established yet.',p.limitation]);
 }
 if(/^(how did my practice feel|practice reflections|how did training feel)$/.test(q)){const review=reflectionInsights(reflections,host,day);return reply('reflections',[review.count+' recent player-reported reflections linked to saved training.',...review.repeated.map(x=>reflectionLabel(x.topic)+' across '+x.days+' days. '+x.question),review.limitation])}
 const intent=interpret(text,day);
 if(intent.kind==='query'&&intent.request.type==='checkout'){
 const {score,darts}=intent.request.payload,r=personalisedCheckout(state,projectTargets(host,day,now,checks).rows,score,darts);
 return reply('checkout',[r.guidance,...(r.suggested?['Suggested: '+r.suggested.join(' → '),'Standard: '+r.standard.join(' → '),r.personalisation]:r.setup.slice(0,3).map(x=>'Aim '+x.target+' to leave '+x.remaining)),...(r.comparison?[r.comparison.days+' matched days; observed finishing-double difference '+pct(r.comparison.delta)+'.']:[])]);
 }
 const result=ask(verifiedLearningState(state,baselines,day).state,text,day);if(result.type==='next-actions'){const review=reflectionInsights(reflections,host,day);for(const x of review.repeated)result.lines.push('Additional player-reported concern: '+x.question+' ('+x.days+' days)')}return result
}
