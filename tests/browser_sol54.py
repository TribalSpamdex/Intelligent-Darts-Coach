"""Independent real cross-tab IndexedDB concurrency regressions."""
import json, os
from playwright.sync_api import sync_playwright

def run_sol54_audit(browser):
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    results=[]
    try:
        a=ctx.new_page();b=ctx.new_page()
        for p in (a,b):
            p.route('**/__archive_probe__',lambda route:route.fulfill(status=200,content_type='text/html',body='<!doctype html><title>Archive concurrency probe</title>'))
            p.goto('http://127.0.0.1:8765/__archive_probe__')
        for initial in (False,True):
            for action in ('delete','save'):
                a.evaluate("async()=>{window.vault=await import('./storage-vault.mjs');await vault.deleteArchive();}")
                if initial:a.evaluate("async()=>vault.saveArchive(JSON.stringify({games:[],sessions:[],marker:'original'}))")
                a.evaluate("""()=>{
                  window.hashStarted=false;
                  const digest={digest:async(...args)=>{if(!hashStarted){hashStarted=true;await new Promise(r=>window.finishHash=r)}return crypto.subtle.digest(...args)}};
                  window.pendingSave=vault.saveArchive(JSON.stringify({games:[],sessions:[],marker:'slow'}),{digest}).then(()=>({saved:true}),e=>({saved:false,error:e.message}));
                }""")
                a.wait_for_function('hashStarted')
                b.evaluate("""async action=>{const m=await import('./storage-vault.mjs');if(action==='delete')await m.deleteArchive();else await m.saveArchive(JSON.stringify({games:[],sessions:[],marker:'newer'}));}""",action)
                result=a.evaluate("async()=>{finishHash();const result=await pendingSave;const latest=await vault.readArchive(),previous=await vault.readArchive({generation:'previous'});return {...result,latest:latest?JSON.parse(latest.json).marker:null,previous:previous?JSON.parse(previous.json).marker:null}}")
                ok=not result['saved'] and result['latest']==(None if action=='delete' else 'newer')
                results.append({'initialArchive':initial,'interveningAction':action,'pass':ok,**result})
        print('DEV54 cross-tab archive results: '+json.dumps(results),flush=True)
        assert all(r['pass'] for r in results),results
        # A new explicit save after deletion remains possible; metadata is not a profile.
        assert a.evaluate("""async()=>{await vault.deleteArchive();await vault.saveArchive(JSON.stringify({games:[],sessions:[],marker:'explicit'}));return JSON.parse((await vault.readArchive()).json).marker==='explicit'&&!(await vault.readArchive({generation:'previous'}))}""")
        print('DEV54 real IndexedDB: four concurrent delete/save cases and explicit fresh save passed',flush=True)
    finally:ctx.close()

if __name__=='__main__':
    with sync_playwright() as p:
        browser=getattr(p,os.getenv('IDC_BROWSER','chromium')).launch()
        try:run_sol54_audit(browser)
        finally:browser.close()
