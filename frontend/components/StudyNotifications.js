'use client';

import { useEffect, useRef, useState } from 'react';

export function showStudyNotification(message, enabled) {
  if (!enabled || typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification('Growly', { body: message, tag: 'growly-study' }); }
  catch { /* The in-app notice remains available on unsupported browsers. */ }
}

export function useStudyReminders(preferences, timerActive, onReminder) {
  const callback = useRef(onReminder);
  useEffect(() => { callback.current = onReminder; }, [onReminder]);
  useEffect(() => {
    const minutes = Number(preferences?.reminderIntervalMinutes);
    if (!preferences?.studyReminders || !Number.isInteger(minutes) || minutes < 15 || timerActive) return;
    const interval = setInterval(() => callback.current('Time for a learning break? Start a focus block when it suits you.'), minutes * 60000);
    return () => clearInterval(interval);
  }, [preferences?.studyReminders, preferences?.reminderIntervalMinutes, timerActive]);
}

export default function StudyNotifications({ value, onChange }) {
  const [permission, setPermission] = useState('unavailable');
  const [message, setMessage] = useState('');
  useEffect(() => { if ('Notification' in window && window.isSecureContext) setPermission(Notification.permission); }, []);
  const update = patch => onChange({ ...value, ...patch });
  async function enableBrowserNotifications() {
    // Permission is requested only from this explicit user action.
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      update({ browserNotifications: result === 'granted' });
      setMessage(result === 'granted' ? 'Permission granted. Save settings to enable browser notifications.' : 'Browser notifications were not enabled. In-app notices still work.');
    } catch { setMessage('Browser notifications are unavailable. In-app notices still work.'); }
  }
  return <fieldset className="notification-settings"><legend>Reminders and notifications</legend>
    <label className="checkbox"><input type="checkbox" checked={Boolean(value.studyReminders)} onChange={e => update({ studyReminders: e.target.checked })} />Enable study reminders while Growly is open</label>
    {value.studyReminders && <label className="field"><span>Remind me every (minutes)</span><input type="number" required min="15" max="1440" step="1" value={value.reminderIntervalMinutes ?? ''} onChange={e => update({ reminderIntervalMinutes: e.target.value === '' ? '' : Number(e.target.value) })} /></label>}
    <p className="small muted">Reminders pause during a focus block. Timer completion always shows an in-app notice. Reminders and browser alerts require this page to remain open.</p>
    {permission === 'granted' ? <label className="checkbox"><input type="checkbox" checked={Boolean(value.browserNotifications)} onChange={e => update({ browserNotifications: e.target.checked })} />Also show browser notifications</label> : <button type="button" className="secondary" disabled={permission === 'unavailable' || permission === 'denied'} onClick={enableBrowserNotifications}>Allow browser notifications</button>}
    {permission === 'denied' && <p className="small muted">Notifications are blocked. You can change that in your browser’s site permissions.</p>}
    {permission === 'unavailable' && <p className="small muted">Browser alerts are unavailable here. Use HTTPS or localhost in a supported browser.</p>}
    {message && <p role="status" className="small">{message}</p>}
  </fieldset>;
}
