import { env } from "../shared/util.js";

const cityCache = new Map();

export async function getWeather() {
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(env.weatherCity)}&count=1&language=fr&format=json`;
    let coords = cityCache.get(env.weatherCity);
    if (!coords) {
      const geoRes = await fetch(geoUrl);
      const geo = await geoRes.json();
      const hit = geo.results?.[0];
      if (!hit) return { ok: false, error: `Ville introuvable : ${env.weatherCity}` };
      coords = { lat: hit.latitude, lon: hit.longitude };
      cityCache.set(env.weatherCity, coords);
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&current_weather=true&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();

    return {
      ok: true,
      city: env.weatherCity,
      current: {
        temperature: Math.round(data.current_weather.temperature),
        wind: Math.round(data.current_weather.windspeed),
        code: data.current_weather.weathercode,
      },
      today: {
        max: Math.round(data.daily.temperature_2m_max[0]),
        min: Math.round(data.daily.temperature_2m_min[0]),
        precipitation: data.daily.precipitation_sum[0],
      },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

const CODES = {
  0: "☀️ Ciel dégagé", 1: "🌤️ Plutôt dégagé", 2: "⛅ Partiellement nuageux", 3: "☁️ Couvert",
  45: "🌫️ Brouillard", 48: "🌫️ Brouillard givrant",
  51: "🌦️ Bruine légère", 53: "🌦️ Bruine", 55: "🌦️ Bruine forte",
  61: "🌧️ Pluie légère", 63: "🌧️ Pluie", 65: "🌧️ Pluie forte",
  71: "🌨️ Neige légère", 73: "🌨️ Neige", 75: "🌨️ Neige forte",
  80: "🌦️ Averses", 81: "🌧️ Averses", 82: "⛈️ Fortes averses",
  95: "⛈️ Orage", 96: "⛈️ Orage avec grêle", 99: "⛈️ Orage violent",
};

export function describeWeather(weather) {
  if (!weather?.ok) return null;
  return {
    headline: CODES[weather.current.code] || "🌡️",
    text: `${weather.current.temperature}°C (min ${weather.today.min} / max ${weather.today.max}) — précipitations : ${weather.today.precipitation ?? 0} mm`,
  };
}
