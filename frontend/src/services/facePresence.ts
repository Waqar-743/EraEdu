export type FaceObservation = 'valid' | 'away' | 'no_face';
export type FaceViolation = 'face_away' | 'no_face';

export interface FacePresenceResult {
  status: 'camera_ready' | 'looking' | 'away' | 'no_face';
  awaySeconds: number;
  violation?: FaceViolation;
  autoSubmit: boolean;
}

// A turned face and no face belong to the same absence episode. Only sustained
// positive detections end it; a single lucky frame must not reset the timer.
export class FacePresenceTracker {
  private absentSince: number | null = null;
  private validFrames = 0;
  private violationEmitted = false;
  private autoSubmitted = false;

  reset() {
    this.absentSince = null;
    this.validFrames = 0;
    this.violationEmitted = false;
    this.autoSubmitted = false;
  }

  observe(kind: FaceObservation, now: number): FacePresenceResult {
    if (kind === 'valid') {
      this.validFrames += 1;
      if (this.validFrames >= 3) {
        this.absentSince = null;
        this.violationEmitted = false;
        this.autoSubmitted = false;
        return { status: 'looking', awaySeconds: 0, autoSubmit: false };
      }
      return { status: 'camera_ready', awaySeconds: 0, autoSubmit: false };
    }

    this.validFrames = 0;
    this.absentSince ??= now;
    const elapsed = Math.max(0, now - this.absentSince);
    if (elapsed < 2_000) return { status: 'camera_ready', awaySeconds: 0, autoSubmit: false };

    const result: FacePresenceResult = {
      status: kind,
      awaySeconds: Math.floor(elapsed / 1000),
      autoSubmit: elapsed >= 60_000 && !this.autoSubmitted,
    };
    if (!this.violationEmitted) {
      this.violationEmitted = true;
      result.violation = kind === 'away' ? 'face_away' : 'no_face';
    }
    if (result.autoSubmit) this.autoSubmitted = true;
    return result;
  }
}

// Share an in-flight model load across React StrictMode mounts. Failure clears
// the cached promise so Retry actually downloads the models again.
export function retryableLoader(load: () => Promise<unknown>): () => Promise<void> {
  let pending: Promise<void> | undefined;
  return () => {
    if (!pending) {
      pending = Promise.resolve().then(load).then(() => undefined).catch(error => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
}

// getUserMedia can resolve after an effect was cleaned up. Stop that stream
// before it can replace the current mount's video feed or leak a webcam lock.
export async function acquireCamera(
  request: () => Promise<MediaStream>,
  active: () => boolean,
): Promise<MediaStream | null> {
  const stream = await request();
  if (active()) return stream;
  stream.getTracks().forEach(track => track.stop());
  return null;
}
