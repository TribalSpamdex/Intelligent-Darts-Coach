"""Actual retained-history UI, file verification and exclusive primary commit."""
from browser_sol51 import ready
from pathlib import Path

def run_sol55_audit(browser):
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
    try:
        page=ctx.new_page();page.on('dialog',lambda d:d.accept());page.goto('http://127.0.0.1:8765/index.html');ready(page)
        page.evaluate('''()=>{ $('quickStartAverage').value='q60';startQuickFromAverage();
          data.games=[];data.sessions=[];data.bigSingles=[];
          const date=new Date();date.setDate(5);date.setHours(12,0,0,0);date.setMonth(date.getMonth()-28);
          for(let i=0;i<12;i++){const at=+date+i*DAY_MS,d=dateKey(at),id='retention-old-'+i,offset=new Date(at).getTimezoneOffset();data.sessions.push({id,start:at,startOffsetMinutes:offset,date:d,quick:true,quickGame:'Scoring Challenge',minutes:5});data.games.push({name:'Scoring Challenge',sessionId:id,quick:true,at:at+1000,day:d,offsetMinutes:offset,completion:'natural',benchmark:true,visits:10,scores:[180,...Array(9).fill(60)],points:720,oneEighties:1,details:{padding:'x'.repeat(1000)}});}
          const at=Date.now()-1000,d=dateKey(at),id='retention-recent';data.sessions.push({id,start:at,startOffsetMinutes:new Date(at).getTimezoneOffset(),date:d,quick:true,quickGame:'Scoring Challenge',minutes:5});data.games.push({name:'Scoring Challenge',sessionId:id,quick:true,at:at+1,day:d,offsetMinutes:new Date(at).getTimezoneOffset(),completion:'natural',benchmark:true,visits:10,scores:Array(10).fill(60),points:600,oneEighties:0});
          save(false);window.IDCPrecision.invalidate();show('settings');}''')
        ym=page.evaluate('data.games[0].day.slice(0,7)');before=page.evaluate('ym=>reportSnapshot(ym)',ym)
        assert page.locator('#idcRetentionApply').is_disabled()
        def verify_file():
            page.locator('#idcRetentionPreview').click();assert '12 rounds to summarise' in page.locator('#idcRetentionStatus').inner_text(),page.locator('#idcRetentionStatus').inner_text()
            with page.expect_download() as event:page.locator('#idcRetentionExport').click()
            path=event.value.path();assert Path(path).read_text()==page.evaluate('window.IDCRetentionBridge.snapshot()')
            page.locator('#idcRetentionFile').set_input_files({'name':'wrong.json','mimeType':'application/json','buffer':b'{}'})
            page.wait_for_function("$('idcRetentionStatus').textContent.includes('does not match')");assert page.locator('#idcRetentionApply').is_disabled()
            page.locator('#idcRetentionFile').set_input_files(path);page.wait_for_function("!$('idcRetentionApply').disabled")
        verify_file()
        page.evaluate("data.__retentionProbe='changed';save(false)");page.locator('#idcRetentionApply').click();assert page.evaluate('data.games.length===13 && !data.idcHistoryRetention')
        verify_file()
        page.evaluate("window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===KEY)throw Error('synthetic quota');return originalSetItem.call(this,k,v)}")
        page.locator('#idcRetentionApply').click();page.evaluate('Storage.prototype.setItem=originalSetItem');assert page.evaluate('data.games.length===13 && !data.idcHistoryRetention')
        verify_file();page.locator('#idcRetentionApply').click();page.wait_for_function("$('idcRetentionStatus').textContent.includes('consolidation saved')")
        assert page.evaluate("data.games.length===1 && data.sessions.length===1 && data.idcHistoryRetention.months[0].counts.games===12 && data.__retentionProbe==='changed'")
        assert page.evaluate('ym=>reportSnapshot(ym)',ym)==before
        page.evaluate("show('records')");assert '12' in page.locator('#recordOverview').inner_text();page.evaluate("show('progress')");assert '12 historical rounds' in page.locator('#idcHistoricalMemory').inner_text()
        page.reload();ready(page);assert page.evaluate("data.games.length===1 && data.idcHistoryRetention.months[0].counts.games===12")
        page.evaluate("show('settings')");page.locator('#idcRetentionPreview').click();assert page.locator('#idcRetentionApply').is_disabled()
        print('DEV55 rendered retention: exact backup, wrong backup, stale profile, quota failure, successful compaction, monthly report, records and reload passed')
    finally:ctx.close()
