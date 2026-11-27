import {quickSkillLines} from './v62-evidence.mjs';
import {autonomyAnswer,AUTONOMY_QUESTIONS} from './autonomy-dialogue.mjs';
import {intelligenceAnswer,INTELLIGENCE_QUESTIONS} from './coaching-intelligence.mjs';
import {tacticalAnswer} from './tactical-learning.mjs';
import {progressionAnswer,PROGRESSION_QUESTIONS} from './progression-dialogue.mjs';
import {statisticsAnswer,STAT_QUESTIONS} from './statistics-dialogue.mjs';
import {contextLines,techniqueLines,equipmentReviews,equipmentLines,isolatedReadiness,isolatedReadinessLines,techniqueEvidence,techniqueEvidenceLines} from './context-profile.mjs';
import {trainingOutcomes,delayedMethodCautions} from './training-outcomes.mjs';
import {recoveryAdvice,recoveryLines} from './tactical-learning.mjs';
import {REGIONS} from './engine/target-evidence.mjs';
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
import {asOfState} from './engine/context.mjs';
const pct=x=>(x*100).toFixed(1)+'%';
const targetName=s=>s==='50'?'Bullseye':s;
export const QUESTIONS=['What do you know about me?','What are my strongest doubles?','What are my weakest doubles?','Compare D16 and D20','Checkout 81 with 2 darts','How consistent is my scoring?','How am I finishing?','What are my goals?','What should I investigate next?','How did my practice feel?','How have I progressed this year?','What happened to my interventions?','Does fatigue affect my darts?','What have we observed about my technique?','Has my equipment change helped?','How do nerves and confidence affect my performance?','Do my technique observations match my results?','Which methods should we reconsider?','How am I doing in Quick Play?',...STAT_QUESTIONS,...PROGRESSION_QUESTIONS,...INTELLIGENCE_QUESTIONS,...AUTONOMY_QUESTIONS,'Model checkout 81 with 2 darts','Recovery from 81 after S19'];
function reply(type,lines){return {kind:'answer',type,lines}}
function describe(g){return targetName(g.target)+': '+g.hits+'/'+g.attempts+' ('+pct(g.rate)+') across '+g.days+' days · '+g.protocol+' · '+g.status}
// Verbal figures remain supplied information, never silently logged practice.
export function reportedComparison(q){
 const skills=[['doubles',/\bdoubles?\b/],['bull',/\bbull(?:seye)?\b/],['trebles',/\btrebles?\b/],['singles',/\bsingles?\b/],['checkout',/\bcheckouts?\b/]].filter(([,re])=>re.test(q));
 if(skills.length!==1)return null;
 const a=q.match(/\b(?:earlier|previously|before|last week|last month)\s*[:=]?\s*(?:i (?:hit|got)\s+)?(\d{1,6})\s*(?:\/|out of)\s*(\d{1,6})\b/);
 const b=q.match(/\b(?:recently|now|currently|this week|this month)\s*[:=]?\s*(?:i (?:hit|got)\s+)?(\d{1,6})\s*(?:\/|out of)\s*(\d{1,6})\b/);
 if(!a||!b)return null;
 const [h1,n1,h2,n2]=[a[1],a[2],b[1],b[2]].map(Number);
 if(n1<=0||n2<=0||h1>n1||h2>n2||n1>100000||n2>100000)return reply('reported-comparison',['The reported hit counts and attempts are inconsistent. Check the two figures before comparing them. Nothing has been saved.']);
 const p1=100*h1/n1,p2=100*h2/n2,change=p2-p1;
 return reply('reported-comparison',[
  skills[0][0]+': earlier '+h1+'/'+n1+' ('+p1.toFixed(1)+'%); recent '+h2+'/'+n2+' ('+p2.toFixed(1)+'%). Change '+(change>0?'+':'')+change.toFixed(1)+' percentage points.',
  'This is a reported comparison, not a recorded independent-day trend. Attempts within a session can be correlated.',
  'How many separate practice days did each period cover? Were the target sequence, rules and practice or match context identical?',
  /equipment(?: and |\/)technique unchanged|same equipment and technique/.test(q)?'You reported unchanged equipment and technique. That reduces one possible explanation but does not establish the cause.':'Did equipment, technique, fatigue, or practice conditions change?',
  'Repeat the same measured check on separate days before changing your training or throw. No player data or training allocation has been changed.'
 ]);
}
export function integratedAsk(host,state,text,day,now=Date.now(),checks=[],reflections=[],baselines={},events=[]){
 state=asOfState(state,day);
 host={...host,sessions:(host.sessions??[]).filter(s=>s?.date<=day),games:(host.games??[]).filter(g=>g?.day<=day)};
 if(typeof text!=='string'||!text.trim()||text.length>300)return ask(state,text,day);
 const q=normaliseQuestion(text);
 const comparison=reportedComparison(q);if(comparison)return comparison;
 if(/^(how am i doing in quick play|quick play (?:statistics|stats|performance|ability)|show my quick play results)$/.test(q))return reply('quick-skill-profile',quickSkillLines(host,day,now));
 if(/^(has my equipment change helped|equipment (?:review|performance)|did changing my darts help|how did my new darts affect my performance)$/.test(q))return reply('equipment-evidence',equipmentLines(equipmentReviews(state,day)));
 if(/^(how do nerves and confidence affect my performance|mental performance|does (?:pressure|confidence|nerves) affect my darts|how does match pressure affect my darts)$/.test(q))return reply('mental-evidence',isolatedReadinessLines(isolatedReadiness(state,day)));
 if(/^(do my technique observations match my results|technique evidence|does my technique affect my performance)$/.test(q))return reply('technique-evidence',techniqueEvidenceLines(techniqueEvidence(state,day)));
 if(/^(which methods should we reconsider|review unsuccessful methods|what hasn't worked)$/.test(q)){
  const r=trainingOutcomes(host,state,day,now),c=delayedMethodCautions(r.currentFollowups,day);
  return reply('method-cautions',[...(r.boundary?['Current review uses evidence after '+r.boundary+'.']:[]),...(c.length?c.map(x=>x.setting.name+' · '+x.protocol+' · '+x.adverse+' adverse and '+x.positive+' positive separate delayed reviews. '+x.reason):['No repeated independent delayed adverse reviews currently justify deferring an exact-setting preference. This does not establish every method is effective.']), 'Ordinary balanced training is unchanged.']);
 }
 const autonomy=autonomyAnswer(host,state,q,day,now,reflections,baselines,events);if(autonomy)return autonomy;
 const tactical=tacticalAnswer(state,q,day);if(tactical)return tactical;
 const intelligence=intelligenceAnswer(host,state,q,day,now,reflections);if(intelligence)return intelligence;
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
 const base=ask(verifiedLearningState(state,baselines,day,host,now).state,text,day),r=reflectionInsights(reflections,host,day),items=investigationQueue(longitudinal(state.observations,day),r.repeated);
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
 const intent=interpret(q,day);
 if(intent.kind==='query'&&intent.request.type==='checkout'){
 const {score,darts}=intent.request.payload,r=personalisedCheckout(state,projectTargets(host,day,now,checks).rows,score,darts);
 return reply('checkout',[r.guidance,...(r.suggested?['Suggested: '+r.suggested.join(' → '),'Standard: '+r.standard.join(' → '),r.personalisation]:r.setup.slice(0,3).map(x=>'Aim '+x.target+' to leave '+x.remaining)),...(r.comparison?[r.comparison.days+' matched days; observed finishing-double difference '+pct(r.comparison.delta)+'.']:[])]);
 }
 const result=ask(verifiedLearningState(state,baselines,day,host,now).state,q,day);if(result.type==='next-actions'){const review=reflectionInsights(reflections,host,day);for(const x of review.repeated)result.lines.push('Additional player-reported concern: '+x.question+' ('+x.days+' days)')}return result
}

 // Only whole-question aliases. No guess from isolated keywords.
 export function normaliseQuestion(text){
  const q=text.trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[?!.]+$/,'').replace(/\s+/g,' ');
  const bare=q.replace(/^(?:please |can you (?:please )?|could you (?:please )?)/,'').replace(/,? please$/,'');
  const aliases=[
   [/^(?:tell me |show me )?(?:which|what) (?:are )?my (?:best|strongest) doubles$/,'what are my strongest doubles'],
   [/^(?:tell me |show me )?(?:which|what) (?:are )?my (?:worst|weakest) doubles$/,'what are my weakest doubles'],
   [/^(?:show me |tell me )?(?:my )?(?:competition|match) progress$/,'is my real match performance improving'],
   [/^(?:show me |tell me )?(?:my )?equipment (?:history|review|performance)$/,'has my equipment change helped'],
   [/^(?:show me |tell me )?(?:my )?mental performance$/,'how do nerves and confidence affect my performance'],
   [/^(?:how|what) (?:can|should|do) i (?:improve|work on) my (?:darts|game)$/,'what should i work on next'],
   [/^(?:show me |tell me )?(?:my )?(?:current |next )?(?:training|practice) (?:priority|priorities)$/,'what is my next coaching priority']
  ];
  return aliases.find(([re])=>re.test(bare))?.[1]??bare;
 }
 // Ephemeral explicitly scoped checkout or review context. Never persisted
 // or used to create observations. A different question replaces it.
 export function conversationTurn(host,state,text,day,now=Date.now(),checks=[],reflections=[],baselines={},events=[],previous=null){
  const q=typeof text==='string'&&text.length<=300?normaliseQuestion(text):'';
  const context=previous?.day===day&&Number.isInteger(previous.score)&&previous.score>=2&&previous.score<=1001&&Number.isInteger(previous.darts)&&previous.darts>=1&&previous.darts<=3?previous:null;
  const topics={
   'calibration-review':{question:'Is my difficulty calibrated correctly?',next:'Repeat the same fixed benchmark on separate days, under familiar conditions. If results disagree, check the measurement rules and recent conditions before changing challenge.'},
   'equipment-evidence':{question:'Has my equipment change helped?',next:'Keep a comfortable reference setup. Record only one intentional change, then repeat the same benchmark on separate days. If discomfort occurs, stop the aggravating practice.'},
   'mental-evidence':{question:'How do nerves and confidence affect my performance?',next:'Keep normal preparation and compare naturally occurring conditions with the same benchmark. Do not deliberately induce pressure or fatigue.'},
   'technique-evidence':{question:'Do my technique observations match my results?',next:'Observe a comfortable baseline. Record one specific technical observation, preferably with a consistent video angle, and compare the same fixed benchmark on separate days.'},
   'method-cautions':{question:'Which methods should we reconsider?',next:'Continue the ordinary balanced plan and repeat independent checks before reinstating an optional drill preference.'}
  };
  const topic=previous?.day===day&&Object.hasOwn(topics,previous.topic)?previous.topic:null;
  if(/^(?:why|why is that|what is the evidence|show me the evidence|what evidence do you have|what should i do about that|how do i test that|what do i do now)$/.test(q)){
   if(!topic)return {answer:reply('clarification',['Start with a specific coaching review so I know which evidence you mean.']),context:null};
   const t=topics[topic],a=integratedAsk(host,state,t.question,day,now,checks,reflections,baselines,events);
   const action=/what should i do|how do i test|what do i do now/.test(q);
   return {answer:reply('review-followup',[...(action?[t.next]:[]),...a.lines,'No player records or training allocation changed.']),context:{day,topic}};
  }
  const count=q.match(/^(?:what about |and |what if i have )?(?:with )?(one|two|three|[123]) darts?(?: left| in hand| remaining)?$/);
  const hit=q.match(/^(?:what if i hit|i hit|after|instead i hit) ([a-z0-9]+)$/);
  if(count||hit){
   if(!context)return {answer:reply('clarification',['Which remaining score and how many darts in hand? Start with a checkout question.']),context:null};
   if(count){
    const darts=({one:1,two:2,three:3})[count[1]]??Number(count[1]);
    return {answer:integratedAsk(host,state,'Checkout '+context.score+' with '+darts+' darts',day,now,checks,reflections,baselines,events),context:{day,score:context.score,darts}};
   }
   const actual=hit[1].toUpperCase();
   if(!REGIONS.includes(actual))return {answer:reply('clarification',['Enter the actual segment, such as S19, T20, D16, 25, 50 or MISS.']),context};
   // Retain the actual visit start across a chain of reported hits.
   // Bust rolls back all darts in the visit, not just the latest dart.
   const start=context.visitStart??context.score,visitDarts=context.visitDarts??context.darts;
   const played=Array.isArray(context.actual)?context.actual:[];
   if(!Number.isInteger(start)||start<2||start>1001||!Number.isInteger(visitDarts)||visitDarts<1||visitDarts>3||played.length!==visitDarts-context.darts||!played.every(x=>REGIONS.includes(x)))return {answer:reply('clarification',['The checkout context is no longer valid. Enter a new score and dart count.']),context:null};
   const history=[...played,actual],r=recoveryAdvice(asOfState(state,day),start,history,visitDarts);
   return {answer:reply('checkout-recovery',recoveryLines(r)),context:r.dartsLeft>0&&r.remaining>=2&&r.status!=='bust'&&r.status!=='finished'?{day,score:r.remaining,darts:r.dartsLeft,visitStart:start,visitDarts,actual:history}:null};
  }
  const intent=interpret(q,day);
  const answer=integratedAsk(host,state,text,day,now,checks,reflections,baselines,events);
  return {answer,context:intent.kind==='query'&&intent.request.type==='checkout'&&answer.kind==='answer'?{day,...intent.request.payload}:Object.hasOwn(topics,answer.type)?{day,topic:answer.type}:null};
 }
