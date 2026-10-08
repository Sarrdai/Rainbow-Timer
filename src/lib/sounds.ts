const HORN_SRC = '/party-horn.mp3';
const NOISE_S = 0.12;

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let horn: HTMLAudioElement | null = null;
let muted = true;

function getHorn() {
  if (!horn) {
    horn = new Audio(HORN_SRC);
    horn.loop = true;
    horn.preload = 'auto';
  }
  return horn;
}

/** Creates the shared AudioContext on first use; resumes it when the browser suspended it */
async function ready(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
    } catch { return null; }
  }
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { return null; }
  }
  getHorn();
  return ctx.state === 'running' ? ctx : null;
}

/** Sounds are independent of React state: any module can call them. */
export const sounds = {
  setMuted(value: boolean) {
    muted = value;
    if (value) sounds.horn(false);
  },

  /** Creates and resumes the audio context (needs a user gesture); resolves to whether audio is running */
  async warmUp() {
    return (await ready()) !== null;
  },

  /** Balloon pop: a band-passed noise snap plus a short falling thump (synthetic, ~0.1 s) */
  async pop() {
    if (muted) return;
    const c = await ready();
    if (!c) return;
    if (!noise) {
      const n = Math.floor(c.sampleRate * NOISE_S);
      noise = c.createBuffer(1, n, c.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    }
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noise;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(2400, t);
    band.frequency.exponentialRampToValueAtTime(900, t + 0.08);
    band.Q.value = 0.8;
    const snap = c.createGain();
    snap.gain.setValueAtTime(1.1, t);
    snap.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(band).connect(snap).connect(c.destination);
    src.start(t);

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.09);
    const body = c.createGain();
    body.gain.setValueAtTime(0.55, t);
    body.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(body).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  },

  /** Timer end: the party horn, looping until `horn(false)` */
  horn(on: boolean) {
    if (typeof window === 'undefined') return;
    if (on && !muted) {
      const el = getHorn();
      el.currentTime = 0;
      el.play().catch(() => {});
    } else if (horn) {
      horn.pause();
      horn.currentTime = 0;
    }
  },

  /** Countdown beep */
  async beep() {
    if (muted) return;
    const c = await ready();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = c.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t); // A5
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  },
};
