"""Real service-worker lifecycle audit using the actual release assets.

Only the cache generation and inert shell/module markers differ between served
generations. No production deployment or network outside this local server.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread, Lock
from urllib.parse import urlsplit
import re

SITE=Path(__file__).resolve().parent.parent/'site'

def run_upgrade_audit(browser):
    state={'generation':901,'fail':False,'failed':0}
    lock=Lock()

    class Handler(SimpleHTTPRequestHandler):
        def log_message(self,*args):
            pass

        def end_headers(self):
            self.send_header('Cache-Control','no-store')
            super().end_headers()

        def do_GET(self):
            path=urlsplit(self.path).path
            with lock:
                generation=state['generation']
                fail=state['fail']
                if fail and path=='/engine/diagnosis.mjs':
                    state['failed']+=1
            if fail and path=='/engine/diagnosis.mjs':
                self.send_error(503,'Synthetic interrupted precache')
                return
            if path not in ('/','/index.html','/sw.js','/idc.mjs'):
                return super().do_GET()
            file='index.html' if path=='/' else path.lstrip('/')
            content=(SITE/file).read_text(encoding='utf-8')
            marker=str(generation)
            if file=='index.html':
                assert '</head>' in content
                content=content.replace('</head>','<meta name="idc-audit-generation" content="'+marker+'"></head>',1)
            elif file=='sw.js':
                content,count=re.subn(r"const CACHE='[^']+';", "const CACHE='IDC:assets:2.0.0-dev"+marker+"';",content,count=1)
                assert count==1
            else:
                content+='\n// IDC_GENERATION_PROBE_'+marker+'\n'
            payload=content.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8' if file=='index.html' else 'text/javascript; charset=utf-8')
            self.send_header('Content-Length',str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(SITE)))
    thread=Thread(target=server.serve_forever,daemon=True)
    thread.start()
    url='http://127.0.0.1:'+str(server.server_port)+'/index.html'
    ctx=None
    try:
        ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
        page=ctx.new_page()
        page.goto(url)
        page.wait_for_function("navigator.serviceWorker.controller!==null && typeof idcWriter!=='undefined' && idcWriter==='held'")
        def probe(p,gen):
            assert p.locator('meta[name=idc-audit-generation]').get_attribute('content')==str(gen)
            assert p.evaluate("async g=>(await fetch('./idc.mjs?v=2.0.0-dev').then(r=>r.text())).includes('IDC_GENERATION_PROBE_'+g)",gen)
        probe(page,901)
        page.evaluate("()=>{data.__upgradeAudit='keep';if(!save(false)||!checkpointData())throw Error('Could not save synthetic profile');localStorage.setItem('dartsCoachV4','LEGACY-UPGRADE-SENTINEL')}")
        page.evaluate("async()=>{const c=await caches.open('OTHER:unrelated');await c.put('./unrelated',new Response('keep'))}")
        # Generation 902 fails while precaching a required runtime module.
        with lock:
            state.update(generation=902,fail=True)
        page.evaluate("async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()}")
        page.wait_for_function("async()=>{const r=await navigator.serviceWorker.getRegistration();return (await caches.keys()).includes('IDC:assets:2.0.0-dev902')&&!r.installing&&!r.waiting}")
        with lock:
            assert state['failed']>0, state
        page.reload()
        page.wait_for_function("navigator.serviceWorker.controller!==null && typeof idcWriter!=='undefined' && idcWriter==='held'")
        probe(page,901)
        assert page.evaluate("data.__upgradeAudit==='keep'")
        # Generation 903 succeeds but must remain waiting while old clients exist.
        with lock:
            state.update(generation=903,fail=False)
        page.evaluate("async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()}")
        page.wait_for_function("async()=>{const r=await navigator.serviceWorker.getRegistration();return !!r.waiting&&r.waiting.state==='installed'}")
        assert page.evaluate("async()=>{const keys=await caches.keys();return keys.includes('IDC:assets:2.0.0-dev901')&&keys.includes('IDC:assets:2.0.0-dev903')}")
        other=ctx.new_page()
        other.goto(url)
        other.wait_for_function("navigator.serviceWorker.controller!==null")
        probe(other,901)
        probe(page,901)
        assert other.evaluate("localStorage.getItem('dartsCoachV4')")== 'LEGACY-UPGRADE-SENTINEL'
        other.close()
        page.close()
        # Release all old controlled clients. The next document must converge
        # on the new worker/cache; a reload then proves consistent new assets.
        page=ctx.new_page()
        page.goto(url)
        page.wait_for_function("async()=>{const r=await navigator.serviceWorker.getRegistration();const keys=await caches.keys();return !!navigator.serviceWorker.controller&&!r.waiting&&keys.includes('IDC:assets:2.0.0-dev903')&&!keys.includes('IDC:assets:2.0.0-dev901')&&!keys.includes('IDC:assets:2.0.0-dev902')}")
        page.reload()
        page.wait_for_function("navigator.serviceWorker.controller!==null && typeof idcWriter!=='undefined' && idcWriter==='held'")
        probe(page,903)
        assert page.evaluate("data.__upgradeAudit==='keep' && localStorage.getItem('dartsCoachV4')==='LEGACY-UPGRADE-SENTINEL'")
        assert page.evaluate("async()=>!!await (await caches.open('OTHER:unrelated')).match('./unrelated')")
        ctx.set_offline(True)
        page.reload()
        page.wait_for_function("navigator.serviceWorker.controller!==null && typeof idcWriter!=='undefined' && idcWriter==='held'")
        probe(page,903)
        page.locator('#navTechnique').click()
        page.locator('#idcQuestion').fill('Checkout 81 with 2 darts')
        page.locator('#idcAsk').click()
        assert 'legal finish' in page.locator('#idcAnswer').inner_text()
        assert page.evaluate("data.__upgradeAudit==='keep'")
        print('Real worker upgrade audit: interrupted precache, waiting generation, old tabs, consistent activation, offline relaunch and profile survival passed')
    finally:
        if ctx is not None:
            ctx.close()
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
