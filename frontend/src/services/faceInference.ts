import * as faceapi from 'face-api.js';
import type { FaceObservation } from './facePresence';

function headPose(landmarks: faceapi.FaceLandmarks68) {
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

export async function inferFaceObservation(video: HTMLVideoElement): Promise<FaceObservation> {
  // Live streams can have a usable current frame (readyState 2) before future
  // frames are buffered. The old library waits for readyState 3 and a `load`
  // event that videos never fire, so pass one decoded snapshot instead.
  // Detection and landmarks must also describe the same frame.
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    throw new Error('Camera frame is unavailable');
  }
  const frame = document.createElement('canvas');
  frame.width = video.videoWidth;
  frame.height = video.videoHeight;
  const context = frame.getContext('2d');
  if (!context) throw new Error('Camera frame is unavailable');
  context.drawImage(video, 0, 0, frame.width, frame.height);
  // face-api.js 0.20's composable .then()/withFaceLandmarks() wrappers do not
  // forward rejections. Awaiting them can hang forever after a detector error.
  // These lower-level APIs return real Promises, so the monitor can recover.
  const detections = await faceapi.nets.tinyFaceDetector.locateFaces(frame,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }));
  const detection = detections.reduce<faceapi.FaceDetection | undefined>((best, candidate) =>
    !best || candidate.score > best.score ? candidate : best, undefined);
  if (!detection || detection.score < 0.6) return 'no_face';
  const faces = await faceapi.extractFaces(frame, [detection]);
  if (!faces[0]) throw new Error('Face crop is unavailable');
  const result = await faceapi.nets.faceLandmark68Net.detectLandmarks(faces[0]);
  const landmarks = Array.isArray(result) ? result[0] : result;
  if (!landmarks) throw new Error('Face landmarks are unavailable');
  const { yaw, pitch } = headPose(landmarks);
  return Math.abs(yaw) <= 30 && Math.abs(pitch) <= 25 ? 'valid' : 'away';
}
