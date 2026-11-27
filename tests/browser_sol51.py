"""Independent rendered probes and actual dev50-tree update, synthetic data only."""
import json
import subprocess
from pathlib import Path
from functools import partial,lru_cache
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from urllib.parse import urlsplit
from browser_upgrade import wait_async

BASELINE='3695ed4fbe2b516c4d66fc6397374daf283bed4b'
SITE=Path(__file__).resolve().parent.parent/'site'

def ready(page):
    page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held' && !!window.IDCPrecision && !!window.IDCPolicy")
    if page.locator('#idcWalkthrough').is_visible(): page.locator('#idcWalkthroughSkip').click()

def run_sol51_audit(browser):
    ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    try:
        page=ctx.new_page();page.goto('http://127.0.0.1:8765/index.html');ready(page)
        page.evaluate("""()=>{
          $('quickStartAverage').value='q60';startQuickFromAverage();data.assessment.completedAt=Date.now()-90*DAY_MS;
          data.games=[];data.sessions=[];
          const now=Date.now();
          for(let age=55;age>=0;age--){const at=now-age*DAY_MS-1000,day=dateKey(at),id='sol51-target-'+age,hits=age<28?3:12;
           data.sessions.push({id,quick:true,quickGame:'Target Mastery',start:at-1000,date:day});
           data.games.push({name:'Target Mastery',sessionId:id,quick:true,at,day,offsetMinutes:new Date(at).getTimezoneOffset(),completion:'natural',benchmark:false,masteryMode:'segment',thrown:15,hits,targetLog:Array.from({length:15},(_,i)=>({ring:'D',target:16,hit:i<hits}))});
          }save(false);window.IDCPrecision.invalidate();show('technique');
        }""")
        page.wait_for_function("document.getElementById('idcBrief').innerText.includes('Check D16')")
        assert '84/420' in page.locator('#idcBrief').inner_text()
        assert page.evaluate("window.IDCPolicy.preferredDrills().doubles")=='Doubles Streak'
        page.locator('#idcBrief').get_by_role('button',name='Check D16',exact=True).click()
        assert page.evaluate("session().quick && session().plan[0].seconds===300 && activeGame.mode==='segment' && activeGame.ring==='D' && activeGame.target===16")
        page.locator('#exerciseIntro').get_by_role('button',name='Play',exact=True).click()
        page.locator('#gameControls').get_by_role('button',name='Hit',exact=True).click()
        page.locator('#undoButton').click()
        assert page.evaluate('activeGame.thrown===0 && activeGame.targetLog.length===0')
        page.locator('#gameControls').get_by_role('button',name='Miss',exact=True).click()
        page.reload();ready(page)
        assert page.evaluate("session().quick && activeGame.target===16 && activeGame.thrown===1")
        page.evaluate("finishSession(false);show('progress')")
        assert 'D16' in page.locator('#dc23MasteryProgress').inner_text()
        page.evaluate("""()=>{
          data.games=[];data.sessions=[];const now=Date.now();
          for(const age of [0,1,7,8,14,15,21,22]){const at=now-age*DAY_MS-1000,day=dateKey(at),id='sol51-fixed-'+age;
           data.sessions.push({id,quick:true,quickGame:'Scoring Challenge',start:at-1000,date:day});
           data.games.push({name:'Scoring Challenge',sessionId:id,quick:true,at,day,offsetMinutes:new Date(at).getTimezoneOffset(),completion:'natural',benchmark:true,visits:10,points:900,scores:Array(10).fill(90)});
          }save(false);window.IDCPrecision.invalidate();show('quick');
        }""")
        assert page.evaluate("dc501PressureEligibility().allowed && dc501PressureEligibility().source==='repeated-fixed-quick-play'")
        assert page.locator('#quickGames').get_by_role('button',name='501 Pressure',exact=True).is_visible()
        page.evaluate("data.games=data.games.slice(0,1);save(false);window.IDCPrecision.invalidate();renderQuick()")
        assert not page.locator('#quickGames').get_by_role('button',name='501 Pressure',exact=True).count()
        # Native validation rejects an impossible bull mark before snapshot/trace.
        page.evaluate("""()=>{quickChoice='Cricket Countdown';$('quickDuration').value='300';startQuickPlay();playExercise();activeGame.targets=[25];activeGame.marks=[0];activeGame.index=0;save(false);renderTraining()}""")
        before=page.evaluate('JSON.stringify(activeGame)')
        page.evaluate('newGameDart(3)')
        assert page.evaluate('JSON.stringify(activeGame)')==before
        assert not page.locator('#gameControls').get_by_role('button',name='Treble (+3)',exact=True).count()
        page.locator('#gameControls').get_by_role('button',name='Bullseye (+2)',exact=True).click()
        assert page.evaluate('activeGame.thrown===1 && activeGame.skillTrace.length===1')
        page.locator('#undoButton').click();assert page.evaluate('activeGame.thrown===0 && activeGame.skillTrace.length===0')
        page.evaluate("finishSession(false);show('technique')")
        for width in [320,375,390,430]:
            page.set_viewport_size({"width":width,"height":844})
            page.locator('#idcQuestion').fill('What target should I practise next?')
            page.locator('#idcAsk').click()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
            assert 'No repeated recent exact-target decline' in page.locator('#idcAnswer').inner_text()
        print('SOL51 rendered actions: contextual D16 recommendation, exact-target launch, input, Undo, reload, fixed Quick Play 501 gate, bull mark rejection and 320/375/390/430 widths passed')
    finally:ctx.close()

def run_pinned51_upgrade_audit(browser):
    import os, re
    version=re.search(r"IDC:assets:2\.0\.0-(dev\d+)",(SITE/'sw.js').read_text()).group(1)
    state={'candidate':False}
    @lru_cache(maxsize=None)
    def baseline(path):
        return (Path(os.environ['IDC_ARCHIVED_BASELINE'])/'site'/path).read_bytes() if os.environ.get('IDC_ARCHIVED_BASELINE') else subprocess.check_output(['git','show',BASELINE+':site/'+path],cwd=SITE.parent)
    class Handler(SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_GET(self):
            path=urlsplit(self.path).path
            if path=='/observer.html':
                payload=b'<!doctype html><title>Upgrade observer</title>'
            elif not path.startswith('/site/'):
                self.send_error(404);return
            elif not state['candidate']:
                try:payload=baseline(path[len('/site/'): ] or 'index.html')
                except subprocess.CalledProcessError:self.send_error(404);return
            else:
                self.path=self.path[len('/site'):]
                return super().do_GET()
            self.send_response(200);self.send_header('Content-Type','text/html' if path.endswith('.html') or path=='/' else 'text/javascript');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(SITE)))
    thread=Thread(target=server.serve_forever,daemon=True);thread.start()
    ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    url='http://127.0.0.1:'+str(server.server_port)+'/site/index.html'
    try:
        page=ctx.new_page();page.goto(url);ready(page)
        page.wait_for_function('navigator.serviceWorker.controller!==null')
        assert 'dev50' in page.title()
        page.evaluate("""()=>{$('quickStartAverage').value='q60';startQuickFromAverage();data.__sol51Upgrade='keep';localStorage.setItem('dartsCoachV4','SOL51-LEGACY');quickChoice='Shanghai Combo';$('quickDuration').value='300';startQuickPlay();playExercise();shanghaiDart(true)}""")
        assert page.evaluate('activeGame.skillTrace.length===1 && activeGame.skillTraceVersion===undefined')
        state['candidate']=True
        page.evaluate("async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()}")
        wait_async(page,"async()=>!!(await navigator.serviceWorker.getRegistration()).waiting",'actual dev51 waiting')
        assert page.evaluate("async v=>{const c=await caches.keys();return c.includes('IDC:assets:2.0.0-dev50') && c.includes('IDC:assets:2.0.0-'+v)}",version)
        observer=ctx.new_page();observer.goto(url.replace('/site/index.html','/observer.html'))
        assert observer.evaluate('navigator.serviceWorker.controller===null')
        page.close()
        wait_async(observer,"async()=>{const r=await navigator.serviceWorker.getRegistration('./site/');return !!r.active&&!r.waiting&&!(await caches.keys()).includes('IDC:assets:2.0.0-dev50')}",'actual dev51 activation')
        page=ctx.new_page();page.goto(url);observer.close();ready(page)
        assert version in page.title()
        assert page.evaluate("data.__sol51Upgrade==='keep' && activeGame.skillTrace.length===1 && activeGame.skillTraceVersion===undefined && localStorage.getItem('dartsCoachV4')==='SOL51-LEGACY'")
        page.evaluate("show('train')")
        # Reopen pause is native behavior; resume, then finish using controls.
        if page.evaluate('!!session().pausedAt'):page.locator('#pauseButton').click()
        page.locator('#gameControls').get_by_role('button',name='Hit',exact=True).click()
        page.locator('#gameControls').get_by_role('button',name='Hit',exact=True).click()
        assert page.evaluate("data.games.length===1 && activeGame.skillTraceVersion===1 && activeGame.skillStartLives>0")
        assert page.evaluate("async()=>{const m=await import('./v62-evidence.mjs?v=2.0.0-dev');return m.extraQuickRounds(window.IDCTrainingBridge.snapshot(),dateKey()).length===1}")
        print('SOL51 actual pinned dev50-to-current worker upgrade: exact production assets, waiting activation, existing player state, legacy sentinel, old active trace completion and new-round metadata passed; baseline='+BASELINE)
    finally:
        ctx.close();server.shutdown();server.server_close();thread.join(timeout=5)
