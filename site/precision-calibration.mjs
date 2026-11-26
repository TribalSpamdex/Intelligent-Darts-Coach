import {averageChoices,SKILL_THRESHOLDS} from './progression-bands.mjs';
const old=[['under30',25,[7,7,7,7],69],['30',35,[6,7,7,7],51],['40',45,[6,6,6,6],41],['50',55,[5,5,5,5],34],['60',65,[4,5,5,5],28],['70',75,[3,4,4,4],25],['80',85,[3,3,3,3],22],['90',95,[2,3,3,3],20],['100',105,[2,2,2,2],19]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function provisionalAllowance(average,start=501){
 if(!Number.isFinite(average)||average<0||average>180||![301,501].includes(start))throw Error('Invalid provisional average');
 let ceiling;
 if(average<=25)ceiling=69+(25-Math.max(10,average))*2.4;
 else if(average>=105)ceiling=19-(average-105)*.035;
 else{const i=old.findIndex((x,i)=>i>0&&average<=x[1]),a=old[i-1],b=old[i];ceiling=a[3]+(b[3]-a[3])*(average-a[1])/(b[1]-a[1])}
 return clamp(Math.round(start===501?ceiling:ceiling*301/501+2),start===501?18:12,start===501?105:75);
}
export function calibrationChoices(){
 return averageChoices().map(b=>{const oldBand=old.findLast(x=>b.average>=(x[0]==='under30'?0:Number(x[0])))??old[0];
 const scoring=SKILL_THRESHOLDS.scoring.findIndex(x=>b.average>=x);
 return {...b,tiers:[scoring<0?7:scoring+1,...oldBand[2].slice(1)],legacyKey:oldBand[0],allowance501:provisionalAllowance(b.average)}});
}
export function calibrationBand(key){const precise=calibrationChoices().find(b=>b.key===key);if(precise)return precise;if(typeof key==='string'&&/^p(?:0|[2-9]0|[2-9]5|1[0-7][05])$/.test(key)){const lower=Number(key.slice(1)),upper=lower===0?20:lower+5;if(upper<=180){const average=(lower+upper)/2,b=old.findLast(x=>average>=(x[0]==='under30'?0:Number(x[0])))??old[0];return {key,lower,upper,average,tiers:[...b[2]],legacyKey:b[0],allowance501:provisionalAllowance(average)}}}const legacy=old.find(x=>x[0]===key);return legacy?{key,average:legacy[1],tiers:[...legacy[2]],legacyKey:key,allowance501:legacy[3]}:null}
export function legacyPrecisionChoices(){return Array.from({length:33},(_,i)=>calibrationBand('p'+(i===0?0:15+i*5))).filter(Boolean)}
export function isFoundationAverage(key){const b=calibrationBand(key);return !!b&&b.average<40}
export function botScoring(average,singles=.85){
 if(!Number.isFinite(average)||!Number.isFinite(singles))throw Error('Invalid bot calibration');
 const target=clamp(average,0,180)/60;
 // Expected points on T20: 60*t+20*s; three-dart target=180*t+60*s.
 const hit=clamp(singles,target/3,Math.min(1,target)),t=(target-hit)/2,s=hit-t;
 return {treble:t,single:s,miss:1-t-s,expected:180*t+60*s};
}
