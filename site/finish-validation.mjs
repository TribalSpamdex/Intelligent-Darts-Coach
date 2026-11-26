import {routes} from './engine/engine.mjs';
const cache=new Map();
export function legalFinishCount(score,darts){
 if(!Number.isInteger(score)||score<2||score>170||!Number.isInteger(darts)||darts<1||darts>3)return false;
 const key=score+'/'+darts;if(!cache.has(key))cache.set(key,routes(score,darts).some(path=>path.length===darts));
 return cache.get(key);
}
