import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, cloudEnabled, pullWardrobe, pushWardrobe, uploadPhoto, downloadPhoto, deletePhoto } from '../lib/cloud.js';
import { mergeWardrobe } from '../lib/mergeWardrobe.js';
import { putImage, isStoredRef } from '../lib/imageStore.js';

const comparable = (doc) => JSON.stringify({ ...doc, updatedAt: undefined });

/**
 * Keeps the local wardrobe document in sync with the signed-in user's Supabase row.
 * doc: the current local document; applyDoc(doc): replaces local state with a merged document.
 */
export default function useCloudSync({ doc, applyDoc, imageCache, setImageCache, setItems }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(cloudEnabled ? 'signed-out' : 'off');
  const [message, setMessage] = useState('');
  const [lastSynced, setLastSynced] = useState(null);
  const [recovery, setRecovery] = useState(false);
  const ready = useRef(false);
  const lastPushed = useRef('');
  const docRef = useRef(doc);
  const cacheRef = useRef(imageCache);
  const photoBusy = useRef(false);
  docRef.current = doc;
  cacheRef.current = imageCache;

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const syncPhotos = useCallback(async (items, userId) => {
    if (photoBusy.current) return;
    photoBusy.current = true;
    try {
      const uploaded = {};
      for (const it of items) {
        if (!isStoredRef(it.image) || it.cloudPath) continue;
        const data = cacheRef.current[it.image.slice(4)];
        if (!data) continue;
        try { uploaded[it.id] = await uploadPhoto(userId, it.id, data); } catch (e) { setMessage(`Photo upload failed: ${e.message}`); }
      }
      if (Object.keys(uploaded).length) setItems(prev => prev.map(it => (uploaded[it.id] ? { ...it, cloudPath: uploaded[it.id] } : it)));
      for (const it of items) {
        if (!it.cloudPath || !isStoredRef(it.image)) continue;
        const key = it.image.slice(4);
        if (cacheRef.current[key]) continue;
        try {
          const data = await downloadPhoto(it.cloudPath);
          await putImage(key, data);
          setImageCache(c => ({ ...c, [key]: data }));
        } catch { /* photo may still be uploading from another device */ }
      }
    } finally { photoBusy.current = false; }
  }, [setItems, setImageCache]);

  // First sync after sign-in: merge this device with the cloud copy.
  useEffect(() => {
    if (!user) { ready.current = false; if (cloudEnabled) setStatus('signed-out'); return undefined; }
    let cancelled = false;
    (async () => {
      setStatus('syncing'); setMessage('');
      try {
        const remote = await pullWardrobe(user.id);
        const merged = mergeWardrobe(docRef.current, remote);
        if (cancelled) return;
        applyDoc(merged);
        await pushWardrobe(user.id, merged);
        lastPushed.current = comparable(merged);
        ready.current = true;
        setStatus('synced'); setLastSynced(Date.now());
        syncPhotos(merged.items, user.id);
      } catch (e) { if (!cancelled) { setStatus('error'); setMessage(e.message); } }
    })();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Afterwards: push local changes (debounced).
  useEffect(() => {
    if (!user || !ready.current) return undefined;
    const key = comparable(doc);
    if (key === lastPushed.current) return undefined;
    const t = setTimeout(async () => {
      setStatus('syncing');
      try {
        await pushWardrobe(user.id, doc);
        lastPushed.current = key;
        setStatus('synced'); setLastSynced(Date.now());
        syncPhotos(doc.items, user.id);
      } catch (e) { setStatus('error'); setMessage(e.message); }
    }, 1500);
    return () => clearTimeout(t);
  }, [doc, user, syncPhotos]);

  const removePhoto = useCallback((path) => { if (user && path) deletePhoto(path); }, [user]);

  return { enabled: cloudEnabled, user, status, message, lastSynced, recovery, clearRecovery: () => setRecovery(false), removePhoto };
}
