import type * as ortTypes from 'onnxruntime-node';
import { getModelPath, isModelDownloaded, downloadModel } from './model-downloader';

/**
 * Owns the lifecycle of the lazily-initialised ONNX runtime and inference
 * session. Previously these were module-level `let`s in `ml.ts` that were
 * never cleaned up; centralising them here gives the queue processor an
 * explicit `releaseSession()` to call when idle, and keeps the inference path
 * free of mutable global state.
 */

let ort: typeof ortTypes | null = null;
let session: ortTypes.InferenceSession | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/** Lazily import the onnxruntime-node module (cached after first call). */
export async function getOrt(): Promise<typeof ortTypes> {
  if (ort) return ort;
  ort = await import('onnxruntime-node');
  return ort;
}

/**
 * Get the shared inference session, creating it (and downloading the model if
 * necessary) on first use. Cancels any pending idle-release so an in-flight
 * job never has the session pulled out from under it.
 */
export async function getSession(): Promise<ortTypes.InferenceSession> {
  cancelScheduledRelease();
  if (session) return session;

  if (!isModelDownloaded()) {
    await downloadModel();
  }

  const ortModule = await getOrt();
  session = await ortModule.InferenceSession.create(getModelPath(), {
    executionProviders: ['cpu'],
  });
  return session;
}

/** True when an inference session is currently loaded. */
export function isSessionActive(): boolean {
  return session !== null;
}

/** Dispose the inference session and free its memory. Safe to call when idle. */
export async function releaseSession(): Promise<void> {
  cancelScheduledRelease();
  if (session) {
    const current = session;
    session = null;
    try {
      await current.release();
    } catch {
      // Best-effort: a failed release shouldn't crash the caller.
    }
  }
}

/**
 * Release the session after `idleMs` of inactivity. Re-arms the timer if one is
 * already pending. The timer is `unref`'d so it never keeps the process alive.
 */
export function scheduleSessionRelease(idleMs: number): void {
  cancelScheduledRelease();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void releaseSession();
  }, idleMs);
  if (typeof idleTimer.unref === 'function') idleTimer.unref();
}

/** Cancel a pending idle-release, if any. */
export function cancelScheduledRelease(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}
