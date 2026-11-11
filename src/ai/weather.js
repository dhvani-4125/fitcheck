// Local weather via Open-Meteo (free, no API key). Location comes from the browser's geolocation
// (with the user's permission) or a city the user searches for.

const CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
};
export const describeCode = (code) => CODES[code] || 'Mixed conditions';

export async function geocodeCity(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('City search is unavailable right now.');
  const json = await res.json();
  return (json.results || []).map(r => ({
    name: r.name, region: [r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude,
  }));
}

export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is not available in this browser.')); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, name: 'Current location', region: '' }),
      () => reject(new Error('Location permission was declined. Search for your city instead.')),
      { timeout: 10000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

export async function fetchForecast({ lat, lon }) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto', forecast_days: '7',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
    hourly: 'precipitation_probability,relative_humidity_2m',
    daily: 'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,wind_speed_10m_max,weather_code',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('Weather is unavailable right now.');
  const j = await res.json();
  const humidityByDay = {};
  (j.hourly?.time || []).forEach((t, i) => {
    const day = t.slice(0, 10);
    (humidityByDay[day] ||= []).push(j.hourly.relative_humidity_2m[i]);
  });
  const nowHour = j.current?.time?.slice(0, 13);
  const hourIdx = (j.hourly?.time || []).findIndex(t => t.slice(0, 13) === nowHour);
  const days = (j.daily?.time || []).map((date, i) => {
    const hum = humidityByDay[date] || [];
    const isToday = i === 0;
    const d = new Date(`${date}T12:00:00`);
    const label = isToday ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long' });
    const feelsDay = (j.daily.apparent_temperature_max[i] * 0.65 + j.daily.apparent_temperature_min[i] * 0.35);
    return {
      date, label,
      temp: isToday ? j.current.temperature_2m : Math.round((j.daily.temperature_2m_max[i] * 0.65 + j.daily.temperature_2m_min[i] * 0.35) * 10) / 10,
      feels: isToday ? j.current.apparent_temperature : Math.round(feelsDay * 10) / 10,
      high: j.daily.temperature_2m_max[i], low: j.daily.temperature_2m_min[i],
      humidity: isToday ? j.current.relative_humidity_2m : Math.round(hum.reduce((a, b) => a + b, 0) / Math.max(1, hum.length)),
      wind: isToday ? j.current.wind_speed_10m : j.daily.wind_speed_10m_max[i],
      rainChance: isToday ? Math.max(j.hourly?.precipitation_probability?.[hourIdx] ?? 0, j.daily.precipitation_probability_max[i] ?? 0) : j.daily.precipitation_probability_max[i] ?? 0,
      code: isToday ? j.current.weather_code : j.daily.weather_code[i],
      summary: describeCode(isToday ? j.current.weather_code : j.daily.weather_code[i]),
    };
  });
  return { fetchedAt: Date.now(), days };
}
