// A deliberately separate, explicit local archive. It never replaces, loads
// into, or silently resurrects the primary player profile. A successful IDB
// transaction is required before reporting a saved copy.
const DB='IDC:local-archive:v1',STORE='snapshots',KEY='manual',PREVIOUS='previous',REVISION='revision';
export const ARCHIVE_LIMIT=50_000_000;
const encoder=new TextEncoder();
export async function archiveEnvelope(json,now=Date.now(),digest=globalThis.crypto?.subtle){
 if(typeof json!=='string'||!json.length||!Number.isSafeInteger(now)||now<=0)throw Error('Invalid local archive input');
 const bytes=encoder.encode(json);if(bytes.length>ARCHIVE_LIMIT)throw Error('Archive exceeds the 50 MB safety limit. Save an external file.');
 const parsed=JSON.parse(json);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Array.isArray(parsed.games)||!Array.isArray(parsed.sessions))throw Error('Invalid player archive');
 if(!digest)throw Error('Archive integrity checks are unavailable');
 const checksum=Array.from(new Uint8Array(await digest.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 return {version:1,savedAt:now,bytes:bytes.length,checksum,json};
}
export async function verifyArchive(value,digest=globalThis.crypto?.subtle){
 if(!value||value.version!==1||typeof value.checksum!=='string'||!/^[a-f0-9]{64}$/.test(value.checksum))throw Error('Unknown or damaged archive');
 const current=await archiveEnvelope(value.json,value.savedAt,digest);
 if(value.bytes!==current.bytes||value.checksum!==current.checksum)throw Error('Archive integrity check failed');
 return current;
}
function openDB(factory){return new Promise((resolve,reject)=>{
 if(!factory){reject(Error('IndexedDB is unavailable on this device'));return}
 const req=factory.open(DB,1);let done=false;
 req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
 req.onblocked=()=>{done=true;reject(Error('Local archive is blocked by another app window'))};
 req.onerror=()=>{done=true;reject(req.error??Error('Local archive could not open'))};
 req.onsuccess=()=>{const db=req.result;if(done){db.close();return}db.onversionchange=()=>db.close();resolve(db)};
})}
async function transaction(mode,operation,factory){
 const db=await openDB(factory);
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode);let result;
  tx.oncomplete=()=>resolve(result);
  tx.onabort=()=>reject(tx.error??Error('Local archive transaction aborted'));
  tx.onerror=()=>reject(tx.error??Error('Local archive transaction failed'));
  const req=operation(tx.objectStore(STORE)),success=req.onsuccess;req.onsuccess=()=>{try{success?.();result=req.result}catch(e){tx.abort();reject(e)}};
 })}finally{db.close()}
}
// Read and verify the existing generation before attempting rotation. The
// read-write transaction rechecks it, so concurrent saves cannot silently
// overwrite a newer snapshot. Failed quota writes abort both generations.
const sameGeneration=(a,b)=>a===b||!!a&&!!b&&a.version===b.version&&a.savedAt===b.savedAt&&a.bytes===b.bytes&&a.checksum===b.checksum&&a.json===b.json;
async function rotateArchive(value,old,verified,revision,factory){
 const db=await openDB(factory);
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);let failure;
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(failure??tx.error??Error('Local archive transaction aborted'));tx.onerror=()=>reject(failure??tx.error??Error('Local archive transaction failed'));
  const request=store.get(KEY);
  request.onsuccess=()=>{try{
   const current=request.result,lease=store.get(REVISION);
   lease.onsuccess=()=>{try{
    if(!sameGeneration(current,old)||(lease.result??0)!==revision){failure=Error('Archive changed in another window; check it and retry');tx.abort();return}
    if(verified&&verified.checksum!==value.checksum)store.put(verified,PREVIOUS);
    store.put(value,KEY);store.put(nextRevision(revision),REVISION);
   }catch(e){failure=e;tx.abort()}};
  }catch(e){failure=e;try{tx.abort()}catch{reject(e)}}};
 })}finally{db.close()}
}
export async function saveArchive(json,{factory=globalThis.indexedDB,digest=globalThis.crypto?.subtle,now=Date.now()}={}){
 // Capture the lease BEFORE asynchronous hashing. Delete also advances it,
 // including on an empty store, so a suspended save cannot resurrect a copy.
 const revision=(await transaction('readonly',s=>s.get(REVISION),factory))??0;
 nextRevision(revision);
 const value=await archiveEnvelope(json,now,digest),old=await transaction('readonly',s=>s.get(KEY),factory);
 let verified=null;if(old!==undefined){try{verified=await verifyArchive(old,digest)}catch{/* Never rotate a damaged generation over a good older copy. */}}
 await rotateArchive(value,old,verified,revision,factory);return {savedAt:value.savedAt,bytes:value.bytes,checksum:value.checksum};
}
export async function readArchive({factory=globalThis.indexedDB,digest=globalThis.crypto?.subtle,generation='latest'}={}){
 if(!['latest','previous'].includes(generation))throw Error('Unknown archive generation');
 const value=await transaction('readonly',s=>s.get(generation==='previous'?PREVIOUS:KEY),factory);return value===undefined?null:verifyArchive(value,digest);
}
export async function archiveStatus(options={}){
 // Do not substitute an older snapshot for a damaged latest generation.
 const check=async generation=>{try{const value=await readArchive({...options,generation});return {status:value?'verified':'missing',value:value?{savedAt:value.savedAt,bytes:value.bytes,checksum:value.checksum}:null}}catch(e){return {status:'unavailable',error:e.message,value:null}}};
 const latest=await check('latest'),previous=await check('previous');return {latest,previous};
}
function nextRevision(value){if(!Number.isSafeInteger(value)||value<0||value>=Number.MAX_SAFE_INTEGER)throw Error('Invalid archive revision');return value+1}
export async function deleteArchive({factory=globalThis.indexedDB}={}){
 await transaction('readwrite',s=>{
  const request=s.get(REVISION);request.onsuccess=()=>{
   s.put(nextRevision(request.result??0),REVISION);s.delete(PREVIOUS);s.delete(KEY);
  };
  return request;
 },factory);
}
export async function storageEstimate(storage=globalThis.navigator?.storage){
 try{const e=await storage?.estimate?.();if(!Number.isFinite(e?.usage)||!Number.isFinite(e?.quota)||e.quota<=0||e.usage<0)return null;return {usage:e.usage,quota:e.quota}}catch{return null}
}
