import {dayGap,dayValid} from './engine/context.mjs';
import {canonicalRows,scopeKey} from './longitudinal.mjs';
import {summarise} from './engine/engine.mjs';
import {extractLearningExposure} from './challenge-exposure.mjs';
import {baseKey,settingKey} from './challenge-setting.mjs';
export const FIXED_PROTOCOLS=Object.freeze({
 scoring:['IDC V6.2 assessment scoring 60 darts','IDC V6.2 Scoring Challenge fixed 30 darts','IDC precision fixed scoring'],
 doubles:['IDC V6.2 assessment D1-D20 fixed 60','IDC precision fixed doubles'],
 checkout:['IDC V6.2 assessment fixed 12 three-dart visits','IDC precision fixed checkout'],
 bull:['IDC V6.2 assessment any bull 30','IDC V6.2 Bull Accuracy any bull 30','IDC precision fixed bull'],
 singles:['IDC V6.2 assessment large singles 60','IDC V6.2 daily large singles 60','IDC precision fixed singles'],
 trebles:['IDC precision fixed trebles']
});
const minAttempts={scoring:30,doubles:60,checkout:12,bull:30,singles:60,trebles:60};
const scoreUnits=(skill,v)=>skill==='scoring'?v:100*v;
const within=(v,a,b)=>dayValid(v)&&v>=a&&v<=b;
function recordedConfounder(state,from,to){
 return (state.readiness??[]).some(r=>within(r.day,from,to)&&r.context==='practice'&&(r.pain||r.fatigue==='high'||r.pressure==='high'))||
 (state.clinic??[]).some(r=>within(r.day,from,to)&&r.pain)||
 (state.setups??[]).some(r=>within(r.day,from,to))||
 (state.changes??[]).some(r=>within(r.day,from,to))||
 (state.interventions??[]).some(r=>dayValid(r.responseDay)&&r.responseDay<=to&&(['accepted','active'].includes(r.status)||['completed','unsuccessful'].includes(r.status)&&dayValid(r.reviewDay)&&r.reviewDay>=from));
}
export function learningEpisodes(host,state,day,now=Date.now()){
 const exposure=extractLearningExposure(host,day,now),observations=canonicalRows(state.observations??[],day);
 const scopes=new Map(),out=[],rejected={coverage:0,confounder:0,mixed:0};
 for(const o of observations){
 if(o.context!=='practice'||!FIXED_PROTOCOLS[o.skill]?.includes(o.protocol)||dayGap(o.day,day)>180)continue;
 const key=scopeKey(o),g=scopes.get(key)??[];g.push(o);scopes.set(key,g);
 }
 for(const rows of scopes.values()){
 const {skill,protocol}=rows[0],byDay=new Map();
 for(const o of rows){const g=byDay.get(o.day)??[];g.push(o);byDay.set(o.day,g)}
 const measures=[...byDay].map(([day,r])=>{const x=summarise(r);return {day,value:scoreUnits(skill,x.value),attempts:x.attempts,ids:r.map(o=>o.id)}}).sort((a,b)=>a.day.localeCompare(b.day));
 // Disjoint chronological measurement pairs. No shared start/end benchmark.
 for(let i=0;i<measures.length-1;){
 const a=measures[i],b=measures[i+1],gap=dayGap(a.day,b.day);
 if(gap<2||gap>8||a.attempts<minAttempts[skill]||b.attempts<minAttempts[skill]){rejected.coverage++;i++;continue}
 if(recordedConfounder(state,a.day,b.day)||exposure.blockedDays.some(d=>within(d,a.day,b.day))){rejected.confounder++;i++;continue}
 const sessionDays=exposure.sessionDays.filter(x=>x.day>a.day&&x.day<b.day);
 const endpointPractice=exposure.sessionDays.filter(x=>x.day===a.day||x.day===b.day).map(x=>x.day===a.day?'before':'after').sort();
 // Endpoint-day practice is not included in the dose. Retain its presence
 // for matching and disclose that within-day ordering is unknown.
 if(!sessionDays.length||sessionDays.length>3){rejected.coverage++;i++;continue}
 const chosen=exposure.exposures.filter(x=>x.setting.skill===skill&&x.day>a.day&&x.day<b.day);
 if(chosen.length!==sessionDays.length||new Set(chosen.map(x=>String(x.sessionId))).size!==chosen.length||sessionDays.some(s=>!chosen.some(e=>e.sessionId===s.id))||chosen.some(x=>settingKey(x.setting)!==settingKey(chosen[0].setting))){rejected.mixed++;i++;continue}
 const first=chosen[0],seconds=chosen.reduce((n,x)=>n+x.seconds,0),otherSeconds=chosen.reduce((n,x)=>n+x.otherSeconds,0);
 // Match the remainder of the training plan by game names and total time.
 const otherGames=[...new Set(chosen.flatMap(x=>x.other.map(a=>a[0])))].sort();
 const otherDose=Object.fromEntries(otherGames.map(name=>[name,chosen.flatMap(x=>x.other).filter(a=>a[0]===name).reduce((n,a)=>n+a[1],0)]));
 out.push({skill,protocol,setting:first.setting,key:baseKey(first.setting),from:a.day,to:b.day,gap,baseline:a.value,after:b.value,delta:b.value-a.value,attempts:[a.attempts,b.attempts],measurementIds:[...a.ids,...b.ids],sessions:chosen.length,seconds,otherSeconds,otherGames,otherDose,endpointPractice,dominance:Math.min(...chosen.map(x=>x.dominance)),rounds:chosen.reduce((n,x)=>n+x.rounds,0)});
 i+=2;
 }
 }
 return {episodes:out.sort((a,b)=>a.to.localeCompare(b.to)||a.key.localeCompare(b.key)),rejected,exposures:exposure.exposures.length};
}
