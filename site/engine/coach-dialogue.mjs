// Deliberately bounded language interface. No text can directly mutate player state.
import {query} from './coach-api.mjs';
const req=(type,day,payload={})=>({version:1,type,day,payload});
export const EXAMPLES=['What should I practise?','How am I doing?','What should I investigate next?','Checkout 81 with 2 darts','What do you know about me?'];
export function interpret(text,day){
 if(typeof text!=='string'||!text.trim()||text.length>300)return {kind:'unsupported',reason:'Enter a short supported question.'};
 const s=text.trim().toLowerCase().replace(/[?!.]+$/,'').replace(/\s+/g,' ');
 if(/^(what should i (practise|practice)( today)?|build (my |a )?training (plan|session)|training( session)?( [123])?)$/.test(s)){const n=s.match(/ ([123])$/);return {kind:'query',request:req('training',day,{number:n?Number(n[1]):1})}}
 if(/^(what should i investigate next|what should i do next|next actions)$/.test(s))return {kind:'query',request:req('next-actions',day)};
 if(/^(how am i doing|review my performance|analyse my performance|analyze my performance|coaching review|why (am i struggling|this recommendation))$/.test(s))return {kind:'query',request:req('review',day)};
 if(/^(what do you know about me|show (my )?memory|player memory)$/.test(s))return {kind:'query',request:req('memory-summary',day)};
 const finish=s.match(/^(?:checkout|finish|how (?:do i|to) (?:checkout|finish)) (\d{1,4})(?: with ([123]) darts?)?$/);
 if(finish)return {kind:'query',request:req('checkout',day,{score:Number(finish[1]),darts:finish[2]?Number(finish[2]):3})};
 return {kind:'unsupported',reason:'I cannot reliably interpret that question yet. Use a supported question or the structured evidence forms. I have not changed your player data.'};
}
export function ask(memory,text,day){
 const intent=interpret(text,day);
 if(intent.kind!=='query')return intent;
 const response=query(memory,intent.request),r=response.result,lines=[];
 if(response.type==='next-actions'){if(!r.length)lines.push('No new action is due. Maintain the current appropriate plan.');for(const a of r)lines.push(a.title+' — '+a.why)}
 if(response.type==='review'){lines.push(r.reason);if(r.wellbeing)lines.push(r.wellbeing);for(const i of r.issues.slice(0,3))lines.push(i.title+': '+i.summary+' '+i.followUp);if(r.nextQuestion)lines.push('Next question: '+r.nextQuestion.text)}
 if(response.type==='training'){if(!r.segments.length)lines.push(r.reason??'No session available.');else{lines.push('Suggested session: '+r.segments.reduce((n,g)=>n+g.minutes,0)+' minutes.');for(const g of r.segments)lines.push(g.minutes+' min — '+g.name+': '+g.instructions)}}
 if(response.type==='checkout'){lines.push(r.guidance);for(const o of r.options.slice(0,5))lines.push(o.path.join(' → '));if(r.status==='setup-required')lines.push('Consider a legal setup rather than attempting a nonexistent finish.')}
 if(response.type==='memory-summary'){lines.push(r.observations+' recorded performance results, '+r.legs+' legs, '+r.sessions+' sessions.');for(const f of r.facts)lines.push(f.key+': '+f.value+' ('+f.kind+')')}
 return {kind:'answer',type:response.type,lines,request:intent.request,verification:r.verification??null};
}
