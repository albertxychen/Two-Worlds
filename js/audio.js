// Procedural Web Audio. No external files.

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  async start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
      this._startBed();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.85;
    return this.muted;
  }

  footstep() {
    this._noise(0.08, 0.045, 140 + Math.random() * 180, 'bandpass');
    this._tone(70 + Math.random() * 30, 0.07, 'sine', 0.03);
  }

  blip() {
    this._tone(460 + Math.random() * 240, 0.045, 'triangle', 0.028);
  }

  click() {
    this._tone(320, 0.05, 'sine', 0.035);
  }

  claim() {
    this._tone(311, 0.18, 'sine', 0.045);
    this._tone(466, 0.32, 'sine', 0.035, 0.09);
  }

  coin(streak = 0) {
    const lift = Math.min(streak, 8) * 28;
    this._tone(860 + lift, 0.1, 'sine', 0.06);
    this._tone(1280 + lift, 0.2, 'sine', 0.05, 0.07);
  }

  buy() {
    this._tone(520, 0.08, 'triangle', 0.04);
    this._tone(780, 0.14, 'sine', 0.04, 0.06);
  }

  heaven() {
    [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => {
      this._tone(note, 0.95, 'sine', 0.05, i * 0.11);
    });
  }

  hell() {
    this._tone(52, 1.35, 'sawtooth', 0.03, 0, 30);
    this._tone(38, 1.5, 'sine', 0.07);
    this._noise(1.05, 0.07, 120, 'lowpass');
  }

  wrong() {
    this._tone(208, 0.28, 'triangle', 0.05, 0, 150);
    this._tone(146, 0.42, 'sine', 0.045, 0.14);
  }

  bell() {
    this._tone(392, 1.7, 'sine', 0.018);
    this._tone(784, 1.3, 'sine', 0.01, 0.02);
  }

  _tone(freq, dur, type, gain, delay = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), t);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    }
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  _noise(dur, gain, freq, filterType) {
    if (!this.ctx || this.muted) return;
    const count = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, count, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < count; i += 1) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const amp = this.ctx.createGain();
    const t = this.ctx.currentTime;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  _startBed() {
    const { ctx, master } = this;
    const drone = ctx.createGain();
    drone.gain.value = 0.018;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 280;
    drone.connect(filter);
    filter.connect(master);

    [55, 82.4, 110].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 1 : 0.45;
      osc.connect(g);
      g.connect(drone);
      osc.start();
    });

    const seconds = 3;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 520;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.035;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    wind.start();
  }
}
