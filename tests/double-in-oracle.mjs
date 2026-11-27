// Independent prefix-sum oracle, separate from the production transition loop.
// Includes both previously opened and unopened double-in visits and empty/short visits.
export function runDoubleInOracle(visit){
 const board=[{s:'MISS',v:0,d:false},{s:'25',v:25,d:false},{s:'50',v:50,d:true}];
 for(let n=1;n<=20;n++)for(const [r,k] of [['S',1],['D',2],['T',3]])board.push({s:r+n,v:n*k,d:r==='D'});
 let seed=0x47c118e3;
 const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
 const count={checked:0,opened:0,unopened:0,bust:0,finished:0,noEntry:0};
 for(let i=0;i<100000;i++){
  const opened=i%2===0,arr=Array.from({length:random()%4},()=>board[random()%board.length]),entry=opened?0:arr.findIndex(x=>x.d);
  const credits=arr.map((x,j)=>entry>=0&&j>=entry?x.v:0);
  const sums=credits.map((_,j)=>credits.slice(0,j+1).reduce((a,b)=>a+b,0));
  // Deliberately create finishes, leave-one busts and overshoots, as well as broad scores.
  const target=i%3===0?Math.max(2,(sums.at(-1)??0)+(random()%5)-2):2+random()%500;
  const left=sums.map(x=>target-x);
  const terminal=left.findIndex(x=>x<=1);
  const bust=terminal>=0&&(left[terminal]!==0||!arr[terminal].d);
  const finish=terminal>=0&&!bust;
  const expected={remaining:bust?target:finish?0:left.at(-1)??target,bust,finished:finish,opened:bust?opened:opened||entry>=0,used:terminal>=0?terminal+1:arr.length};
  const actual=visit(target,arr.map(x=>x.s),{doubleIn:true,opened});
  if(Object.keys(expected).some(k=>expected[k]!==actual[k]))throw Error(JSON.stringify({target,opened,darts:arr.map(x=>x.s),actual,expected}));
  count.checked++;count[opened?'opened':'unopened']++;count.bust+=Number(bust);count.finished+=Number(finish);count.noEntry+=Number(!opened&&entry<0);
 }
 return count;
}
