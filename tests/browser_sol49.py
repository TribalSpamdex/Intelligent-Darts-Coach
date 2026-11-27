"""Independent save/Undo/reload/render checks for supported Quick Play evidence."""
import json

def run_sol49_audit(browser):
    ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    try:
        page=ctx.new_page()
        page.goto('http://127.0.0.1:8765/index.html')
        if page.locator('#idcWalkthrough').is_visible(): page.locator('#idcWalkthroughSkip').click()
        page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held' && !!window.IDCPrecision")
        result=page.evaluate("""async()=>{
          const names=['Scoring Challenge','Scoring Survival','Scoring Ladder','Treble Hunt','Doubles Survival','Doubles Streak','Staying Straight','Checkout Climb','Focused Checkouts','Bull Accuracy','Bull Survival','Bull Streak','Outside Doubles','Double Double','Dartboard Bingo','Target Mastery','Bull Bank','Bull Blackjack','First Nine Siege','Setup Shot','Risk or Reward','High-Low','Split the Difference','Double Duel','301 Pressure','501 Pressure','170 Challenge'];
          const out=[];document.getElementById('quickStartAverage').value='q100';startQuickFromAverage();
          for(const name of names){
           data.activeSession=null;data.game=null;activeGame=null;undoSnapshot=null;data.games=[];data.sessions=[];
           data.assessment.finished=true;data.assessment.quickStart=true;data.assessment.completedAt=Date.now()-DAY_MS;
           for(const k of SKILLS)data.skills[k].level=4;
           quickChoice=name;dc23QuickMode='bull';document.getElementById('quickDuration').value='300';startQuickPlay();playExercise();
           let actions=0;
           const action=()=>{
            if(['Scoring Challenge','Scoring Survival','Scoring Ladder','First Nine Siege','Setup Shot','Risk or Reward','High-Low','Split the Difference','301 Pressure','501 Pressure','170 Challenge'].includes(name)){document.getElementById('scoreInput').value=name==='Scoring Challenge'?'60':actions<2?'180':'0';if(name==='Scoring Challenge')recordScore();else if(['High-Low','Split the Difference'].includes(name))new40Score();else scoringVisit();}
            else if(name==='Bull Bank')bullBankDart(actions<2?25:0);
            else if(name==='Bull Blackjack')new40Dart(actions<2?25:0);
            else if(name==='Double Duel')new40Dart(actions<2?'hit':'miss');
            else if(name==='Target Mastery')dc23MasteryInput(actions<6?'50':actions<10?'25':'miss');
            else if(name==='Treble Hunt')trebleDart(false);
            else if(name==='Doubles Survival')survivalDart(false);
            else if(name==='Doubles Streak')doublesStreakDart(false);
            else if(name==='Staying Straight')straightDart(0);
            else if(name==='Checkout Climb')checkoutMiss();
            else if(name==='Focused Checkouts')focusedMiss();
            else if(name==='Bull Accuracy')bullDart(actions<6?50:actions<10?25:0);
            else if(name==='Bull Survival')bullSurvival(false);
            else if(name==='Bull Streak')bullStreak(false);
            else if(name==='Outside Doubles')newGameDart('outside');
            else if(name==='Double Double')newGameDart('miss');
            else if(name==='Dartboard Bingo')new40Dart('miss');
           };
           while(!data.games.length&&actions<1000){action();actions++}
           if(data.games.length!==1)throw Error(name+' did not finish');
           const before=window.IDCTrainingBridge.snapshot();
           const nativeRows=dc24MasteryRows().length;
           const module=await import('./v62-evidence.mjs?v=2.0.0-dev');
           if(module.masteryRows(before).length!==nativeRows)throw Error(name+' active bridge disagrees');
           const cards=window.IDCPrecision.quickMeasurementCards(before,dateKey());
           if(name!=='Target Mastery'&&!cards.length)throw Error(name+' omitted saved measurements');
           undoGame();
           if(data.games.length||window.IDCPrecision.quickMeasurementCards(window.IDCTrainingBridge.snapshot(),dateKey()).length||dc24MasteryRows().length)throw Error(name+' Undo retained evidence');
           actions--;action();finishSession(false);show('progress');
           if(!document.getElementById('dc23MasteryProgress').innerText.includes('Quick Play'))throw Error(name+' missing visible source');
           if(data.sessions.some(s=>s.quick!==true))throw Error(name+' fabricated training attendance');
           out.push({name,actions,cards:cards.length,nativeRows,hits:module.masteryRows(before).reduce((n,r)=>n+r.hit,0),visible:document.getElementById('dc23MasteryProgress').innerText.slice(0,350)});
          }
          return out;
        }""")
        assert len(result)==27,result
        page.reload()
        page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held' && !!window.IDCPrecision")
        page.locator('#navProgress').click()
        assert 'Other Quick Play measurements' in page.locator('#dc23MasteryProgress').inner_text()
        for width in [320,390,430]:
            page.set_viewport_size({"width":width,"height":844})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
        print('SOL49 independent Quick Play real save, Undo, reload, Progress and active bridge:',json.dumps(result))
    finally:
        ctx.close()
