import os, json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=getattr(p,os.getenv('IDC_BROWSER','chromium')).launch()
    ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script("""if(!localStorage.getItem('dartsCoachV4'))localStorage.setItem('dartsCoachV4','CONTROL-SENTINEL');if(!localStorage.getItem('DCI-independent:foundation:v1'))localStorage.setItem('DCI-independent:foundation:v1','INDEPENDENT-SENTINEL');""")
    page.goto('http://127.0.0.1:8765/index.html')
    assert 'V1.7.0-dev' in page.title()
    assert page.locator('#home').is_visible()
    assert not page.locator('#idcCoach').is_visible()
    assert page.locator('.homeWelcome').is_visible()
    page.locator('#headerInfo').click()
    assert page.locator('#welcomeOverlay').is_visible()
    page.locator('#welcomeOverlay button').click()
    assert not page.locator('#welcomeOverlay').is_visible()
    assert 'Coach' in page.locator('#navTechnique').inner_text()
    page.locator('#navTechnique').click()
    assert page.locator('#idcCoach').is_visible()
    assert page.locator('.techniqueHero').is_visible()
    page.locator('#idcReview').click()
    assert 'Decision: balanced' in page.locator('#idcReport').inner_text()
    assert 'Eligible measurements: 0' in page.locator('#idcReport').inner_text()
    page.locator('#idcExample').click()
    assert 'SIMULATION ONLY' in page.locator('#idcReport').inner_text()
    assert 'temporary-focus' in page.locator('#idcReport').inner_text()
    page.locator('#idcQuestion').fill('Checkout 81 with 2 darts')
    page.locator('#idcAsk').click()
    assert 'legal finish' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcReview').click()
    assert 'Eligible measurements: 0' in page.locator('#idcReport').inner_text()
    assert page.evaluate("localStorage.getItem('dartsCoachV4')")=='CONTROL-SENTINEL'
    assert page.evaluate("localStorage.getItem('DCI-independent:foundation:v1')")=='INDEPENDENT-SENTINEL'
    for tab in ['train','quick','progress','records','technique','settings','home']:
        page.evaluate("show("+json.dumps(tab)+")")
        assert page.locator('#'+tab).is_visible()
    page.locator('#navTechnique').click()
    page.locator('#idcMemoryPanel > summary').click()
    for width in [320,390,430]:
        page.set_viewport_size({"width":width,"height":844})
        fact=page.locator('#idcFact input[name=key]').bounding_box()
        value=page.locator('#idcFact input[name=value]').bounding_box()
        save=page.locator('#idcFact button').bounding_box()
        assert fact['y']+fact['height']<=value['y']
        assert value['y']+value['height']<=save['y']
        assert fact['x']+fact['width']<=width+1 and value['x']+value['width']<=width+1
        assert fact['height']>=44 and value['height']>=44
    page.set_viewport_size({"width":390,"height":844})
    page.locator('#idcFact input[name=key]').fill('Preferred double')
    page.locator('#idcFact input[name=value]').fill('D16')
    page.locator('#idcFact button').click()
    assert 'preferred double: D16' in page.locator('#idcMemoryHistory').inner_text()
    assert 'Saved: preferred double' in page.locator('#idcFactStatus').inner_text()
    page.reload()
    assert page.locator('#home').is_visible()
    page.locator('#navTechnique').click()
    page.locator('#idcMemoryPanel > summary').click()
    assert 'preferred double: D16' in page.locator('#idcMemoryHistory').inner_text()
    page.locator('#idcQuestion').fill('What do you know about me?')
    page.locator('#idcAsk').click()
    assert 'D16' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcQuestion').fill('Compare D16 and D20')
    page.locator('#idcAsk').click()
    assert 'Insufficient comparable evidence' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcQuestion').fill('How consistent is my scoring?')
    page.locator('#idcAsk').click()
    assert 'No eligible completed' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcQuestion').fill('What are my goals?')
    page.locator('#idcAsk').click()
    assert 'No active measurable goals' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcPair').evaluate("(e)=>{e.closest('details').open=true;e.closest('details').parentElement.closest('details').open=true}")
    page.locator('#idcPair input[name=firstHits]').fill('7')
    page.locator('#idcPair input[name=secondHits]').fill('3')
    page.locator('#idcPair input[name=comparable]').check()
    page.locator('#idcPair button').click()
    assert '1 saved checks' in page.locator('#idcPairHistory').inner_text()
    assert page.evaluate('window.IDCTrainingBridge.memory().targetChecks.length')==1
    page.locator('#idcQuestion').fill('Compare D16 and D20')
    page.locator('#idcAsk').click()
    assert 'Insufficient comparable evidence' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcReady input[name=pain]').check()
    page.locator('#idcReady button').click()
    page.locator('#idcReview').click()
    assert 'Decision: stop' in page.locator('#idcReport').inner_text()
    assert page.evaluate('window.IDCPolicy.mayStart()') is False
    page.locator('#idcReady input[name=pain]').uncheck()
    page.locator('#idcReady button').click()
    assert page.evaluate('window.IDCPolicy.mayStart()') is True
    page.locator('#idcSetup input[name=name]').fill('Test setup')
    page.locator("#idcSetup input[name='setup:weight']").fill('24g')
    page.locator('#idcSetup button').click()
    assert 'Test setup' in page.locator('#idcMemoryHistory').inner_text()
    assert page.evaluate('JSON.parse(JSON.stringify(window.IDCTrainingBridge.memory())).state.setups.length')==1
    assert page.evaluate("localStorage.getItem('dartsCoachV4')")=='CONTROL-SENTINEL'
    assert page.evaluate("localStorage.getItem('DCI-independent:foundation:v1')")=='INDEPENDENT-SENTINEL'
    # Exercise real host transitions with synthetic browser-only training.
    assert page.evaluate("[...document.getElementById('quickStartAverage').options].filter(o=>!o.hidden).length")==65
    assert page.evaluate("[...document.getElementById('recalibrateAverage').options].filter(o=>!o.hidden).length")==65
    page.evaluate("document.getElementById('quickStartAverage').value='q60';startQuickFromAverage();show('train')")
    assert page.evaluate("window.IDCTrainingBridge.snapshot().assessment.profile.selfReportedAverage")==61.25
    assert page.evaluate("dc3MatchAllowance(501)")==30
    assert page.locator('#idcPreCheck').is_visible()
    page.locator('#idcPreCheck summary').click()
    page.locator('#idcPreOptions button').first.click()
    assert 'Readiness saved' in page.locator('#idcPreStatus').inner_text()
    page.evaluate("beginTraining(true,true)")
    assert page.evaluate("!!session()")
    page.evaluate("playExercise()")
    assert not page.locator('#idcExerciseCheck').is_visible()
    page.evaluate("completeExercise('manual')")
    assert page.locator('#idcExerciseCheck').is_visible()
    assert page.evaluate("session().phase")=='complete'
    assert page.evaluate("!!session().pausedAt")
    page.locator('#idcExerciseCheck textarea').fill('Synthetic test note')
    page.locator('#idcExerciseCheck button').filter(has_text='Timing or release').click()
    assert 'Saved:' in page.locator('#idcExerciseCheck').inner_text()
    assert page.evaluate("window.IDCTrainingBridge.memory().reflections.length")==1
    page.locator('#nextExerciseButton').click()
    assert not page.locator('#idcExerciseCheck').is_visible()
    page.evaluate("finishSession(false)")
    assert page.locator('#idcSessionCheck').is_visible()
    assert 'You noted' in page.locator('#idcSessionCheck').inner_text()
    page.locator('#idcSessionCheck button').filter(has_text='Skip check-in').click()
    assert 'Check-in skipped' in page.locator('#idcSessionCheck').inner_text()
    assert page.evaluate("window.IDCTrainingBridge.memory().reflections.length")==2
    page.evaluate("finishView()")
    page.locator('#navTechnique').click()
    page.locator('#idcQuestion').fill('How did my practice feel?')
    page.locator('#idcAsk').click()
    assert '1 recent player-reported reflections' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcQuestion').fill('How have I progressed this year?')
    page.locator('#idcAsk').click()
    assert 'No comparable measurements recorded yet' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcQuestion').fill('What happened to my interventions?')
    page.locator('#idcAsk').click()
    assert 'No accepted intervention history recorded' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcQuestion').fill('Does fatigue affect my darts?')
    page.locator('#idcAsk').click()
    page.wait_for_timeout(300)
    assert 'No comparable performance and readiness history' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcQuestion').fill('What have we observed about my technique?')
    page.locator('#idcAsk').click()
    page.wait_for_timeout(300)
    assert 'No recent structured technical observations' in page.locator('#idcAnswer').inner_text()
    # Actual evidence is optional, previewed, confirmed and stored separately.
    page.on('dialog',lambda d:d.accept())
    page.locator('#idcSamplePanel').evaluate('(e)=>e.open=true')
    page.locator('#idcSampleAim').select_option('D16')
    page.locator('#idcSampleForm textarea').fill('D16 S16')
    page.locator('#idcSampleForm button').click()
    assert 'exactly 20' in page.locator('#idcSamplePreview').inner_text()
    page.locator('#idcSampleForm textarea').fill(' '.join(['D16']*8+['S16']*12))
    page.locator('#idcSampleForm button').click()
    assert '8/20 exact hits' in page.locator('#idcSamplePreview').inner_text()
    page.locator('#idcSamplePreview button').click()
    assert 'Sample saved locally' in page.locator('#idcSamplePreview').inner_text()
    assert page.evaluate('window.IDCTrainingBridge.memory().state.throws.length')==20
    page.locator('#idcLegPanel').evaluate('(e)=>e.open=true')
    page.locator('#idcLegForm select[name=start]').select_option('101')
    page.locator('#idcLegForm select[name=context]').select_option('competition')
    page.locator('#idcLegForm textarea').fill('T20 S1 D20')
    page.locator('#idcLegForm button').click()
    assert '101.0 average' in page.locator('#idcLegPreview').inner_text()
    page.locator('#idcLegPreview button').click()
    assert 'Leg saved locally' in page.locator('#idcLegPreview').inner_text()
    assert page.evaluate('window.IDCTrainingBridge.memory().state.legs.length')==1
    page.locator('#idcStatsPanel').evaluate('(e)=>e.open=true')
    page.locator('#idcStatsType').select_option('Detailed target statistics')
    page.locator('#idcStatsFilter').fill('D16')
    page.locator('#idcStatsPeriod').select_option('28')
    page.locator('#idcStatsReview').click()
    assert 'Manual fixed 20-dart target sample' in page.locator('#idcStatsResult').inner_text()
    assert '40.0%' in page.locator('#idcStatsResult').inner_text()
    page.locator('#idcStatsType').select_option('Actual match statistics')
    page.locator('#idcStatsReview').click()
    assert '101.0' in page.locator('#idcStatsResult').inner_text()
    assert 'competition' in page.locator('#idcStatsResult').inner_text()
    for width in [320,390,430]:
        page.set_viewport_size({"width":width,"height":844})
        card=page.locator('#idcStatsResult .idc-stat-card').first.bounding_box()
        assert card['x']+card['width']<=width+1
    page.set_viewport_size({"width":390,"height":844})
    page.reload()
    page.locator('#navTechnique').click()
    assert page.evaluate('window.IDCTrainingBridge.memory().state.legs.length')==1
    assert page.evaluate('window.IDCTrainingBridge.memory().state.throws.length')==20
    page.evaluate("navigator.serviceWorker.ready")
    page.wait_for_function("navigator.serviceWorker.controller!==null")
    if os.getenv('IDC_BROWSER','chromium')=='chromium':
        assert page.evaluate("""async()=>{const c=await caches.open('IDC:assets:1.7.0-dev1');return !!(await c.match('./context-profile.mjs?v=1.7.0-dev'))&&!!(await c.match('./context-profile.mjs'))&&!!(await c.match('./longitudinal.mjs'))&&!!(await c.match('./engine/context.mjs'))&&!!(await c.match('./contextual-questions.mjs'))&&!!(await c.match('./statistics-view.mjs?v=1.7.0-dev'))&&!!(await c.match('./manual-target-samples.mjs?v=1.7.0-dev'))&&!!(await c.match('./progression-evidence.mjs?v=1.7.0-dev'))&&!!(await c.match('./precision-games.mjs?v=1.7.0-dev'))&&!!(await c.match('./challenge-learning.mjs?v=1.7.0-dev'))&&!!(await c.match('./challenge-exposure.mjs?v=1.7.0-dev'))}""")
        ctx.set_offline(True)
        page.reload()
        page.locator('#navTechnique').click()
        page.locator('#idcExample').click()
        assert 'temporary-focus' in page.locator('#idcReport').inner_text()
        page.locator('#idcQuestion').fill('How have I progressed this year?')
        page.locator('#idcAsk').click()
        assert 'No comparable measurements recorded yet' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcStatsPanel').evaluate('(e)=>e.open=true')
    page.locator('#idcStatsType').select_option('Actual match statistics')
    page.locator('#idcStatsReview').click()
    assert '101.0' in page.locator('#idcStatsResult').inner_text()
    page.locator('#idcLegPanel').evaluate('(e)=>e.open=true')
    page.locator('#idcLegHistory button').click()
    assert page.evaluate('window.IDCTrainingBridge.memory().state.legs.length')==0
    page.locator('#idcSamplePanel').evaluate('(e)=>e.open=true')
    page.locator('#idcSampleHistory button').click()
    assert page.evaluate('window.IDCTrainingBridge.memory().state.throws.length')==0
    # Optional measured checks and progression are real local features, including offline.
    page.locator('#idcPrecisionCheckPanel').evaluate('(e)=>e.open=true')
    page.locator('#idcPrecisionCheckSkill').select_option('scoring')
    page.locator('#idcPrecisionCheckForm input[name=hits]').fill('648')
    page.locator('#idcPrecisionCheckForm input[name=complete]').check()
    page.locator('#idcPrecisionCheckForm button').click()
    assert '64.8 three-dart average' in page.locator('#idcPrecisionCheckStatus').inner_text()
    assert page.evaluate("window.IDCTrainingBridge.memory().state.observations.filter(o=>o.protocol==='IDC precision fixed scoring').length")==1
    page.locator('#idcProgressionPanel').evaluate('(e)=>e.open=true')
    page.locator('#idcMilestoneReview').click()
    assert '64.8' in page.locator('#idcMilestoneResult').inner_text()
    assert 'Awaiting evidence' in page.locator('#idcMilestoneResult').inner_text()
    page.reload()
    page.locator('#navTechnique').click()
    assert page.evaluate("window.IDCTrainingBridge.memory().state.observations.filter(o=>o.protocol==='IDC precision fixed scoring').length")==1
    page.locator('#idcPrecisionCheckPanel').evaluate('(e)=>e.open=true')
    page.locator('#idcPrecisionCheckHistory button').click()
    assert page.evaluate("window.IDCTrainingBridge.memory().state.observations.length")==0
    page.locator('#idcProgressionPanel').evaluate('(e)=>e.open=true')
    page.locator('#idcLearningReview').click()
    assert 'Not enough comparable records' in page.locator('#idcLearningResult').inner_text()
    page.locator('#idcQuestion').fill('Which difficulty helps me improve?')
    page.locator('#idcAsk').click()
    assert 'Not enough comparable records' in page.locator('#idcAnswer').inner_text()
    page.evaluate("show('progress')")
    assert 'Keep recording' in page.locator('#idcProgressHighlights').inner_text()
    # Synthetic native construction audit: same rule-builder used by timed training.
    audit=page.evaluate("""async()=>{
      const original=clone(data),oldGame=activeGame,oldUndo=undoSnapshot,oldTab=currentTab;
      try{
       const mod=await import('./precision-games.mjs?v=1.7.0-dev'),learn=await import('./challenge-setting.mjs?v=1.7.0-dev');
       const day=n=>dateKey(Date.now()-n*DAY_MS),now=Date.now();
       data.assessment.completedAt=now-35*DAY_MS;
       data.idcCoachMemory.state.observations=[];
       for(const n of [0,1,7,8,14,15,21,22])for(const [skill,attempts,hits] of [['scoring',30,1500],['doubles',60,60],['checkout',12,12],['bull',30,30],['singles',60,60],['trebles',60,30]])
        data.idcCoachMemory.state.observations.push({id:'IDC:precision-check:'+skill+':'+day(n),day:day(n),skill,context:'practice',protocol:'IDC precision fixed '+skill,attempts,hits});
       data.games=[];data.activeSession={id:now,start:now,extra:false,quick:false,index:0,phase:'rules',pausedAt:now,plan:[{name:'Scoring Survival',seconds:600,mode:'timed'}],round:1,completed:[]};
       const results=[],names=mod.SUPPORTED_GAMES;let captured=0;
       for(let tier=1;tier<=7;tier++){
        for(const k of SKILLS)data.skills[k].level=tier;
        for(const name of names){
         data.activeSession.plan=[{name,seconds:600,mode:'timed'}];
         window.IDCPrecision.invalidate();
         const g=buildGame(name);
         if(g.learningSetting){const e=gameResult(g,'natural');if(!learn.validSetting(e.learningSetting)||JSON.stringify(g.learningSetting)!==JSON.stringify(e.learningSetting))throw Error('Learning metadata missing or invalid '+name);captured++;}
         if(g.precision){
          const e=gameResult(g,'natural');
          if(!mod.validPrecisionRecord(e)||e.benchmark!==false||e.prospectiveForecast!==null)throw Error('Incorrect saved precision rule '+name+' tier '+tier);
          results.push({name,tier,modified:true});
         }else results.push({name,tier,modified:false});
        }
       }
       for(const k of SKILLS)data.skills[k].level=4;
       data.activeSession.plan=[{name:'Scoring Survival',seconds:600,mode:'timed'}];
       window.IDCPrecision.invalidate();const g=buildGame('Scoring Survival');
       if(g.target!==68||g.precision?.quarter!==3)throw Error('Actual round did not use confirmed quarter');
       if(g.learningSetting?.before!==60||g.learningSetting?.after!==68||g.learningSetting?.quarter!==3)throw Error('Native learning configuration not captured');
       const observed=[];for(const [value,target,quarter] of [[61,60,0],[66,62,1],[70,65,2],[75,68,3]]){for(const o of data.idcCoachMemory.state.observations)if(o.skill==='scoring')o.hits=value*10;window.IDCPrecision.invalidate();const v=buildGame('Scoring Survival');if(v.target!==target||(v.precision?.quarter??0)!==quarter||v.learningSetting?.after!==target||v.learningSetting?.quarter!==quarter)throw Error('Real scoring quarter '+quarter+' expected '+target+' got '+v.target);observed.push(v.target)}
       const e=gameResult(g,'natural');data.games=[e];
       if(skillSamples().scoring.length!==0||completedRows('scoring').length!==0)throw Error('Modified round polluted benchmark evidence');
       data.activeSession.quick=true;const q=buildGame('Scoring Survival');if(q.precision||q.learningSetting)throw Error('Quick Play altered or counted as learning exposure');
       data.activeSession.quick=false;data.activeSession.plan=[{name:'Double Duel',seconds:600,mode:'timed'}];data.activeSession.phase='playing';data.activeSession.pausedAt=null;currentTab='technique';window.IDCPrecision.invalidate();activeGame=buildGame('Double Duel');data.game=activeGame;
       if(activeGame.opponentEvery!==2||!activeGame.precision)throw Error('Rival pace not adjusted');
       new40Dart('miss');if(activeGame.opponent!==0||activeGame.turn!==1)throw Error('Rival scored early');
       new40Dart('miss');if(activeGame.opponent!==1||activeGame.turn!==2)throw Error('Rival did not use calibrated pace');
       undoGame();if(activeGame.opponent!==0||activeGame.turn!==1||activeGame.opponentEvery!==2)throw Error('Undo did not restore frozen rival configuration');
       return {captured,observed,tested:results.length,modified:results.filter(x=>x.modified).length,names:new Set(results.filter(x=>x.modified).map(x=>x.name)).size};
      }finally{data=original;activeGame=oldGame;undoSnapshot=oldUndo;currentTab=oldTab;window.IDCPrecision.invalidate();save(false)}
    }""")
    assert audit['observed']==[60,62,65,68], audit
    assert audit['tested']==259, audit
    assert audit['captured']>=20, audit
    assert audit['modified']>=70 and audit['names']>=20, audit
    print('Native precision construction audit:',audit)
    assert not errors, errors
    browser.close()
    print('IDC browser smoke and storage isolation passed')
