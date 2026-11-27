import {recordSetting} from './challenge-setting.mjs';
import {challengeLearning,learnedCap} from './challenge-learning.mjs';
import {projectEvidence,masteryRows,canonicalSkillGames,recordedDay,quickAdaptiveMeasurements,fixedGameSources,roundIdentity} from './v62-evidence.mjs';
import {precisionDecisions,progressEvidence,calibrationGuard,confirmedAbility} from './progression-evidence.mjs';
import {precisionRound,precisionOptions,SUPPORTED_GAMES} from './precision-games.mjs';
import {calibrationChoices,legacyPrecisionChoices,calibrationBand,isFoundationAverage,provisionalAllowance,botScoring} from './precision-calibration.mjs';
import {projectTargets,summaries,targetDevelopment,targetDevelopmentLines} from './host-targets.mjs';
import {learningBoundary} from './challenge-episodes.mjs';
import {gameProfile} from './game-profile.mjs';
import {dayGap,dayValid} from './engine/context.mjs';
export function snapshotPrecision(host,state,day,tiers,assessmentDay=null,now=Date.now()){
 const raw=projectEvidence(host,{today:day,now}).observations;
 const rows=[...raw,...(state?.observations??[])]
 .filter(o=>!assessmentDay||o.day>=assessmentDay);
 const recent=(xs,condition)=>(xs??[]).some(o=>dayValid(o.day)&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<7&&condition(o));
 const safety=recent(state?.readiness,o=>o.pain||o.day===day&&o.fatigue==='high')||recent(state?.clinic,o=>o.pain);
 const learning=challengeLearning(host,{...state,observations:rows},day,now);
 return {decisions:precisionDecisions(rows,day,tiers),safety,learning};
}
export function applyPrecision(game,profile,games,day,opts={}){
 if(!SUPPORTED_GAMES.includes(game?.name)||!profile)return game;
 const options=precisionOptions(games,game.name,day,game.tier,opts.now??Date.now(),game);
 const cap=learnedCap(game,profile.learning),safety=profile.safety||opts.safety;
 const played=precisionRound(game,profile.decisions,{...options,maxQuarter:Math.min(options.maxQuarter,cap.maxQuarter),eligible:opts.eligible===true,safety,probe:options.probe||opts.probe,cooldown:options.cooldown||opts.cooldown});
 return (opts.eligible===true||opts.capture===true)&&!safety?recordSetting(game,played):played;
}
// Authoritative fixed Quick Play evidence for the native estimator and charts.
// This marker is constructed here; saved records cannot opt themselves in.
export function quickFixedSamples(host,now=Date.now()){
 const day=recordedDay(now),eligible=new Set(projectEvidence(host,{today:day,now}).observations.filter(o=>o.protocol.startsWith('IDC V6.2 Quick Play ')).map(o=>o.id));
 const games=canonicalSkillGames(host.games),sources=fixedGameSources(games);
 return games.flatMap(g=>{
  const skill=g?.name==='Scoring Challenge'?'scoring':g?.name==='Bull Accuracy'?'bull':null;
  if(!skill||g.quick!==true||!eligible.has('IDC:host-v62:'+sources.get(roundIdentity(g))+':'+skill))return [];
  return [{skill,time:g.at,day:g.day,volume:skill==='scoring'?10:30,points:skill==='scoring'?g.points:0,hits:skill==='bull'?g.outer+g.inner:0,inner:g.inner??0,id:g.at,source:'Quick Play '+g.name,quick:true,verifiedQuick:true,weight:1}];
 });
}
// A repeated fixed Quick Play protocol may establish 80+, but neither one
// hot day nor adaptive scoring can. All fresh comparable protocols can veto.
export function fixedQuickScoringGate(host,state,day,now=Date.now()){
 const boundary=learningBoundary(state??{},day),a=host.assessment,at=a?.finished&&Number.isFinite(a.completedAt)&&a.completedAt<=now?a.completedAt:0;
 const raw=projectEvidence({...host,games:(host.games??[]).filter(g=>!at||g?.at>=at)},{today:day,now}).observations;
 const profiles=progressEvidence([...raw,...(state?.observations??[])].filter(o=>(!boundary||o.day>boundary)&&(!at||o.day>=recordedDay(at,a.offsetMinutes))),day)
  .filter(p=>p.skill==='scoring'&&p.context==='practice'&&['IDC V6.2 Quick Play Scoring Challenge fixed 30 darts','IDC V6.2 Scoring Challenge fixed 30 darts','IDC V6.2 assessment scoring 60 darts','IDC precision fixed scoring'].includes(p.protocol)&&p.adequate&&dayGap(p.last,day)<=7);
 const quick=profiles.find(p=>p.protocol==='IDC V6.2 Quick Play Scoring Challenge fixed 30 darts');
 if(!quick)return {status:'insufficient',allowed:false,average:null,source:'insufficient-fixed-quick-play'};
 const average=confirmedAbility(profiles,180),allowed=profiles.every(p=>p.confirm(80)&&p.form.status!=='below-usual');
 return {status:allowed?'supported':'blocked',allowed,average,source:allowed?'repeated-fixed-quick-play':'current-fixed-evidence-below-80',days:quick.days,weeks:quick.weeks,attempts:quick.attempts};
}
export function quickMeasurementCards(host,day,now=Date.now()){
 const targets=summaries(projectTargets(host,day,now).rows).filter(x=>x.protocol.startsWith('Quick Play · ')&&!x.protocol.includes('Target Mastery'));
 const finishes=gameProfile(host,day,now).checkout.filter(x=>x.protocol.startsWith('Quick Play · ')&&!x.protocol.includes('Target Mastery'));
 const fixed=projectEvidence(host,{today:day,now}).observations.filter(o=>o.protocol.startsWith('IDC V6.2 Quick Play ')),groups=new Map();
 for(const o of fixed){const x=groups.get(o.protocol)??{key:o.protocol,skill:o.skill,hits:0,attempts:0,days:new Set()};x.hits+=o.hits;x.attempts+=o.attempts;x.days.add(o.day);groups.set(o.protocol,x)}
 return [...quickAdaptiveMeasurements(host,day,now).map(x=>({key:'Quick Play · '+x.key.replace(/tier [1-7]\b/g,'separate setting'),value:(x.scoring?(x.perDart?3:1)*x.hits/x.attempts:100*x.hits/x.attempts).toFixed(1)+(x.scoring?' average':'%'),detail:x.attempts+' '+x.unit+' · '+x.days+' days · adaptive stopping rules'})),...targets.map(x=>({key:x.protocol.replace(/tier (?:[1-7]|unspecified)\b/g,'separate setting')+' · '+x.target,value:(100*x.rate).toFixed(1)+'%',detail:x.hits+' / '+x.attempts+' darts · '+x.days+' days · adaptive target selection'})),...finishes.map(x=>({key:x.protocol.replace(/tier [1-7]\b/g,'separate setting')+' · '+x.score,value:(100*x.rate).toFixed(1)+'%',detail:x.hits+' / '+x.attempts+' attempts · '+x.days+' days · adaptive checkout selection'})),...[...groups.values()].map(x=>({key:x.key.replace('IDC V6.2 ','') ,value:(x.skill==='scoring'?3*x.hits/x.attempts:100*x.hits/x.attempts).toFixed(1)+(x.skill==='scoring'?' average':'%'),detail:x.attempts+' darts · '+x.days.size+' days · fixed completed rounds'}))];
}
export function createPrecisionAdapter(getData,getHistory=null){
 let cache=null;
 return Object.freeze({
  calibrationChoices,legacyPrecisionChoices,calibrationBand,isFoundationAverage,provisionalAllowance,botScoring,supported:name=>SUPPORTED_GAMES.includes(name),
  masteryRows:(host,now)=>masteryRows(host,now),quickFixedSamples,quickMeasurementCards,
  targetReview(){try{const d=getData();return targetDevelopmentLines(targetDevelopment(d.host,d.state,d.day,d.now))}catch{return []}},
  scoringEligibility(now=Date.now()){try{const d=getData();return fixedQuickScoringGate(d.host,d.state,recordedDay(now),now)}catch{return {status:'unavailable'}}},
  tierGuard(skill,current,next){try{const d=getData();const a=d.host.assessment,at=a?.finished?(a.completedAt??a.profile?.createdAt):null,boundary=Number.isFinite(at)&&at>0&&at<=d.now?recordedDay(at,a.offsetMinutes):null;return calibrationGuard([...projectEvidence(d.host,{today:d.day,now:d.now}).observations,...(d.state?.observations??[])].filter(o=>!boundary||o.day>=boundary),d.day,skill,current,next)}catch{return {status:'unavailable',contradictions:[]}}},
  botAverage(fallback,prior){try{const d=getData(),profiles=progressEvidence([...projectEvidence(d.host,{today:d.day,now:d.now}).observations,...(d.state?.observations??[])],d.day).filter(r=>r.skill==='scoring'&&r.context==='practice'&&r.adequate&&dayGap(r.last,d.day)<=7&&['IDC V6.2 assessment scoring 60 darts','IDC V6.2 Scoring Challenge fixed 30 darts','IDC precision fixed scoring','IDC V6.2 Quick Play Scoring Challenge fixed 30 darts'].includes(r.protocol));const values=profiles.map(r=>r.value);if(values.length&&Math.max(...values)-Math.min(...values)<=10)return Math.round(Math.min(...values)/2.5)*2.5;return Number.isFinite(prior)?prior:fallback}catch{return fallback}},
  adjust(game,context){
   if((!context?.eligible&&!context?.capture)||!SUPPORTED_GAMES.includes(game?.name)||game.recovery||game.challengeTuning)return game;
   try{
    const key=JSON.stringify([context.sessionId,context.exerciseIndex,context.day??null,context.tiers,context.assessmentDay]);
    let d=null;
    // Frozen profile within an exercise. A new exercise or restored page
    // recomputes from the saved authoritative history, not from partial darts.
    if(!cache||cache.key!==key){d=getData();cache={key,day:d.day,profile:snapshotPrecision(d.host,d.state,d.day,context.tiers,context.assessmentDay,d.now)}}
    if(!getHistory&&!d)d=getData();const now=d?.now??Date.now(),history=getHistory?getHistory(game.name,cache.day,now):d.host.games;
    const eligibleHistory=history.filter(g=>g.quick===false);
    return applyPrecision(game,cache.profile,eligibleHistory,cache.day,{...context,now});
   }catch{return game}
  },
  invalidate(){cache=null}
 });
}
