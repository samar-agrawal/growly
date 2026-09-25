'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createTimer,
  extendTimer,
  pauseTimer,
  remainingMilliseconds,
  restoreTimer,
  resumeTimer,
} from '../lib/study-timer.mjs';

const storageKey = 'growly.study-timer.v1';

export function useStudyTimer(onComplete) {
  const [timer, setTimer] = useState(null);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');
  const completeCallback = useRef(onComplete);
  const notified = useRef(null);
  useEffect(() => {
    completeCallback.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    try {
      setTimer(restoreTimer(sessionStorage.getItem(storageKey)));
    } catch {
      setStorageWarning('This browser cannot retain the timer on reload. Keep this page open.');
    }
    setNow(Date.now());
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      if (timer) sessionStorage.setItem(storageKey, JSON.stringify(timer));
      else sessionStorage.removeItem(storageKey);
    } catch {
      setStorageWarning('This browser cannot retain the timer on reload. Keep this page open.');
    }
  }, [timer, ready]);
  useEffect(() => {
    if (timer?.status !== 'running') return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (remainingMilliseconds(timer, time) === 0)
        setTimer((current) =>
          current?.id === timer.id ? { ...current, status: 'complete', remainingMs: 0 } : current,
        );
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [timer]);
  useEffect(() => {
    if (timer?.status === 'complete' && notified.current !== timer.id) {
      notified.current = timer.id;
      completeCallback.current();
    }
  }, [timer]);
  return {
    timer,
    ready,
    storageWarning,
    remainingMs: remainingMilliseconds(timer, now),
    start(payload, label) {
      if (!ready || timer)
        throw new Error('Finish or discard the current timer before starting another.');
      const time = Date.now();
      setNow(time);
      setTimer(createTimer(payload, label, crypto.randomUUID(), time));
    },
    extend() {
      notified.current = null;
      setNow(Date.now());
      setTimer((current) => (current ? extendTimer(current) : current));
    },
    pause() {
      setTimer((current) => (current ? pauseTimer(current) : current));
    },
    resume() {
      setNow(Date.now());
      setTimer((current) => (current ? resumeTimer(current) : current));
    },
    clear() {
      setTimer(null);
    },
  };
}

export default function StudyTimer({ controller, onReview, reviewOpen }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { timer, remainingMs, storageWarning } = controller;
  useEffect(() => {
    setConfirmDiscard(false);
  }, [timer?.id]);
  if (!timer) return null;
  const seconds = Math.ceil(remainingMs / 1000);
  const display = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const complete = timer.status === 'complete';
  return (
    <section className="study-timer" aria-label="Study timer">
      <div className="spread">
        <div>
          <p className="eyebrow">FOCUS BLOCK</p>
          <h2>{timer.label}</h2>
        </div>
        <div
          className="timer-clock"
          role="timer"
          aria-label={`${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`}
        >
          {display}
        </div>
      </div>
      <p role="status" className="small muted">
        {complete
          ? 'Time is up! Take a break.'
          : timer.status === 'paused'
            ? 'Paused.'
            : 'Focus time. You’ve got this.'}
      </p>
      {storageWarning && <p className="small danger-text">{storageWarning}</p>}
      {confirmDiscard ? (
        <div className="timer-actions" role="group" aria-label="Confirm discard timer">
          <span>Discard this block without logging it?</span>
          <button className="secondary" onClick={() => setConfirmDiscard(false)}>
            Keep timer
          </button>
          <button
            className="primary danger-button"
            onClick={() => {
              controller.clear();
              setConfirmDiscard(false);
            }}
          >
            Discard block
          </button>
        </div>
      ) : (
        <div className="timer-actions">
          {complete ? (
            <button
              className="primary"
              aria-label="Review and save session"
              disabled={reviewOpen}
              onClick={() => onReview(timer)}
            >
              Review & save
            </button>
          ) : (
            <button
              className="primary"
              onClick={timer.status === 'paused' ? controller.resume : controller.pause}
            >
              {timer.status === 'paused' ? 'Resume' : 'Pause'}
            </button>
          )}
          {complete && (
            <button
              className="secondary"
              aria-label="Continue for 30 minutes"
              disabled={reviewOpen || timer.payload.slots >= 48}
              onClick={controller.extend}
            >
              +30 min
            </button>
          )}
          <button
            className="secondary"
            disabled={reviewOpen}
            onClick={() => setConfirmDiscard(true)}
          >
            Discard timer
          </button>
        </div>
      )}
    </section>
  );
}
