// 全部用 WebAudio 即時合成，沒有音檔、沒有版權問題。第一次點擊後才建立 AudioContext（瀏覽器規定）。
export function createSound() {
  let ctx = null;
  let master = null;
  let eng = null;
  const S = {on: true};

  const unlock = () => {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  };
  const ok = () => ctx && S.on;
  const tone = (freq, t0, dur, {type = 'sine', vol = 0.25, to = null} = {}) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  };
  const noise = (t0, dur, {vol = 0.15, f0 = 2000, f1 = 600, q = 0.8} = {}) => {
    const n = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t0);
    bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(master);
    src.start(t0);
  };

  return {
    get on() {
      return S.on;
    },
    set on(v) {
      S.on = v;
      if (master) master.gain.value = v ? 0.5 : 0;
    },
    unlock,
    pop(f = 600) {
      if (!ok()) return;
      tone(f, ctx.currentTime, 0.12, {to: f * 1.5, vol: 0.18});
    },
    chime() {
      if (!ok()) return;
      const t = ctx.currentTime;
      [784, 988, 1319].forEach((f, i) => tone(f, t + i * 0.09, 0.5, {vol: 0.2}));
    },
    boop() {
      if (!ok()) return;
      tone(330, ctx.currentTime, 0.22, {to: 260, vol: 0.16, type: 'triangle'});
    },
    dingdong() {
      if (!ok()) return;
      const t = ctx.currentTime + 0.05;
      tone(659, t, 0.9, {vol: 0.22});
      tone(523, t + 0.45, 1.1, {vol: 0.22});
    },
    whoosh(out) {
      if (!ok()) return;
      noise(ctx.currentTime, 0.5, out ? {f0: 500, f1: 2500, vol: 0.12} : {f0: 2500, f1: 500, vol: 0.12});
    },
    hiss() {
      if (!ok()) return;
      noise(ctx.currentTime, 0.7, {f0: 5000, f1: 3000, vol: 0.08, q: 0.5});
    },
    // 柴油：低沉的鋸齒波；電動：細細的、隨速度升高的嗡聲
    engine(onState, mode = 'diesel') {
      if (!ctx) return;
      if (eng && eng.mode !== mode) {
        eng.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
        const old = eng;
        setTimeout(() => (old.o.stop(), old.o2.stop()), 300);
        eng = null;
      }
      if (onState && !eng && mode === 'jet') {
        // 噴射引擎：低沉的風聲（濾過的雜訊）加上一個隨轉速升高的嗡嗡聲
        const n = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 300;
        const o = ctx.createOscillator();
        o.type = 'sine';
        const og = ctx.createGain();
        og.gain.value = 0.25;
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        src.connect(lp).connect(g);
        o.connect(og).connect(g);
        g.connect(master);
        src.start();
        o.start();
        eng = {o, o2: src, g, lp, mode};
        return;
      }
      if (onState && !eng) {
        const o = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = mode === 'ev' ? 'sine' : 'sawtooth';
        o2.type = mode === 'ev' ? 'sine' : 'square';
        lp.type = 'lowpass';
        lp.frequency.value = mode === 'ev' ? 4000 : 260;
        g.gain.value = 0.0001;
        o.connect(lp);
        o2.connect(lp);
        lp.connect(g).connect(master);
        o.start();
        o2.start();
        eng = {o, o2, g, lp, mode};
      }
    },
    // 離開這台車：引擎聲停掉、音訊環境關掉（不然每進一次車就多一個一直在跑的音訊環境）
    dispose() {
      try {
        eng?.o.stop();
        eng?.o2.stop();
      } catch {
        /* 已經停了 */
      }
      eng = null;
      ctx?.close?.();
      ctx = null;
    },
    // 切到別的分頁：整個聲音先停（畫面不會更新，引擎聲就不會一直響）
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend();
    },
    resume() {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    setSpeed(v) {
      if (!eng) return;
      const t = ctx.currentTime;
      if (eng.mode === 'jet') {
        // v 是引擎轉速 0–100
        eng.lp.frequency.setTargetAtTime(250 + v * 22, t, 0.2);
        eng.o.frequency.setTargetAtTime(220 + v * 9, t, 0.2);
        eng.g.gain.setTargetAtTime(S.on ? Math.min(0.09, v * 0.0011) : 0.0001, t, 0.25);
        return;
      }
      if (eng.mode === 'ev') {
        const f = 180 + v * 22;
        eng.o.frequency.setTargetAtTime(f, t, 0.1);
        eng.o2.frequency.setTargetAtTime(f * 1.5, t, 0.1);
        eng.g.gain.setTargetAtTime(S.on ? Math.min(0.022, v * 0.0012) : 0.0001, t, 0.15);
        return;
      }
      const f = 38 + v * 1.6;
      eng.o.frequency.setTargetAtTime(f, t, 0.1);
      eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.1);
      eng.lp.frequency.setTargetAtTime(220 + v * 12, t, 0.1);
      eng.g.gain.setTargetAtTime(S.on ? Math.min(0.06, v * 0.003) : 0.0001, t, 0.15);
    },
  };
}
