import {fullReport} from './engine/executive.mjs';
import {verifiedLearningState,baselineIntegrity} from './intervention-audit.mjs';
import {performanceForecasts,forecastLines,forecastValidation,forecastValidationLines} from './performance-forecast.mjs';
import {coachBrief,briefLines} from './proactive-coach.mjs';
import {eventLines,competitionPreparation,competitionPreparationLines} from './competition-calendar.mjs';
import {personalLearning,learningLines,planPreview,blockPreview,planLines,blockLines,longProgramme,longProgrammeLines} from './personal-programme.mjs';
import {coachingAccountability,accountabilityLines,methodReviews,methodReviewLines} from './coaching-accountability.mjs';
import {recoveryPlan,recoveryLines} from './development-review.mjs';
export const AUTONOMY_QUESTIONS=Object.freeze(['What is my next coaching priority?','What performance range is realistic?','How do I learn best?','Preview my next session','Plan my next four weeks','How should I prepare for competition?','How effective has my coaching been?','How accurate are your predictions?','How should I recover from a slump?','Plan my next three months']);
export function reviewForAutonomy(state,baselines,day){
 const report=fullReport(verifiedLearningState(state,baselines,day).state,day);
 const i=(state.interventions??[]).find(x=>x.status==='accepted'&&x.id===report.active?.intervention);
 if(i&&baselineIntegrity(i,baselines[i.id]??[],state.observations,day).status!=='intact')return {...report,active:{mode:'baseline-edited',intervention:i.id}};
 return report;
}
const reply=(type,lines)=>({kind:'answer',type,lines});
export function autonomyAnswer(host,state,q,day,now=Date.now(),reflections=[],baselines={},events=[]){
 if(/^(what performance range is realistic|performance forecast|predict my performance)$/.test(q))return reply('performance-forecast',forecastLines(performanceForecasts(state.observations,day)));
 if(/^(how accurate are your predictions|forecast validation|test your predictions)$/.test(q))return reply('forecast-validation',forecastValidationLines(forecastValidation(state.observations,day)));
 if(/^(how do i learn best|my learning profile|personal learning profile)$/.test(q))return reply('personal-learning',learningLines(personalLearning(host,state,day,now)));
 if(q==='upcoming competitions')return reply('competition-preparation',eventLines(events,day));
 if(/^(how should i prepare for competition|competition preparation)$/.test(q))return reply('competition-preparation',[...eventLines(events,day),...competitionPreparationLines(competitionPreparation(state,events,day,{report:reviewForAutonomy(state,baselines,day)}))]);
 if(/^(how effective has my coaching been|coaching accountability|audit my coaching)$/.test(q))return reply('coaching-accountability',[...accountabilityLines(coachingAccountability(host,state,baselines,day,now)),...methodReviewLines(methodReviews(host,state,day,now),day)]);
 if(/^(what is my next coaching priority|coach brief|preview my next session|plan my next four weeks|how should i recover from a slump|plan my next three months)$/.test(q)){
  const report=reviewForAutonomy(state,baselines,day);
  if(q==='how should i recover from a slump')return reply('recovery-plan',recoveryLines(recoveryPlan(host,state,day,{report,now})));
  if(q==='plan my next three months')return reply('long-programme',longProgrammeLines(longProgramme(host,state,report,events,day,now)));
  if(q==='preview my next session')return reply('session-preview',planLines(planPreview(host,state,report,events,day,now)));
  if(q==='plan my next four weeks')return reply('block-preview',blockLines(blockPreview(host,state,report,events,day,now)));
  return reply('coach-brief',briefLines(coachBrief(host,state,report,events,reflections,day,now)));
 }
 return null;
}
