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
             const rounds=session().roundsCompleted;
             miss(name);
             if(JSON.stringify(activeGame)===before&&session().roundsCompleted===rounds)throw Error('Legal miss made no progress: '+label);
             undoGame();
             if(JSON.stringify(activeGame)!==before||session().roundsCompleted!==rounds||data.games.length)throw Error('First-action Undo mismatch: '+label);
             let completed=false,steps=0;
             // Complete one natural all-miss round for each name and mastery mode at tier 4.
             if(tier===4){
              while(!data.games.length&&steps<600){
               prepare(name);const prior=JSON.stringify(activeGame);miss(name);steps++;
               if(data.games.length){
                const row=data.games[0];
                if(row.name!==name||row.completion!=='natural'||row.sessionId!==session().id||session().roundsCompleted!==1||session().round!==2||activeGame.name!==name)throw Error('Round record/restart mismatch: '+label);
                undoGame();
                if(data.games.length||session().roundsCompleted!==0||session().round!==1||JSON.stringify(activeGame)!==prior)throw Error('Terminal-action Undo mismatch: '+label);
                completed=true;break;
               }
               if(JSON.stringify(activeGame)===prior)throw Error('Round stopped progressing: '+label);
              }
              if(!completed)throw Error('No bounded natural round: '+label);
              session().activityStarted=Date.now()-600001;session().activityAccumulated=0;
              trainingTimer();
              if(session().phase!=='complete'||session().completed.length!==1||session().completed[0].seconds!==600||session().index!==0)throw Error('Timer completion mismatch: '+label);
             }
             checks.push({name,tier,mode,completed,steps});
            }
           }
           if(alerts.length)throw Error('Unexpected game alert: '+alerts.join('; '));
           return {names:new Set(checks.map(x=>x.name)).size,configurations:checks.length,naturalRounds:checks.filter(x=>x.completed).length,actions:checks.reduce((n,x)=>n+x.steps+1,0)};
          }finally{save=oldSave;window.alert=oldAlert;announceRound=oldAnnounce;hideRoundAnnouncement()}
        }""")
        assert result['names']==41 and result['configurations']==336 and result['naturalRounds']==48, result
        print('Native gameplay action, round, Undo and timer matrix:',result)
    finally:
        ctx.close()
