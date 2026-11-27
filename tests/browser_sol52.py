"""Rendered Dev52 archive, coaching and actual fixed-check controls."""
import os
from browser_sol51 import ready

def run_sol52_audit(browser):
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
    try:
        page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
        page.goto('http://127.0.0.1:8765/index.html');ready(page)
        assert 'dev53' in page.title()
        page.evaluate("$('quickStartAverage').value='q60';startQuickFromAverage();show('settings')")
        page.locator('#idcArchiveSave').click()
        page.wait_for_function("$('idcArchiveStatus').textContent.includes('Verified local archive')")
        assert page.evaluate("async()=>{const m=await import('./storage-vault.mjs');const r=await m.readArchive();return !!r&&JSON.parse(r.json).games.length===0}")
        page.reload();ready(page);page.evaluate("show('settings')");page.locator('#idcArchiveCheck').click()
        page.wait_for_function("$('idcArchiveStatus').textContent.includes('Verified local archive')")
        with page.expect_download() as info:page.locator('#idcArchiveExport').click()
        assert info.value.suggested_filename.endswith('.json')
        assert page.evaluate("async()=>{const m=await import('./storage-vault.mjs');const s=localStorage.getItem(KEY);const j=JSON.stringify({games:[],sessions:[],synthetic:'x'.repeat(7600000)});await m.saveArchive(j);const r=await m.readArchive();return r.json===j&&localStorage.getItem(KEY)===s}")
        # Rotate atomically; a corrupted latest copy cannot overwrite the previous verified archive.
        assert page.evaluate("async()=>{const m=await import('./storage-vault.mjs');const r=await m.readArchive({generation:'previous'});return !!r&&JSON.parse(r.json).games.length===0}")
        with page.expect_download() as previous_info:page.locator('#idcArchivePrevious').click()
        assert previous_info.value.suggested_filename.startswith('idc-previous-archive-')
        assert page.evaluate("""async()=>{
          const m=await import('./storage-vault.mjs');const before=(await m.readArchive({generation:'previous'})).checksum;
          const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('IDC:local-archive:v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
          await new Promise((resolve,reject)=>{const t=db.transaction('snapshots','readwrite'),s=t.objectStore('snapshots');const r=s.get('manual');r.onsuccess=()=>{s.put({...r.result,json:'damaged'},'manual')};t.oncomplete=resolve;t.onabort=()=>reject(t.error)});db.close();
          const status=await m.archiveStatus();if(status.latest.status!=='unavailable'||status.previous.status!=='verified')return false;
          await m.saveArchive(JSON.stringify({games:[],sessions:[],probe:'new'}));return (await m.readArchive({generation:'previous'})).checksum===before;
        }""")
        page.locator('#idcArchiveDelete').click();page.wait_for_function("$('idcArchiveStatus').textContent.includes('Local archive deleted')")
        assert page.evaluate("async()=>{const m=await import('./storage-vault.mjs');return !(await m.readArchive())&&!(await m.readArchive({generation:'previous'}))}")
        page.evaluate("show('technique')")
        page.locator('#idcQuestion').fill('Why has my performance changed?');page.locator('#idcAsk').click()
        assert 'comparable fixed' in page.locator('#idcAnswer').inner_text().lower()
        page.locator('#idcQuestion').fill('Are any weaknesses emerging?');page.locator('#idcAsk').click()
        assert 'warning' in page.locator('#idcAnswer').inner_text().lower()
        assert page.evaluate("window.IDCTrainingBridge.startFixedQuickCheck('Scoring Challenge')")
        assert page.evaluate("session().quick && session().plan[0].seconds===300 && activeGame.skillProtocol.name==='Scoring Challenge'")
        page.locator('#exerciseIntro').get_by_role('button',name='Play',exact=True).click()
        assert page.evaluate('!!activeGame.skillProtocol.rules')
        page.reload();ready(page);assert page.evaluate("activeGame.skillProtocol.name==='Scoring Challenge'")
        page.wait_for_function('navigator.serviceWorker.controller!==null')
        # Chromium's network-emulation gate is supplementary; both engines
        # must pass actual socket-disconnection in the pinned Dev51 upgrade.
        if os.getenv('IDC_BROWSER','chromium')=='chromium':
            ctx.set_offline(True);page.reload();ready(page);assert 'dev53' in page.title();ctx.set_offline(False)
        assert not errors,errors
        print('DEV52 rendered '+os.getenv('IDC_BROWSER','chromium')+': archive save/readback/reload/export/delete, 7.6 MB IndexedDB copy, Coach watch, native fixed-check start/metadata/reload passed')
    finally:ctx.close()
