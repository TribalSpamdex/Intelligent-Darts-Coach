import {skillProfiles,skillLines} from './skill-statistics.mjs';
import {projectTargets} from './host-targets.mjs';
import {detailedTargets,targetDetailLines} from './target-statistics.mjs';
import {scoringDetail,scoringDetailLines,checkoutDetail,checkoutDetailLines} from './visit-statistics.mjs';
import {practiceProfile,practiceLines} from './practice-statistics.mjs';
import {contextComparison,contextComparisonLines} from './context-statistics.mjs';
import {evidenceCoverage,coverageLines} from './evidence-coverage.mjs';
import {matchProfiles,matchLines,actualLegObservations} from './match-statistics.mjs';
import {recordedAimProfile,recordedAimLines} from './actual-target-statistics.mjs';
export const STAT_QUESTIONS=['Detailed skill statistics','Detailed target statistics D16','Detailed scoring statistics','Detailed checkout statistics 81','Practice volume','Practice versus competition','Evidence coverage','Actual match statistics','Actual miss patterns'];
const skills={scoring:'scoring',doubles:'doubles',singles:'singles',checkout:'checkout',bull:'bull','first nine':'firstNine',trebles:'trebles',switching:'switching',setup:'setup',pressure:'pressure',grouping:'grouping'};
const reply=(type,lines)=>({kind:'answer',type,lines});
export function statisticsAnswer(host,state,q,day,now=Date.now(),checks=[]){
 const skill=q.match(/^detailed (?:skill statistics|statistics)(?: (scoring|doubles|singles|checkout|bull|first nine|trebles|switching|setup|pressure|grouping))?$/);
 const target=q.match(/^detailed target statistics(?: ([dst](?:[1-9]|1[0-9]|20)|50|25))?$/);
 const checkout=q.match(/^detailed checkout statistics(?: (\d{1,3}))?$/);
 const miss=q.match(/^actual miss patterns(?: ([dst](?:[1-9]|1[0-9]|20)|50|25))?$/);
 const observations=()=>[...state.observations,...actualLegObservations(state.legs??[],day)];
 if(skill)return reply('detailed-skills',skillLines(skillProfiles(observations(),day),skill[1]?skills[skill[1]]:null));
 if(target)return reply('detailed-targets',targetDetailLines(detailedTargets(projectTargets(host,day,now,checks).rows,day),target[1]?.toUpperCase()));
 if(q==='detailed scoring statistics')return reply('detailed-scoring',scoringDetailLines(scoringDetail(host,day,now)));
 if(checkout)return reply('detailed-checkouts',checkoutDetailLines(checkoutDetail(host,day,now),checkout[1]?Number(checkout[1]):null));
 if(q==='practice volume')return reply('practice-volume',practiceLines(practiceProfile(host,day)));
 if(q==='practice versus competition')return reply('context-comparison',contextComparisonLines(contextComparison(observations(),day)));
 if(q==='evidence coverage')return reply('evidence-coverage',coverageLines(evidenceCoverage(host,{...state,observations:observations()},day,now,checks)));
 if(q==='actual match statistics')return reply('actual-matches',matchLines(matchProfiles(state.legs??[],day)));
 if(miss)return reply('actual-misses',recordedAimLines(recordedAimProfile(state.legs??[],day),miss[1]?.toUpperCase()));
 return null;
}
