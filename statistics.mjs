// Descriptive statistics for independent calendar-day units.
// No confidence interval or probability of future success is implied.
export function quantile(values,p){
 if(!Array.isArray(values)||values.some(v=>!Number.isFinite(v))||!Number.isFinite(p)||p<0||p>1)throw Error('Invalid quantile input');
 if(!values.length)return null;
 const a=[...values].sort((a,b)=>a-b),i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);
 return a[lo]+(a[hi]-a[lo])*(i-lo);
}
export function distribution(values){
 if(!Array.isArray(values)||values.some(v=>!Number.isFinite(v)))throw Error('Invalid distribution');
 if(!values.length)return {n:0,mean:null,sd:null,median:null,q1:null,q3:null,iqr:null,mad:null,min:null,max:null};
 const n=values.length,mean=values.reduce((a,b)=>a+b,0)/n,median=quantile(values,.5),q1=quantile(values,.25),q3=quantile(values,.75);
 return {n,mean,sd:n>1?Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)):null,median,q1,q3,iqr:q3-q1,mad:quantile(values.map(v=>Math.abs(v-median)),.5),min:quantile(values,0),max:quantile(values,1)};
}
export function groupedDistribution(rows,key,value){
 const groups=new Map();
 for(const row of rows){const k=key(row),v=value(row);if(!Number.isFinite(v))throw Error('Invalid measurement');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(v)}
 return [...groups].map(([key,values])=>({key,...distribution(values)}));
}
export function describeDifference(earlier,recent,{floor,minDays=7,minBlocks=3}={}){
 if(!Number.isFinite(floor)||floor<=0||!Number.isInteger(minDays)||minDays<2||!Number.isInteger(minBlocks)||minBlocks<2)throw Error('Invalid comparison policy');
 const a=distribution(earlier.map(x=>x.value)),b=distribution(recent.map(x=>x.value));
 const distinct=xs=>new Set(xs.map(x=>x.day)).size===xs.length;
 if(!distinct(earlier)||!distinct(recent)||new Set([...earlier,...recent].map(x=>x.day)).size!==earlier.length+recent.length)throw Error('Comparison days must be unique and disjoint');
 const blocks=xs=>groupedDistribution(xs,x=>x.block,x=>x.value).map(g=>g.mean);
 const x=blocks(earlier),y=blocks(recent);
 const result={earlier:a,recent:b,blocks:[x.length,y.length],delta:null,noise:null,status:'insufficient',floor};
 if(a.n<minDays||b.n<minDays||x.length<minBlocks||y.length<minBlocks)return result;
 const dx=distribution(x),dy=distribution(y),delta=dy.mean-dx.mean,noise=2.5*Math.sqrt(dx.sd**2/x.length+dy.sd**2/y.length);
 const consistency=y.filter(v=>Math.sign(v-dx.mean)===Math.sign(delta)).length/y.length;
 return {...result,delta,noise,consistency,status:Math.abs(delta)>=Math.max(floor,noise)&&consistency>=.75?(delta>0?'improving':'declining'):'unclear'};
}
