"""Native action/round/Undo/timer matrix; synthetic isolated profile.

This tests the actual JS handlers and in-memory saved-round records, not human
throws or every legal outcome. The matrix substitutes disk writes/renderAll
with a lightweight save; existing browser smoke tests cover real persistence.
"""
def run_gameplay_audit(browser):
    ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    try:
        page=ctx.new_page()
        page.goto('http://127.0.0.1:8765/index.html')
        page.wait_for_function("typeof idcWriter!=='undefined' && idcWriter==='held' && !!window.IDCPolicy")
        result=page.evaluate("""()=>{
          const oldSave=save,oldAlert=window.alert,oldAnnounce=announceRound;
          const alerts=[],checks=[];
          try{
           document.getElementById('quickStartAverage').value='q60';startQuickFromAverage();
           data.sessions=[];data.games=[];data.bigSingles=[];data.activeSession=null;
           currentTab='train';
           save=()=>true;announceRound=()=>{};window.alert=x=>alerts.push(String(x));
           const scoring=new Set(['Scoring Survival','Scoring Ladder','301 Pressure','501 Pressure','Setup Shot','Risk or Reward','170 Challenge','First Nine Siege']);
           const genericNumber=new Set(['Halve It','Cricket Countdown']);
           const genericMiss=new Set(['101 Sprint','Golf Five','Double Double','Switchback']);
           const newerMiss=new Set(['Last Dart Standing','Neighbour Trap','Double Jackpot','Dartboard Bingo','Checkout Poker','Double Bull Bridge','Double Duel']);
           function prepare(name){
            const g=activeGame;
            if(name==='Last Dart Rescue'&&!g.aim){const score=g.targets[g.index];rescueAim(score===50?'BULL':'D'+score/2)}
            if(name==='Last Dart Standing'&&!g.choice)new40Choice(g.scores[g.index]%2===0?'FINISH':'SETUP');
            if(name==='Double Jackpot'&&!g.choice)new40Choice([20,16,10,5].find(n=>!g.usedTargets?.includes(n)));
            if(name==='Checkout Poker'&&!g.chosen)new40Choice(g.cards.find(n=>!g.cardsUsed?.includes(n)));
           }
           function miss(name){
            if(scoring.has(name)){padSet('0');scoringVisit();return}
            if(name==='Double-In 201'){padSet('0');dc591OpeningSubmit();return}
            if(name==='High-Low'||name==='Split the Difference'){padSet('0');new40Score();return}
            if(genericNumber.has(name)){newGameDart(0);return}
            if(genericMiss.has(name)){newGameDart('miss');return}
            if(newerMiss.has(name)){new40Dart('miss');return}
            const actions={
             'Doubles Survival':()=>survivalDart(false),'Treble Hunt':()=>trebleDart(false),
             'Doubles Streak':()=>doublesStreakDart(false),'Staying Straight':()=>straightDart(0),
             'Checkout Climb':checkoutMiss,'Focused Checkouts':focusedMiss,
             'Bull Accuracy':()=>dcVisitRecord('miss'),'Bull Survival':()=>bullSurvival(false),'Bull Streak':()=>bullStreak(false),
             'Shanghai Combo':()=>shanghaiDart(false),'Bull Bank':()=>bullBankDart(0),'Number Lock':()=>numberLockDart(0),
             'Outside Doubles':()=>newGameDart('outside'),'Last Dart Rescue':()=>rescueDart(false),
             'Pressure Cricket':()=>new40Dart(0),'Bull Blackjack':()=>new40Dart(0),
             'Target Mastery':()=>dc23MasteryInput('miss')
            };
            if(!actions[name])throw Error('Unmapped quick game '+name);
            actions[name]();
           }
           let id=Date.now();
           for(let tier=1;tier<=7;tier++)for(const name of QUICK_GAMES){
            for(const mode of name==='Target Mastery'?DC23_MASTERY_MODES:[null]){
             for(const skill of SKILLS)data.skills[skill].level=tier;
             data.games=[];undoSnapshot=null;const start=Date.now(),item={name,seconds:600,mode:'timed',provenanceId:'audit:'+id};
             if(mode)item.mastery={mode};
             data.activeSession={id:++id,start,extra:false,quick:false,index:0,phase:'playing',pausedAt:null,pausedTotal:0,activityStarted:start,activityAccumulated:0,plan:[item],round:1,roundsCompleted:0,completed:[],allocated:true,benchmarkSeconds:0};
             window.IDCPrecision.invalidate();
             activeGame=buildGame(name);data.game=activeGame;
             renderTraining();
             const label=name+' tier '+tier+(mode?' '+mode:'');
             if(activeGame.name!==name||mode&&activeGame.mode!==mode)throw Error('Wrong game configuration '+label);
             prepare(name);
             const before=JSON.stringify(activeGame);
             const totals=JSON.stringify([data.bestDouble,data.bestCheckout,data.doublesHit,data.doublesThrown]);
             const rounds=session().roundsCompleted;
             miss(name);
             if(JSON.stringify(activeGame)===before&&session().roundsCompleted===rounds)throw Error('Legal miss made no progress: '+label);
             undoGame();
             if(JSON.stringify(activeGame)!==before||session().roundsCompleted!==rounds||data.games.length)throw Error('First-action Undo mismatch: '+label);
             let completed=false,steps=0;
             // Complete an entire round at EVERY coarse tier and mastery mode.
             {
              while(!data.games.length&&steps<600){
               prepare(name);const prior=JSON.stringify(activeGame);miss(name);steps++;
               if(data.games.length){
                const row=data.games[0];
                if(row.name!==name||row.completion!=='natural'||row.sessionId!==session().id||session().roundsCompleted!==1||session().round!==2||activeGame.name!==name)throw Error('Round record/restart mismatch: '+label);
                undoGame();
                if(data.games.length||session().roundsCompleted!==0||session().round!==1||JSON.stringify(activeGame)!==prior||JSON.stringify([data.bestDouble,data.bestCheckout,data.doublesHit,data.doublesThrown])!==totals)throw Error('Terminal-action Undo mismatch: '+label);
                completed=true;break;
               }
               if(JSON.stringify(activeGame)===prior)throw Error('Round stopped progressing: '+label);
              }
              if(!completed)throw Error('No bounded natural round: '+label);
              session().activityStarted=Date.now()-600001;session().activityAccumulated=0;
              session().pausedAt=Date.now();trainingTimer();
              if(session().phase!=='playing'||session().completed.length)throw Error('Paused timer completed an exercise: '+label);
              session().pausedAt=null;trainingTimer();
              if(session().phase!=='complete'||session().completed.length!==1||session().completed[0].seconds!==600||session().index!==0)throw Error('Timer completion mismatch: '+label);
              const after=JSON.stringify(session().completed),savedGames=data.games.length;
              trainingTimer();finishExpiredExercise();
              if(JSON.stringify(session().completed)!==after||data.games.length!==savedGames)throw Error('Repeated expiry duplicated an activity: '+label);
             }
             checks.push({name,tier,mode,completed,steps});
            }
           }
           // Checkout buttons and handlers must use real double-out mathematics.
           data.activeSession.plan=[{name:'Target Mastery',mode:'timed',seconds:600,mastery:{mode:'checkout',band:'101+'}}];
           data.activeSession.phase='playing';data.activeSession.pausedAt=null;data.activeSession.activityStarted=Date.now();
           activeGame=buildGame('Target Mastery');data.game=activeGame;activeGame.checkoutExample=101;renderTraining();
           const beforeCheckout=JSON.stringify(activeGame);
           dc23MasteryInput('finish1');
           if(JSON.stringify(activeGame)!==beforeCheckout)throw Error('Impossible one-dart mastery finish accepted');
           if([...document.querySelectorAll('button')].some(b=>b.getAttribute('onclick')==="dc23MasteryInput('finish1')"))throw Error('Impossible mastery finish button rendered');
           dc23MasteryInput('finish2');
           if(activeGame.attempts!==1||activeGame.attemptLog[0].dartsUsed!==2||activeGame.hits!==1)throw Error('Legal two-dart mastery finish rejected');
           undoGame();if(JSON.stringify(activeGame)!==beforeCheckout)throw Error('Mastery checkout Undo mismatch');
           // Native double-in keypad: opening double on dart two, credited
           // points only after entry, then legal double-out and saved-result Undo.
           data.games=[];data.activeSession.plan=[{name:'Double-In 201',mode:'timed',seconds:600}];data.activeSession.round=1;data.activeSession.roundsCompleted=0;data.activeSession.lastRoundUndo=null;
           activeGame=buildGame('Double-In 201');data.game=activeGame;renderTraining();
           if(!dc591OpeningValid(80,20,2,3,3)||dc591OpeningValid(80,20,3,3,3))throw Error('Double-in entry allowance mismatch');
           padSet('80');dc591OpeningSubmit();dc591Select(20,2);dc591Confirm();
           if(!activeGame.entered||activeGame.remaining!==121||activeGame.entryDarts!==2||activeGame.dartsUsed!==3||activeGame.entryMisses!==1)throw Error('Opening visit not credited accurately');
           renderTraining();padSet('81');doubleInVisit();
           if(activeGame.remaining!==40||activeGame.dartsUsed!==6)throw Error('Double-in follow-up visit mismatch');
           renderTraining();const beforeFinish=JSON.stringify(activeGame);padSet('40');doubleInVisit();chooseCheckoutDarts(1);confirmCheckoutDarts();
           if(data.games.length!==1||data.games[0].dartsUsed!==7||data.games[0].highestFinish!==40||!data.games[0].win)throw Error('Double-in finish not saved accurately');
           undoGame();if(data.games.length||JSON.stringify(activeGame)!==beforeFinish)throw Error('Double-in finish Undo mismatch');
           // The target sequence cannot invite extra darts after the rival wins.
           const duel={name:'Double Duel',tier:4,opponentEvery:2,turn:1,player:0,opponent:3,sequence:[20,16,8,10,12,6]};
           if(dcVisitSpec(duel).targets.length!==1)throw Error('Personalised rival boundary is not reflected in visit display');
           // A rules dialog can temporarily pause active practice, but a
           // background transition revokes its permission to auto-resume.
           data.activeSession.plan=[{name:'Bull Accuracy',mode:'timed',seconds:600}];
           data.activeSession.phase='playing';data.activeSession.pausedAt=null;data.activeSession.activityStarted=Date.now()-5000;data.activeSession.activityAccumulated=0;data.activeSession.pausedTotal=0;
           activeGame=buildGame('Bull Accuracy');data.game=activeGame;renderTraining();
           dc88Open();
           if(!session().pausedAt||!dc88Resume)throw Error('Rules modal did not pause practice');
           const dialog=document.getElementById('dc88Dialog'),pausedAt=session().pausedAt,elapsed=exerciseElapsed();
           dc74PauseForBackground();
           if(dc88Resume!==null)throw Error('Background did not revoke modal auto-resume');
           // Invoke the registered close handler deterministically; the
           // native close event may otherwise be queued after this probe.
           const onclose=dialog.onclose;dialog.onclose=null;dialog.close();onclose();
           if(session().pausedAt!==pausedAt||exerciseElapsed()!==elapsed)throw Error('Rules modal resumed after background');
           if(alerts.length)throw Error('Unexpected game alert: '+alerts.join('; '));
           return {names:new Set(checks.map(x=>x.name)).size,configurations:checks.length,naturalRounds:checks.filter(x=>x.completed).length,actions:checks.reduce((n,x)=>n+x.steps+1,0)};
          }finally{save=oldSave;window.alert=oldAlert;announceRound=oldAnnounce;hideRoundAnnouncement()}
        }""")
        assert result['names']==41 and result['configurations']==336 and result['naturalRounds']==336, result
        print('Native gameplay action, round, Undo and timer matrix:',result)
    finally:
        ctx.close()
