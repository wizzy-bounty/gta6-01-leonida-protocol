// audio.js — tiny WebAudio bleeps for LEONIDA PROTOCOL. No audio files: every
// sound is a short oscillator blip synthesised on the spot. Everything is
// guarded so the game runs silently (and never throws) where audio is blocked.

let ctx = null;
let master = null;

function ensureContext() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function blip(freqFrom, freqTo, seconds, type = "square", volume = 1) {
  const ac = ensureContext();
  if (!ac || ac.state === "suspended") return;
  try {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  } catch {
    /* silent by design */
  }
}

function arpeggio(notes, stepSeconds, type = "triangle") {
  notes.forEach((freq, i) => {
    setTimeout(() => blip(freq, freq, 0.14, type, 0.9), i * stepSeconds * 1000);
  });
}

export const sfx = {
  click() { blip(660, 520, 0.06, "square", 0.5); },
  enter() { blip(220, 330, 0.1, "triangle", 0.8); },
  pickup() { arpeggio([523, 784], 0.07); },
  success() { arpeggio([523, 659, 784, 1047], 0.09); },
  fail() { arpeggio([392, 330, 262, 196], 0.12, "sawtooth"); },
  shot() { blip(880, 120, 0.09, "sawtooth", 0.7); },
  crash() { blip(140, 55, 0.22, "sawtooth", 0.9); },
  busted() { arpeggio([330, 330, 262, 262], 0.16, "square"); },
  siren() { blip(700, 950, 0.18, "triangle", 0.35); },
};
