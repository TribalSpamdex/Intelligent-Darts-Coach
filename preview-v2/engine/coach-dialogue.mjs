// Deliberately bounded language interface. No text can directly mutate player state.
import {query} from './coach-api.mjs';
const req=(type,day,payload={})=>({version:1,type,day,payload});
export const EXAMPLES=['What should I practise?','How am I doing?','What should I investigate next?','Checkout 81 with 2 darts','What do you know about me?'];
export function interpret(text,day){
 if(typeof text!=='string'||!text.trim()||text.length>300)return {kind:'unsupported',reason:'Enter a short supported question.'};
 const s=text.trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[?!.]+$/,'').replace(/\s+/g,' ');
 const clean=s.replace(/\b(one|two|three)\s+darts?\b/g,(_,n)=>({one:1,two:2,three:3}[n])+' darts');
 const remaining=clean.match(/^(?:i (?:have|have got|am on)|i've got|i'm on) (\d{1,4})(?: (?:points )?(?:left|remaining))? (?:and|with) (\d+) darts?(?: (?:in hand|left|remaining))?(?:[.!?;:, ]+(?:what (?:should|do) i (?:throw|aim at|go for)|how (?:should|do) i (?:finish|check out)))?$/);
 if(remaining){const score=Number(remaining[1]),darts=Number(remaining[2]);if(score<2||score>1001||darts<1||darts>3)return {kind:'unsupported',reason:'Enter a remaining score from 2 to 1001 and one, two or three darts in hand.'};return {kind:'query',request:req('checkout',day,{score,darts})}}
 if(/^(what should i (practise|practice)( today)?|build (my |a )?training (plan|session)|training( session)?( [123])?)$/.test(s)){const n=s.match(/ ([123])$/);return {kind:'query',request:req('training',day,{number:n?Number(n[1]):1})}}
 if(/^(what should i investigate next|what should i do next|next actions)$/.test(s))return {kind:'query',request:req('next-actions',day)};
 if(/^(how am i doing|review my performance|analyse my performance|analyze my performance|coaching review|why (am i struggling|this recommendation))$/.test(s))return {kind:'query',request:req('review',day)};
 if(/^(what do you know about me|show (my )?memory|player memory)$/.test(s))return {kind:'query',request:req('memory-summary',day)};
 if(/^(what (?:do|can|could|should) i (?:train|work on|practise|practice)(?: today| next)?|(?:give|make|create|suggest|recommend) me (?:a |my )?(?:practice|practise|training) (?:plan|session|routine)|(?:what is|what's) my (?:practice|training) plan(?: today)?|(?:plan|build) (?:my |a )?(?:practice|practise) (?:session|routine))$/.test(s))return {kind:'query',request:req('training',day,{number:1})};
 if(/^(?:how (?:have i been doing|is my game going|am i progressing)|am i (?:getting better|improving)|(?:review|assess|evaluate) my (?:game|progress|darts)|(?:what is|what's) holding me back)$/.test(s))return {kind:'query',request:req('review',day)};
 if(/^(?:what (?:do|should) i focus on next|where should i focus next|what are my next steps)$/.test(s))return {kind:'query',request:req('next-actions',day)};
 const finish=clean.match(/^(?:checkout|check out|finish|how (?:do i|can i|to) (?:checkout|check out|finish|take out)) (\d{1,4})(?: (?:with|in) ([123]) darts?)?$/);
 if(finish){const score=Number(finish[1]);if(score<2||score>1001)return {kind:'unsupported',reason:'Enter a valid remaining score from 2 to 1001.'};return {kind:'query',request:req('checkout',day,{score,darts:finish[2]?Number(finish[2]):3})}};
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
