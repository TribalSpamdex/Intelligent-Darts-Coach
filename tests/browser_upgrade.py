"""Real service-worker lifecycle audit using the actual release assets.

Only the cache generation and inert shell/module markers differ between served
generations. No production deployment or network outside this local server.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread, Lock, Event
from urllib.parse import urlsplit
import re

SITE=Path(__file__).resolve().parent.parent/'site'

def run_upgrade_audit(browser):
    state={'generation':901,'fail':False,'failed':0}
    lock=Lock()
    failed_request=Event()

    class Handler(SimpleHTTPRequestHandler):
        protocol_version='HTTP/1.1'

        def log_message(self,*args):
            pass

        def end_headers(self):
            self.send_header('Cache-Control','no-store')
            super().end_headers()

        def do_GET(self):
            path=urlsplit(self.path).path
            if path=='/observer.html':
                payload=b'<!doctype html><title>Uncontrolled upgrade observer</title>'
                self.send_response(200)
                self.send_header('Content-Type','text/html')
                self.send_header('Content-Length',str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            if not path.startswith('/site/'):
                self.send_error(404)
                return
            self.path=self.path[len('/site'):]
            path=urlsplit(self.path).path
            with lock:
                generation=state['generation']
                fail=state['fail']
                unavailable=fail and path!='/sw.js'
                if unavailable:
                    state['failed']+=1
            if unavailable:
                failed_request.set()
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

    class AuditServer(ThreadingHTTPServer):
        request_queue_size=256

    server=AuditServer(('127.0.0.1',0),partial(Handler,directory=str(SITE)))
    thread=Thread(target=server.serve_forever,daemon=True)
    thread.start()
    origin='http://127.0.0.1:'+str(server.server_port)
    url=origin+'/site/index.html'
    ctx=None
    try:
        ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
        page=ctx.new_page()
        page.goto(url)
        page.wait_for_function("navigator.serviceWorker.controller!==null && typeof idcWriter!=='undefined' && idcWriter==='held'")
        def cache_probe(p,gen):
            result=p.evaluate("""async gen=>{
              const scope=new URL('/site/',location.origin),name='IDC:assets:2.0.0-dev'+gen,names=await caches.keys();
              if(!names.includes(name))return {shell:null,module:false,keys:0,names};
              const cache=await caches.open(name);
              const shell=await cache.match(new URL('index.html',scope).href),mod=await cache.match(new URL('idc.mjs?v=2.0.0-dev',scope).href);
              const html=shell?await shell.text():'',js=mod?await mod.text():'';
              return {shell:html.match(/name="idc-audit-generation" content="(\d+)"/)?.[1]??null,module:js.includes('IDC_GENERATION_PROBE_'+gen),keys:(await cache.keys()).length};
            }""",gen)
            assert result['shell']==str(gen) and result['module'] and result['keys']>=160, (gen,result)
        def probe(p,gen):
            actual=p.locator('meta[name=idc-audit-generation]').get_attribute('content')
            module=p.evaluate("async g=>(await fetch('./idc.mjs?v=2.0.0-dev',{cache:'no-store'}).then(r=>r.text())).includes('IDC_GENERATION_PROBE_'+g)",gen)
            assert actual==str(gen) and module, {'expected':gen,'shell':actual,'module':module,'url':p.url}

        cache_probe(page,901)
        probe(page,901)
        page.evaluate("()=>{data.__upgradeAudit='keep';if(!save(false)||!checkpointData())throw Error('Could not save synthetic profile');localStorage.setItem('dartsCoachV4','LEGACY-UPGRADE-SENTINEL')}")
        page.evaluate("async()=>{const c=await caches.open('OTHER:unrelated');await c.put('./unrelated',new Response('keep'))}")
        # Generation 902 is available as a worker script but required assets
        # return 503. Require server-observed failure before asserting isolation.
        with lock:
            state.update(generation=902,fail=True)
        page.evaluate("async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()}")
        assert failed_request.wait(20), 'No failed precache request reached the synthetic server'
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
        waiting=page.evaluate("""async()=>{
          const r=await navigator.serviceWorker.getRegistration(),w=r.waiting;
          const channel=new MessageChannel();
          const answer=new Promise(resolve=>channel.port1.onmessage=e=>resolve(e.data));
          w.postMessage({type:'IDC_ASSET_STATUS'},[channel.port2]);
          return await Promise.race([answer,new Promise(resolve=>setTimeout(()=>resolve({error:'No worker inventory response',state:w.state,url:w.scriptURL}),5000))]);
        }""")
        assert waiting.get('generation')=='IDC:assets:2.0.0-dev903' and waiting.get('stored',0)>=160 and not waiting.get('missing'), waiting
        cache_probe(page,903)
        other=ctx.new_page()
        other.goto(url+'?audit=old-client')
        other.wait_for_function("navigator.serviceWorker.controller!==null")
        probe(other,901)
        probe(page,901)
        assert other.evaluate("localStorage.getItem('dartsCoachV4')")== 'LEGACY-UPGRADE-SENTINEL'
        observer=ctx.new_page()
        observer.goto(origin+'/observer.html')
        assert observer.evaluate('navigator.serviceWorker.controller===null')
        other.close()
        page.close()
        # Wait from an uncontrolled same-origin page, so opening the next
        # client cannot race with the old worker's release of its last client.
        observer.wait_for_function("async()=>{const r=await navigator.serviceWorker.getRegistration('./site/');const keys=await caches.keys();return !!r?.active&&r.active.state==='activated'&&!r.waiting&&keys.includes('IDC:assets:2.0.0-dev903')&&!keys.includes('IDC:assets:2.0.0-dev901')&&!keys.includes('IDC:assets:2.0.0-dev902')}")
        cache_probe(observer,903)
        page=ctx.new_page()
        page.goto(url+'?audit=activated-generation')
        observer.close()
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
