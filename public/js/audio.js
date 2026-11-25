// Tiny synthesized soundscape: server hum, fans, door whooshes, pager beeps.
// No audio files — every sound is made from oscillators and noise.

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    // brown-ish noise buffer
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    this.noiseBuf = buf;

    this.amb = ctx.createGain();
    this.amb.gain.value = 0.0;
    this.amb.connect(this.master);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    this.fanFilter = ctx.createBiquadFilter();
    this.fanFilter.type = 'lowpass';
    this.fanFilter.frequency.value = 700;
    noise.connect(this.fanFilter).connect(this.amb);
    noise.start();
    [60, 120, 180].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = [0.05, 0.025, 0.01][i];
      o.connect(g).connect(this.amb);
      o.start();
      (this.hums ||= []).push(g);
    });
    this.setAmbience('indoor');
  }

  setAmbience(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const indoor = kind !== 'outdoor';
    this.amb.gain.setTargetAtTime(this.muted ? 0 : indoor ? 0.35 : 0.25, t, 0.5);
    this.fanFilter.frequency.setTargetAtTime(indoor ? (kind === 'tunnel' ? 1400 : 700) : 300, t, 0.5);
    (this.hums || []).forEach((g, i) => g.gain.setTargetAtTime(indoor ? [0.05, 0.025, 0.01][i] : 0, t, 0.5));
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  whoosh() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.6);
  }

  beep(freqs = [880, 1320], dur = 0.09) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    freqs.forEach((fr, i) => {
      const t = ctx.currentTime + i * (dur + 0.03);
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = fr;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    });
  }

  jingle() { this.beep([523, 659, 784, 1047], 0.12); }
  denied() { this.beep([220, 180], 0.15); }
}
