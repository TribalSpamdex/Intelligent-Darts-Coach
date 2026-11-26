// Local coaching intelligence router. Each expensive analysis runs only on
// explicit review, not on each keypad press, dart or timer tick.
import {trainingLedger,ledgerLines} from './training-ledger.mjs';
import {trainingOutcomes,outcomeReportLines,followupLines} from './training-outcomes.mjs';
import {stageProfiles,stageTransfer,stageLines,transferLines} from './match-stages.mjs';
import {developmentProfile,developmentAgenda,developmentLines,agendaLines,goalRunwayLines} from './development-review.mjs';
export const INTELLIGENCE_QUESTIONS=Object.freeze([
 'What should I work on next?','How much have I actually trained?','How does my training relate to progress?',
 'Which drills help me improve?','Does longer practice help me?','Have my gains lasted?',
 'Where do I lose performance in legs?','How does practice transfer to competition?','How far am I from my goals?'
]);
const answer=(type,lines)=>({kind:'answer',type,lines});
export function intelligenceAnswer(host,state,q,day,now=Date.now()){
 if(/^(what should i work on next|my development priorities|development agenda)$/.test(q))return answer('development-agenda',agendaLines(developmentAgenda(host,state,day,{now})));
 if(/^(how much have i actually trained|training ledger|recorded training time)$/.test(q))return answer('training-ledger',ledgerLines(trainingLedger(host,day,now),day));
 if(/^(how does my training relate to progress|training and progress|am i plateauing|plateau review)$/.test(q))return answer('training-progress',developmentLines(developmentProfile(host,state,day,now)));
 if(/^(which drills help me improve|training method learning|compare my drills)$/.test(q))return answer('training-method',outcomeReportLines(trainingOutcomes(host,state,day,now),'method'));
 if(/^(does longer practice help me|training dose|practice duration learning)$/.test(q))return answer('training-dose',outcomeReportLines(trainingOutcomes(host,state,day,now),'dose'));
 if(/^(have my gains lasted|delayed benchmark follow-up|training retention)$/.test(q))return answer('training-followup',followupLines(trainingOutcomes(host,state,day,now)));
 const period=q.match(/^(?:match stages|where do i lose performance in legs)(?: (7|28|84|365) days)?$/);
 if(period)return answer('match-stages',stageLines(stageProfiles(state.legs??[],day),period[1]?Number(period[1]):28));
 if(/^(how does practice transfer to competition|actual match transfer|match stage comparison)$/.test(q))return answer('match-transfer',transferLines(stageTransfer(stageProfiles(state.legs??[],day),day)));
 if(/^(how far am i from my goals|goal runway|goal gaps)$/.test(q))return answer('goal-runway',goalRunwayLines(developmentAgenda(host,state,day,{now})));
 return null;
}
