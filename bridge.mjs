import {projectEvidence} from './v62-evidence.mjs';
import {newPlayer,query} from './engine/coach-api.mjs';
import {ask} from './engine/coach-dialogue.mjs';
import {scenario} from './engine/scenarios.mjs';
export function snapshotForCoach(host,day,now=Date.now()){
 const evidence=projectEvidence(host,{today:day,now});
 return {state:{...newPlayer(),observations:evidence.observations},evidence};
}
export function compareCoaches(host,legacy,day,now=Date.now()){
 const {state,evidence}=snapshotForCoach(host,day,now);
 const report=query(state,{version:1,type:'review',day,payload:{}}).result;
 return {report,legacy,evidence,mode:'comparison-only'};
}
export function demo(){const s=scenario('decline');return query(s.memory,{version:1,type:'review',day:s.day,payload:{}}).result}
