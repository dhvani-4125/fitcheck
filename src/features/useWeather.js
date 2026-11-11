import { useCallback, useEffect, useState } from 'react';
import { currentPosition, fetchForecast, geocodeCity } from '../ai/weather.js';

const KEY = 'fitcheck-weather-v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

export default function useWeather() {
  const saved = read();
  const [place, setPlace] = useState(saved.place || null);
  const [forecast, setForecast] = useState(saved.forecast || null);
  const [dayIndex, setDayIndex] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ place, forecast })); } catch { /* optional */ }
  }, [place, forecast]);

  const load = useCallback(async (p) => {
    setStatus('Checking the forecast…');
    try {
      const f = await fetchForecast(p);
      setPlace(p); setForecast(f); setDayIndex(0); setStatus('');
    } catch (e) { setStatus(e.message); }
  }, []);

  // refresh a stale forecast (older than 1 hour) when the app opens
  useEffect(() => {
    if (place && (!forecast || Date.now() - forecast.fetchedAt > 60 * 60 * 1000)) load(place);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const useMyLocation = async () => {
    setStatus('Asking for location permission…');
    try { await load(await currentPosition()); } catch (e) { setStatus(e.message); }
  };
  const search = async (q) => {
    if (!q.trim()) return [];
    try { return await geocodeCity(q); } catch (e) { setStatus(e.message); return []; }
  };
  const clear = () => { setPlace(null); setForecast(null); setStatus(''); };

  const day = forecast?.days?.[dayIndex] || null;
  return { place, forecast, day, dayIndex, setDayIndex, status, useMyLocation, search, choose: load, clear };
}
