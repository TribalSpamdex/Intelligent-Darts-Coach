// Public progress milestones are measurement units, never internal difficulty tiers.
const scoreSkills=new Set(['scoring','firstNine']);
export const SKILL_THRESHOLDS=Object.freeze({scoring:[110,90,75,60,45,30],doubles:[60,45,35,27,20,12],checkout:[75,60,50,40,30,20],bull:[70,55,45,33,22,12]});
export function bandEdges(skill){return scoreSkills.has(skill)?[0,20,...Array.from({length:64},(_,i)=>22.5+i*2.5)]:Array.from({length:41},(_,i)=>i*2.5)}
export function measurementBand(skill,value){
 const edges=bandEdges(skill),max=edges.at(-1);
 if(!Number.isFinite(value)||value<0||value>max)throw Error('Invalid progression measurement');
 const index=Math.min(edges.length-2,edges.findLastIndex(x=>x<=value)),lower=edges[index],upper=edges[index+1];
 return {index,lower,upper,max,atMaximum:value===max,next:value===max?null:upper,fraction:(value-lower)/(upper-lower)};
}
export function tierRange(skill,tier){
 const t=SKILL_THRESHOLDS[skill];if(!t||!Number.isInteger(tier)||tier<1||tier>7)throw Error('Invalid gameplay tier');
 const lower=tier===7?0:t[tier-1],upper=tier===1?(skill==='scoring'?180:100):t[tier-2];
 return {lower,upper,midpoint:(lower+upper)/2,quarters:[.25,.5,.75].map(f=>lower+(upper-lower)*f)};
}
export function tierHalf(skill,tier,value){const r=tierRange(skill,tier);return Number.isFinite(value)&&value>=r.midpoint?'upper':'foundation'}
export function tierQuarter(skill,tier,value){const r=tierRange(skill,tier);if(!Number.isFinite(value))return 0;return r.quarters.filter(b=>value>=b).length}
export function averageChoices(){const a=bandEdges('scoring');return a.slice(0,-1).map((lower,i)=>({key:'q'+lower,lower,upper:a[i+1],average:(lower+a[i+1])/2,label:lower+'–'+(a[i+1]===180?'180':'under '+a[i+1])}))}
