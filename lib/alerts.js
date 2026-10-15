// Both the dashboard and scheduler use this function. Measurement freshness and
// the notification baseline have separate timestamps, so slow changes accumulate.
export function alertTransition(previous, aqi, stamp, delta, now = Date.now()) {
  if (!Number.isFinite(aqi) || aqi < 0 || !Number.isFinite(stamp) || now - stamp > 10800000 || stamp > now + 600000) return null;
  const seen = previous?.seen ?? previous?.time;
  if (Number.isFinite(seen) && stamp <= seen) return null;
  if (!Number.isFinite(previous?.aqi) || !Number.isFinite(seen) || stamp - seen > 10800000) return { aqi, time: stamp, seen: stamp, notify: false };
  const notify = Math.abs(aqi - previous.aqi) >= delta;
  return { aqi: notify ? aqi : previous.aqi, time: notify ? stamp : previous.time, seen: stamp, notify };
}
