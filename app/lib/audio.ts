// Generates a short alert tone using the Web Audio API — no audio files needed
export function playAlertTone(severity: 'high' | 'medium' = 'high') {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    const freqs = severity === 'high' ? [880, 660, 880] : [440, 330];
    let t = ctx.currentTime;

    freqs.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.26);
      t += 0.28;
    });
  } catch {
    // AudioContext blocked or unavailable
  }
}
