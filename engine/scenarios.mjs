import {emptyMemory,addObservation} from './engine.mjs';
import {recordReadiness} from './context.mjs';
import {recordAnswer,recordChange} from './diagnosis.mjs';
import {recordClinic} from './clinic.mjs';
export const SCENARIOS=[['decline','Doubles decline with improving scoring'],['stable','Stable performance with normal variation'],['fatigue','Decline associated with fatigue'],['equipment','Recent equipment change'],['measurement','Incomparable benchmark conditions'],['sparse','Insufficient observations'],['pressure','Competition-only decline'],['pain','Pain takes priority'],['exposure','Reduced doubles practice with complete logging']];
export const EXECUTIVE_SCENARIOS=[['multi','Two simultaneous weaknesses'],['technical','Repeated release observation'],['unknown','Uncertain investigation answer']];
const date=i=>'2026-01-'+String(i+1).padStart(2,'0');
export function scenario(id){
 if(![...SCENARIOS,...EXECUTIVE_SCENARIOS].some(x=>x[0]===id))throw Error('Unknown simulation');
 let m=emptyMemory();const ctx=id==='pressure'?'competition':'practice',n=id==='sparse'?3:14;
 for(let i=0;i<n;i++){
 const day=date(i),h=id==='stable'?28+i%3:id==='fatigue'?(i<7?30:12):i<7?30:12;
 m=addObservation(m,{id:'demo-d'+i,day,skill:'doubles',context:ctx,protocol:'Fixed D1–D20',attempts:60,hits:h});
 m=addObservation(m,{id:'demo-s'+i,day,skill:'scoring',context:'practice',protocol:'60 darts at 20',attempts:60,hits:i<7?1000:1250});
 m.exposure.push({day,skill:'scoring',minutes:40},{day,skill:'doubles',minutes:id==='exposure'?(i<7?20:5):5});
 if(id==='fatigue')m=recordReadiness(m,{day,context:ctx,fatigue:i<7?'normal':'high',pressure:'normal',confidence:'normal',pain:false,note:''});
 }
 const answer=(question,answer)=>{m=recordAnswer(m,{day:'2026-01-15',skill:'doubles',context:ctx,protocol:'Fixed D1–D20',question,answer})};
 if(id==='fatigue')answer('fatigue','yes');
 if(id==='equipment'){answer('equipment','yes');m=recordChange(m,{id:'demo-change',day:'2026-01-07',field:'equipment',description:'Changed stem length'})}
 if(id==='measurement')answer('protocol','no');
 if(id==='pain')answer('comfort','yes');
 if(id==='exposure')answer('logging','yes');
 if(id==='multi')for(let i=0;i<14;i++)m=addObservation(m,{id:'demo-c'+i,day:date(i),skill:'checkout',context:'practice',protocol:'Fixed checkout benchmark',attempts:60,hits:i<7?30:12});
 if(id==='technical')for(const [i,day] of ['2026-01-12','2026-01-13'].entries())m=recordClinic(m,{id:'demo-technical-'+i,day,skill:'doubles',context:'practice',protocol:'Fixed D1–D20',domain:'release',observation:'repeated difference',condition:'normal practice',method:'video review',pain:false,note:'Observed release difference; cause unknown.'});
 if(id==='unknown')answer('comfort','unknown');
 return {memory:m,day:'2026-01-15',id};
}
