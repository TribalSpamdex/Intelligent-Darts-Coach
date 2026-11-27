import {manualTargetRows} from './manual-target-samples.mjs';
import {dayGap,dayValid} from './engine/context.mjs';
import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {skillProfiles} from './skill-statistics.mjs';
import {projectTargets} from './host-targets.mjs';
import {detailedTargets} from './target-statistics.mjs';
import {gameProfile} from './game-profile.mjs';
import {practiceProfile} from './practice-statistics.mjs';
export function evidenceCoverage(host,state,day,now=Date.now(),checks=[]){
 if(!dayValid(day))throw Error('Invalid coverage date');
 const rows=canonicalRows(state.observations,day),skills=skillProfiles(rows,day);
 const raw=projectTargets(host,day,now,checks),targets=detailedTargets([...raw.rows,...manualTargetRows(state.throws??[],day)],day);
 const games=gameProfile(host,day,now),practice=practiceProfile(host,day);
 const missing=['scoring','doubles','checkout','bull','singles'].filter(s=>!skills.some(p=>p.skill===s&&p.coverage==='multi-week'));
 return {skills:skills.map(p=>({skill:p.skill,context:p.context,protocol:p.protocol,coverage:p.coverage,last:p.last,days:p.windows[1].distribution.n,weeks:p.windows[1].weeks,attempts:p.windows[1].attempts})),missing,targetProfiles:targets.length,adequateTargets:targets.filter(r=>r.windows[2].daily.n>=7&&r.windows[2].attempts>=30).length,excludedTargetIdentities:raw.conflicts,excludedGameIdentities:games.conflicts,duplicateSessionIdentities:practice.duplicates,recordedDays:new Set(rows.filter(o=>dayGap(o.day,day)<28).map(o=>o.day)).size,limitation:'Coverage is not a player rating. Missing measurements are unknown, not weak skills. All thresholds are engineering rules, not validated cutoffs.'};
}
export function coverageLines(c){
 return [c.recordedDays+' distinct days with eligible benchmark evidence in the last 28 days.',c.adequateTargets+' of '+c.targetProfiles+' target/protocol profiles have at least 30 attempts across seven separate days.','Insufficient multi-week coverage: '+(c.missing.join(', ')||'none of the five tracked core skills')+'.',...c.skills.slice(0,20).map(s=>s.skill+' · '+s.context+' · '+s.protocol+': '+s.coverage+'; '+s.days+' days, '+s.weeks+' weeks, '+s.attempts+' attempts.'),'Excluded conflicting target/game/session identities: '+c.excludedTargetIdentities+'/'+c.excludedGameIdentities+'/'+c.duplicateSessionIdentities+'.',c.limitation];
}
