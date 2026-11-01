import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acquireCamera, FacePresenceTracker, retryableLoader } from '../src/services/facePresence.ts';

test('a brief missing frame is tolerated; three positive frames confirm a face', () => {
  const tracker = new FacePresenceTracker();
  assert.equal(tracker.observe('no_face', 0).violation, undefined);
  assert.equal(tracker.observe('valid', 500).status, 'camera_ready');
  assert.equal(tracker.observe('valid', 1000).status, 'camera_ready');
  assert.equal(tracker.observe('valid', 1500).status, 'looking');
  assert.equal(tracker.observe('no_face', 2000).violation, undefined);
  assert.equal(tracker.observe('no_face', 3999).violation, undefined);
  assert.equal(tracker.observe('no_face', 4000).violation, 'no_face');
});

test('alternating turned-away and missing-face results preserve one absence episode and the 60s cutoff', () => {
  const tracker = new FacePresenceTracker();
  const results = [];
  for (let now = 0; now <= 62000; now += 500) {
    results.push(tracker.observe(now % 1000 ? 'away' : 'no_face', now));
  }
  assert.equal(results.filter(result => result.violation).length, 1);
  assert.deepEqual(results.filter(result => result.autoSubmit).map(result => result.awaySeconds), [60]);
  assert.equal(results.at(-1).awaySeconds, 62);
});

test('an isolated positive frame does not let a long absence reset its violation timer', () => {
  const tracker = new FacePresenceTracker();
  tracker.observe('away', 0);
  assert.equal(tracker.observe('away', 2000).violation, 'face_away');
  tracker.observe('valid', 59000);
  assert.equal(tracker.observe('no_face', 60000).autoSubmit, true);
  tracker.observe('valid', 60500);
  tracker.observe('valid', 61000);
  assert.equal(tracker.observe('valid', 61500).status, 'looking');
  tracker.observe('away', 62000);
  assert.equal(tracker.observe('away', 64000).violation, 'face_away');
});

test('a camera or model interruption resets the absence timer without inventing a violation', () => {
  const tracker = new FacePresenceTracker();
  tracker.observe('no_face', 0);
  tracker.reset();
  assert.equal(tracker.observe('no_face', 90000).violation, undefined);
  assert.equal(tracker.observe('no_face', 91999).autoSubmit, false);
  assert.equal(tracker.observe('no_face', 92000).violation, 'no_face');
});

test('concurrent mounts share model loads and a failed model download can be retried', async () => {
  let calls = 0;
  const load = retryableLoader(async () => { if (++calls === 1) throw new Error('offline'); });
  const first = load();
  assert.equal(first, load());
  await assert.rejects(first, /offline/);
  await load();
  await load();
  assert.equal(calls, 2);
});

test('a cancelled camera request releases all late tracks and cannot replace the current feed', async () => {
  let resolve;
  let active = true;
  let stopped = 0;
  const stream = { getTracks: () => [{ stop: () => stopped++ }, { stop: () => stopped++ }] };
  const result = acquireCamera(() => new Promise(done => { resolve = done; }), () => active);
  active = false;
  resolve(stream);
  assert.equal(await result, null);
  assert.equal(stopped, 2);
  assert.equal(await acquireCamera(async () => stream, () => true), stream);
  assert.equal(stopped, 2);
});
