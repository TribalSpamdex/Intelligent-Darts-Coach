import {visit,routes,rankedRoutes,setup,points,isDouble,SEGMENTS} from './engine.mjs';
import {preferredDoubles} from './goals.mjs';
import {modelFor,missAwarePolicy,REGIONS} from './target-evidence.mjs';
const canonical=s=>/^[LI]/.test(s)?'S'+s.slice(1):s;
export function advice(memory,{score,darts=3,actual=[],doubleIn=false,opened=!doubleIn,context='practice',protocol='',opponent=null}){
 if(!Number.isInteger(score)||score<2||score>1001||!Number.isInteger(darts)||darts<1||darts>3||!Array.isArray(actual)||actual.length>darts||!actual.every(s=>REGIONS.includes(s))||typeof doubleIn!=='boolean'||typeof opened!=='boolean'||!['practice','competition'].includes(context)||typeof protocol!=='string'||protocol.length>100||!(opponent===null||Number.isInteger(opponent)&&opponent>=2&&opponent<=1001))throw Error('Invalid tactical input');
 if(!doubleIn&&!opened)throw Error('Straight-in visits cannot be unopened');
 const preferred=preferredDoubles(memory),played=visit(score,actual.map(canonical),{doubleIn,opened}),remaining=played.remaining,left=darts-played.used;
 if(played.used!==actual.length)throw Error('Recorded darts continue after the visit ended');
 const base={start:score,actual,remaining,dartsLeft:left,opened:played.opened,preferred,opponent,opponentCanFinish:opponent===null?null:routes(opponent,3).length>0,limitation:'Opponent finish availability is not a measured probability of winning.'};
 if(played.bust)return {...base,status:'bust',options:[],setup:[],guidance:'Visit ended in a bust. Restore the visit-start score; no more darts in this visit.'};
 if(played.finished)return {...base,status:'finished',options:[],setup:[],guidance:'Legal double-out finish.'};
 if(!left)return {...base,status:'visit-complete',options:[],setup:[],guidance:'No darts remain in this visit.'};
 if(doubleIn&&!played.opened){
 const direct=rankedRoutes(remaining,left,{},preferred).filter(x=>isDouble(x.path[0]));
 const doubles=preferred.concat(SEGMENTS.filter(s=>isDouble(s)&&!preferred.includes(s))).filter(s=>remaining-points(s)>=2||remaining===points(s));
 return {...base,status:'double-in-required',options:direct,setup:[],openingTargets:doubles,guidance:'A double is required before scoring. These are legal opening options; no opening probability is assumed.'};
 }
 const all=rankedRoutes(remaining,left,{},preferred),setups=setup(remaining,left);
 const unique=new Map();for(const x of all){const k=x.path[0]+'/'+x.path.at(-1);if(!unique.has(k))unique.set(k,x)}
 const options=[...unique.values()].slice(0,12);
 const result={...base,status:all.length?'finish-available':'setup-required',options,routeCount:all.length,setup:setups.slice(0,12),guidance:all.length?'A legal finish is available. Route ordering uses fewer darts and recorded finishing preference, not an estimated win probability.':'No legal finish with the darts remaining. Consider leaving an accessible finish next visit.'};
 if(protocol.trim()){const model=modelFor(memory.throws??[],context,protocol.trim());result.measured=missAwarePolicy(remaining,left,model)}
 // Independently verify every displayed route against visit rules.
 for(const x of result.options)if(x.path.length>left||!visit(remaining,x.path).finished)throw Error('Tactical verification failure');
 return result;
}
