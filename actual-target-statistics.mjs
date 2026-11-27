import {analyseLeg} from './engine/match.mjs';
import {classify,targetSummaries} from './engine/target-evidence.mjs';
import {dayValid,dayGap} from './engine/context.mjs';
export function recordedAimProfile(legs,day){
 if(!dayValid(day)||!Array.isArray(legs))throw Error('Invalid match target history');
 const throws=[],ids=new Set();let unknown=0,excluded=0;
 for(const raw of legs){
 const l=analyseLeg(raw),x=l.leg;
 if(ids.has(x.id))throw Error('Duplicate leg identity');ids.add(x.id);
 if(dayGap(x.day,day)<0||dayGap(x.day,day)>=84||x.result==='abandoned')continue;
 unknown+=l.unknownIntent;
 if(l.unknownIntent){excluded++;continue}
 const protocol='Actual leg '+x.start+(x.doubleIn?' double-in':' straight-in');
 for(const [v,visit] of x.visits.entries())for(const [i,actual] of visit.darts.entries()){
 throws.push({id:'aim:'+x.id+':'+v+':'+i,day:x.day,context:x.context,protocol,aim:visit.aims[i],actual});
 }
 }
 const groups=targetSummaries(throws).sort((a,b)=>a.context.localeCompare(b.context)||a.protocol.localeCompare(b.protocol)||a.aim.localeCompare(b.aim,undefined,{numeric:true}));
 return {groups,unknown,excluded,limitation:'Actual segments only from fully aimed completed legs, kept separate by match rules and context. Board-relative directions are not release or grip diagnoses.'};
}
export function recordedAimLines(r,target=null){
 const g=r.groups.filter(x=>!target||x.aim===target);
 if(!g.length)return ['No fully aimed completed leg measurements for this question.',r.unknown+' recorded darts had unknown intent; '+r.excluded+' legs excluded.',r.limitation];
 return [...g.slice(0,24).flatMap(x=>[x.aim+' · '+x.context+' · '+x.protocol+': '+x.hits+'/'+x.attempts+' exact hits, '+x.days+' days · '+x.adequacy,Object.entries(x.directions).map(([k,v])=>k+' '+v).join(' · ')]),r.unknown+' unknown aims across '+r.excluded+' excluded legs.',r.limitation];
}
