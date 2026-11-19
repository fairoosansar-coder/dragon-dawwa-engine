/** Owns one capture attempt, including permission requests that cannot be aborted. */
export class DictationSession {
  cancelled = false;
  private cleanups: Array<() => void> = [];

  own(cleanup: () => void) {
    if (this.cancelled) this.run(cleanup);
    else this.cleanups.push(cleanup);
  }

  ownStream(stream: MediaStream) {
    // Register individually so a failing track cannot prevent the rest from stopping.
    for (const track of stream.getTracks()) this.own(() => track.stop());
  }

  release() {
    for (const cleanup of this.cleanups.splice(0)) this.run(cleanup);
  }

  cancel() {
    this.cancelled = true;
    this.release();
  }

  private run(cleanup: () => void) {
    try { cleanup(); } catch { /* Continue releasing the remaining resources. */ }
  }
}
