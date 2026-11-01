/** On-device face presence. Camera/model failures are operational states. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { acquireCamera, FacePresenceTracker, retryableLoader } from '../services/facePresence';

const DETECTION_INTERVAL_MS = 500;
const DETECTION_CONFIDENCE_THRESHOLD = 0.6;
const MODEL_URL = `${import.meta.env.BASE_URL}models`;
const loadModels = retryableLoader(async () => {
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
});

export type FaceStatus =
  | 'model_loading' | 'model_load_failed' | 'camera_starting' | 'camera_ready'
  | 'camera_unavailable' | 'permission_denied' | 'inference_error'
  | 'looking' | 'away' | 'no_face';

export interface FaceDetectionCallbacks {
  onViolation?: (kind: 'face_away' | 'no_face') => void;
  onAutoSubmit?: () => void;
}

export interface FaceDetectionState {
  status: FaceStatus;
  awaySeconds: number;
  violationCount: number;
  modelsLoaded: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  retryCamera: () => void;
}

function estimateHeadPose(landmarks: faceapi.FaceLandmarks68) {
  const pts = landmarks.positions;
  const nose = pts[30], chin = pts[8], leftEye = pts[36], rightEye = pts[45];
  const leftMouth = pts[48], rightMouth = pts[54];
  const width = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const height = Math.hypot(chin.x - nose.x, chin.y - nose.y);
  const mouthToEye = (leftMouth.y + rightMouth.y - leftEye.y - rightEye.y) / 2;
  if (!width || !height || !mouthToEye) throw new Error('Invalid face landmarks');
  const yaw = ((nose.x - (leftEye.x + rightEye.x) / 2) / (width / 2)) * 45;
  const pitch = (((nose.y - (leftEye.y + rightEye.y) / 2) / mouthToEye) - 0.55) * 80;
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) throw new Error('Invalid face pose');
  return { yaw, pitch };
}

export function useFaceDetection(enabled: boolean, callbacks: FaceDetectionCallbacks = {}): FaceDetectionState {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isDetecting = useRef(false);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;
  const [status, setStatus] = useState<FaceStatus>('model_loading');
  const [awaySeconds, setAwaySeconds] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const retryCamera = useCallback(() => setRetry(value => value + 1), []);

  // One lifecycle owns the model load, stream and recursive detector loop.
  // Updating a status badge must not cancel an in-flight detector call.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let validFaceTimer: ReturnType<typeof setTimeout> | undefined;
    const tracker = new FacePresenceTracker();
    const video = videoRef.current;

    const clearValidTimer = () => {
      if (validFaceTimer) clearTimeout(validFaceTimer);
      validFaceTimer = undefined;
    };
    const unavailable = (nextStatus: FaceStatus) => {
      clearValidTimer();
      tracker.reset();
      setAwaySeconds(0);
      setStatus(nextStatus);
    };

    const runDetection = async () => {
      if (cancelled) return;
      const track = stream?.getVideoTracks()[0];
      if (!track || track.readyState !== 'live' || track.muted) {
        unavailable('camera_unavailable');
      } else if (video && !isDetecting.current && !video.paused && !video.ended && video.readyState >= 2) {
        isDetecting.current = true;
        try {
          const detection = await faceapi.detectSingleFace(video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: DETECTION_CONFIDENCE_THRESHOLD }))
            .withFaceLandmarks();
          if (cancelled) return;
          let kind: 'valid' | 'away' | 'no_face' = 'no_face';
          if (detection && detection.detection.score >= DETECTION_CONFIDENCE_THRESHOLD) {
            const { yaw, pitch } = estimateHeadPose(detection.landmarks);
            kind = Math.abs(yaw) <= 30 && Math.abs(pitch) <= 25 ? 'valid' : 'away';
          }
          const result = tracker.observe(kind, Date.now());
          clearValidTimer();
          setStatus(result.status);
          setAwaySeconds(result.awaySeconds);
          if (result.violation) {
            setViolationCount(value => value + 1);
            cbRef.current.onViolation?.(result.violation);
          }
          if (result.autoSubmit) cbRef.current.onAutoSubmit?.();
          if (result.status === 'looking') {
            // A stalled/throttled detector must not leave a stale green badge.
            validFaceTimer = setTimeout(() => {
              if (!cancelled) unavailable('camera_ready');
            }, 2_000);
          }
        } catch {
          if (!cancelled) unavailable('inference_error');
        } finally {
          isDetecting.current = false;
        }
      }
      if (!cancelled) timer = setTimeout(runDetection, DETECTION_INTERVAL_MS);
    };

    const start = async () => {
      setModelsLoaded(false);
      unavailable('model_loading');
      try { await loadModels(); }
      catch { if (!cancelled) unavailable('model_load_failed'); return; }
      if (cancelled) return;
      setModelsLoaded(true);
      unavailable('camera_starting');
      try {
        const acquired = await acquireCamera(() => navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false,
        }), () => !cancelled);
        if (!acquired) return;
        if (cancelled) { acquired.getTracks().forEach(track => track.stop()); return; }
        stream = acquired;
        stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
          if (!cancelled) unavailable('camera_unavailable');
        }));
        if (!video) throw new Error('Camera preview is unavailable');
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        unavailable('camera_ready');
        void runDetection();
      } catch (error: unknown) {
        stream?.getTracks().forEach(track => track.stop());
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : '';
        unavailable(name === 'NotAllowedError' || name === 'SecurityError' ? 'permission_denied' : 'camera_unavailable');
      }
    };
    void start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearValidTimer();
      stream?.getTracks().forEach(track => track.stop());
      if (video && video.srcObject === stream) video.srcObject = null;
    };
  }, [enabled, retry]);

  return { status, awaySeconds, violationCount, modelsLoaded, videoRef, retryCamera };
}

export default useFaceDetection;
