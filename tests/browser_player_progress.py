"""Independent rendered-control checks with real local persistence, no save stubs."""
import json

def run_player_progress_audit(browser):
    ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    page=ctx.new_page()
    checks=[]
    try:
        page.goto('http://127.0.0.1:8765/index.html')
        page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held' && !!window.IDCPolicy")
        page.evaluate("document.getElementById('quickStartAverage').value='q60';startQuickFromAverage()")
        cases=[
            ('Doubles Survival','survivalDart(true)','survivalDart(false)'),
            ('Doubles Streak','doublesStreakDart(true)','doublesStreakDart(false)'),
            ('Treble Hunt','trebleDart(true)','trebleDart(false)'),
            ('Bull Survival','bullSurvival(true)','bullSurvival(false)'),
            ('Bull Streak','bullStreak(true)','bullStreak(false)'),
            ('Outside Doubles',"newGameDart('double')","newGameDart('outside')"),
            ('Double Double',"newGameDart('hit')","newGameDart('miss')"),
        ]
        for name,hit,miss in cases:
            page.evaluate("""name=>{
              data.activeSession=null;data.game=null;activeGame=null;data.games=[];
              quickChoice=name;document.getElementById('quickDuration').value='300';startQuickPlay();
            }""",name)
            page.locator('#exerciseIntro button[onclick="playExercise()"]').click()
            start=page.evaluate('session().activityStarted')
            thrown=0
            # Two natural successful rounds, using actual visible touch controls.
            while page.evaluate('session().roundsCompleted')<2:
                assert thrown<80,(name,'unbounded hit path')
                page.locator('#gameControls button[onclick='+json.dumps(hit)+']').click()
                thrown+=1
                assert page.locator('#roundFlash').inner_text()=='STREAK '+str(thrown),(name,thrown,page.locator('#miniMetrics').inner_text())
                assert not page.locator('#roundAnnouncement').is_visible(),name
                assert page.evaluate('session().activityStarted')==start,name
            assert 'Hits: '+str(thrown) in page.locator('#miniMetrics').inner_text()
            # Undo the exact terminal dart; then re-enter it and check disk recovery.
            page.locator('#undoButton').click()
            assert page.evaluate('session().roundsCompleted')==1,name
            assert page.locator('#roundFlash').inner_text()=='STREAK '+str(thrown-1),name
            page.locator('#gameControls button[onclick='+json.dumps(hit)+']').click()
            assert page.evaluate('session().roundsCompleted')==2,name
            # A reload must pause, preserve all logs/counters, and retain round Undo.
            page.reload()
            page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held' && !!window.IDCPolicy")
            page.evaluate("show('train')")
            assert page.evaluate('!!session().pausedAt'),name
            page.locator('#pauseButton').click()
            assert page.locator('#roundFlash').inner_text()=='STREAK '+str(thrown),name
            page.locator('#undoButton').click()
            assert page.evaluate('session().roundsCompleted')==1,name
            page.locator('#gameControls button[onclick='+json.dumps(hit)+']').click()
            # A miss breaks the current streak, even when it ends the round.
            page.locator('#gameControls button[onclick='+json.dumps(miss)+']').click()
            assert page.locator('#roundFlash').inner_text()=='STREAK 0',name
            assert 'Best streak: '+str(thrown) in page.locator('#miniMetrics').inner_text(),name
            page.locator('#undoButton').click()
            assert page.locator('#roundFlash').inner_text()=='STREAK '+str(thrown),name
            # Check actual rendered target/control geometry, including the narrow layout.
            geometry=[]
            for width in [320,390,430]:
                page.set_viewport_size({"width":width,"height":844})
                page.evaluate('window.scrollTo(0,0)')
                boxes=page.evaluate("""()=>['gameTarget','gameControls','undoButton'].map(id=>{
                  const b=document.getElementById(id).getBoundingClientRect();return {id,x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom};
                })""")
                for b in boxes:
                    assert b['w']>0 and b['x']>=-1 and b['x']+b['w']<=width+1,(name,width,boxes)
                    assert b['y']>=0 and b['bottom']<=844,(name,width,boxes)
                assert not page.locator('#roundAnnouncement').is_visible()
                geometry.append({"width":width,"boxes":boxes})
            page.set_viewport_size({"width":390,"height":844})
            checks.append({"name":name,"successDarts":thrown,"naturalRounds":2,"reloadUndo":True,"geometry":geometry})
        records=page.evaluate("""()=>{
          const row=clone(data.games[0]),future={...clone(row),sessionId:'future',at:Date.now()+DAY_MS};
          data.games.push(clone(row),future);show('records');
          const cards=document.getElementById('recordGames');
          for(const section of cards.querySelectorAll('details'))section.open=true;
          return {text:cards.innerText,kept:data.games.length,sourceTier:row.tierAtStart};
        }""")
        assert 'Repeated records: 1' in records['text'],records
        assert 'Invalid or future dates excluded: 1' in records['text'],records
        assert 'Tier ' not in records['text'],records
        assert records['kept']==4,records
        home=page.evaluate("""()=>{
          const row={id:'home-audit',start:Date.now()-60000,date:dateKey(),minutes:1,quick:true,completed:true};
          data.sessions=[row,clone(row),{...clone(row),id:'future',start:Date.now()+DAY_MS,date:dateKey(Date.now()+DAY_MS)}];
          show('home');return document.getElementById('homeHighlights').innerText;
        }""")
        assert home.count('1\n')>=2,home
        assert '3\nSessions' not in home,home
        print('Independent rendered Home totals: '+json.dumps(home))
        print('Independent rendered record presentation: '+json.dumps(records))
        print('Independent rendered player-progress audit: '+json.dumps(checks))
    finally:
        ctx.close()
