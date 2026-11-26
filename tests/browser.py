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
    page.evaluate("navigator.serviceWorker.ready")
    page.wait_for_function("navigator.serviceWorker.controller!==null")
    if os.getenv('IDC_BROWSER','chromium')=='chromium':
        ctx.set_offline(True)
        page.reload()
        page.locator('#idcExample').click()
        assert 'temporary-focus' in page.locator('#idcReport').inner_text()
    assert not errors, errors
    browser.close()
    print('IDC browser smoke and storage isolation passed')
