// Optional cloud accounts + sync via Supabase (free tier). If the two build-time variables are
// not set, the app runs fully offline and the account UI explains how to enable it.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(url && anonKey);
export const supabase = cloudEnabled ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

const BUCKET = 'garments';
const redirectTo = () => window.location.origin + window.location.pathname;

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() { await supabase.auth.signOut(); }
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
  if (error) throw error;
}
export async function setNewPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function pullWardrobe(userId) {
  const { data, error } = await supabase.from('wardrobes').select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.data || null;
}
export async function pushWardrobe(userId, doc) {
  const { error } = await supabase.from('wardrobes').upsert({ user_id: userId, data: doc, updated_at: new Date().toISOString() });
  if (error) throw error;
}

const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();
const blobToDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

export async function uploadPhoto(userId, itemId, dataUrl) {
  const path = `${userId}/${itemId}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, await dataUrlToBlob(dataUrl), { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}
export async function downloadPhoto(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return blobToDataUrl(data);
}
export async function deletePhoto(path) {
  try { await supabase.storage.from(BUCKET).remove([path]); } catch { /* best effort */ }
}
