"""Rendered Dev52 archive, coaching and actual fixed-check controls."""
from browser_sol51 import ready

def run_sol52_audit(browser):
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
    try:
        page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
        page.goto('http://127.0.0.1:8765/index.html');ready(page)
        assert 'dev52' in page.title()
        page.evaluate("$('quickStartAverage').value='q60';startQuickFromAverage();show('settings')")
        page.locator('#idcArchiveSave').click()
        page.wait_for_function("$('idcArchiveStatus').textContent.includes('Verified local archive')")
        assert page.evaluate("async()=>{const m=await import('./storage-vault.mjs');const r=await m.readArchive();return !!r&&JSON.parse(r.json).games.length===0}")
        page.reload();ready(page);page.evaluate("show('settings')");page.locator('#idcArchiveCheck').click()
        page.wait_for_function("$('idcArchiveStatus').textContent.includes('Verified local archive')")
        with page.expect_download() as info:page.locator('#idcArchiveExport').click()
        assert info.value.suggested_filename.endswith('.json')
        assert page.evaluate("async()=>{const m=await import('./storage-vault.mjs');const s=localStorage.getItem('dartsCoachV4');const j=JSON.stringify({games:[],sessions:[],synthetic:'x'.repeat(7600000)});await m.saveArchive(j);const r=await m.readArchive();return r.json===j&&localStorage.getItem('dartsCoachV4')===s}")
        page.locator('#idcArchiveDelete').click();page.wait_for_function("$('idcArchiveStatus').textContent.includes('Local archive deleted')")
        assert page.evaluate("async()=>!(await (await import('./storage-vault.mjs')).readArchive())")
        page.evaluate("show('technique')")
        page.locator('#idcQuestion').fill('Are any weaknesses emerging?');page.locator('#idcAsk').click()
        assert 'warning' in page.locator('#idcAnswer').inner_text().lower()
        assert page.evaluate("window.IDCTrainingBridge.startFixedQuickCheck('Scoring Challenge')")
        assert page.evaluate("session().quick && session().plan[0].seconds===300 && activeGame.skillProtocol.name==='Scoring Challenge'")
        page.locator('#exerciseIntro').get_by_role('button',name='Play',exact=True).click()
        assert page.evaluate('!!activeGame.skillProtocol.rules')
        page.reload();ready(page);assert page.evaluate("activeGame.skillProtocol.name==='Scoring Challenge'")
        page.wait_for_function('navigator.serviceWorker.controller!==null');ctx.set_offline(True);page.reload();ready(page);assert 'dev52' in page.title();ctx.set_offline(False)
        assert not errors,errors
        print('DEV52 rendered Chromium: archive save/readback/reload/export/delete, 7.6 MB IndexedDB copy, Coach watch, native fixed-check start/metadata/reload and offline navigation passed')
    finally:ctx.close()
