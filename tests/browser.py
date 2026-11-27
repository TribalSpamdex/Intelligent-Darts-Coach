import os, json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=getattr(p,os.getenv('IDC_BROWSER','chromium')).launch()
    ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    from urllib.parse import urlsplit
    external_requests=[]
    def track_request(request):
        u=urlsplit(request.url)
        if u.scheme in ('http','https','ws','wss') and (u.scheme!='http' or u.hostname!='127.0.0.1' or u.port!=8765):
            external_requests.append((request.method,request.url))
    ctx.on('request',track_request)
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
    # Real fresh install: walkthrough starts automatically, then stays replayable.
    guide=page.locator('#idcWalkthrough')
    assert guide.is_visible()
    assert page.locator('#idcWalkthroughCount').inner_text()=='STEP 1 OF 8'
    assert page.locator('#idcWalkthroughBack').is_disabled()
    before=page.evaluate('JSON.stringify(data)')
    for n in range(2,9):
        page.locator('#idcWalkthroughNext').click()
        assert page.locator('#idcWalkthroughCount').inner_text()==f'STEP {n} OF 8'
    page.locator('#idcWalkthroughBack').click()
    assert page.locator('#idcWalkthroughCount').inner_text()=='STEP 7 OF 8'
    page.locator('#idcWalkthroughNext').click()
    assert page.locator('#idcWalkthroughNext').inner_text()=='Finish'
    page.locator('#idcWalkthroughNext').click()
    assert not guide.is_visible()
    assert page.evaluate('JSON.stringify(data)')==before
    page.reload()
    page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    assert not guide.is_visible()
    page.locator('#headerSettings').click()
    page.locator('#idcWalkthroughSettings').click()
    assert guide.is_visible() and page.locator('#idcWalkthroughCount').inner_text()=='STEP 1 OF 8'
    page.locator('#idcWalkthroughSkip').click()
    page.locator('#navHome').click()
    page.locator('#headerInfo').click()
    assert page.locator('#welcomeOverlay').is_visible()
    page.locator('#idcWalkthroughAbout').click()
    assert guide.is_visible()
    page.locator('#idcWalkthroughSkip').click()
    assert not page.locator('#welcomeOverlay').is_visible()
    page.locator('#headerInfo').click()
    page.locator('#welcomeOverlay .dc36InfoClose').click()
    assert not page.locator('#welcomeOverlay').is_visible()
    assert 'Coach' in page.locator('#navTechnique').inner_text()
    page.locator('#navTechnique').click()
    assert page.locator('#idcCoach').is_visible()
    assert page.locator('.techniqueHero').is_visible()
    page.locator('#idcReview').click()
    assert 'Decision: balanced' in page.locator('#idcReport').inner_text()
    assert 'Eligible measurements: 0' in page.locator('#idcReport').inner_text()
    assert 'Maintain your balanced practice' in page.locator('#idcBrief').inner_text()
    # Exercise sparse two-day feedback through both real Coach UI entry points.
    sparse=page.evaluate("""async()=>{
      const saved=data.idcCoachMemory;
      try{
       const {newMemory}=await import('./coach-memory.mjs?v=2.0.0-dev');
       data.idcCoachMemory=clone(window.IDCTrainingBridge.memory()??newMemory());
       const today=dateKey(),old=dateKey(Date.now()-26*DAY_MS);
       data.idcCoachMemory.state.observations=[
        {id:'sparse-older',day:old,skill:'doubles',context:'practice',protocol:'Fixed doubles',attempts:100,hits:35},
        {id:'sparse-recent',day:today,skill:'doubles',context:'practice',protocol:'Fixed doubles',attempts:100,hits:20}
       ];
       window.IDCPrecision.invalidate();
       document.getElementById('idcReview').click();
       const review=document.getElementById('idcReport').innerText;
       document.getElementById('idcQuestion').value='review my performance';
       document.getElementById('idcAsk').click();
       const answer=document.getElementById('idcAnswer').innerText;
       return {review,answer};
      }finally{if(saved===undefined)delete data.idcCoachMemory;else data.idcCoachMemory=saved;window.IDCPrecision.invalidate()}
    }""")
    assert '35% to 20%' in sparse['review'] and 'Decision: balanced' in sparse['review'] and '-15 percentage points' in sparse['answer'], sparse
    # A synthetic decline with a recorded protocol concern yields an optional check.
    prompt=page.evaluate("""async()=>{
      const saved=data.idcCoachMemory;
      try{
       const {newMemory}=await import('./coach-memory.mjs?v=2.0.0-dev');
       data.idcCoachMemory=clone(window.IDCTrainingBridge.memory()??newMemory());
       const previous=dateKey(Date.now()-DAY_MS);
       data.idcCoachMemory.state.observations=Array.from({length:56},(_,i)=>({id:'prompt-'+i,day:dateKey(Date.now()-i*DAY_MS),skill:'doubles',context:'practice',protocol:'Fixed doubles',attempts:100,hits:i<28?20:60}));
       data.idcCoachMemory.state.answers=[{day:previous,skill:'doubles',context:'practice',protocol:'Fixed doubles',question:'protocol',answer:'no'}];
       window.IDCPrecision.invalidate();document.getElementById('idcReview').click();
       const skip=[...document.querySelectorAll('#idcBrief button')].find(b=>b.textContent==='Skip for today');
       if(!skip)return {available:false,brief:document.getElementById('idcBrief').innerText,report:document.getElementById('idcReport').innerText};
       const before=JSON.stringify(data.idcCoachMemory);skip.click();
       return {available:true,unchanged:before===JSON.stringify(data.idcCoachMemory),brief:document.getElementById('idcBrief').innerText,preference:localStorage.getItem('IDC:brief-dismissed-day')===dateKey(),detailCleared:!document.getElementById('idcReport').innerText.includes('Next question:')};
      }finally{if(saved===undefined)delete data.idcCoachMemory;else data.idcCoachMemory=saved;localStorage.removeItem('IDC:brief-dismissed-day');window.IDCPrecision.invalidate()}
    }""")
    assert prompt['available'] and prompt['unchanged'] and prompt['preference'] and prompt['detailCleared'] and 'Optional check skipped' in prompt['brief'], prompt
    page.reload()
    page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    page.locator('#navTechnique').click()
    page.locator('#idcExample').click()
    assert 'SIMULATION ONLY' in page.locator('#idcReport').inner_text()
    assert 'temporary-focus' in page.locator('#idcReport').inner_text()
    page.locator('#idcQuestion').fill('Checkout 81 with 2 darts')
    page.locator('#idcAsk').click()
    assert 'legal finish' in page.locator('#idcAnswer').inner_text()
    conversation_before=page.evaluate('JSON.stringify(data)')
    page.locator('#idcQuestion').fill('What if I hit S19?')
    page.locator('#idcAsk').click()
    assert 'Remaining score 62; 1 usable darts' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcQuestion').fill('Checkout 61 with 3 darts')
    page.locator('#idcAsk').click()
    page.locator('#idcQuestion').fill('I hit S20')
    page.locator('#idcAsk').click()
    page.locator('#idcQuestion').fill('I hit T20')
    page.locator('#idcAsk').click()
    assert 'Remaining score 61; 0 usable darts' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcQuestion').fill('Please show me my equipment history')
    page.locator('#idcAsk').click()
    assert 'No two dated equipment snapshots' in page.locator('#idcAnswer').inner_text()
    page.locator('#idcQuestion').fill('And with two darts?')
    page.locator('#idcAsk').click()
    assert 'Start with a checkout question' in page.locator('#idcAnswer').inner_text()
    assert page.evaluate('JSON.stringify(data)')==conversation_before
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
    assert blocked['unchanged'] and blocked['assessmentHidden'] and blocked['blocked']==3, blocked
    # Re-enter Coach explicitly after probing native entry points; readiness is
    # edited using the visible form rather than a synthetic memory mutation.
    page.locator('#navTechnique').click()
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
    consent_dialogs=[]
    def confirm_method(dialog):
        consent_dialogs.append({'type':dialog.type,'message':dialog.message})
        if dialog.type=='confirm' and 'Allow the coach to choose' in dialog.message:
            dialog.accept()
        else:
            dialog.dismiss()
    page.on('dialog',confirm_method)
    try:
        page.locator('#idcBrief button').filter(has_text='Enable personalised drill choice').click()
        assert len(consent_dialogs)==1 and consent_dialogs[0]['type']=='confirm' and 'Allow the coach to choose' in consent_dialogs[0]['message'], consent_dialogs
        assert page.evaluate("window.IDCPolicy.methodEnabled()") is True, {'dialogs':consent_dialogs,'status':page.locator('#idcMemoryStatus').inner_text(),'report':page.locator('#idcReport').inner_text(),'writer':page.evaluate('idcWriter'),'active':page.evaluate('!!session()'),'saveError':page.evaluate('storageSaveError')}
    finally:
        page.remove_listener('dialog',confirm_method)
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
    assert page.locator('#idcDeepQuestions button').count()==14
    page.locator('#idcDeepQuestions button').filter(has_text='Is my real match performance improving?').click()
    assert 'No eligible real competition' in page.locator('#idcAnswer').inner_text()
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
        # Read the generation declared by the deployed worker, not a stale test constant.
        cache_audit=page.evaluate("""async()=>{const sw=await fetch('./sw.js',{cache:'no-store'}).then(r=>r.text());const name=sw.match(/const CACHE='([^']+)'/)[1];const keys=await caches.keys();if(!keys.includes(name))return {name,keys,missing:['active generation absent']};const c=await caches.open(name);const assets=JSON.parse(sw.match(/const ASSETS=(\\[[^;]+\\]);/)[1]);const expected=[...new Set(assets.flatMap(a=>[a,a.split('?')[0]]))];const missing=[];for(const a of expected)if(!await c.match(a))missing.push(a);return {name,keys,expected:expected.length,missing}}""")
        assert cache_audit['expected']>=160 and not cache_audit['missing'], cache_audit
        assert [n for n in cache_audit['keys'] if n.startswith('IDC:assets:')]==[cache_audit['name']], cache_audit
        print('Complete offline asset inventory:',cache_audit['expected'])
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
    else:
        # WebKit must actually launch and execute the cached coach offline, not
        # just wait for service-worker registration. Restore online afterwards.
        inventory=page.evaluate("""async()=>{
          const sw=await fetch('./sw.js',{cache:'no-store'}).then(r=>r.text());
          const name=sw.match(/const CACHE='([^']+)'/)[1], keys=await caches.keys();
          if(!keys.includes(name))return {expected:0,missing:['active generation absent']};
          const c=await caches.open(name),assets=JSON.parse(sw.match(/const ASSETS=(\\[[^;]+\\]);/)[1]);
          const expected=[...new Set(assets.flatMap(a=>[a,a.split('?')[0]]))],missing=[];
          for(const a of expected)if(!await c.match(a))missing.push(a);
          return {expected:expected.length,missing};
        }""")
        assert inventory['expected']>=160 and not inventory['missing'], inventory
        # Record an emulation failure separately, without suppressing later
        # real-origin outage, gameplay, migration or storage checks.
        webkit_offline_error=None
        try:
            ctx.set_offline(True)
            page.goto('http://127.0.0.1:8765/index.html?audit=webkit-offline')
            if page.locator('#idcWalkthrough').is_visible():
                page.locator('#idcWalkthroughSkip').click()
            page.wait_for_function("navigator.serviceWorker.controller!==null && typeof idcWriter!=='undefined' && idcWriter==='held'")
            page.locator('#navTechnique').click()
            page.locator('#idcExample').click()
            assert 'temporary-focus' in page.locator('#idcReport').inner_text()
            page.locator('#idcQuestion').fill('Checkout 81 with 2 darts')
            page.locator('#idcAsk').click()
            assert 'legal finish' in page.locator('#idcAnswer').inner_text()
            print('WebKit offline emulation navigation and Coach passed:',inventory['expected'])
        except Exception as exc:
            webkit_offline_error=str(exc)
            print('WebKit offline emulation failure:',webkit_offline_error)
        finally:
            ctx.set_offline(False)
        if webkit_offline_error:
            page.goto('http://127.0.0.1:8765/index.html')
            if page.locator('#idcWalkthrough').is_visible():
                page.locator('#idcWalkthroughSkip').click()
            page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
            page.locator('#navTechnique').click()
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
    # Scheduled contract: actual generated and locked native plan, not advisory preview.
    structure=page.evaluate("""()=>{
      const original=clone(data),policy=window.IDCPolicy;
      try{
       data.sessions=[];data.bigSingles=[];data.activeSession=null;
       const plan=generateSession(false,false,true),timed=plan.filter(e=>e.mode==='timed');
       const initial={warmup:timed[0]?.seconds,application:timed.at(-1)?.seconds,role:timed.at(-1)?.application===true,name:timed.at(-1)?.name,total:timed.reduce((n,e)=>n+e.seconds,0),unique:new Set(timed.map(e=>e.name)).size===timed.length,benchmark:plan.some(e=>e.name==='Big Singles')};
       const run=(elapsed)=>{
        const now=Date.now(),s={id:now,start:now-elapsed*1000,pausedAt:now,pausedTotal:0,benchmarkSeconds:0,index:0,quick:false,extra:false,allocated:false,completed:[],phase:'rules',plan:clone(plan.filter(e=>e.name!=='Warm-up'&&e.name!=='Big Singles')),unifiedAudit:{},wholeSessionAudit:{policy:{categories:{}}}};
        data.activeSession=s;
        window.IDCPolicy={...policy,transfer:()=>({status:'unchanged'})};
        allocateRemaining(s);
        return {total:s.plan.reduce((n,e)=>n+e.seconds,0),last:s.plan.at(-1),min:Math.min(...s.plan.map(e=>e.seconds)),locked:s.provenanceLocked.exercises.at(-1)?.plannedSeconds};
       };
       return {initial,normal:run(600),short:run(3000),extraReview:generateSession(true,false,true).at(-1)?.name};
      }finally{data=original;window.IDCPolicy=policy;window.IDCPrecision.invalidate()}
    }""")
    assert structure['initial']=={'warmup':600,'application':600,'role':True,'name':'301 Pressure','total':3600,'unique':True,'benchmark':True}, structure
    assert structure['normal']['total']==3000 and structure['normal']['last']['application'] and structure['normal']['locked']==600 and structure['normal']['min']>=300, structure
    assert structure['short']['total']==600 and structure['short']['last']['application'] and structure['short']['locked']==600, structure
    assert structure['extraReview']=='Review', structure
    # Application time is mixed practice, never ten extra minutes of isolated checkout work.
    attribution=page.evaluate("""()=>{
      const original=clone(data),now=Date.now();
      try{
       const start=now-1800000,day=dateKey(start);
       data.sessions=[{id:start,start,date:day,extra:false,quick:false,completed:true,minutes:30,activities:[{name:'Checkout Climb',seconds:600,at:start+600000,exerciseIndex:0},{name:'301 Pressure',application:true,seconds:600,at:start+1200000,exerciseIndex:1},{name:'Warm-up',seconds:600,at:now,exerciseIndex:2}]}];
       data.games=[];
       const p=coach62Practice(now,start),l=dc28CategoryLedger(now).at(-1);
       return {checkout:p.categories.checkout.seconds,application:p.application,total:p.totalSeconds,legacyCheckout:l.minutes.checkout,unknown:l.unknownMinutes};
      }finally{data=original;window.IDCPrecision.invalidate()}
    }""")
    assert attribution=={'checkout':600,'application':600,'total':1800,'legacyCheckout':10,'unknown':20}, attribution
    # H5: same native skill tier, calendar, exposure and settings; change only
    # independent measured ability and inspect actual executable scheduler output.
    adaptation=page.evaluate("""()=>{const original=clone(data);try{
      data.sessions=[];data.games=[];data.bigSingles=[];data.activeSession=null;data.assessmentHistory=[];data.assessment.completedAt=Date.now()-90*DAY_MS;
      data.idcCoachMemory.events=[];data.idcCoachMemory.state.readiness=[];data.idcCoachMemory.state.interventions=[];data.idcCoachMemory.baselines={};
      for(const k of SKILLS)data.skills[k].level=4;
      const day=n=>dateKey(Date.now()-n*DAY_MS),results=[];
      for(const [avg,doubles,checkout,bull] of [[25,6,1,3],[55,18,4,10],[75,30,6,16],[95,42,9,22],[108,51,11,27]]){
       data.idcCoachMemory.state.observations=[];
       for(const n of [0,1,7,8,14,15,21,22])for(const [skill,attempts,hits] of [['scoring',30,avg*10],['doubles',60,doubles],['checkout',12,checkout],['bull',30,bull]])
        data.idcCoachMemory.state.observations.push({id:'IDC:precision-check:'+skill+':'+day(n),day:day(n),skill,context:'practice',protocol:'IDC precision fixed '+skill,attempts,hits});
       window.IDCPrecision.invalidate();
       const pref=window.IDCPolicy.preferredDrills();
       if(Object.values(pref).some(n=>!QUICK_GAMES.includes(n)||DC10_MEASUREMENT_GAMES.has(n)))throw Error('Measured drill is not executable '+JSON.stringify(pref));
       const plans=FOCUS.map(focus=>Array.from(chooseSessionGames(focus,4,null,false,null)));
       if(plans.some(p=>p.length!==4||new Set(p).size!==4||p.some(n=>DC10_MEASUREMENT_GAMES.has(n))))throw Error('Invalid native plan');
       const full=generateSession(false,false,true).map(e=>[e.name,e.seconds??null,e.mode]);
       results.push({pref,plans,full});
      }
      return results;
    }finally{data=original;window.IDCPrecision.invalidate()}}""")
    assert len({json.dumps(x['pref'],sort_keys=True) for x in adaptation})>=3, adaptation
    assert len({json.dumps(x['plans']) for x in adaptation})>=2, adaptation
    print('Native measured profile scheduling audit:',adaptation)
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
    # H2: actual mid-session changes, resume, assessment input and recreational
    # input must obey a saved stop, not just the training start button.
    safety=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    sp=safety.new_page()
    sp.goto('http://127.0.0.1:8765/index.html')
    if sp.locator('#idcWalkthrough').is_visible():
        sp.locator('#idcWalkthroughSkip').click()
    sp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held' && !!window.IDCPolicy")
    gates=sp.evaluate("""async()=>{const {changeMemory}=await import('./coach-memory.mjs?v=2.0.0-dev'),bridge=window.IDCTrainingBridge,old=window.alert;
      window.alert=()=>{};try{
       const setPain=pain=>{const raw=bridge.memory(),day=bridge.day(),next=changeMemory(bridge.snapshot(),raw,day,'readiness',{day,context:'practice',fatigue:'normal',pressure:'normal',confidence:'normal',pain,note:''});bridge.writeMemory(next,JSON.stringify(raw))};
       document.getElementById('quickStartAverage').value='q60';startQuickFromAverage();
       quickChoice='Bull Accuracy';document.getElementById('quickDuration').value='300';startQuickPlay();playExercise();
       if(session()?.phase!=='playing'||session().pausedAt)throw Error('Could not start control round');
       bullDart(50);if(activeGame.thrown!==1||activeGame.inner!==1)throw Error('Control dart not recorded');
       setPain(true);const paused=!!session().pausedAt;const before=JSON.stringify(activeGame);
       bullDart(50);pauseSession();bullDart(25);
       const blocked=paused&&!!session().pausedAt&&before===JSON.stringify(activeGame);
       setPain(false);pauseSession();bullDart(25);const resumed=!session().pausedAt&&activeGame.thrown===2&&activeGame.outer===1;
       finishSession(false);show('quick');casualGames.start('301',1);casualGames.dart(20,3);
       const casual=JSON.stringify(casualGames.inspect());setPain(true);casualGames.dart(20,3);casualGames.start('501',1);
       const casualBlocked=casual===JSON.stringify(casualGames.inspect());
       casualGames.clear();setPain(false);
       data.assessment=newAssessment();openAssessment(STAGES[0]);const warmStarted=!!assessmentWarmup().startedAt;
       setPain(true);resumeAssessmentWarmup();const warmBlocked=warmStarted&&!assessmentWarmup().startedAt;
       activeStage='doubles';const doubles=JSON.stringify(data.assessment.doubles);assessmentDouble(true);
       const assessmentBlocked=doubles===JSON.stringify(data.assessment.doubles);
       return {blocked,resumed,casualBlocked,warmBlocked,assessmentBlocked};
      }finally{window.alert=old}}""")
    assert all(gates.values()), gates
    safety.close()
    print('Physical readiness mid-session and resume audit:',gates)
    # Real player-visible progress, not outcome overlays, across native round restart and Undo.
    progress_ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    pp=progress_ctx.new_page()
    pp.goto('http://127.0.0.1:8765/index.html')
    if pp.locator('#idcWalkthrough').is_visible():
        pp.locator('#idcWalkthroughSkip').click()
    pp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held' && !!window.IDCPolicy")
    progress=pp.evaluate("""()=>{
      document.getElementById('quickStartAverage').value='q60';startQuickFromAverage();
      quickChoice='Doubles Survival';document.getElementById('quickDuration').value='300';startQuickPlay();playExercise();
      if(session()?.phase!=='playing'||activeGame?.name!=='Doubles Survival')throw Error('Doubles control game did not start');
      const overlayHidden=()=>$('roundAnnouncement').classList.contains('hidden');
      const current=()=>$('roundFlash').textContent;
      const metrics=()=>$('miniMetrics').textContent;
      const n=activeGame.sequence.length;
      if(!overlayHidden()||current()!=='STREAK 0')throw Error('Unexpected initial presentation '+current());
      for(let i=0;i<n;i++)survivalDart(true);
      if(!overlayHidden()||session().round!==2||current()!=='STREAK '+n||!metrics().includes('Hits: '+n)||data.games.at(-1).win!==true)throw Error('Restart progress mismatch '+current()+' '+metrics());
      undoGame();
      if(!overlayHidden()||session().round!==1||current()!=='STREAK '+(n-1))throw Error('Round Undo mismatch '+current());
      survivalDart(true);survivalDart(false);
      if(!overlayHidden()||current()!=='STREAK 0'||!metrics().includes('Best streak: '+n))throw Error('Miss did not reset streak '+current()+' '+metrics());
      undoGame();
      if(current()!=='STREAK '+n)throw Error('Miss Undo mismatch '+current());
      return {n,round:session().round,metrics:metrics()};
    }""")
    assert progress['n']>0 and progress['round']==2,progress
    assert pp.locator('#roundFlash').is_visible() and pp.locator('#miniMetrics').is_visible()
    assert not pp.locator('#roundAnnouncement').is_visible()
    progress_ctx.close()
    print('Player progress and no-overlay browser regression:',progress)

    # Sol H1: a second document must not overwrite a successfully saved profile.
    before=page.evaluate("localStorage.getItem(KEY)")
    other=ctx.new_page()
    other.goto('http://127.0.0.1:8765/index.html')
    if other.locator('#idcWalkthrough').is_visible():
        other.locator('#idcWalkthroughSkip').click()
    other.wait_for_function("typeof idcWriter!=='undefined' && idcWriter!=='pending'")
    assert other.evaluate("idcWriter")=='readonly'
    other.evaluate("""()=>{data.idcCoachMemory=null;save(false)}""")
    assert page.evaluate("localStorage.getItem(KEY)")==before
    other.close()
    # Sol M1: destructive storage recovery simulation in an isolated profile.
    recovery=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    rp=recovery.new_page()
    rp.goto('http://127.0.0.1:8765/index.html')
    if rp.locator('#idcWalkthrough').is_visible():
        rp.locator('#idcWalkthroughSkip').click()
    rp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    rp.evaluate("""()=>{data.__solRecoveryMarker='deleted';save(false);checkpointData();const old=localStorage.getItem(CHECKPOINT_KEY);
       delete data.__solRecoveryMarker;save(false);localStorage.setItem(CHECKPOINT_KEY,old);localStorage.setItem(KEY,'broken-primary');}""")
    rp.reload()
    rp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    assert rp.evaluate("idcRecoveryBlocked && !data.__solRecoveryMarker")
    assert rp.evaluate("localStorage.getItem(KEY)")=='broken-primary'
    recovery.close()
    # Positive recovery: an exact current checkpoint must survive unchanged
    # writes, restore a corrupt primary, and be refreshed under the new fence.
    valid_recovery=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    vp=valid_recovery.new_page()
    vp.goto('http://127.0.0.1:8765/index.html')
    if vp.locator('#idcWalkthrough').is_visible():
        vp.locator('#idcWalkthroughSkip').click()
    vp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    unchanged=vp.evaluate("""()=>{data.__solRecoveryMarker='keep';if(!save(false)||!checkpointData())throw Error('setup failed');const fence=localStorage.getItem(RECOVERY_FENCE);if(!save(false))throw Error('no-op save failed');const same=localStorage.getItem(RECOVERY_FENCE)===fence;localStorage.setItem(KEY,'broken-current-primary');return same}""")
    assert unchanged
    vp.reload()
    vp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    assert vp.evaluate("""()=>!idcRecoveryBlocked&&data.__solRecoveryMarker==='keep'&&localStorage.getItem(KEY)!=='broken-current-primary'&&JSON.parse(localStorage.getItem(CHECKPOINT_KEY)).fence===localStorage.getItem(RECOVERY_FENCE)""")
    # A second corruption of primary must still recover the same current data.
    vp.evaluate("localStorage.setItem(KEY,'second-corruption')")
    vp.reload()
    vp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    assert vp.evaluate("!idcRecoveryBlocked && data.__solRecoveryMarker==='keep'")
    # Complete an interrupted native session while the primary write fails.
    vp.wait_for_function("!!window.IDCPolicy")
    quota=vp.evaluate("""()=>{document.getElementById('quickStartAverage').value='q60';
      startQuickFromAverage();beginTraining(true,true);const previous=Storage.prototype.setItem;
      try{Storage.prototype.setItem=function(k,v){if(k===KEY)throw new DOMException('Full','QuotaExceededError');return previous.call(this,k,v)};
        finishSession(false);return {failed:dc17SaveFailed,message:$('finishedText').textContent,retained:data.sessions.length};
      }finally{Storage.prototype.setItem=previous}}""")
    assert quota['failed'] and quota['retained'] and 'backup' in quota['message'].lower(),quota
    # Failed primary writes must preserve an already-current checkpoint.
    assert vp.evaluate("""()=>{data.__probe='committed';save(false);checkpointData();
      const fence=localStorage.getItem(RECOVERY_FENCE),previous=Storage.prototype.setItem;
      data.__probe='pending';try{Storage.prototype.setItem=function(k,v){if(k===KEY)throw Error('quota');return previous.call(this,k,v)};
      return !save(false)&&localStorage.getItem(RECOVERY_FENCE)===fence;
      }finally{Storage.prototype.setItem=previous}}""")
    vp.evaluate("localStorage.setItem(KEY,'damaged-after-failed-write')")
    vp.reload()
    vp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
    assert vp.evaluate("data.__probe==='committed' && !idcRecoveryBlocked")
    valid_recovery.close()
    print('Sol H1/H2/M1 browser regression probes passed')
    assert not errors, errors
    assert not external_requests,external_requests
    print('Observed smoke-test requests: no external HTTP(S) or WebSocket destinations')
    from browser_gameplay import run_gameplay_audit
    from browser_upgrade import run_upgrade_audit
    from browser_migration import run_migration_audit
    from browser_player_progress import run_player_progress_audit
    from browser_sol49 import run_sol49_audit
    from browser_sol50 import run_sol50_audit
    from browser_sol51 import run_sol51_audit,run_pinned51_upgrade_audit,run_pinned52_upgrade_audit
    from browser_sol52 import run_sol52_audit
    import traceback
    audit_errors=[]
    # Automation-level offline switch is separately recorded. Mandatory
    # worker audit must pass both HTTP outage and actual socket disconnection.
    # Physical iOS airplane-mode validation remains a separate release gate.
    if os.getenv('IDC_BROWSER','chromium')=='webkit' and webkit_offline_error:
        print('UNRESOLVED WebKit network-emulation diagnostic:',webkit_offline_error)
    for audit in (run_gameplay_audit,run_upgrade_audit,run_migration_audit,run_player_progress_audit,run_sol49_audit,run_sol50_audit,run_sol51_audit,run_pinned51_upgrade_audit,run_pinned52_upgrade_audit,run_sol52_audit):
        try:
            audit(browser)
        except Exception as exc:
            audit_errors.append((audit.__name__,str(exc)))
            traceback.print_exc()
    browser.close()
    assert not audit_errors,audit_errors
    print('IDC browser smoke and storage isolation passed')
