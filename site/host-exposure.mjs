// Conservative observed practice time from finished IDC sessions.
// Mixed or ambiguous game names remain unclassified; do not assume all practice was logged.
const fixed=new Map([['Scoring Challenge','scoring'],['Scoring Survival','scoring'],['Scoring Ladder','scoring'],['Bull Accuracy','bull'],['Bull Survival','bull'],['Bull Streak','bull'],['Checkout Climb','checkout'],['Focused Checkouts','checkout'],['Big Singles','singles']]);
export function projectExposure(host,day){
 const totals=new Map(),seen=new Set(),ambiguous=new Set();let unclassifiedSeconds=0;
 for(const s of host.sessions){
 if(!s||s.quick!==false||!Array.isArray(s.activities)||typeof s.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!Number.isFinite(Date.parse(s.date))||new Date(s.date).toISOString().slice(0,10)!==s.date||s.date>day||!['number','string'].includes(typeof s.id))continue;
 const id=String(s.id);if(seen.has(id))ambiguous.add(id);seen.add(id);
 }
 seen.clear();
 for(const s of host.sessions){
 if(!s||s.quick!==false||!Array.isArray(s.activities)||typeof s.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!Number.isFinite(Date.parse(s.date))||new Date(s.date).toISOString().slice(0,10)!==s.date||s.date>day||!['number','string'].includes(typeof s.id)||ambiguous.has(String(s.id))||seen.has(String(s.id)))continue;
 seen.add(String(s.id));const ids=new Set();
 for(const a of s.activities){
 if(!a||!Number.isInteger(a.seconds)||a.seconds<=0||a.seconds>3600||!Number.isInteger(a.exerciseIndex)||a.exerciseIndex<0||ids.has(a.exerciseIndex))continue;
 ids.add(a.exerciseIndex);let skill=fixed.get(a.name);
 if(!skill&&['Doubles Survival','Doubles Streak'].includes(a.name)&&a.exerciseId){const rows=host.games.filter(g=>g.sessionId===s.id&&g.exerciseId===a.exerciseId&&g.name===a.name&&g.quick===false&&!g.recovery&&!g.challengeTuning&&g.day===s.date&&g.day<=day&&Number.isFinite(g.at)&&Number.isFinite(a.at)&&Number.isFinite(s.start)&&g.at>=s.start&&g.at<=a.at);if(rows.length&&rows.every(g=>g.variant==='doubles'))skill='doubles'}
 if(!skill){if(!['Warm-up','Review'].includes(a.name))unclassifiedSeconds+=a.seconds;continue}
 const key=JSON.stringify([s.date,skill]);totals.set(key,(totals.get(key)??0)+a.seconds);
 }}
 const exposure=[...totals].map(([k,seconds])=>{const [day,skill]=JSON.parse(k);return {day,skill,minutes:Math.min(600,Math.floor(seconds/60))}}).filter(x=>x.minutes>0);
 return {exposure,unclassifiedSeconds,complete:false};
}
