import assert from 'node:assert/strict';
import { AudioManager } from '../AudioManager.ts';

let contexts = [];

class FakeAudioParam {
  value = 0;
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}

class FakeNode {
  connections = [];
  disconnectCount = 0;
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.disconnectCount += 1; this.connections = []; }
}

class FakeSource extends FakeNode {
  onended = null;
  starts = [];
  stops = [];
  constructor(context) { super(); this.context = context; }
  start(...args) { this.starts.push(args); this.context.startedSources.push(this); }
  stop(...args) { this.stops.push(args); }
  finish() {
    const ended = this.onended;
    this.onended = null;
    ended?.();
  }
}

class FakeOscillator extends FakeSource {
  type = 'sine';
  frequency = new FakeAudioParam();
}

class FakeBufferSource extends FakeSource {
  buffer = null;
  loop = false;
}

class FakeGain extends FakeNode {
  gain = new FakeAudioParam();
}

class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeAudioParam();
}

class FakeBuffer {
  constructor(channels, frames, sampleRate) {
    this.duration = frames / sampleRate;
    this.channels = Array.from({ length: channels }, () => new Float32Array(frames));
  }
  getChannelData(channel) { return this.channels[channel]; }
}

class FakeAudioContext {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 100;
  destination = new FakeNode();
  sources = [];
  startedSources = [];
  oscillators = [];
  bufferSources = [];
  gains = [];
  nodes = [];
  createBufferCalls = 0;
  resumeCalls = 0;
  closeCalls = 0;
  constructor() { contexts.push(this); }
  track(node) { this.nodes.push(node); return node; }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return this.track(gain);
  }
  createOscillator() {
    const source = new FakeOscillator(this);
    this.sources.push(source);
    this.oscillators.push(source);
    return this.track(source);
  }
  createBufferSource() {
    const source = new FakeBufferSource(this);
    this.sources.push(source);
    this.bufferSources.push(source);
    return this.track(source);
  }
  createBiquadFilter() { return this.track(new FakeFilter()); }
  createBuffer(channels, frames, sampleRate) {
    this.createBufferCalls += 1;
    return new FakeBuffer(channels, frames, sampleRate);
  }
  resume() { this.resumeCalls += 1; this.state = 'running'; return Promise.resolve(); }
  close() { this.closeCalls += 1; this.state = 'closed'; return Promise.resolve(); }
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function verifyGestureInitializationAndQueueDrop() {
  contexts = [];
  globalThis.window = { AudioContext: FakeAudioContext };
  const audio = new AudioManager();
  assert.equal(audio.available, true);
  assert.equal(audio.muted, false);

  audio.setPlaying(true);
  audio.play('pistol');
  assert.equal(contexts.length, 0, 'playing state and effects must not initialize audio');

  audio.unlock();
  await flushMicrotasks();
  assert.equal(contexts.length, 1, 'unlock should create exactly one context');
  assert.equal(contexts[0].resumeCalls, 1);
  assert.equal(contexts[0].createBufferCalls, 1, 'noise is generated once and reused');
  assert.equal(contexts[0].sources.length, 0, 'the pre-unlock pistol must not be queued');

  audio.setPlaying(true);
  assert.equal(contexts[0].oscillators.length, 2, 'resume starts the hum once');
  assert.equal(contexts[0].bufferSources.length, 1, 'resume starts one looped noise bed');
  assert.equal(contexts[0].bufferSources[0].loop, true);
  audio.setPlaying(true);
  assert.equal(contexts[0].sources.length, 3, 'repeated resume does not duplicate ambience');

  audio.dispose();
  await flushMicrotasks();
}

async function verifyEffectsMutePauseConcurrencyAndDispose() {
  contexts = [];
  globalThis.window = { AudioContext: FakeAudioContext };
  const audio = new AudioManager();
  audio.play('reload');
  assert.equal(contexts.length, 0, 'effects outside active play are ignored');
  audio.unlock();
  await flushMicrotasks();
  const context = contexts[0];

  audio.play('pistol');
  assert.equal(context.sources.length, 0, 'effects remain gated until active play');
  audio.setPlaying(true);
  const ambienceSources = context.sources.length;
  assert.equal(ambienceSources, 3);

  for (let index = 0; index < 8; index++) audio.play('pistol');
  const afterEight = context.sources.length;
  assert.equal(afterEight - ambienceSources, 16, 'eight pistol events each schedule two sources');
  audio.play('reload');
  assert.equal(context.sources.length, afterEight, 'the ninth concurrent effect is capped');

  for (const source of context.sources.slice(ambienceSources)) source.finish();

  const reloadStart = context.sources.length;
  const reloadNodesStart = context.nodes.length;
  audio.play('reload');
  const reloadSources = context.sources.slice(reloadStart);
  assert.equal(reloadSources.length, 3, 'reload synthesizes three mechanical clicks');
  for (const source of reloadSources) source.finish();
  assert.equal(context.nodes.slice(reloadNodesStart).every(node => node.disconnectCount > 0), true, 'ended reload nodes are disconnected');

  const growlStart = context.sources.length;
  audio.play('zombieGrowl');
  const growlSources = context.sources.slice(growlStart);
  assert.equal(growlSources.length, 2, 'a completed voice frees one concurrency slot');
  assert.equal(growlSources[0].buffer ?? null, null, 'growl includes its synthesized oscillator');
  assert.equal(growlSources[1].buffer, context.bufferSources[0].buffer, 'effects reuse the generated noise buffer');

  const hitStart = context.sources.length;
  audio.play('zombieHit');
  const hitSources = context.sources.slice(hitStart);
  assert.equal(hitSources.length, 2, 'zombie hit synthesizes a noise burst and tone');
  assert.equal(hitSources[0].buffer, context.bufferSources[0].buffer, 'hit noise reuses the generated buffer');

  audio.setMuted(true);
  assert.equal(audio.muted, true);
  assert.equal(audio.available, true, 'muting does not make supported audio unavailable');
  assert.equal(context.gains[0].gain.value, 0, 'mute silences the master output');
  assert.equal(context.sources.at(-1).stops.length > 0, true, 'mute stops active one-shots');
  assert.equal(context.sources.slice(0, ambienceSources).every(source => source.stops.length > 0), true, 'mute stops ambience');
  const mutedSourceCount = context.sources.length;
  audio.play('pistol');
  assert.equal(context.sources.length, mutedSourceCount, 'muted effects are ignored');
  audio.setMuted(false);
  assert.equal(audio.muted, false);
  assert.equal(context.gains[0].gain.value, 0.22, 'unmute restores the master output');
  assert.equal(context.sources.length, mutedSourceCount + 3, 'unmute during play restores one ambience instance');
  audio.setMuted(false);
  assert.equal(context.sources.length, mutedSourceCount + 3, 'repeated unmute does not duplicate ambience');

  const pausedHitStart = context.sources.length;
  audio.play('zombieHit');
  assert.equal(context.sources.length, pausedHitStart + 2, 'an effect can be active before pause');
  const activeSources = [...context.sources];
  audio.setPlaying(false);
  assert.equal(activeSources.every(source => source.stops.length > 0), true, 'pause stops all active sources');
  const pausedSourceCount = context.sources.length;
  audio.play('zombieHit');
  assert.equal(context.sources.length, pausedSourceCount, 'paused effects are ignored');

  audio.unlock();
  audio.setPlaying(true);
  assert.equal(context.sources.length, pausedSourceCount + 3, 'resume starts one new ambience instance');
  audio.setPlaying(true);
  assert.equal(context.sources.length, pausedSourceCount + 3, 'repeated play state does not duplicate ambience');
  audio.unlock();
  await flushMicrotasks();
  assert.equal(contexts.length, 1, 'repeated unlock reuses the owned context');
  assert.equal(context.resumeCalls, 1, 'a running context is not resumed again');

  const activeHitStart = context.sources.length;
  audio.play('zombieHit');
  assert.equal(context.sources.length, activeHitStart + 2, 'active-play effects remain enabled after resume');

  // Game keeps one AudioManager across rounds. Repeated menu/start cycles must
  // stop the prior ambience and create exactly one fresh ambience bed each time.
  for (let restart = 1; restart <= 3; restart++) {
    const beforePause = context.sources.length;
    audio.setPlaying(false);
    assert.equal(context.sources.length, beforePause, `restart ${restart} pause creates no sources`);
    const beforeResume = context.sources.length;
    audio.unlock();
    audio.setPlaying(true);
    assert.equal(context.sources.length, beforeResume + 3, `restart ${restart} creates one ambience bed`);
    audio.setPlaying(true);
    assert.equal(context.sources.length, beforeResume + 3, `restart ${restart} repeated play does not duplicate ambience`);
  }

  const sourcesBeforeDispose = [...context.sources];
  const sourceCountBeforeDispose = context.sources.length;
  audio.dispose();
  await flushMicrotasks();
  assert.equal(audio.available, false);
  assert.equal(context.state, 'closed');
  assert.equal(context.closeCalls, 1);
  assert.equal(sourcesBeforeDispose.every(source => source.stops.length > 0), true, 'dispose stops every owned source');
  assert.equal(context.gains[0].connections.length, 0, 'dispose disconnects the master from the destination');
  assert.equal(context.nodes.every(node => node.disconnectCount > 0), true, 'dispose disconnects every owned node');
  audio.setPlaying(true);
  audio.play('pistol');
  assert.equal(context.sources.length, sourceCountBeforeDispose, 'disposed instances cannot restart');
}

async function verifyUnavailableAudio() {
  globalThis.window = {};
  const audio = new AudioManager();
  assert.equal(audio.available, false);
  audio.unlock();
  audio.setPlaying(true);
  audio.play('pistol');
  audio.setMuted(true);
  audio.dispose();
  assert.equal(audio.available, false);
}

async function verifyResumeFailure() {
  contexts = [];
  class RejectingAudioContext extends FakeAudioContext {
    resume() {
      this.resumeCalls += 1;
      return Promise.reject(new Error('Audio permission denied'));
    }
  }
  globalThis.window = { AudioContext: RejectingAudioContext };
  const audio = new AudioManager();
  audio.unlock();
  await flushMicrotasks();
  assert.equal(audio.available, false, 'a rejected resume is reported as unavailable');
  assert.equal(contexts[0].state, 'closed', 'failed contexts are closed');
  audio.setPlaying(true);
  audio.play('pistol');
  audio.dispose();
}

await verifyGestureInitializationAndQueueDrop();
await verifyEffectsMutePauseConcurrencyAndDispose();
await verifyUnavailableAudio();
await verifyResumeFailure();
console.log('AudioManager lifecycle checks passed.');
