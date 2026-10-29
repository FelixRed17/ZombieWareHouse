type Sound = 'pistol' | 'reload' | 'zombieGrowl' | 'zombieHit';

interface SoundVoice {
  sources: Set<AudioScheduledSourceNode>;
  nodes: Set<AudioNode>;
}

interface OneShotSource {
  voice: SoundVoice;
  nodes: AudioNode[];
}

const MASTER_GAIN = 0.22;
const MAX_CONCURRENT_EFFECTS = 8;

/** Synthesized effects and ambience. Call unlock() directly from a user gesture. */
export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly oneShots = new Set<SoundVoice>();
  private readonly oneShotSources = new Map<AudioScheduledSourceNode, OneShotSource>();
  private ambience: SoundVoice | null = null;
  private mutedState = false;
  private playing = false;
  private supported = typeof window !== 'undefined' && typeof window.AudioContext === 'function';
  private disposed = false;
  private resumePending = false;

  get muted(): boolean { return this.mutedState; }
  get available(): boolean {
    return this.supported && !this.disposed && (!this.context || this.context.state !== 'closed');
  }

  /** Initialize or resume the single owned context from a user gesture. */
  unlock(): void {
    if (!this.available) return;

    try {
      if (!this.context) {
        this.context = new window.AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.mutedState ? 0 : MASTER_GAIN;
        this.master.connect(this.context.destination);
        this.noiseBuffer = this.createNoiseBuffer(this.context);
      }

      if (this.context.state === 'suspended' && !this.resumePending) {
        this.resumePending = true;
        void this.context.resume().then(() => {
          this.resumePending = false;
        }, () => {
          this.resumePending = false;
          this.disableAudio();
        });
      }
    } catch {
      this.disableAudio();
    }
  }

  setMuted(muted: boolean): void {
    if (this.disposed || muted === this.mutedState) return;
    this.mutedState = muted;

    if (this.master && this.context) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(muted ? 0 : MASTER_GAIN, now);
    }

    if (muted) this.stopEverything();
    else if (this.playing) this.startAmbience();
  }

  /** Game calls this after its gesture-driven unlock and on play/pause changes. */
  setPlaying(playing: boolean): void {
    if (this.disposed) return;
    this.playing = playing;
    if (playing && !this.mutedState) this.startAmbience();
    else this.stopEverything();
  }

  play(sound: Sound): void {
    const context = this.context;
    if (!this.playing || this.mutedState || !this.available || !context || !this.master || context.state !== 'running') return;
    if (this.oneShots.size >= MAX_CONCURRENT_EFFECTS) return;

    const voice: SoundVoice = { sources: new Set(), nodes: new Set() };
    this.oneShots.add(voice);
    const now = context.currentTime;

    try {
      switch (sound) {
        case 'pistol':
          this.noise(voice, now, 0.105, 0.19, 1150);
          this.tone(voice, now, 148, 49, 0.13, 'sawtooth', 0.13);
          break;
        case 'reload':
          this.tone(voice, now, 680, 590, 0.075, 'square', 0.055);
          this.tone(voice, now, 470, 760, 0.105, 'triangle', 0.065, 0.13);
          this.tone(voice, now, 730, 610, 0.08, 'square', 0.045, 0.3);
          break;
        case 'zombieGrowl':
          this.tone(voice, now, 116, 58, 0.56, 'triangle', 0.13);
          this.noise(voice, now, 0.34, 0.035, 380, 0.02);
          break;
        case 'zombieHit':
          this.noise(voice, now, 0.075, 0.12, 900);
          this.tone(voice, now, 210, 87, 0.12, 'triangle', 0.12);
          break;
      }
    } catch {
      this.stopVoice(voice);
    }

    if (voice.sources.size === 0) this.oneShots.delete(voice);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.playing = false;
    this.stopEverything();
    this.master?.disconnect();
    this.master = null;
    this.noiseBuffer = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const duration = 2;
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private tone(
    voice: SoundVoice,
    startAt: number,
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    peak: number,
    delay = 0,
  ): void {
    if (!this.context || !this.master) return;
    const source = this.context.createOscillator();
    const envelope = this.context.createGain();
    const at = startAt + delay;
    source.type = type;
    source.frequency.setValueAtTime(Math.max(startFrequency, 1), at);
    source.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), at + duration);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + Math.min(0.008, duration / 3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(envelope);
    envelope.connect(this.master);
    this.trackOneShot(voice, source, [source, envelope]);
    source.start(at);
    source.stop(at + duration + 0.01);
  }

  private noise(voice: SoundVoice, startAt: number, duration: number, peak: number, cutoff: number, delay = 0): void {
    if (!this.context || !this.master || !this.noiseBuffer) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    const at = startAt + delay;
    const attack = Math.min(0.004, duration / 3);
    const offset = Math.random() * Math.max(0, this.noiseBuffer.duration - duration);
    source.buffer = this.noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, at);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    this.trackOneShot(voice, source, [source, filter, envelope]);
    source.start(at, offset, duration);
    source.stop(at + duration + 0.01);
  }

  private trackOneShot(voice: SoundVoice, source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    voice.sources.add(source);
    for (const node of nodes) voice.nodes.add(node);
    this.oneShotSources.set(source, { voice, nodes });
    source.onended = () => this.finishOneShot(source);
  }

  private finishOneShot(source: AudioScheduledSourceNode): void {
    const owned = this.oneShotSources.get(source);
    if (!owned) return;
    this.oneShotSources.delete(source);
    source.onended = null;
    owned.voice.sources.delete(source);
    for (const node of owned.nodes) {
      node.disconnect();
      owned.voice.nodes.delete(node);
    }
    if (owned.voice.sources.size === 0) this.oneShots.delete(owned.voice);
  }

  private startAmbience(): void {
    if (!this.context || !this.master || !this.noiseBuffer || !this.playing || this.mutedState || this.ambience) return;

    const voice: SoundVoice = { sources: new Set(), nodes: new Set() };
    this.ambience = voice;

    try {
      const now = this.context.currentTime;
      const humFilter = this.context.createBiquadFilter();
      const humMix = this.context.createGain();
      const low = this.context.createOscillator();
      const high = this.context.createOscillator();
      const noiseSource = this.context.createBufferSource();
      const noiseFilter = this.context.createBiquadFilter();
      const noiseMix = this.context.createGain();

      humFilter.type = 'lowpass';
      humFilter.frequency.setValueAtTime(160, now);
      humMix.gain.setValueAtTime(0.065, now);
      low.type = 'sine';
      low.frequency.setValueAtTime(49, now);
      high.type = 'triangle';
      high.frequency.setValueAtTime(73, now);
      low.connect(humFilter);
      high.connect(humFilter);
      humFilter.connect(humMix);
      humMix.connect(this.master);
      this.addAmbienceSources(voice, [low, high], [humFilter, humMix]);

      noiseSource.buffer = this.noiseBuffer;
      noiseSource.loop = true;
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(260, now);
      noiseMix.gain.setValueAtTime(0.012, now);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseMix);
      noiseMix.connect(this.master);
      this.addAmbienceSources(voice, [noiseSource], [noiseFilter, noiseMix]);

      low.start(now);
      high.start(now);
      noiseSource.start(now);
    } catch {
      this.stopAmbience();
    }
  }

  private addAmbienceSources(voice: SoundVoice, sources: AudioScheduledSourceNode[], nodes: AudioNode[]): void {
    for (const source of sources) voice.sources.add(source);
    for (const node of [...sources, ...nodes]) voice.nodes.add(node);
  }

  private stopEverything(): void {
    for (const voice of [...this.oneShots]) this.stopVoice(voice);
    this.stopAmbience();
  }

  private stopVoice(voice: SoundVoice): void {
    this.oneShots.delete(voice);
    for (const source of voice.sources) {
      source.onended = null;
      this.oneShotSources.delete(source);
      try { source.stop(); } catch { /* The source may already have ended. */ }
    }
    for (const node of voice.nodes) node.disconnect();
    voice.sources.clear();
    voice.nodes.clear();
  }

  private stopAmbience(): void {
    const voice = this.ambience;
    this.ambience = null;
    if (voice) this.stopVoice(voice);
  }

  private disableAudio(): void {
    this.supported = false;
    this.resumePending = false;
    this.stopEverything();
    this.master?.disconnect();
    this.master = null;
    this.noiseBuffer = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
