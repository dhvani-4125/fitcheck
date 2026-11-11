// Uploaded garment photos are kept in IndexedDB (localStorage is too small for images).
// Items reference them as `idb:<id>`.
const DB = 'fitcheck-images';
const STORE = 'images';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(result && 'result' in result ? result.result : undefined); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export const isStoredRef = (src) => typeof src === 'string' && src.startsWith('idb:');
export const refFor = (id) => `idb:${id}`;

export async function putImage(id, dataUrl) {
  try { await tx('readwrite', s => s.put(dataUrl, id)); return true; } catch { return false; }
}

export async function deleteImage(id) {
  try { await tx('readwrite', s => s.delete(id)); } catch { /* optional */ }
}

export async function loadAllImages() {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const out = {};
      const req = db.transaction(STORE).objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) { out[cur.key] = cur.value; cur.continue(); } else { db.close(); resolve(out); }
      };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch { return {}; }
}
