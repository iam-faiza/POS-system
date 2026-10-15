// Short synthesized beeps for scan, error and success. No audio files needed.
const STORAGE_KEY = 'pos_sound';
let audioContext = null;

export function isSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Storage blocked: the setting lasts for this session only.
  }
}

function tone(frequency, startOffset, duration) {
  const ctx = audioContext;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + startOffset;
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function play(notes) {
  if (!isSoundEnabled()) return;
  try {
    if (!audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      audioContext = new AudioCtor();
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    notes.forEach(([frequency, offset, duration]) => tone(frequency, offset, duration));
  } catch {
    // Audio is decorative; never let it break the sale.
  }
}

export const playScanBeep = () => play([[1046, 0, 0.09]]);
export const playErrorBeep = () => play([[220, 0, 0.22]]);
export const playSuccessChime = () => play([[784, 0, 0.12], [1046, 0.12, 0.2]]);
