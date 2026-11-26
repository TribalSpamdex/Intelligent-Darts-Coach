import {validPrecisionRecord,SUPPORTED_GAMES} from './precision-games.mjs';
import {dayGap,dayValid} from './engine/context.mjs';
import {distribution} from './statistics.mjs';
export function precisionAudit(games,day){
 if(!dayValid(day)||!Array.isArray(games))throw Error('Invalid precision audit');
 const seen=new Map(),conflicts=new Set();
 for(const g of games){
 if(!g||!SUPPORTED_GAMES.includes(g.name)||g.quick!==false||g.extra||g.recovery||g.completion!=='natural'||typeof g.win!=='boolean'||!dayValid(g.day)||g.day>day||dayGap(g.day,day)>=84||!Number.isFinite(g.at)||!Number.isInteger(g.tierAtStart)||g.tierAtStart<1||g.tierAtStart>7)continue;
 const mode=validPrecisionRecord(g)?'precision':!g.challengeTuning?'standard':null;if(!mode)continue;
 const key=JSON.stringify([g.name,g.at]),record={name:g.name,day:g.day,tier:g.tierAtStart,mode,win:g.win,rule:g.ruleVersion??null,config:mode==='precision'?g.precision:null};
 if(seen.has(key)&&JSON.stringify(seen.get(key))!==JSON.stringify(record))conflicts.add(key);else seen.set(key,record);
 }
 const groups=new Map();
 for(const [id,r] of seen){if(conflicts.has(id))continue;const key=JSON.stringify([r.name,r.tier,r.rule,r.mode,r.config]),x=groups.get(key)??{...r,days:new Map()};const d=x.days.get(r.day)??[0,0];d[0]+=Number(r.win);d[1]++;x.days.set(r.day,d);groups.set(key,x)}
 return [...groups.values()].map(x=>{const {days,win,day,...rest}=x,v=[...days.values()];return {...rest,days:days.size,rounds:v.reduce((n,r)=>n+r[1],0),wins:v.reduce((n,r)=>n+r[0],0),daily:distribution(v.map(r=>r[0]/r[1]))}}).sort((a,b)=>a.name.localeCompare(b.name)||a.mode.localeCompare(b.mode));
}
const names={lives:'Lives',allowed:'Dart allowance',allowedMisses:'Miss allowance',dartsLeft:'Dart budget',maxDarts:'Dart limit',maxVisits:'Visit limit',target:'Scoring target',targets:'Scoring ladder',goal:'Target score',roundPointGoal:'Point target',failedVisitLimit:'Failed visit allowance',maxCalls:'Call limit',par:'Par',tolerance:'Score tolerance'};
const value=v=>Array.isArray(v)?v.join(' / '):String(v);
export function precisionAuditLines(rows){
 if(!rows.length)return ['No completed eligible challenge rounds recorded.'];
 return [...rows.slice(0,40).map(r=>r.name+' · '+(r.mode==='precision'?'personalised challenge · '+(names[r.config.field]??r.config.field)+' '+value(r.config.after):'standard challenge')+' · '+r.wins+'/'+r.rounds+' successful rounds; '+r.days+' measured days; median daily success '+(r.daily.median*100).toFixed(1)+'%.'),'Different rules and difficulty configurations remain separate. Round success is not a benchmark accuracy or proof of improvement.'];
}
