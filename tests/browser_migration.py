"""Synthetic historical-schema and backup/restore integration probes.

Legacy fixtures exercise the supported migration branches, not a claim that
every historical real-world profile has been obtained or tested.
"""
import json

URL='http://127.0.0.1:8765/index.html'

def run_migration_audit(browser):
    ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    try:
        page=ctx.new_page()
        page.goto(URL)
        page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held' && !!window.IDCPolicy")
        fixture=page.evaluate("""()=>{
          document.getElementById('quickStartAverage').value='q60';
          startQuickFromAverage();
          const d=clone(data);
          d.activeSession=null;d.game=null;
          d.__migrationProbe='Résumé 🎯 日本語';
          d.games=[{name:'Archived exercise',at:Date.now()-86400000,completion:'natural',marker:'historical'}];
          d.sessions=[];d.assessmentHistory=[];
          return d;
        }""")
        assert fixture['assessment']['finished'] is True
        # Exercise both accepted legacy storage keys with completed old
        # assessments, without touching the separate V6.2 control namespace.
        for key,version in [('IDC:legacy:v3',3),('IDC:legacy:v2',2)]:
            legacy=json.loads(json.dumps(fixture))
            legacy['assessment']['version']=version
            migrated=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
            try:
                mp=migrated.new_page()
                payload=json.dumps(json.dumps(legacy,ensure_ascii=True))
                mp.add_init_script("if(!localStorage.getItem('IDC:training:v1'))localStorage.setItem("+json.dumps(key)+","+payload+");localStorage.setItem('dartsCoachV4','CONTROL-MIGRATION-SENTINEL');")
                mp.goto(URL)
                mp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
                check=mp.evaluate("""()=>({marker:data.__migrationProbe,assessment:data.assessment.finished,carried:data.assessment.carriedForward===true,history:data.assessmentHistory.filter(x=>x.migrationOriginal).length,game:data.games[0]?.marker,stored:!!localStorage.getItem(KEY),control:localStorage.getItem('dartsCoachV4')})""")
                assert check=={'marker':'Résumé 🎯 日本語','assessment':True,'carried':True,'history':1,'game':'historical','stored':True,'control':'CONTROL-MIGRATION-SENTINEL'}, check
                mp.reload()
                mp.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
                assert mp.evaluate("data.assessmentHistory.filter(x=>x.migrationOriginal).length===1 && data.games[0].marker==='historical'")
            finally:
                migrated.close()
        result=page.evaluate("""async()=>{
          const {newMemory}=await import('./coach-memory.mjs?v=2.0.0-dev');
          const originalConfirm=window.confirm,originalAlert=window.alert;
          const oldSave=Storage.prototype.setItem;
          const check=(v,m)=>{if(!v)throw Error(m)};
          try{
           window.confirm=()=>true;window.alert=()=>{};
           data.__migrationProbe='Résumé 🎯 日本語';
           data.idcCoachMemory=newMemory();
           data.idcCoachMemory.state.facts=[{key:'preferred double',value:'D16',kind:'reported',at:new Date().toISOString()}];
           data.__largeProbe='Résumé 🎯 日本語 '.repeat(14000);
           check(save(false)&&checkpointData(),'Large profile could not be saved');
           const packed=JSON.parse(localStorage.getItem(KEY));
           check(packed.format==='dc-lzw1-primary','Large profile did not take compressed primary path');
           check(JSON.parse(dc998Unpack(packed.packed,packed.length)).__largeProbe===data.__largeProbe,'Unicode compression round trip failed');
           generateBackup();
           const backup=$('backupText').value,exported=JSON.parse(backup);
           check(exported.__largeProbe===data.__largeProbe,'Export did not include entire live profile');
           check(exported.idcCoachMemory.state.facts[0].value==='D16','Coach fact missing from export');
           const current=localStorage.getItem(KEY),currentFence=localStorage.getItem(RECOVERY_FENCE);
           function reject(candidate){
            let refused=false;
            try{applyRestoredData(validateRestore(JSON.stringify(candidate)))}catch(e){refused=true}
            check(refused&&localStorage.getItem(KEY)===current&&localStorage.getItem(RECOVERY_FENCE)===currentFence,'Malformed backup mutated committed profile');
           }
           reject({...exported,games:[null]});
           reject({...exported,assessment:[]});
           reject({...exported,idcCoachMemory:{format:'wrong'}});
           const now=Date.now(),item={name:'Bull Accuracy',mode:'timed',seconds:600,provenanceId:'migration:0'};
           const active={id:now,start:now-60000,extra:true,quick:true,quickGame:'Bull Accuracy',quickSeconds:600,index:0,phase:'playing',pausedAt:null,pausedTotal:0,activityStarted:now-60000,activityAccumulated:0,lastActiveSaveAt:now-30000,plan:[item],round:1,roundsCompleted:0,completed:[],allocated:true,benchmarkSeconds:0};
           const game={name:'Bull Accuracy',started:now-60000,thrown:1,inner:1,outer:0,misses:0};
           active.dc75Undo={index:0,exerciseId:item.provenanceId,game:{...game,thrown:0,inner:0}};
           const good={...exported,activeSession:active,game};
           reject({...good,game:{...game,name:'Unknown'}});
           reject({...good,game:null});
           reject({...good,activeSession:{...active,plan:[{...item,name:'Unknown'}]}});
           reject({...good,activeSession:{...active,plan:[{...item,seconds:-1}]}});
           reject({...good,activeSession:{...active,pausedTotal:-100}});
           reject({...good,activeSession:{...active,index:99}});
           // An atomic storage failure must leave both the primary and fence intact.
           Storage.prototype.setItem=function(k,v){if(k===KEY)throw new DOMException('Full','QuotaExceededError');return oldSave.call(this,k,v)};
           reject(good);
           Storage.prototype.setItem=oldSave;
           // A cancelled restore has no durable side effects.
           window.confirm=()=>false;
           check(applyRestoredData(validateRestore(JSON.stringify(good)))===false&&localStorage.getItem(KEY)===current,'Cancelled restore replaced data');
           window.confirm=()=>true;
           check(applyRestoredData(validateRestore(JSON.stringify(good)))===true,'Valid backup rejected');
           check(data.activeSession.pausedAt===active.lastActiveSaveAt&&data.activeSession.activityStarted===null&&data.activeSession.activityAccumulated===30000,'Interrupted session clock not recovered');
           check(activeGame.thrown===1&&undoSnapshot?.thrown===0,'Active game or undo missing after import');
           check(data.idcCoachMemory.state.facts[0].value==='D16','Coach fact lost on restore');
           check(data.__largeProbe===exported.__largeProbe,'Large imported profile differs');
           return {rejections:9,legacyKeys:2,compressed:true,paused:true,undo:true};
          }finally{Storage.prototype.setItem=oldSave;window.confirm=originalConfirm;window.alert=originalAlert}
        }""")
        assert result['compressed'] and result['paused'] and result['undo'], result
        page.reload()
        page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held'")
        assert page.evaluate("data.__migrationProbe==='Résumé 🎯 日本語' && data.activeSession.pausedAt!==null && activeGame.thrown===1 && undoSnapshot?.thrown===0")
        print('Synthetic legacy migration, large Unicode backup, atomic rejection and interrupted-session restore audit:',result)
    finally:
        ctx.close()
