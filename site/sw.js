const CACHE='IDC:assets:2.0.0-dev32';
const ASSETS=["./index.html","./engine/clinic.mjs?v=2.0.0-dev","./engine/coach-api.mjs?v=2.0.0-dev","./engine/coach-dialogue.mjs?v=2.0.0-dev","./engine/context.mjs?v=2.0.0-dev","./engine/diagnosis.mjs?v=2.0.0-dev","./engine/engine.mjs?v=2.0.0-dev","./engine/equipment-profile.mjs?v=2.0.0-dev","./engine/executive.mjs?v=2.0.0-dev","./engine/experiments.mjs?v=2.0.0-dev","./engine/explanation.mjs?v=2.0.0-dev","./engine/followup.mjs?v=2.0.0-dev","./engine/goals.mjs?v=2.0.0-dev","./engine/host-adapter.mjs?v=2.0.0-dev","./engine/interventions.mjs?v=2.0.0-dev","./engine/knowledge.mjs?v=2.0.0-dev","./engine/learning.mjs?v=2.0.0-dev","./engine/match.mjs?v=2.0.0-dev","./engine/next-actions.mjs?v=2.0.0-dev","./engine/player-intelligence.mjs?v=2.0.0-dev","./engine/reasoning.mjs?v=2.0.0-dev","./engine/scenarios.mjs?v=2.0.0-dev","./engine/session-intelligence.mjs?v=2.0.0-dev","./engine/state.mjs?v=2.0.0-dev","./engine/strategy.mjs?v=2.0.0-dev","./engine/tactics.mjs?v=2.0.0-dev","./engine/target-analysis.mjs?v=2.0.0-dev","./engine/target-evidence.mjs?v=2.0.0-dev","./engine/training.mjs?v=2.0.0-dev","./engine/verification.mjs?v=2.0.0-dev","./idc.mjs?v=2.0.0-dev","./bridge.mjs?v=2.0.0-dev","./v62-evidence.mjs?v=2.0.0-dev","./coach-memory.mjs?v=2.0.0-dev","./coach-policy.mjs?v=2.0.0-dev","./host-exposure.mjs?v=2.0.0-dev","./host-targets.mjs?v=2.0.0-dev","./game-profile.mjs?v=2.0.0-dev","./integrated-dialogue.mjs?v=2.0.0-dev","./target-checks.mjs?v=2.0.0-dev","./reflections.mjs?v=2.0.0-dev","./context-profile.mjs?v=2.0.0-dev","./longitudinal.mjs?v=2.0.0-dev","./intervention-audit.mjs?v=2.0.0-dev","./contextual-questions.mjs?v=2.0.0-dev","./actual-target-statistics.mjs?v=2.0.0-dev","./context-statistics.mjs?v=2.0.0-dev","./evidence-coverage.mjs?v=2.0.0-dev","./finish-validation.mjs?v=2.0.0-dev","./manual-target-samples.mjs?v=2.0.0-dev","./match-statistics.mjs?v=2.0.0-dev","./practice-statistics.mjs?v=2.0.0-dev","./skill-statistics.mjs?v=2.0.0-dev","./statistics-dialogue.mjs?v=2.0.0-dev","./statistics-view.mjs?v=2.0.0-dev","./statistics.mjs?v=2.0.0-dev","./target-statistics.mjs?v=2.0.0-dev","./visit-statistics.mjs?v=2.0.0-dev","./weekly-statistics.mjs?v=2.0.0-dev","./progression-bands.mjs?v=2.0.0-dev","./progression-evidence.mjs?v=2.0.0-dev","./progression-dialogue.mjs?v=2.0.0-dev","./precision-calibration.mjs?v=2.0.0-dev","./precision-checks.mjs?v=2.0.0-dev","./precision-games.mjs?v=2.0.0-dev","./precision-adapter.mjs?v=2.0.0-dev","./precision-audit.mjs?v=2.0.0-dev","./challenge-setting.mjs?v=2.0.0-dev","./challenge-exposure.mjs?v=2.0.0-dev","./challenge-episodes.mjs?v=2.0.0-dev","./challenge-learning.mjs?v=2.0.0-dev","./training-ledger.mjs?v=2.0.0-dev","./training-outcomes.mjs?v=2.0.0-dev","./match-stages.mjs?v=2.0.0-dev","./development-review.mjs?v=2.0.0-dev","./coaching-intelligence.mjs?v=2.0.0-dev","./tactical-learning.mjs?v=2.0.0-dev","./session-learning.mjs?v=2.0.0-dev","./trial-planning.mjs?v=2.0.0-dev","./performance-forecast.mjs?v=2.0.0-dev","./competition-calendar.mjs?v=2.0.0-dev","./coaching-accountability.mjs?v=2.0.0-dev","./proactive-coach.mjs?v=2.0.0-dev","./personal-programme.mjs?v=2.0.0-dev","./autonomy-dialogue.mjs?v=2.0.0-dev"];
// Module imports have no query string even when their entry point does.
const OFFLINE_ASSETS=[...new Set(ASSETS.flatMap(a=>[a,a.split('?')[0]]))];
// Verify the inventory by exact scoped URL. Do not open a nonexistent cache
// merely to inspect it, and never report a generation ready from its name alone.
function requiredURLs(){return OFFLINE_ASSETS.map(a=>new URL(a,self.registration.scope).href)}
async function inventory(){
 const names=await caches.keys(),expected=requiredURLs();
 if(!names.includes(CACHE))return {generation:CACHE,expected:expected.length,stored:0,missing:expected};
 const cache=await caches.open(CACHE),keys=new Set((await cache.keys()).map(r=>r.url));
 return {generation:CACHE,expected:expected.length,stored:keys.size,missing:expected.filter(url=>!keys.has(url))};
}
async function assertComplete(){
 const state=await inventory();
 if(state.missing.length)throw Error('Incomplete IDC asset generation: '+state.missing.length+' missing');
}
self.addEventListener('install',e=>e.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(requiredURLs().map(url=>new Request(url,{cache:'reload'})));
 await assertComplete();
})()));
// Read-only diagnostic; no profile, identifiers, or external network access.
self.addEventListener('message',e=>{
 if(e.data?.type!=='IDC_ASSET_STATUS'||!e.ports?.[0])return;
 const port=e.ports[0];e.waitUntil(inventory().then(x=>port.postMessage(x),()=>port.postMessage({generation:CACHE,error:'Inventory unavailable'})));
});
// Activation happens only after this generation's complete precache has
// installed. Do not force skipWaiting; old controlled clients can finish.
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 await assertComplete();
 const names=await caches.keys();
 await Promise.all(names.filter(n=>n!==CACHE&&/^IDC:assets:\d+\.\d+\.\d+(?:-dev\d*)?$/.test(n)).map(n=>caches.delete(n)));
 await self.clients.claim();
})()));
// Never fall back to a different network generation for a known runtime asset.
async function installedAsset(url,navigation=false){
 const c=await caches.open(CACHE),hit=await c.match(url);
 if(hit)return hit;
 return new Response(navigation?'IDC offline files are incomplete. Reconnect and update the application before continuing.':'IDC runtime asset missing from the installed generation.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
}
self.addEventListener('fetch',e=>{const u=new URL(e.request.url),scope=new URL(self.registration.scope);if(e.request.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname))return;if(e.request.mode==='navigate'&&(u.pathname===scope.pathname||u.pathname===new URL('./index.html',scope).pathname)){
 // Keep HTML and imports in the same installed generation. A network-first
 // shell would mix new HTML with old cached modules during a waiting upgrade.
 e.respondWith(installedAsset(new URL('./index.html',scope).href,true));return
 }if(!OFFLINE_ASSETS.some(a=>new URL(a,scope).href===u.href))return;e.respondWith(installedAsset(u.href));});
