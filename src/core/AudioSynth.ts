import { tuning } from "../config/tuning";

export type SfxName =
  | "jump"
  | "doubleJump"
  | "bounce"
  | "land"
  | "collect"
  | "death"
  | "portalActive"
  | "portalEnter"
  | "uiClick";

export interface SfxPlayOptions {
  step?: number;
  intensity?: number;
}

const GAIN_SMOOTHING_SEC = 0.02;

const NOISE_BUFFER_SEC = 0.1;

const SILENCE = 0.0001;

interface OscSweep {
  readonly type: OscillatorType;
  readonly startHz: number;
  readonly endHz: number;
  readonly durSec: number;
  readonly attackSec: number;
  readonly peak: number;
}

const JUMP: OscSweep = {
  type: "square",
  startHz: 220,
  endHz: 440,
  durSec: 0.09,
  attackSec: 0.005,
  peak: 0.22,
};

const DOUBLE_JUMP: OscSweep = {
  type: "square",
  startHz: 330,
  endHz: 660,
  durSec: 0.08,
  attackSec: 0.005,
  peak: 0.2,
};

const BOUNCE: OscSweep = {
  type: "sine",
  startHz: 150,
  endHz: 500,
  durSec: 0.12,
  attackSec: 0.005,
  peak: 0.22,
};

const LAND = {
  durSec: 0.07,
  attackSec: 0.004,
  thudHz: 90,
  thudPeak: 0.3,
  burstLowpassHz: 900,
  burstPeak: 0.14,
};

const COLLECT = {
  baseHz: 523.25,
  ladder: [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3],
  maxStep: 9,
  secondNoteOffset: 2,
  staggerSec: 0.07,
  noteSec: 0.26,
  attackSec: 0.006,
  peak: 0.18,
};

const DEATH = {
  durSec: 0.35,
  attackSec: 0.008,
  startHz: 300,
  endHz: 60,
  sawPeak: 0.24,
  noiseLowpassHz: 1200,
  noisePeak: 0.12,
};

const PORTAL_ACTIVE = {
  durSec: 0.6,
  attackSec: 0.08,
  baseHz: 392,
  triad: [1, 5 / 4, 3 / 2],
  detuneCents: 7,
  peak: 0.07,
};

const PORTAL_ENTER = {
  durSec: 0.4,
  riseSec: 0.34,
  startHz: 300,
  endHz: 3200,
  q: 2.5,
  peak: 0.22,
};

const UI_CLICK = {
  durSec: 0.008,
  highpassHz: 3200,
  peak: 0.16,
};

const ROLLING = {
  maxGain: 0.12,
  smoothSec: 0.06,
  cutoffMinHz: 400,
  cutoffMaxHz: 2200,
  rateMin: 0.8,
  rateMax: 1.3,
};

const HUM = {
  sineHz: 98,
  triangleHz: 147,
  detuneCents: 4,
  lowpassHz: 520,
  gain: 0.05,
  attackTau: 0.08,
  releaseTau: 0.13,
  stopAfterSec: 0.8,
};

const AMBIENT = {
  rootHz: 98,
  chords: [
    [1, 6 / 5, 3 / 2],
    [6 / 5, 8 / 5, 2],
    [6 / 5, 3 / 2, 9 / 5],
    [8 / 9, 9 / 8, 4 / 3],
  ],
  chordSec: 4,
  attackSec: 1.4,
  releaseSec: 1.6,
  detuneCents: 5,
  lowpassHz: 700,
  notePeak: 0.03,
  lookaheadSec: 3,
  tickMs: 1000,
  offFadeTau: 0.2,
  offCleanupMs: 1500,
};

interface PatchContext {
  readonly ctx: AudioContext;
  readonly out: AudioNode;
  readonly pitch: number;
  readonly t0: number;
  readonly opts: SfxPlayOptions;
  readonly noise: AudioBuffer;
}

type PatchFn = (p: PatchContext) => void;

function pentatonicHz(degree: number): number {
  const ratio = COLLECT.ladder[degree % COLLECT.ladder.length] ?? 1;
  return (
    COLLECT.baseHz * ratio * 2 ** Math.floor(degree / COLLECT.ladder.length)
  );
}

function cleanupOnEnded(
  source: AudioScheduledSourceNode,
  chain: AudioNode[],
): void {
  source.onended = () => {
    source.onended = null;
    source.disconnect();
    for (const node of chain) {
      node.disconnect();
    }
  };
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(
    1,
    Math.ceil(NOISE_BUFFER_SEC * ctx.sampleRate),
    ctx.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function playOscSweep(
  { ctx, out, pitch, t0 }: PatchContext,
  sweep: OscSweep,
): void {
  const osc = ctx.createOscillator();
  osc.type = sweep.type;
  osc.frequency.setValueAtTime(sweep.startHz * pitch, t0);
  osc.frequency.exponentialRampToValueAtTime(
    sweep.endHz * pitch,
    t0 + sweep.durSec,
  );

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(sweep.peak, t0 + sweep.attackSec);
  gain.gain.exponentialRampToValueAtTime(SILENCE, t0 + sweep.durSec);

  osc.connect(gain).connect(out);
  cleanupOnEnded(osc, [gain]);
  osc.start(t0);
  osc.stop(t0 + sweep.durSec);
}

const patches: Record<SfxName, PatchFn> = {
  jump: (p) => {
    playOscSweep(p, JUMP);
  },

  doubleJump: (p) => {
    playOscSweep(p, DOUBLE_JUMP);
  },

  bounce: (p) => {
    playOscSweep(p, BOUNCE);
  },

  land: ({ ctx, out, pitch, t0, opts, noise }) => {
    const scale = clamp01(opts.intensity ?? 1);
    const thudPeak = Math.max(SILENCE, LAND.thudPeak * scale);
    const burstPeak = Math.max(SILENCE, LAND.burstPeak * scale);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(LAND.thudHz * pitch, t0);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0, t0);
    thudGain.gain.linearRampToValueAtTime(thudPeak, t0 + LAND.attackSec);
    thudGain.gain.exponentialRampToValueAtTime(SILENCE, t0 + LAND.durSec);

    osc.connect(thudGain).connect(out);
    cleanupOnEnded(osc, [thudGain]);
    osc.start(t0);
    osc.stop(t0 + LAND.durSec);

    const src = ctx.createBufferSource();
    src.buffer = noise;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(LAND.burstLowpassHz * pitch, t0);

    const burstGain = ctx.createGain();
    burstGain.gain.setValueAtTime(burstPeak, t0);
    burstGain.gain.exponentialRampToValueAtTime(SILENCE, t0 + LAND.durSec);

    src.connect(filter).connect(burstGain).connect(out);
    cleanupOnEnded(src, [filter, burstGain]);
    src.start(t0);
    src.stop(t0 + LAND.durSec);
  },

  collect: ({ ctx, out, pitch, t0, opts }) => {
    const step = Math.min(
      COLLECT.maxStep,
      Math.max(0, Math.floor(opts.step ?? 0)),
    );
    for (const [i, offset] of [0, COLLECT.secondNoteOffset].entries()) {
      const start = t0 + i * COLLECT.staggerSec;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(pentatonicHz(step + offset) * pitch, start);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(
        COLLECT.peak,
        start + COLLECT.attackSec,
      );
      gain.gain.exponentialRampToValueAtTime(SILENCE, start + COLLECT.noteSec);

      osc.connect(gain).connect(out);
      cleanupOnEnded(osc, [gain]);
      osc.start(start);
      osc.stop(start + COLLECT.noteSec);
    }
  },

  death: ({ ctx, out, pitch, t0, noise }) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(DEATH.startHz * pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(
      DEATH.endHz * pitch,
      t0 + DEATH.durSec,
    );

    const sawGain = ctx.createGain();
    sawGain.gain.setValueAtTime(0, t0);
    sawGain.gain.linearRampToValueAtTime(DEATH.sawPeak, t0 + DEATH.attackSec);
    sawGain.gain.exponentialRampToValueAtTime(SILENCE, t0 + DEATH.durSec);

    osc.connect(sawGain).connect(out);
    cleanupOnEnded(osc, [sawGain]);
    osc.start(t0);
    osc.stop(t0 + DEATH.durSec);

    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(DEATH.noiseLowpassHz * pitch, t0);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(DEATH.noisePeak, t0);
    noiseGain.gain.exponentialRampToValueAtTime(SILENCE, t0 + DEATH.durSec);

    src.connect(filter).connect(noiseGain).connect(out);
    cleanupOnEnded(src, [filter, noiseGain]);
    src.start(t0);
    src.stop(t0 + DEATH.durSec);
  },

  portalActive: ({ ctx, out, pitch, t0 }) => {
    for (const ratio of PORTAL_ACTIVE.triad) {
      for (const sign of [-1, 1]) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(PORTAL_ACTIVE.baseHz * ratio * pitch, t0);
        osc.detune.setValueAtTime(sign * PORTAL_ACTIVE.detuneCents, t0);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(
          PORTAL_ACTIVE.peak,
          t0 + PORTAL_ACTIVE.attackSec,
        );
        gain.gain.exponentialRampToValueAtTime(
          SILENCE,
          t0 + PORTAL_ACTIVE.durSec,
        );

        osc.connect(gain).connect(out);
        cleanupOnEnded(osc, [gain]);
        osc.start(t0);
        osc.stop(t0 + PORTAL_ACTIVE.durSec);
      }
    }
  },

  portalEnter: ({ ctx, out, pitch, t0, noise }) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(PORTAL_ENTER.q, t0);
    filter.frequency.setValueAtTime(PORTAL_ENTER.startHz * pitch, t0);
    filter.frequency.exponentialRampToValueAtTime(
      PORTAL_ENTER.endHz * pitch,
      t0 + PORTAL_ENTER.riseSec,
    );

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(SILENCE, t0);
    gain.gain.exponentialRampToValueAtTime(
      PORTAL_ENTER.peak,
      t0 + PORTAL_ENTER.riseSec,
    );
    gain.gain.exponentialRampToValueAtTime(SILENCE, t0 + PORTAL_ENTER.durSec);

    src.connect(filter).connect(gain).connect(out);
    cleanupOnEnded(src, [filter, gain]);
    src.start(t0);
    src.stop(t0 + PORTAL_ENTER.durSec);
  },

  uiClick: ({ ctx, out, pitch, t0, noise }) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(UI_CLICK.highpassHz * pitch, t0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(UI_CLICK.peak, t0);
    gain.gain.exponentialRampToValueAtTime(SILENCE, t0 + UI_CLICK.durSec);

    src.connect(filter).connect(gain).connect(out);
    cleanupOnEnded(src, [filter, gain]);
    src.start(t0);
    src.stop(t0 + UI_CLICK.durSec);
  },
};

interface RollingVoice {
  readonly src: AudioBufferSourceNode;
  readonly filter: BiquadFilterNode;
  readonly gain: GainNode;
}

function createRollingVoice(
  ctx: AudioContext,
  out: AudioNode,
  noise: AudioBuffer,
): RollingVoice {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  src.playbackRate.value = ROLLING.rateMin;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = ROLLING.cutoffMinHz;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  src.connect(filter).connect(gain).connect(out);
  src.start();
  return { src, filter, gain };
}

interface HumVoice {
  readonly oscs: readonly OscillatorNode[];
  readonly filter: BiquadFilterNode;
  readonly gain: GainNode;
}

function createHumVoice(ctx: AudioContext, out: AudioNode): HumVoice {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = HUM.lowpassHz;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  const recipes: {
    type: OscillatorType;
    hz: number;
    detuneCents: number;
  }[] = [
    { type: "sine", hz: HUM.sineHz, detuneCents: -HUM.detuneCents },
    { type: "triangle", hz: HUM.triangleHz, detuneCents: HUM.detuneCents },
  ];
  const oscs = recipes.map((r) => {
    const osc = ctx.createOscillator();
    osc.type = r.type;
    osc.frequency.value = r.hz;
    osc.detune.value = r.detuneCents;
    osc.connect(filter);
    osc.start();
    return osc;
  });

  filter.connect(gain).connect(out);
  return { oscs, filter, gain };
}

interface AmbientSession {
  readonly filter: BiquadFilterNode;
  readonly bus: GainNode;
  timer: number | undefined;
  nextChordAt: number;
  chordIndex: number;
}

function scheduleAmbientChord(
  ctx: AudioContext,
  out: AudioNode,
  chordIndex: number,
  t: number,
): void {
  const ratios = AMBIENT.chords[chordIndex % AMBIENT.chords.length] ?? [];
  const end = t + AMBIENT.chordSec + AMBIENT.releaseSec;
  for (const [i, ratio] of ratios.entries()) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = AMBIENT.rootHz * ratio;
    osc.detune.value = (i % 2 === 0 ? -1 : 1) * AMBIENT.detuneCents;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(AMBIENT.notePeak, t + AMBIENT.attackSec);
    gain.gain.setValueAtTime(AMBIENT.notePeak, t + AMBIENT.chordSec);
    gain.gain.linearRampToValueAtTime(0, end);

    osc.connect(gain).connect(out);
    cleanupOnEnded(osc, [gain]);
    osc.start(t);
    osc.stop(end);
  }
}

export class AudioSynth {
  private ctx: AudioContext | undefined;
  private master: GainNode | undefined;
  private noise: AudioBuffer | undefined;
  private rolling: RollingVoice | undefined;
  private rollingSpeed = -1;
  private hum: HumVoice | undefined;
  private ambient: AmbientSession | undefined;
  private humDesired = false;
  private ambientDesired = false;
  private volume = clamp01(tuning.defaultVolume);
  private muted = false;

  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.targetGain();
      this.master.connect(this.ctx.destination);
      this.ctx.addEventListener("statechange", () => {
        this.realizeVoices();
      });
    }
    if (this.ctx.state === "suspended") {
      void this.ctx
        .resume()
        .then(() => {
          this.realizeVoices();
        })
        .catch(() => undefined);
    }
  }

  setVolume(v: number): void {
    this.volume = clamp01(v);
    this.applyGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  play(name: SfxName, opts: SfxPlayOptions = {}): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== "running") {
      return;
    }
    this.noise ??= createNoiseBuffer(ctx);
    const pitch = 1 + (Math.random() * 2 - 1) * tuning.sfxPitchJitter;
    patches[name]({
      ctx,
      out: master,
      pitch,
      t0: ctx.currentTime,
      opts,
      noise: this.noise,
    });
  }

  setRolling(speed01: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== "running") {
      return;
    }
    const speed = clamp01(speed01);
    if (!this.rolling) {
      if (speed === 0) {
        return;
      }
      this.noise ??= createNoiseBuffer(ctx);
      this.rolling = createRollingVoice(ctx, master, this.noise);
      this.rollingSpeed = -1;
    }
    if (speed === this.rollingSpeed) {
      return;
    }
    this.rollingSpeed = speed;
    const t = ctx.currentTime;
    const voice = this.rolling;
    voice.gain.gain.setTargetAtTime(
      ROLLING.maxGain * speed,
      t,
      ROLLING.smoothSec,
    );
    voice.filter.frequency.setTargetAtTime(
      ROLLING.cutoffMinHz + (ROLLING.cutoffMaxHz - ROLLING.cutoffMinHz) * speed,
      t,
      ROLLING.smoothSec,
    );
    voice.src.playbackRate.setTargetAtTime(
      ROLLING.rateMin + (ROLLING.rateMax - ROLLING.rateMin) * speed,
      t,
      ROLLING.smoothSec,
    );
  }

  stopRolling(): void {
    const voice = this.rolling;
    if (!voice) {
      return;
    }
    this.rolling = undefined;
    this.rollingSpeed = -1;
    voice.src.stop();
    voice.src.disconnect();
    voice.filter.disconnect();
    voice.gain.disconnect();
  }

  setHum(active: boolean): void {
    this.humDesired = active;
    this.realizeVoices();
  }

  setAmbient(on: boolean): void {
    this.ambientDesired = on;
    this.realizeVoices();
  }

  private realizeVoices(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      return;
    }

    if (!this.humDesired && this.hum) {
      const voice = this.hum;
      this.hum = undefined;
      const t = ctx.currentTime;
      voice.gain.gain.setTargetAtTime(0, t, HUM.releaseTau);
      const [first, ...rest] = voice.oscs;
      if (first) {
        cleanupOnEnded(first, [...rest, voice.filter, voice.gain]);
      }
      for (const osc of voice.oscs) {
        osc.stop(t + HUM.stopAfterSec);
      }
    } else if (this.humDesired && !this.hum && ctx.state === "running") {
      this.hum = createHumVoice(ctx, master);
      this.hum.gain.gain.setTargetAtTime(
        HUM.gain,
        ctx.currentTime,
        HUM.attackTau,
      );
    }

    if (!this.ambientDesired && this.ambient) {
      const session = this.ambient;
      this.ambient = undefined;
      clearTimeout(session.timer);
      session.bus.gain.setTargetAtTime(0, ctx.currentTime, AMBIENT.offFadeTau);
      setTimeout(() => {
        session.filter.disconnect();
        session.bus.disconnect();
      }, AMBIENT.offCleanupMs);
    } else if (
      this.ambientDesired &&
      !this.ambient &&
      ctx.state === "running"
    ) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = AMBIENT.lowpassHz;

      const bus = ctx.createGain();
      bus.gain.value = 1;
      filter.connect(bus).connect(master);

      this.ambient = {
        filter,
        bus,
        timer: undefined,
        nextChordAt: ctx.currentTime,
        chordIndex: 0,
      };
      this.pumpAmbient(this.ambient);
    }
  }

  destroy(): void {
    this.humDesired = false;
    this.ambientDesired = false;
    this.stopRolling();
    this.stopHumNow();
    this.stopAmbientNow();
    if (this.ctx && this.ctx.state !== "closed") {
      void this.ctx.close().catch(() => undefined);
    }
    this.ctx = undefined;
    this.master = undefined;
    this.noise = undefined;
  }

  private pumpAmbient(session: AmbientSession): void {
    const ctx = this.ctx;
    if (!ctx || this.ambient !== session || ctx.state === "closed") {
      return;
    }
    while (session.nextChordAt < ctx.currentTime + AMBIENT.lookaheadSec) {
      scheduleAmbientChord(
        ctx,
        session.filter,
        session.chordIndex,
        session.nextChordAt,
      );
      session.chordIndex = (session.chordIndex + 1) % AMBIENT.chords.length;
      session.nextChordAt += AMBIENT.chordSec;
    }
    session.timer = setTimeout(() => {
      this.pumpAmbient(session);
    }, AMBIENT.tickMs);
  }

  private stopHumNow(): void {
    const voice = this.hum;
    if (!voice) {
      return;
    }
    this.hum = undefined;
    for (const osc of voice.oscs) {
      osc.stop();
      osc.disconnect();
    }
    voice.filter.disconnect();
    voice.gain.disconnect();
  }

  private stopAmbientNow(): void {
    const session = this.ambient;
    if (!session) {
      return;
    }
    this.ambient = undefined;
    clearTimeout(session.timer);
    session.filter.disconnect();
    session.bus.disconnect();
  }

  private applyGain(): void {
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(
        this.targetGain(),
        this.ctx.currentTime,
        GAIN_SMOOTHING_SEC,
      );
    }
  }

  private targetGain(): number {
    return this.muted ? 0 : this.volume;
  }
}
