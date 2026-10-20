/**
 * Dragon Dawwa Audio Studio Web Audio Synthesizer
 * Procedural studio sound effect generator & audio mixer
 * Replicating pydub / Web Audio procedural sound design
 */

export type StudioFxType = 'intro_music' | 'paper_rustle' | 'soft_chime' | 'dramatic_drum' | 'outro_music' | 'bismillah_cue' | 'none';

class AudioStudioEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays a procedural sound effect matching the master Python script design
   */
  public playFx(fxType: StudioFxType): Promise<void> {
    return new Promise((resolve) => {
      const ctx = this.getContext();
      if (!ctx || fxType === 'none') {
        resolve();
        return;
      }

      const now = ctx.currentTime;

      if (fxType === 'intro_music') {
        // Traditional Oriental Ney & Oud acoustic ambient drone pad (D minor / Bayati mode: D3, A3, F4, G4)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        // Warm woody Ney flute / acoustic drone filter
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(1400, now + 1.2);
        filter.frequency.exponentialRampToValueAtTime(650, now + 3.2);

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(146.83, now); // D3 (Deep Ney fundamental)
        osc1.frequency.linearRampToValueAtTime(220.00, now + 1.8); // A3

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(220.00, now); // A3
        osc2.frequency.linearRampToValueAtTime(349.23, now + 2.0); // F4 (Bayati flavor)

        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(293.66, now); // D4

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.22, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);

        osc1.connect(filter);
        osc2.connect(filter);
        osc3.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc3.start(now);
        osc1.stop(now + 3.4);
        osc2.stop(now + 3.4);
        osc3.stop(now + 3.4);

        setTimeout(resolve, 2200);
      } else if (fxType === 'soft_chime') {
        // Soft antique brass chime & harmonic ring
        const osc = ctx.createOscillator();
        const oscHarmonic = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(784, now); // G5 antique brass
        osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6

        oscHarmonic.type = 'triangle';
        oscHarmonic.frequency.setValueAtTime(1567.98, now); // G6 subtle shimmer

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

        osc.connect(gain);
        oscHarmonic.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        oscHarmonic.start(now);
        osc.stop(now + 1.4);
        oscHarmonic.stop(now + 1.4);

        setTimeout(resolve, 800);
      } else if (fxType === 'dramatic_drum') {
        // Dramatic low sub-bass impact (75Hz descending impact punch)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.7);

        setTimeout(resolve, 600);
      } else if (fxType === 'paper_rustle') {
        // Procedural noise burst simulating script paper movement
        const bufferSize = ctx.sampleRate * 0.35;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 1.2;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(now);
        setTimeout(resolve, 350);
      } else if (fxType === 'outro_music') {
        // Closing warm synth outro sting (A3 + E4 + A4)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(329.63, now);
        osc1.frequency.exponentialRampToValueAtTime(220, now + 3.0);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(440, now);
        osc2.frequency.exponentialRampToValueAtTime(220, now + 3.0);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 3.5);
        osc2.stop(now + 3.5);

        setTimeout(resolve, 2500);
      } else if (fxType === 'bismillah_cue') {
        // Soft Bismillah opening vocalization cue: warm modal acoustic chord in Bayati maqam
        // D4 (293.66Hz), F4 (349.23Hz), A4 (440Hz), D5 (587.33Hz) with gentle vocal formant filter
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(650, now); // Vocal formant resonance
        filter.Q.setValueAtTime(2.5, now);

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(293.66, now); // D4
        osc1.frequency.exponentialRampToValueAtTime(329.63, now + 1.2);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(349.23, now); // F4 (Bayati flavor)
        osc2.frequency.exponentialRampToValueAtTime(440.0, now + 1.2);

        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(440.0, now); // A4

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

        osc1.connect(filter);
        osc2.connect(filter);
        osc3.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc3.start(now);
        osc1.stop(now + 2.2);
        osc2.stop(now + 2.2);
        osc3.stop(now + 2.2);

        setTimeout(resolve, 1800);
      } else {
        resolve();
      }
    });
  }
}

export const audioStudio = new AudioStudioEngine();
