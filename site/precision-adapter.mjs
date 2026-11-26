import {projectEvidence} from './v62-evidence.mjs';
import {precisionDecisions,progressEvidence} from './progression-evidence.mjs';
import {precisionRound,precisionOptions,SUPPORTED_GAMES} from './precision-games.mjs';
import {calibrationChoices,calibrationBand,isFoundationAverage,provisionalAllowance,botScoring} from './precision-calibration.mjs';
import {dayGap,dayValid} from './engine/context.mjs';
export function snapshotPrecision(host,state,day,tiers,assessmentDay=null,now=Date.now()){
 const raw=projectEvidence(host,{today:day,now}).observations;
 const rows=[...raw,...(state?.observations??[])]
 .filter(o=>!assessmentDay||o.day>=assessmentDay);
 const recent=(xs,condition)=>(xs??[]).some(o=>dayValid(o.day)&&dayGap(o.day,day)>=0&&dayGap(o.day,day)<7&&condition(o));
 const safety=recent(state?.readiness,o=>o.pain||o.day===day&&o.fatigue==='high')||recent(state?.clinic,o=>o.pain);
 return {decisions:precisionDecisions(rows,day,tiers),safety};
}
export function applyPrecision(game,profile,games,day,opts={}){
 if(!SUPPORTED_GAMES.includes(game?.name)||!profile)return game;
 const options=precisionOptions(games,game.name,day,game.tier,opts.now??Date.now());
 return precisionRound(game,profile.decisions,{...options,eligible:opts.eligible===true,safety:profile.safety||opts.safety,probe:options.probe||opts.probe,cooldown:options.cooldown||opts.cooldown});
}
export function createPrecisionAdapter(getData){
 let cache=null;
 return Object.freeze({
  calibrationChoices,calibrationBand,isFoundationAverage,provisionalAllowance,botScoring,supported:name=>SUPPORTED_GAMES.includes(name),
  botAverage(fallback,prior){try{const d=getData(),profiles=progressEvidence([...projectEvidence(d.host,{today:d.day,now:d.now}).observations,...(d.state?.observations??[])],d.day).filter(r=>r.skill==='scoring'&&r.context==='practice'&&r.adequate&&dayGap(r.last,d.day)<=7&&['IDC V6.2 assessment scoring 60 darts','IDC V6.2 Scoring Challenge fixed 30 darts','IDC precision fixed scoring'].includes(r.protocol));const values=profiles.map(r=>r.value);if(values.length&&Math.max(...values)-Math.min(...values)<=10)return Math.round(Math.min(...values)/5)*5;return Number.isFinite(prior)?prior:fallback}catch{return fallback}},
  adjust(game,context){
   if(!context?.eligible||!SUPPORTED_GAMES.includes(game?.name)||game.recovery||game.challengeTuning)return game;
   try{
    const d=getData(),key=JSON.stringify([context.sessionId,context.exerciseIndex,d.day,context.tiers,context.assessmentDay]);
    // Frozen profile within an exercise. A new exercise or restored page
    // recomputes from the saved authoritative history, not from partial darts.
    if(!cache||cache.key!==key)cache={key,profile:snapshotPrecision(d.host,d.state,d.day,context.tiers,context.assessmentDay,d.now)};
    return applyPrecision(game,cache.profile,d.host.games,d.day,{...context,now:d.now});
   }catch{return game}
  },
  invalidate(){cache=null}
 });
}
