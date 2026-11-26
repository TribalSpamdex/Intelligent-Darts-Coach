import {validObservation} from './engine/engine.mjs';
import {dayValid} from './engine/context.mjs';
const definitions={scoring:{attempts:30,max:1800,instructions:'Throw 10 normal scoring visits; enter the total points.'},doubles:{attempts:60,max:60,instructions:'Throw exactly three darts at each double D1 to D20; count hits at the intended double.'},checkout:{attempts:12,max:12,instructions:'One three-dart attempt each at 41, 46, 52, 60, 68, 76, 81, 90, 101, 110, 120 and 130; count legal finishes.'},bull:{attempts:30,max:30,instructions:'Throw 30 darts at bull; count 25 or 50 as a hit.'},singles:{attempts:60,max:60,instructions:'Three darts at each large single from 1 to 20; count intended large-single hits.'},trebles:{attempts:60,max:60,instructions:'Three darts at each treble T1 to T20; count intended treble hits.'}};
export const CHECKS=Object.freeze(definitions);
const prefix='IDC:precision-check:';
export function makeCheck(skill,hits,day){
 const d=CHECKS[skill];if(!Object.hasOwn(CHECKS,skill)||!dayValid(day)||!Number.isInteger(hits)||hits<0||hits>d.max)throw Error('Enter a valid measured total for the complete check');
 return validObservation({id:prefix+skill+':'+day,day,skill,context:'practice',protocol:'IDC precision fixed '+skill,attempts:d.attempts,hits});
}
export function validatePrecisionChecks(rows){
 for(const o of rows.filter(x=>x.id.startsWith(prefix))){const v=makeCheck(o.skill,o.hits,o.day);if(JSON.stringify(v)!==JSON.stringify(validObservation(o)))throw Error('Invalid precision check record')}
}
export function isPrecisionCheck(o){return typeof o?.id==='string'&&o.id.startsWith(prefix)}
