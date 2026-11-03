import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { INTEGRITY_SAVED, queueIntegrityEvent, type IntegrityEvent } from '../services/integrityOutbox';

type ViolationType = 'tab_change' | 'copy_attempt' | 'right_click' | 'keyboard_shortcut' | 'face_away' | 'no_face' | 'focus_loss';

interface UseQuizSecurityOptions {
  quizAttemptId: string;
  enabled?: boolean;
  onAutoSubmitted: () => void;
}

// Topic exams use the same account-scoped durable sender as code exams. This
// hook stays mounted while questions load, so changing questions never resets
// the camera or abandons queued reports.
export const useQuizSecurity = ({ quizAttemptId, enabled = true, onAutoSubmitted }: UseQuizSecurityOptions) => {
  const userId = useAuthStore(state => state.user?._id);
  const [violationCount, setViolationCount] = useState(0);
  const [lastViolationType, setLastViolationType] = useState<ViolationType | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const unqueued = useRef(new Map<string, IntegrityEvent>());
  const lastAt = useRef<Record<string, number>>({});
  const completed = useRef(false);
  const onComplete = useRef(onAutoSubmitted);
  onComplete.current = onAutoSubmitted;

  const save = useCallback((event: IntegrityEvent) => {
    if (!userId) return;
    try {
      queueIntegrityEvent(userId, event);
      unqueued.current.delete(event.body.event_id);
      setWriteError(unqueued.current.size ? 'Some monitoring events are not saved. Keep this tab open and retry.' : null);
    } catch {
      unqueued.current.set(event.body.event_id, event);
      setWriteError('Monitoring could not be saved on this device. Allow browser storage and retry before leaving.');
    }
  }, [userId]);

  const reportViolation = useCallback((type: ViolationType) => {
    if (!enabled || !userId || !quizAttemptId || completed.current) return;
    const now = Date.now();
    if (now - (lastAt.current[type] || 0) < 1200) return;
    lastAt.current[type] = now;
    setLastViolationType(type);
    save({ attemptId: quizAttemptId, body: {
      event_id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2)}`,
      violation_type: type,
      detectionMethod: type === 'face_away' || type === 'no_face' ? 'camera_face_detection' : 'browser_event',
      event_timestamp: new Date().toISOString(),
      alert_message: type === 'no_face' ? 'No face detected during topic exam' : type === 'face_away' ? 'Face turned away during topic exam' : 'Topic exam monitoring event',
    } });
  }, [enabled, quizAttemptId, save, userId]);

  useEffect(() => {
    const saved = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.attemptId !== quizAttemptId) return;
      if (typeof detail.result?.violationCount === 'number') setViolationCount(detail.result.violationCount);
      if (!completed.current && (detail.result?.autoSubmitted || detail.result?.alreadySubmitted)) {
        completed.current = true;
        onComplete.current();
      }
    };
    window.addEventListener(INTEGRITY_SAVED, saved);
    return () => window.removeEventListener(INTEGRITY_SAVED, saved);
  }, [quizAttemptId]);

  useEffect(() => {
    if (!enabled) return;
    let hidden = document.visibilityState === 'hidden';
    let focusEpisode = false;
    let blurTimer: ReturnType<typeof setTimeout>;
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(blurTimer);
        if (!hidden) reportViolation('tab_change');
        hidden = true;
      } else { hidden = false; focusEpisode = false; }
    };
    const blur = () => {
      blurTimer = setTimeout(() => {
        if (!hidden && !focusEpisode) { focusEpisode = true; reportViolation('focus_loss'); }
      }, 300);
    };
    const focus = () => { clearTimeout(blurTimer); focusEpisode = false; };
    const clipboard = (event: ClipboardEvent) => { event.preventDefault(); reportViolation('copy_attempt'); };
    const contextmenu = (event: MouseEvent) => { event.preventDefault(); reportViolation('right_click'); };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'F12' || event.key === 'PrintScreen' ||
        ((event.ctrlKey || event.metaKey) && ['s', 'u'].includes(event.key.toLowerCase()))) {
        event.preventDefault(); reportViolation('keyboard_shortcut');
      }
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    document.addEventListener('copy', clipboard);
    document.addEventListener('cut', clipboard);
    document.addEventListener('paste', clipboard);
    document.addEventListener('contextmenu', contextmenu);
    document.addEventListener('keydown', keydown);
    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      document.removeEventListener('copy', clipboard);
      document.removeEventListener('cut', clipboard);
      document.removeEventListener('paste', clipboard);
      document.removeEventListener('contextmenu', contextmenu);
      document.removeEventListener('keydown', keydown);
    };
  }, [enabled, reportViolation]);

  return { reportViolation, violationCount, lastViolationType, writeError,
    retryReports: () => unqueued.current.forEach(save) };
};
