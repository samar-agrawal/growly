export function remainingMilliseconds(timer, now = Date.now()) {
  if (!timer || timer.status === 'complete') return 0;
  return timer.status === 'running' ? Math.max(0, timer.endsAt - now) : timer.remainingMs;
}

export function createTimer(payload, label, id, now = Date.now()) {
  const slots = Number(payload.slots);
  if (!Number.isInteger(slots) || slots < 1 || slots > 48) throw new Error('Choose 1–48 slots for a timer (up to 24 hours).');
  const remainingMs = slots * 30 * 60 * 1000;
  return { id, payload: { ...payload, slots, timerId: id }, label, status: 'running', remainingMs, endsAt: now + remainingMs };
}

export function pauseTimer(timer, now = Date.now()) {
  const remainingMs = remainingMilliseconds(timer, now);
  return { ...timer, status: remainingMs ? 'paused' : 'complete', remainingMs, endsAt: null };
}

export function resumeTimer(timer, now = Date.now()) {
  return { ...timer, status: 'running', endsAt: now + timer.remainingMs };
}

export function restoreTimer(raw, now = Date.now()) {
  try {
    const timer = JSON.parse(raw);
    if (!timer || !/^[0-9a-f-]{36}$/i.test(timer.id) || !timer.payload || timer.payload.timerId !== timer.id || !Number.isInteger(timer.payload.slots) || timer.payload.slots < 1 || timer.payload.slots > 48 || typeof timer.label !== 'string') return null;
    if (!['running', 'paused', 'complete'].includes(timer.status) || !Number.isFinite(timer.remainingMs) || timer.remainingMs < 0) return null;
    if (timer.status === 'running' && !Number.isFinite(timer.endsAt)) return null;
    return remainingMilliseconds(timer, now) === 0 ? { ...timer, status: 'complete', remainingMs: 0 } : timer;
  } catch { return null; }
}
