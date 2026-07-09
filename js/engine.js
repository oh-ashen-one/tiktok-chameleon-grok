/** Match engine: paint → place → seek (hider/seeker roles) */
const Engine = (() => {
  const W = CFG.W, H = CFG.H, CAT = CFG.CAT, P = CFG.PAINT;
  let stage, sctx, paintCv, pctx, catImg, mapImg, bgSnap;
  let state = null, hooks = {}, raf = 0, timerId = 0;
  let paintLayer, undo = [], tool = "brush", brush = 22, color = "#ff4fa3";
  let painting = false, keys = {}, lastT = 0, maskCache = null;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const poseOf = id => POSES.find(p => p.id === id) || POSES[0];

  function init(opts) {
    stage = document.getElementById("stage");
    sctx = stage.getContext("2d", { willReadFrequently: true });
    paintCv = document.getElementById("paint-cv");
    pctx = paintCv.getContext("2d", { willReadFrequently: true });
    catImg = opts.catImg;
    hooks = opts.hooks || {};
    bindPaint();
    bindStage();
    bindKeys();
  }

  function bindKeys() {
    window.addEventListener("keydown", e => {
      keys[e.code] = true;
      if (!state) return;
      if (e.code === "KeyR" && (state.phase === "paint" || state.phase === "place")) {
        e.preventDefault();
        const ids = POSES.map(p => p.id);
        const cur = state.pose || "stand";
        setPose(ids[(ids.indexOf(cur) + 1) % ids.length]);
      }
      if (e.code === "Digit1") taunt();
      if (e.code === "Space" && state.phase === "place") {
        e.preventDefault();
        setPose(state.pose === "wall" ? "stand" : "wall");
      }
      if ((e.code === "ControlLeft" || e.code === "ControlRight") && state.phase === "place") {
        setPose(state.pose === "crouch" ? "stand" : "crouch");
      }
      const map = { Digit4: "stand", Digit5: "crouch", Digit6: "stretch", Digit7: "ball", Digit8: "wall", Digit9: "crawl" };
      if (map[e.code] && (state.phase === "paint" || state.phase === "place")) setPose(map[e.code]);
      if (e.code === "Digit3") window.SHOW_OUTLINES = !window.SHOW_OUTLINES;
    });
    window.addEventListener("keyup", e => { keys[e.code] = false; });
  }

  function taunt() {
    if (!state || !["place", "seek"].includes(state.phase)) return;
    const line = CHAT.taunt[(Math.random() * CHAT.taunt.length) | 0];
    hooks.onChat?.(state.me.name, line);
    AudioFX.S.taunt();
    if (state.mine && state.phase === "seek") state.mine.tauntUntil = performance.now() + 1800;
  }

  function startMatch(players, me, map) {
    stopAll();
    state = {
      players, me, map, round: 0, phase: "idle", time: 0, taps: 0,
      hiders: [], mine: null, seeker: null, hiderPlayers: [],
      mag: { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2 },
      drag: false, pose: "stand", converted: [], hoverX: null, hoverY: null,
    };
    players.forEach(p => { p.score = 0; });
    mapImg = new Image();
    mapImg.onload = () => { snapBG(); nextRound(); };
    mapImg.onerror = () => { snapBG(); nextRound(); };
    mapImg.src = map.src;
  }

  function stopAll() {
    clearInterval(timerId);
    cancelAnimationFrame(raf);
    if (state) {
      clearInterval(state.magInt);
      clearInterval(state.detInt);
    }
  }

  function snapBG() {
    if (mapImg?.complete && mapImg.naturalWidth) sctx.drawImage(mapImg, 0, 0, W, H);
    else {
      const g = sctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#5a3d7a"); g.addColorStop(1, "#2a4a6a");
      sctx.fillStyle = g; sctx.fillRect(0, 0, W, H);
    }
    bgSnap = sctx.getImageData(0, 0, W, H);
  }

  function bgAt(x, y) {
    if (!bgSnap) return [200, 200, 200];
    x = clamp(x | 0, 0, W - 1); y = clamp(y | 0, 0, H - 1);
    const i = (y * W + x) * 4, d = bgSnap.data;
    return [d[i], d[i + 1], d[i + 2]];
  }

  function nextRound() {
    if (!state || state.round >= CFG.ROUNDS.length) return;
    const plan = CFG.ROUNDS[state.round];
    state.phase = "reveal";
    state.converted = [];
    state.pose = "stand";
    hooks.onRound?.(state.round + 1, plan.role);

    const bots = state.players.filter(p => p.bot);
    if (plan.role === "HIDER") {
      state.seeker = bots[(Math.random() * bots.length) | 0];
      state.hiderPlayers = [state.me, ...bots.filter(b => b !== state.seeker)];
    } else {
      state.seeker = state.me;
      state.hiderPlayers = bots;
    }

    banner(plan.role === "HIDER" ? "🫥 YOU ARE A HIDER" : "🔍 YOU ARE THE SEEKER");
    AudioFX.S.whistle();
    setTimeout(() => {
      if (!state) return;
      if (plan.role === "HIDER") beginPaint(plan);
      else beginSeekAsSeeker(plan);
    }, 2300);
  }

  /* -------- paint -------- */
  function beginPaint(plan) {
    state.phase = "paint";
    paintLayer = document.createElement("canvas");
    paintLayer.width = paintLayer.height = P;
    undo = [];
    renderPaint();
    hooks.onPhase?.("paint", plan.paint);
    hooks.onPose?.(state.pose);
    banner("🎨 PAINT YOUR BODY", 1300);
    startTimer(plan.paint, () => beginPlace(plan));
    loop();
  }

  function renderPaint() {
    pctx.clearRect(0, 0, P, P);
    pctx.drawImage(catImg, 0, 0, P, P);
    const tmp = document.createElement("canvas");
    tmp.width = tmp.height = P;
    const t = tmp.getContext("2d");
    t.drawImage(catImg, 0, 0, P, P);
    t.globalCompositeOperation = "source-atop";
    t.drawImage(paintLayer, 0, 0);
    pctx.drawImage(tmp, 0, 0);
  }

  function bindPaint() {
    const pos = e => {
      const r = paintCv.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width * P, (e.clientY - r.top) / r.height * P];
    };
    paintCv.addEventListener("pointerdown", e => {
      if (state?.phase !== "paint") return;
      if (tool === "eyedrop") {
        const [x, y] = pos(e);
        const d = pctx.getImageData(clamp(x | 0, 0, P - 1), clamp(y | 0, 0, P - 1), 1, 1).data;
        setColor(`rgb(${d[0]},${d[1]},${d[2]})`);
        AudioFX.S.pick();
        return;
      }
      pushUndo();
      painting = true;
      stroke(...pos(e));
    });
    paintCv.addEventListener("pointermove", e => { if (painting) stroke(...pos(e)); });
    window.addEventListener("pointerup", () => { painting = false; });
  }

  function stroke(x, y) {
    const c = paintLayer.getContext("2d");
    c.fillStyle = color;
    if (tool === "brush") {
      c.beginPath(); c.arc(x, y, brush / 2, 0, 7); c.fill();
    } else if (tool === "spray") {
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * 7, d = Math.random() * brush;
        c.globalAlpha = 0.3;
        c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.2, 0, 7); c.fill();
        c.globalAlpha = 1;
      }
    } else if (tool === "fill") {
      c.fillRect(0, 0, P, P);
    } else if (tool === "eraser") {
      c.save();
      c.globalCompositeOperation = "destination-out";
      c.beginPath(); c.arc(x, y, brush / 2, 0, 7); c.fill();
      c.restore();
    }
    AudioFX.S.paint();
    renderPaint();
  }

  function pushUndo() {
    undo.push(paintLayer.getContext("2d").getImageData(0, 0, P, P));
    if (undo.length > 24) undo.shift();
  }
  function undoPaint() {
    const im = undo.pop();
    if (im) { paintLayer.getContext("2d").putImageData(im, 0, 0); renderPaint(); }
  }
  function clearPaint() {
    pushUndo();
    paintLayer.getContext("2d").clearRect(0, 0, P, P);
    renderPaint();
  }
  function setTool(t) { tool = t; }
  function setColor(c) { color = c; hooks.onColor?.(c); }
  function setBrush(v) { brush = v; }
  function setPose(id) {
    if (!state) return;
    state.pose = id;
    if (state.mine) {
      state.mine.pose = id;
      hooks.onCamo?.(camo(state.mine));
    }
    hooks.onPose?.(id);
    AudioFX.S.pose();
  }

  function bindStage() {
    stage.addEventListener("pointerdown", e => {
      const [x, y] = stageXY(e);
      if (state?.phase === "paint" && tool === "eyedrop") {
        const [r, g, b] = bgAt(x, y);
        setColor(`rgb(${r},${g},${b})`);
        AudioFX.S.pick();
      } else if (state?.phase === "place") {
        state.drag = true;
        moveMine(x, y);
      } else if (state?.phase === "seek" && canSeek()) {
        seekTap(x, y);
      }
    });
    stage.addEventListener("pointermove", e => {
      const [x, y] = stageXY(e);
      if (state?.phase === "place" && state.drag) moveMine(x, y);
      if (state && canSeek()) { state.hoverX = x; state.hoverY = y; }
    });
    window.addEventListener("pointerup", () => { if (state) state.drag = false; });
  }

  function stageXY(e) {
    const r = stage.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
  }

  function canSeek() {
    return state && state.phase === "seek" &&
      (state.seeker === state.me || state.converted.includes(state.me));
  }

  /* -------- place -------- */
  function beginPlace(plan) {
    state.phase = "place";
    const t = plan.place || 12;
    hooks.onPhase?.("place", t);
    banner("🫥 HIDE! WASD + POSES", 1300);
    state.hiders = [];
    state.mine = mkHider(state.me, W / 2, H - CAT / 2 - 28, paintLayer, state.pose);
    state.hiders.push(state.mine);
    state.hiderPlayers.filter(p => p.bot).forEach(b => {
      const x = rand(CAT, W - CAT), y = rand(H * 0.22, H - CAT / 2 - 8);
      const pose = POSES[(Math.random() * POSES.length) | 0].id;
      state.hiders.push(mkHider(b, x, y, botPaint(x, y, b.skill), pose));
    });
    startTimer(t, () => beginSeekAsHider(plan));
  }

  function mkHider(p, x, y, paint, pose) {
    return { p, x, y, flip: Math.random() < 0.5, paint, found: false, camo: 0, pose, wob: Math.random() * 7, tauntUntil: 0 };
  }

  function moveMine(x, y) {
    if (!state.mine) return;
    state.mine.x = clamp(x, CAT / 2, W - CAT / 2);
    state.mine.y = clamp(y, CAT / 2, H - CAT / 2);
    hooks.onCamo?.(camo(state.mine));
  }

  function flipMine() { if (state.mine) state.mine.flip = !state.mine.flip; }

  function updateMove(dt) {
    if (state?.phase !== "place" || !state.mine) return;
    const sp = 220 * dt;
    let dx = 0, dy = 0;
    if (keys.KeyW || keys.ArrowUp) dy -= 1;
    if (keys.KeyS || keys.ArrowDown) dy += 1;
    if (keys.KeyA || keys.ArrowLeft) dx -= 1;
    if (keys.KeyD || keys.ArrowRight) dx += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      moveMine(state.mine.x + (dx / len) * sp, state.mine.y + (dy / len) * sp);
      if (dx < 0) state.mine.flip = true;
      if (dx > 0) state.mine.flip = false;
    }
  }

  function botPaint(x, y, skill) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = P;
    const c = cv.getContext("2d");
    const cell = 22;
    for (let py = 0; py < P; py += cell) {
      for (let px = 0; px < P; px += cell) {
        const sx = x - CAT / 2 + (px / P) * CAT;
        const sy = y - CAT / 2 + (py / P) * CAT;
        let [r, g, b] = bgAt(sx, sy);
        const n = (1 - skill) * 80;
        r = clamp(r + rand(-n, n), 0, 255);
        g = clamp(g + rand(-n, n), 0, 255);
        b = clamp(b + rand(-n, n), 0, 255);
        c.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        c.fillRect(px, py, cell + 1, cell + 1);
      }
    }
    return cv;
  }

  function maskData() {
    if (maskCache) return maskCache;
    const cv = document.createElement("canvas");
    cv.width = cv.height = P;
    const c = cv.getContext("2d");
    c.drawImage(catImg, 0, 0, P, P);
    maskCache = c.getImageData(0, 0, P, P).data;
    return maskCache;
  }

  function camo(h) {
    const pc = h.paint.getContext("2d").getImageData(0, 0, P, P).data;
    const mask = maskData();
    const pose = poseOf(h.pose);
    let sum = 0, n = 0;
    for (let i = 0; i < 480; i++) {
      const px = (Math.random() * P) | 0, py = (Math.random() * P) | 0;
      const mi = (py * P + px) * 4;
      if (mask[mi + 3] < 100) continue;
      const pr = pc[mi], pg = pc[mi + 1], pb = pc[mi + 2], pa = pc[mi + 3];
      const sx = h.x - (CAT * pose.sx) / 2 + (px / P) * CAT * pose.sx;
      const sy = h.y - (CAT * pose.sy) / 2 + (py / P) * CAT * pose.sy + pose.oy;
      const [br, bg, bb] = bgAt(sx, sy);
      const r = pa > 40 ? pr : 245, g = pa > 40 ? pg : 245, b = pa > 40 ? pb : 245;
      sum += Math.sqrt((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2);
      n++;
    }
    const avg = n ? sum / n : 255;
    let bonus = 0;
    if (h.pose === "wall" || h.pose === "stretch") bonus = 6;
    if (h.pose === "crawl" || h.pose === "crouch") bonus = 4;
    if (h.pose === "ball") bonus = 3;
    return clamp(Math.round(100 - (avg / 240) * 100) + bonus, 0, 100);
  }

  /* -------- seek as hider -------- */
  function beginSeekAsHider(plan) {
    state.phase = "seek";
    state.hiders.forEach(h => { h.camo = camo(h); });
    hooks.onPhase?.("seek", plan.seek);
    hooks.onCamo?.(state.mine.camo);
    banner("🔍 " + state.seeker.name.toUpperCase() + " IS SEEKING!", 1700);
    AudioFX.S.whistle();
    state.mag = { x: rand(100, W - 100), y: rand(100, H - 100), tx: 0, ty: 0 };
    retarget();
    state.magInt = setInterval(retarget, 1600 + Math.random() * 800);
    state.detInt = setInterval(() => detectTick(plan), 650);
    startTimer(plan.seek, () => endHiderRound(plan));
  }

  function retarget() {
    const t = state.hiders.filter(h => !h.found);
    if (!t.length) return;
    if (Math.random() < 0.6) {
      t.sort((a, b) => a.camo - b.camo);
      const pick = t[(Math.random() * Math.min(3, t.length)) | 0];
      state.mag.tx = pick.x + rand(-150, 150);
      state.mag.ty = pick.y + rand(-150, 150);
    } else {
      state.mag.tx = rand(80, W - 80);
      state.mag.ty = rand(80, H - 80);
    }
  }

  function detectTick(plan) {
    if (!state || state.phase !== "seek") return;
    const m = state.mag;
    state.hiders.forEach(h => {
      if (h.found) return;
      const taunt = h.tauntUntil && performance.now() < h.tauntUntil ? 0.22 : 0;
      const d = Math.hypot(h.x - m.x, h.y - m.y);
      if (d > 230) return;
      const prox = 1 - d / 230;
      const sk = state.seeker.skill || 0.6;
      if (Math.random() < prox * (1 - h.camo / 100) * sk * 0.85 + prox * 0.025 + taunt) findHider(h);
    });
    state.hiders.forEach(h => {
      if (!h.found) {
        if (h.p === state.me) { state.me.score += 2; hooks.onScore?.(state.me.score); }
        else if (h.p.bot) h.p.score += 2;
      }
    });
    if (state.hiders.every(h => h.found)) {
      clearInterval(timerId);
      endHiderRound(plan);
    }
  }

  function findHider(h) {
    if (h.found) return;
    h.found = true;
    if (state.seeker === state.me) {
      state.me.score += 120;
      hooks.onScore?.(state.me.score);
    } else if (state.seeker.bot) state.seeker.score += 120;

    hooks.onEvent?.(`🔍 ${h.p.name} FOUND!`, "bad");
    if (!state.converted.includes(h.p) && h.p !== state.seeker) {
      state.converted.push(h.p);
      hooks.onEvent?.(`⚡ ${h.p.name} joined SEEKERS!`, "warn");
      AudioFX.S.convert();
    }
    if (h === state.mine) {
      AudioFX.S.found();
      banner("😿 FOUND — YOU'RE A SEEKER", 1700);
      hooks.onPhase?.("converted", state.time);
      state.taps = 6;
      hooks.onTaps?.(state.taps);
    } else AudioFX.S.catch();

    if (h.p.bot && Math.random() < 0.55) {
      hooks.onChat?.(h.p.name, CHAT.found[(Math.random() * CHAT.found.length) | 0]);
    }
  }

  function endHiderRound() {
    clearInterval(state.magInt);
    clearInterval(state.detInt);
    state.phase = "roundover";
    state.hiders.forEach(h => {
      if (!h.found) {
        if (h.p.bot) h.p.score += 150;
        if (h === state.mine) {
          state.me.score += 150;
          AudioFX.S.win();
          banner("🏆 YOU SURVIVED!", 1900);
        }
      }
    });
    hooks.onScore?.(state.me.score);
    setTimeout(() => finishRound(), 2100);
  }

  /* -------- seek as seeker -------- */
  function beginSeekAsSeeker(plan) {
    state.phase = "seek";
    state.taps = plan.taps || 12;
    state.hiders = [];
    state.mine = null;
    state.hiderPlayers.forEach(b => {
      const x = rand(CAT, W - CAT), y = rand(H * 0.2, H - CAT / 2 - 8);
      const pose = POSES[(Math.random() * POSES.length) | 0].id;
      state.hiders.push(mkHider(b, x, y, botPaint(x, y, b.skill), pose));
    });
    state.hiders.forEach(h => { h.camo = camo(h); });
    hooks.onPhase?.("seekAsSeeker", plan.seek);
    hooks.onTaps?.(state.taps);
    banner("🔍 FIND " + state.hiders.length + " CATS!", 1900);
    AudioFX.S.whistle();
    startTimer(plan.seek, () => endSeekerRound(false));
    loop();
  }

  function seekTap(x, y) {
    if (!state || state.taps <= 0 || state.phase !== "seek") return;
    if (!canSeek()) return;
    const hit = state.hiders.find(h => {
      if (h.found) return false;
      const pose = poseOf(h.pose);
      const hw = (CAT * pose.sx) / 2 + 10;
      const hh = (CAT * pose.sy) / 2 + 10;
      return Math.abs(x - h.x) < hw && Math.abs(y - h.y) < hh;
    });
    if (hit) {
      hit.found = true;
      const pts = 120 + Math.round(hit.camo * 0.9);
      state.me.score += pts;
      hooks.onScore?.(state.me.score);
      hooks.onEvent?.(`✔ Found ${hit.p.name}! +${pts}`, "good");
      hooks.onChat?.(hit.p.name, CHAT.found[(Math.random() * CHAT.found.length) | 0]);
      AudioFX.S.catch();
      if (!state.converted.includes(hit.p)) {
        state.converted.push(hit.p);
        hooks.onEvent?.(`⚡ ${hit.p.name} joined SEEKERS!`, "warn");
      }
      if (state.hiders.every(h => h.found)) {
        clearInterval(timerId);
        endSeekerRound(true);
      }
    } else {
      state.taps--;
      hooks.onTaps?.(state.taps);
      hooks.onEvent?.("✖ Miss (−3s)", "bad");
      AudioFX.S.miss();
      state.time = Math.max(1, state.time - 3);
      hooks.onTimer?.(state.time);
      state.miss = { x, y, t: performance.now() };
      if (state.taps <= 0) {
        clearInterval(timerId);
        endSeekerRound(false);
      }
    }
  }

  function endSeekerRound(sweep) {
    state.phase = "roundover";
    const found = state.hiders.filter(h => h.found).length;
    state.hiders.forEach(h => { if (!h.found) h.p.score += 150 + Math.round(h.camo * 0.4); });
    if (sweep) {
      state.me.score += 200;
      AudioFX.S.win();
      banner("🏆 CLEAN SWEEP! +200", 1900);
    } else banner(`⏱ TIME · ${found}/${state.hiders.length} FOUND`, 1900);
    hooks.onScore?.(state.me.score);
    setTimeout(() => finishRound(), 2100);
  }

  function startTimer(sec, onEnd) {
    clearInterval(timerId);
    state.time = sec;
    hooks.onTimer?.(state.time);
    timerId = setInterval(() => {
      if (!state) return;
      state.time--;
      hooks.onTimer?.(state.time);
      if (state.time <= 5 && state.time > 0) AudioFX.S.tick();
      if (state.time <= 0) { clearInterval(timerId); onEnd(); }
    }, 1000);
  }

  function finishRound() {
    cancelAnimationFrame(raf);
    clearInterval(state.magInt);
    clearInterval(state.detInt);
    state.round++;
    const standings = [...state.players].sort((a, b) => b.score - a.score);
    hooks.onRoundEnd?.(state.round, standings, state.round >= CFG.ROUNDS.length);
  }

  function skipNext() { nextRound(); loop(); }

  function lockIn() {
    if (state?.phase === "place") {
      clearInterval(timerId);
      beginSeekAsHider(CFG.ROUNDS[state.round]);
    }
  }

  function banner(text, ms = 2100) {
    const el = document.getElementById("banner");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(banner._t);
    banner._t = setTimeout(() => el.classList.remove("show"), ms);
  }

  function loop() {
    cancelAnimationFrame(raf);
    lastT = performance.now();
    const step = now => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      updateMove(dt);
      draw();
      if (state && state.phase !== "idle" && state.phase !== "roundover") raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function draw() {
    if (mapImg?.complete && mapImg.naturalWidth) sctx.drawImage(mapImg, 0, 0, W, H);
    else if (bgSnap) sctx.putImageData(bgSnap, 0, 0);
    if (!state) return;
    const t = performance.now() / 1000;

    if (state.phase === "paint") {
      sctx.globalAlpha = 0.35;
      sctx.drawImage(catImg, W / 2 - 55, H - 150, 110, 110);
      sctx.globalAlpha = 1;
      sctx.fillStyle = "#0008";
      sctx.font = "bold 16px sans-serif";
      sctx.textAlign = "center";
      sctx.fillText("💧 Eyedropper + click STAGE to steal colors", W / 2, 36);
    }

    if (["place", "seek", "roundover"].includes(state.phase)) {
      [...state.hiders].sort((a, b) => (a.found ? 1 : 0) - (b.found ? 1 : 0)).forEach(h => {
        drawCat(h, h.found ? 0.28 : 1, h.found);
        if (state.phase === "place" && h === state.mine) {
          const pose = poseOf(h.pose);
          sctx.strokeStyle = "#ffd93d";
          sctx.lineWidth = 3;
          sctx.setLineDash([8, 6]);
          const w = CAT * pose.sx, hh = CAT * pose.sy;
          sctx.strokeRect(h.x - w / 2, h.y - hh / 2 + pose.oy * 0.3, w, hh);
          sctx.setLineDash([]);
        }
        if (h.tauntUntil && performance.now() < h.tauntUntil) {
          sctx.font = "28px sans-serif";
          sctx.fillText("😹", h.x - 14, h.y - CAT / 2 - 8);
        }
      });
    }

    if (state.phase === "seek" && state.seeker?.bot && state.mine && !state.mine.found) {
      const m = state.mag;
      m.x += (m.tx - m.x) * 0.025;
      m.y += (m.ty - m.y) * 0.025;
      sctx.strokeStyle = "rgba(255,255,255,0.9)";
      sctx.lineWidth = 5;
      sctx.beginPath(); sctx.arc(m.x, m.y, 88 + Math.sin(t * 3) * 5, 0, 7); sctx.stroke();
      sctx.strokeStyle = "#ff4fa3";
      sctx.lineWidth = 2;
      sctx.beginPath(); sctx.arc(m.x, m.y, 98 + Math.sin(t * 3) * 5, 0, 7); sctx.stroke();
      sctx.font = "26px sans-serif";
      sctx.fillText("🔍", m.x + 68, m.y + 90);
      sctx.fillStyle = "#fff";
      sctx.font = "bold 12px sans-serif";
      sctx.textAlign = "center";
      sctx.fillText(state.seeker.name, m.x, m.y - 100);
    }

    if (canSeek() && state.hoverX != null) {
      sctx.strokeStyle = "#ffd93d";
      sctx.lineWidth = 2;
      sctx.beginPath(); sctx.arc(state.hoverX, state.hoverY, 28, 0, 7); sctx.stroke();
      sctx.beginPath();
      sctx.moveTo(state.hoverX - 40, state.hoverY); sctx.lineTo(state.hoverX + 40, state.hoverY);
      sctx.moveTo(state.hoverX, state.hoverY - 40); sctx.lineTo(state.hoverX, state.hoverY + 40);
      sctx.stroke();
    }

    if (state.miss && performance.now() - state.miss.t < 400) {
      const a = 1 - (performance.now() - state.miss.t) / 400;
      sctx.strokeStyle = `rgba(255,80,80,${a})`;
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(state.miss.x - 18, state.miss.y - 18);
      sctx.lineTo(state.miss.x + 18, state.miss.y + 18);
      sctx.moveTo(state.miss.x + 18, state.miss.y - 18);
      sctx.lineTo(state.miss.x - 18, state.miss.y + 18);
      sctx.stroke();
    }

    if (state.phase === "seek" && state.hiders?.length) {
      const left = state.hiders.filter(h => !h.found).length;
      sctx.fillStyle = "#000a";
      sctx.fillRect(16, H - 40, 150, 26);
      sctx.fillStyle = "#28e0c8";
      sctx.font = "bold 13px sans-serif";
      sctx.textAlign = "left";
      sctx.fillText(`🐱 Hiding ${left}/${state.hiders.length}`, 24, H - 22);
    }
  }

  function drawCat(h, alpha, dead) {
    const pose = poseOf(h.pose);
    sctx.save();
    sctx.globalAlpha = alpha;
    sctx.translate(h.x, h.y + Math.sin(performance.now() / 600 + h.wob) * 1.2 + pose.oy * 0.3);
    if (h.flip) sctx.scale(-1, 1);
    sctx.scale(pose.sx, pose.sy);
    sctx.drawImage(catImg, -CAT / 2, -CAT / 2, CAT, CAT);
    const tmp = drawCat._t || (drawCat._t = document.createElement("canvas"));
    tmp.width = tmp.height = P;
    const c = tmp.getContext("2d");
    c.clearRect(0, 0, P, P);
    c.drawImage(catImg, 0, 0, P, P);
    c.globalCompositeOperation = "source-atop";
    c.drawImage(h.paint, 0, 0);
    c.globalCompositeOperation = "source-over";
    sctx.drawImage(tmp, -CAT / 2, -CAT / 2, CAT, CAT);
    if (dead) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalAlpha = 1;
      sctx.font = "28px sans-serif";
      sctx.fillText("😿", h.x - 14, h.y - CAT / 2 - 6);
    }
    if (window.SHOW_OUTLINES) {
      sctx.globalAlpha = 0.9;
      sctx.strokeStyle = "#ff4fa3";
      sctx.lineWidth = 2 / Math.max(pose.sx, pose.sy);
      sctx.strokeRect(-CAT / 2, -CAT / 2, CAT, CAT);
    }
    sctx.restore();
  }

  return {
    init, startMatch, skipNext, lockIn,
    setTool, setColor, setBrush, setPose, undoPaint, clearPaint, flipMine, taunt,
    get state() { return state; },
  };
})();
