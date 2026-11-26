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
    page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    assert 'V2.0.0-dev' in page.title()
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
    assert 'Maintain your balanced practice' in page.locator('#idcBrief').inner_text()
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
    page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
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
    # Sol H2: a stop decision must block actual physical entry points.
    blocked=page.evaluate("""()=>{const notices=[],old=window.alert;window.alert=x=>notices.push(x);try{
      const before=JSON.stringify(data.activeSession??null);
      startQuickPlay();beginTraining(true,true);openAssessment(STAGES.find(x=>!stageComplete(x)));
      return {unchanged:JSON.stringify(data.activeSession??null)===before,assessmentHidden:document.getElementById('assessmentScreen').classList.contains('hidden'),blocked:notices.length};
    }finally{window.alert=old}}""")
    assert blocked['unchanged'] and blocked['assessmentHidden'] and blocked['blocked']>=1, blocked
    page.locator('#idcReady input[name=pain]').uncheck()
    page.locator('#idcReady button').click()
    assert page.evaluate('window.IDCPolicy.mayStart()') is True
    assert page.evaluate("""()=>{const old=data.idcCoachMemory;try{data.idcCoachMemory={format:'invalid'};return window.IDCPolicy.mayStart()===false}finally{data.idcCoachMemory=old}}""")
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
    assert page.evaluate("""async()=>{const m=await import('./training-ledger.mjs?v=2.0.0-dev');const x=m.trainingLedger(window.IDCTrainingBridge.snapshot(),window.IDCTrainingBridge.day());return x.sessions.length>=1&&x.sessions.some(s=>!s.completed)}""")
    assert page.evaluate("window.IDCPolicy.methodEnabled()") is False
    page.once('dialog',lambda d:d.accept())
    page.locator('#idcBrief button').filter(has_text='Enable personalised drill choice').click()
    assert page.evaluate("window.IDCPolicy.methodEnabled()") is True
    page.reload()
    page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    page.locator('#navTechnique').click()
    assert page.evaluate("window.IDCPolicy.methodEnabled()") is True
    page.locator('#idcBrief button').filter(has_text='Disable personalised drill choice').click()
    assert page.evaluate("window.IDCPolicy.methodEnabled()") is False
    page.locator('#idcAutonomyPanel').evaluate('(e)=>e.open=true')
    assert page.locator('#idcAutonomyQuestions button').count()==10
    page.locator('#idcEventForm input[name=name]').fill('Synthetic league')
    event_day=page.evaluate("window.IDCTrainingBridge.day()")
    page.locator('#idcEventForm input[name=day]').fill(event_day)
    page.locator('#idcEventForm button').click()
    assert 'Competition saved locally' in page.locator('#idcEventStatus').inner_text()
    assert 'Synthetic league' in page.locator('#idcEvents').inner_text()
    assert 'Synthetic league' in page.locator('#idcBrief').inner_text()
    page.locator('#idcAutonomyQuestions button').filter(has_text='How should I prepare for competition?').click()
    assert 'Synthetic league' in page.locator('#idcAnswer').inner_text()
    event_plan=page.evaluate("""()=>{const before=JSON.stringify(data),plan=generateSession(false,false,true);return {phase:plan.unifiedAudit.competition?.phase,familiar:plan.unifiedAudit.competition?.familiar,trial:plan.unifiedAudit.exploration?.trial,mastery:plan.some(e=>e.name==='Target Mastery'),valid:plan.every(e=>e.mode==='benchmark'||e.seconds>=300),unchanged:before===JSON.stringify(data)}}""")
    assert event_plan=={'phase':'competition-day','familiar':True,'trial':None,'mastery':False,'valid':True,'unchanged':True},event_plan
    page.once('dialog',lambda d:d.accept())
    page.locator('#idcEvents button').click()
    assert 'No saved competitions' in page.locator('#idcEvents').inner_text()
    page.locator('#idcAutonomyPanel').evaluate('(e)=>e.open=false')
    page.locator('#idcDeepPanel').evaluate('(e)=>e.open=true')
    assert page.locator('#idcDeepQuestions button').count()==13
    page.locator('#idcDeepQuestions button').filter(has_text='Recovery from 81 after S19').click()
    assert 'Remaining score 62' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcDeepPanel').evaluate('(e)=>e.open=false')
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
    page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    page.locator('#navTechnique').click()
    assert page.evaluate('window.IDCTrainingBridge.memory().state.legs.length')==1
    assert page.evaluate('window.IDCTrainingBridge.memory().state.throws.length')==20
    page.evaluate("navigator.serviceWorker.ready")
    page.wait_for_function("navigator.serviceWorker.controller!==null")
    if os.getenv('IDC_BROWSER','chromium')=='chromium':
        assert page.evaluate("""async()=>{const c=await caches.open('IDC:assets:2.0.0-dev2');return !!(await c.match('./context-profile.mjs?v=2.0.0-dev'))&&!!(await c.match('./context-profile.mjs'))&&!!(await c.match('./longitudinal.mjs'))&&!!(await c.match('./engine/context.mjs'))&&!!(await c.match('./contextual-questions.mjs'))&&!!(await c.match('./statistics-view.mjs?v=2.0.0-dev'))&&!!(await c.match('./manual-target-samples.mjs?v=2.0.0-dev'))&&!!(await c.match('./progression-evidence.mjs?v=2.0.0-dev'))&&!!(await c.match('./precision-games.mjs?v=2.0.0-dev'))&&!!(await c.match('./challenge-learning.mjs?v=2.0.0-dev'))&&!!(await c.match('./challenge-exposure.mjs?v=2.0.0-dev'))}""")
        assert page.evaluate("""async()=>{const c=await caches.open('IDC:assets:2.0.0-dev2');for(const n of ['training-ledger','training-outcomes','match-stages','development-review','coaching-intelligence','tactical-learning','session-learning','trial-planning'])if(!await c.match('./'+n+'.mjs?v=2.0.0-dev')||!await c.match('./'+n+'.mjs'))return false;return true}""")
        ctx.set_offline(True)
        page.reload()
        page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
        page.locator('#navTechnique').click()
        page.locator('#idcExample').click()
        assert 'temporary-focus' in page.locator('#idcReport').inner_text()
        page.locator('#idcQuestion').fill('How have I progressed this year?')
        page.locator('#idcAsk').click()
        assert 'No comparable measurements recorded yet' in page.locator('#idcAnswer').inner_text()
        page.locator('#idcQuestion').fill('My ability profile')
        page.locator('#idcAsk').click()
        assert 'Not enough comparable recent evidence' in page.locator('#idcAnswer').inner_text()
        assert 'doubles' in page.locator('#idcAnswer').inner_text()
        page.locator('#idcReview').click()
        assert 'Current development priorities' in page.locator('#idcReport').inner_text()
        for question, expected in [('How much have I actually trained?', 'Unlogged practice is unknown'), ('Which drills help me improve?', 'eligible exercise exposures'), ('Does longer practice help me?', 'eligible exercise exposures'), ('Have my gains lasted?', 'delayed follow-ups'), ('Where do I lose performance in legs?', '101 straight-in'), ('How does practice transfer to competition?', 'actual practice and competition'), ('Model checkout 81 with 2 darts', 'Standard legal route'), ('Recovery from 81 after S19', 'Remaining score 62'), ('Do I lose consistency during practice?', 'six or more complete'), ('What should I test next?', 'Not enough comparable training contrasts'), ('What performance range is realistic?', 'No comparable measured history'), ('How effective has my coaching been?', 'No accepted intervention history'), ('Plan my next four weeks', 'Week 4')]:
            page.locator('#idcQuestion').fill(question)
            page.locator('#idcAsk').click()
            assert expected.lower() in page.locator('#idcAnswer').inner_text().lower(), question
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
    page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
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
    # Native allocator boundary test: a stubbed independent decision checks the actual
    # allocator and locked plan; real evidence gates are tested in Node.
    allocation=page.evaluate("""()=>{
      const previous=data.activeSession,policy=window.IDCPolicy,oldSessions=data.sessions;
      try{
       data.sessions=[];
       const now=Date.now(),normal='Scoring Survival',alternative='Scoring Ladder';
       const run=(mode)=>{
        const s={id:now,start:now-1800000,pausedAt:now,pausedTotal:0,benchmarkSeconds:0,index:0,quick:false,extra:false,allocated:false,completed:[],phase:'rules',plan:[
         {name:normal,mode:'timed',seconds:900,wholeCoach:{category:'scoring'}},
         {name:'Doubles Survival',mode:'timed',seconds:600,wholeCoach:{category:'doubles'}},
         {name:'Review',mode:'timed',seconds:300}
        ],unifiedAudit:{idcMethodCandidates:[{normal,alternative,skill:'scoring',normalScore:1,alternativeScore:2}]},wholeSessionAudit:{policy:{categories:{}}}};
        if(mode==='extra')s.extra=true;
        if(mode==='focus')s.coachDayIntent={focus:'doubles'};
        if(mode==='trial')s.unifiedAudit.exploration={trial:true};
        if(mode==='wrong-category')s.unifiedAudit.idcMethodCandidates[0].alternative='Doubles Survival';
        data.activeSession=s;dc45InitialSnapshot(s);
        let calls=0;
        window.IDCPolicy={...policy,transfer:()=>({status:'unchanged'}),methodChoice:options=>{calls++;return mode==='decline'?{status:'unchanged'}:{status:'selected',...options[0]}}};
        allocateRemaining(s);
        return {mode,calls,total:s.plan.reduce((n,e)=>n+e.seconds,0),names:s.plan.map(e=>e.name),locked:s.provenanceLocked.exercises.map(e=>e.name),method:s.wholeSessionAudit.idcMethod?.exerciseIndex??null};
       };
       return ['allow','decline','extra','focus','trial','wrong-category'].map(run);
      }finally{data.activeSession=previous;data.sessions=oldSessions;window.IDCPolicy=policy}
    }""")
    assert allocation[0]['calls']==1 and allocation[0]['method']==0, allocation
    assert allocation[0]['names'][0]=='Scoring Ladder' and allocation[0]['locked']==allocation[0]['names'], allocation
    assert allocation[1]['calls']==1 and allocation[1]['names'][0]=='Scoring Survival', allocation
    assert all(x['calls']==0 and x['names'][0]=='Scoring Survival' for x in allocation[2:]), allocation
    assert all(x['total']==1800 for x in allocation), allocation
    # Synthetic native construction audit: same rule-builder used by timed training.
    audit=page.evaluate("""async()=>{
      const original=clone(data),oldGame=activeGame,oldUndo=undoSnapshot,oldTab=currentTab;
      try{
       const mod=await import('./precision-games.mjs?v=2.0.0-dev'),learn=await import('./challenge-setting.mjs?v=2.0.0-dev');
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
       const observed=[];for(const [value,target,quarter] of [[61,60,0],[64,61,.5],[66,62,1],[68,63,1+1/3],[70,65,2],[72,67,2+2/3],[75,68,3]]){for(const o of data.idcCoachMemory.state.observations)if(o.skill==='scoring')o.hits=value*10;window.IDCPrecision.invalidate();const v=buildGame('Scoring Survival');if(v.target!==target||(v.precision?.quarter??0)!==quarter||v.learningSetting?.after!==target||v.learningSetting?.quarter!==quarter)throw Error('Real scoring quarter '+quarter+' expected '+target+' got '+v.target);observed.push(v.target)}
       // Native continuous ability remains high but repeated recent lower form limits challenge.
       const savedObservations=clone(data.idcCoachMemory.state.observations);
       data.idcCoachMemory.state.observations=savedObservations.filter(o=>o.skill!=='scoring');
       for(const n of [...Array.from({length:21},(_,i)=>i+7),0,1,2])data.idcCoachMemory.state.observations.push({id:'IDC:precision-check:scoring:'+day(n),day:day(n),skill:'scoring',context:'practice',protocol:'IDC precision fixed scoring',attempts:30,hits:(n<7?70:90)*10});
       window.IDCPrecision.invalidate();const capped=buildGame('Scoring Survival');
       if(capped.target!==65)throw Error('Expected temporary form cap 65; got '+capped.target);
       data.idcCoachMemory.state.observations=savedObservations;window.IDCPrecision.invalidate();
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
    assert audit['observed']==[60,61,62,63,65,67,68], audit
    assert audit['tested']==259, audit
    assert audit['captured']>=20, audit
    assert audit['modified']>=70 and audit['names']>=20, audit
    print('Native precision construction audit:',audit)
    # Sol H1: a second document must not overwrite a successfully saved profile.
    before=page.evaluate("localStorage.getItem(KEY)")
    other=ctx.new_page()
    other.goto('http://127.0.0.1:8765/index.html')
    other.wait_for_function("typeof idcWriter!=='undefined' && idcWriter!=='pending'")
    assert other.evaluate("idcWriter")=='readonly'
    other.evaluate("""()=>{data.idcCoachMemory=null;save(false)}""")
    assert page.evaluate("localStorage.getItem(KEY)")==before
    other.close()
    # Sol M1: destructive storage recovery simulation in an isolated profile.
    recovery=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    rp=recovery.new_page()
    rp.goto('http://127.0.0.1:8765/index.html')
    rp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    rp.evaluate("""()=>{data.__solRecoveryMarker='deleted';save(false);checkpointData();const old=localStorage.getItem(CHECKPOINT_KEY);
       delete data.__solRecoveryMarker;save(false);localStorage.setItem(CHECKPOINT_KEY,old);localStorage.setItem(KEY,'broken-primary');}""")
    rp.reload()
    rp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    assert rp.evaluate("idcRecoveryBlocked && !data.__solRecoveryMarker")
    assert rp.evaluate("localStorage.getItem(KEY)")=='broken-primary'
    recovery.close()
    print('Sol H1/H2/M1 browser regression probes passed')
    assert not errors, errors
    browser.close()
    print('IDC browser smoke and storage isolation passed')
