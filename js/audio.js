/** WebAudio synth — no external audio files */
const AudioFX = (() => {
  let ctx = null, muted = false, sfx = true, music = true, musicId = null, step = 0;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(f, d = 0.12, type = "square", vol = 0.08, when = 0, slide = 0) {
    if (muted || !sfx) return;
    try {
      const a = ac(), o = a.createOscillator(), g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, a.currentTime + when);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), a.currentTime + when + d);
      g.gain.setValueAtTime(vol, a.currentTime + when);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + when + d);
      o.connect(g).connect(a.destination);
      o.start(a.currentTime + when);
      o.stop(a.currentTime + when + d + 0.02);
    } catch (_) {}
  }

  const S = {
    click: () => tone(660, 0.06, "square", 0.06),
    paint: () => tone(300 + Math.random() * 140, 0.04, "sine", 0.03),
    pick: () => tone(1200, 0.08, "triangle", 0.07),
    ready: () => { tone(520, 0.1); tone(780, 0.12, "square", 0.08, 0.1); },
    join: () => tone(440, 0.09, "triangle", 0.06, 0, 220),
    msg: () => tone(980, 0.05, "sine", 0.04),
    found: () => { tone(300, 0.15, "sawtooth", 0.09, 0, -150); tone(200, 0.2, "sawtooth", 0.07, 0.12, -100); },
    catch: () => { tone(700, 0.1, "square", 0.09); tone(500, 0.14, "square", 0.08, 0.09, -200); },
    miss: () => tone(140, 0.25, "sawtooth", 0.1, 0, -60),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "triangle", 0.09, i * 0.13)),
    lose: () => [400, 350, 300, 250].forEach((f, i) => tone(f, 0.2, "sawtooth", 0.06, i * 0.15)),
    tick: () => tone(1500, 0.03, "sine", 0.05),
    whistle: () => { tone(900, 0.3, "sine", 0.09, 0, 500); tone(1400, 0.25, "sine", 0.08, 0.3, -400); },
    pose: () => { tone(600, 0.06, "triangle", 0.06); tone(900, 0.08, "triangle", 0.05, 0.05); },
    taunt: () => { tone(440, 0.08); tone(660, 0.1, "square", 0.05, 0.08); },
    convert: () => { tone(300, 0.1, "sawtooth", 0.08); tone(700, 0.14, "square", 0.08, 0.2); },
  };

  const BASS = [110, 110, 146.8, 98];
  const LEAD = [440, 523, 587, 523, 659, 587, 523, 440];

  function musicTick() {
    if (muted || !music) return;
    const prev = sfx;
    // music uses same tone path but force through when music on
    sfx = true;
    if (!muted) {
      try {
        const a = ac(), o = a.createOscillator(), g = a.createGain();
        o.type = "triangle";
        o.frequency.value = BASS[step % 4];
        g.gain.setValueAtTime(0.04, a.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.28);
        o.connect(g).connect(a.destination);
        o.start(); o.stop(a.currentTime + 0.3);
        if (step % 2 === 0) {
          const o2 = a.createOscillator(), g2 = a.createGain();
          o2.type = "sine";
          o2.frequency.value = LEAD[(step / 2) % 8] * (step % 16 < 8 ? 1 : 0.75);
          g2.gain.setValueAtTime(0.025, a.currentTime);
          g2.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.22);
          o2.connect(g2).connect(a.destination);
          o2.start(); o2.stop(a.currentTime + 0.24);
        }
      } catch (_) {}
    }
    sfx = prev;
    step++;
  }

  return {
    S,
    unlock: ac,
    setMuted(m) { muted = m; },
    get muted() { return muted; },
    setSfx(on) { sfx = on; },
    setMusic(on) { music = on; },
    startMusic() { if (!musicId) musicId = setInterval(musicTick, 320); },
    stopMusic() { clearInterval(musicId); musicId = null; },
  };
})();
