// WAQI documents iaqi pollutant values as AQI sub-indices, not concentrations.
// Its headline `aqi` can instead contain a national index (observed for DOE MY).
// Never convert that scalar or include weather values in the maximum.
export const WAQI_METHOD = 'waqi-subindices-v1';
export const POLLUTANTS = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co'];
const numeric = x => (typeof x === 'number' || typeof x === 'string' && x.trim()) && Number.isFinite(Number(x)) ? Number(x) : null;
const index = x => { const n = numeric(x); return n !== null && n >= 0 ? n : null; };
export function waqiIndex(data) {
  const pollutants = Object.fromEntries(POLLUTANTS.map(k => [k, index(data?.iaqi?.[k]?.v)]));
  const available = Object.entries(pollutants).filter(([, v]) => v !== null);
  const maximum = available.length ? Math.max(...available.map(([, v]) => v)) : null;
  const reportedIndex = index(data?.aqi);
  // Do not report reassuringly low air quality when a higher headline may
  // represent a missing pollutant. A declared dominant pollutant must exist.
  const incomplete = POLLUTANTS.includes(data?.dominentpol) && pollutants[data.dominentpol] === null ||
    available.length < POLLUTANTS.length && reportedIndex !== null && maximum !== null && reportedIndex > Math.round(maximum);
  return { aqi: maximum === null || incomplete ? null : Math.round(maximum), pollutants,
    dominant: available.find(([, v]) => v === maximum)?.[0] || null,
    calculation: WAQI_METHOD, reportedIndex };
}
export function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}
export function measurementTime(time) {
  const candidate = time?.iso || (time?.s && time?.tz ? time.s.replace(' ', 'T') + time.tz : '');
  // A timestamp without an offset must never inherit the visitor's timezone.
  return typeof candidate === 'string' && validDay(candidate.slice(0, 10)) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(candidate) &&
    Number.isFinite(Date.parse(candidate)) ? candidate : null;
}
export function normalizeWaqi(d, expectedUid = null) {
  const result = waqiIndex(d), uid = numeric(d?.idx), lat = numeric(d?.city?.geo?.[0]), lon = numeric(d?.city?.geo?.[1]);
  if (result.aqi === null) throw Error('No pollutant AQI sub-indices');
  if (!Number.isSafeInteger(uid) || uid <= 0 || expectedUid !== null && uid !== Number(expectedUid) ||
    lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw Error('Invalid station identity');
  const time = measurementTime(d.time), value = key => numeric(d.iaqi?.[key]?.v);
  const forecast = Array.isArray(d.forecast?.daily?.pm25) ? d.forecast.daily.pm25 : [];
  return {
    ...result, uid, provider: 'waqi', index: 'us', name: String(d.city?.name || 'Monitoring station'), lat, lon, time,
    fetchedAt: new Date().toISOString(), timezone: time?.endsWith('Z') ? '+00:00' : time?.slice(-6) || null,
    pm25: result.pollutants.pm25, pm10: result.pollutants.pm10,
    humidity: value('h') !== null && value('h') >= 0 && value('h') <= 100 ? value('h') : null,
    wind: value('w') !== null && value('w') >= 0 ? value('w') : null, temperature: value('t'),
    units: { index: 'US AQI (WAQI pollutant sub-indices)', pollutants: 'US AQI sub-index', wind: 'm/s', temperature: '°C', humidity: '%', forecast: 'PM2.5 AQI' },
    forecast: [...new Map(forecast.filter(x => validDay(x?.day)).map(x => ({ day: x.day, avg: index(x.avg), min: index(x.min), max: index(x.max) }))
      .filter(x => x.avg !== null && (x.min === null || x.min <= x.avg) && (x.max === null || x.max >= x.avg)).map(x => [x.day, x])).values()]
      .sort((a, b) => a.day.localeCompare(b.day)).slice(-8),
    attribution: (Array.isArray(d.attributions) ? d.attributions : []).filter(x => /^https?:\/\//i.test(x?.url || '')).map(x => ({ name: String(x.name || 'Data provider'), url: x.url })),
    stationUrl: /^https?:\/\//i.test(d.city?.url || '') ? d.city.url : null
  };
}
