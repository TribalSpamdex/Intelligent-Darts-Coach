"""Additional successful and adverse paths in the new input-trace adapters."""
import json

def run_sol50_audit(browser):
    ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    try:
        page=ctx.new_page()
        page.goto('http://127.0.0.1:8765/index.html')
        if page.locator('#idcWalkthrough').is_visible(): page.locator('#idcWalkthroughSkip').click()
        page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held' && !!window.IDCPrecision")
        results=page.evaluate("""async()=>{
          const {extraQuickRounds,projectEvidence}=await import('./v62-evidence.mjs?v=2.0.0-dev');
          const {projectTargets}=await import('./host-targets.mjs?v=2.0.0-dev');
          const {gameProfile}=await import('./game-profile.mjs?v=2.0.0-dev');
          const out=[];document.getElementById('quickStartAverage').value='q100';startQuickFromAverage();
          const start=(name,tier=4)=>{
           data.activeSession=null;data.game=null;activeGame=null;undoSnapshot=null;data.games=[];data.sessions=[];
           data.assessment.finished=true;data.assessment.quickStart=true;data.assessment.completedAt=Date.now()-DAY_MS;
           for(const k of SKILLS)data.skills[k].level=tier;
           quickChoice=name;document.getElementById('quickDuration').value='300';startQuickPlay();playExercise();
          };
          const read=()=>extraQuickRounds(window.IDCTrainingBridge.snapshot(),dateKey());
          const check=(name,fn)=>{
           const rows=read();if(rows.length!==1)throw Error(name+' missing validated row '+JSON.stringify(data.games[0]));
           const r=rows[0];if(!fn(r))throw Error(name+' unexpected measurements '+JSON.stringify(r));
           const snap=window.IDCTrainingBridge.snapshot();
           if(projectEvidence(snap,{today:dateKey()}).observations.some(o=>o.protocol.includes(name)))throw Error(name+' promoted into fixed benchmark');
           finishSession(false);show('progress');
           const cards=window.IDCPrecision.quickMeasurementCards(window.IDCTrainingBridge.snapshot(),dateKey());
           if(!cards.some(c=>c.key.includes(name)))throw Error(name+' missing cards');
           out.push({name,metrics:r.metrics,targets:r.targets,finishes:r.finishes});
          };
          // Real opening confirmation, one bust and a shortened legal finish.
          start('Double-In 201');
          padSet('80');dc591OpeningSubmit();dc591Select(20,1);dc591Confirm();
          padSet('180');doubleInVisit(); // bust with three credited zero darts
          padSet('81');doubleInVisit(); // leaves 40
          finishDoubleInVisit(40,1);
          check('Double-In 201',r=>r.metrics.some(m=>m.label.includes('opening double')&&m.hits===1&&m.attempts===1)&&r.metrics.some(m=>m.scoring&&m.hits===201&&m.attempts===10));
          start('101 Sprint');
          // A two-dart 101 is legal; the native picker supplies actual darts.
          sprintWin();chooseCheckoutDarts(2);confirmCheckoutDarts();
          check('101 Sprint',r=>r.metrics.some(m=>m.unit==='rounds'&&m.hits===1&&m.attempts===1));
          start('Checkout Poker');
          const first=activeGame.cards[0];new40Choice(first);new40Dart('miss');
          new40Choice(first);new40Dart('hit',3);
          const second=activeGame.cards.find(n=>n!==first);new40Choice(second);new40Dart('hit',3);
          check('Checkout Poker',r=>r.finishes.length===3&&r.finishes.filter(x=>x.success).length===2&&r.finishes.filter(x=>!x.success)[0].used===3);
          start('Last Dart Rescue',4);
          while(!data.games.length){const n=activeGame.targets[activeGame.index],correct=n===50?'BULL':'D'+n/2;rescueAim(correct==='D20'?'D16':'D20')}
          check('Last Dart Rescue',r=>r.metrics.some(m=>m.unit==='decisions'&&m.hits===0)&&r.targets.length===0);
          start('Shanghai Combo',7);
          shanghaiDart(true);shanghaiDart(false);
          undoGame();if(activeGame.skillTrace.length!==1)throw Error('mid-round Undo retained a dart');
          shanghaiDart(true);shanghaiDart(true);
          check('Shanghai Combo',r=>r.targets.length===3&&r.targets.every(t=>t.target.startsWith('S')&&t.hits===1));
          start('Number Lock');
          const pool=activeGame.targets.slice();numberLockDart(pool[0]);numberLockDart(0);numberLockDart(pool[1]);numberLockDart(pool[2]);
          check('Number Lock',r=>r.targets.length===0&&r.metrics.some(m=>m.hits===3&&m.attempts===4));
          return out;
        }""")
        assert len(results)==6,results
        print('SOL50 successful and adverse Quick Play trace paths:',json.dumps(results))
    finally:
        ctx.close()
