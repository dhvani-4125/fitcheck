// Optional cloud accounts + sync via Supabase (free tier). If the two build-time variables are
// not set, the app runs fully offline and the account UI explains how to enable it.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(url && anonKey);
export const supabase = cloudEnabled ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

const BUCKET = 'garments';
const redirectTo = () => window.location.origin + window.location.pathname;

export async function signUp(email, password, profile = {}) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo(), data: profile } });
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
export async function saveAccountProfile(profile) {
  try { await supabase.auth.updateUser({ data: profile }); } catch { /* best effort */ }
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

// ---------- Ask Friends polls (public link: anyone with it can view and vote, no login)
const POLL_BUCKET = 'polls';
export function newPollId() {
  const a = new Uint8Array(9); crypto.getRandomValues(a);
  return Array.from(a, b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}
export async function createPoll(userId, { question, options }) {
  const id = newPollId();
  const uploaded = [];
  for (let i = 0; i < options.length; i++) {
    const path = `${userId}/${id}-${i}.jpg`;
    const { error } = await supabase.storage.from(POLL_BUCKET).upload(path, await dataUrlToBlob(options[i].dataUrl), { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    uploaded.push({ label: options[i].label, image: supabase.storage.from(POLL_BUCKET).getPublicUrl(path).data.publicUrl });
  }
  const { error } = await supabase.from('polls').insert({ id, owner: userId, question, options: uploaded });
  if (error) throw error;
  return id;
}
export async function fetchPoll(id) {
  const { data, error } = await supabase.from('polls').select('id, question, options, created_at').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
export async function fetchVotes(id) {
  const { data, error } = await supabase.from('poll_votes').select('option_index, voter_name, comment, created_at').eq('poll_id', id).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function castVote(id, optionIndex, voterName, comment) {
  const { error } = await supabase.from('poll_votes').insert({ poll_id: id, option_index: optionIndex, voter_name: (voterName || '').slice(0, 40) || null, comment: (comment || '').slice(0, 200) || null });
  if (error) throw error;
}
export async function listMyPolls(userId) {
  const { data, error } = await supabase.from('polls').select('id, question, options, created_at, poll_votes(option_index, voter_name, comment)').eq('owner', userId).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
}
export async function deletePoll(id) {
  const { error } = await supabase.from('polls').delete().eq('id', id);
  if (error) throw error;
}
export const pollLink = (id) => `${window.location.origin}${window.location.pathname}?poll=${id}`;
