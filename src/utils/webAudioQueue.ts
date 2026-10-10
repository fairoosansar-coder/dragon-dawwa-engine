/**
 * Dragon Dawwa Web Audio API Pre-Loading Queue Engine
 * 
 * Provides an AudioContext-based queue and buffering pipeline:
 * 1. Pre-fetches dialogue TTS audio in advance.
 * 2. Decodes binary audio into native AudioBuffers using AudioContext.decodeAudioData().
 * 3. Keeps an active playback queue so that when segment N ends, segment N+1 triggers with 0ms delay.
 * 4. Connects through an AnalyserNode for high-resolution visualizer canvas streaming.
 */

export class WebAudioQueueManager {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private decodedBufferCache = new Map<number, AudioBuffer>();
  private pendingFetches = new Map<number, Promise<AudioBuffer | null>>();
  private currentPlayingIndex: number = -1;

  public getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.smoothingTimeConstant = 0.8;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    this.getContext();
    return this.analyser;
  }

  /**
   * Converts base64 string to ArrayBuffer for AudioContext decoding
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Pre-loads, decodes, and caches an AudioBuffer for a specific dialogue line
   */
  public async prefetchAndDecode(
    index: number,
    text: string,
    speaker: string,
    voiceName?: string
  ): Promise<AudioBuffer | null> {
    if (this.decodedBufferCache.has(index)) {
      return this.decodedBufferCache.get(index)!;
    }

    if (this.pendingFetches.has(index)) {
      return this.pendingFetches.get(index)!;
    }

    const clean = text.replace(/\[[^\]]+\]/g, '').trim();
    if (!clean) return null;

    const loadPromise = (async () => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean, speaker, voiceName })
        });

        if (!res.ok) {
          throw new Error(`TTS server responded with ${res.status}`);
        }

        const data = await res.json();
        if (data.audioBase64) {
          const ctx = this.getContext();
          if (ctx) {
            const arrayBuf = this.base64ToArrayBuffer(data.audioBase64);
            const audioBuffer = await ctx.decodeAudioData(arrayBuf);
            this.decodedBufferCache.set(index, audioBuffer);
            return audioBuffer;
          }
        }
        return null;
      } catch (err) {
        console.warn(`WebAudio prefetch error for line ${index} (${speaker}):`, err);
        return null;
      } finally {
        this.pendingFetches.delete(index);
      }
    })();

    this.pendingFetches.set(index, loadPromise);
    return loadPromise;
  }

  /**
   * Has the audio already been buffered and ready to play immediately?
   */
  public isReady(index: number): boolean {
    return this.decodedBufferCache.has(index);
  }

  /**
   * Plays a decoded AudioBuffer immediately with Web Audio API.
   * Invokes onEnded callback seamlessly as soon as audio playback finishes.
   */
  public async playSegment(
    index: number,
    text: string,
    speaker: string,
    playbackRate: number,
    onEnded: () => void
  ): Promise<boolean> {
    this.stopCurrent();

    const ctx = this.getContext();
    if (!ctx) return false;

    let buffer: AudioBuffer | null = null;
    if (this.decodedBufferCache.has(index)) {
      buffer = this.decodedBufferCache.get(index)!;
    } else {
      buffer = await this.prefetchAndDecode(index, text, speaker);
    }

    if (!buffer) return false;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;

      if (this.analyser) {
        source.connect(this.analyser);
        this.analyser.connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }

      this.activeSource = source;
      this.currentPlayingIndex = index;

      source.onended = () => {
        if (this.currentPlayingIndex === index) {
          this.activeSource = null;
          this.currentPlayingIndex = -1;
          onEnded();
        }
      };

      source.start(0);
      return true;
    } catch (playErr) {
      console.warn('Web Audio playback error:', playErr);
      return false;
    }
  }

  /**
   * Stops currently playing buffer
   */
  public stopCurrent(): void {
    if (this.activeSource) {
      try {
        this.activeSource.onended = null;
        this.activeSource.stop();
      } catch {}
      this.activeSource = null;
    }
    this.currentPlayingIndex = -1;
  }

  /**
   * Clears buffer cache
   */
  public clear(): void {
    this.stopCurrent();
    this.decodedBufferCache.clear();
    this.pendingFetches.clear();
  }
}

export const webAudioQueue = new WebAudioQueueManager();
