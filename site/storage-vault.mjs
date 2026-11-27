// A deliberately separate, explicit local archive. It never replaces, loads
// into, or silently resurrects the primary player profile. A successful IDB
// transaction is required before reporting a saved copy.
const DB='IDC:local-archive:v1',STORE='snapshots',KEY='manual';
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
  const req=operation(tx.objectStore(STORE));req.onsuccess=()=>{result=req.result};
 })}finally{db.close()}
}
export async function saveArchive(json,{factory=globalThis.indexedDB,digest=globalThis.crypto?.subtle,now=Date.now()}={}){
 const value=await archiveEnvelope(json,now,digest);await transaction('readwrite',s=>s.put(value,KEY),factory);return {savedAt:value.savedAt,bytes:value.bytes,checksum:value.checksum};
}
export async function readArchive({factory=globalThis.indexedDB,digest=globalThis.crypto?.subtle}={}){
 const value=await transaction('readonly',s=>s.get(KEY),factory);return value===undefined?null:verifyArchive(value,digest);
}
export async function deleteArchive({factory=globalThis.indexedDB}={}){await transaction('readwrite',s=>s.delete(KEY),factory)}
export async function storageEstimate(storage=globalThis.navigator?.storage){
 try{const e=await storage?.estimate?.();if(!Number.isFinite(e?.usage)||!Number.isFinite(e?.quota)||e.quota<=0||e.usage<0)return null;return {usage:e.usage,quota:e.quota}}catch{return null}
}
