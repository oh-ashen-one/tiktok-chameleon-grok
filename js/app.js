/** UI shell — boot, menus, lobby, wire engine */
(() => {
  const $ = id => document.getElementById(id);
  const screens = [...document.querySelectorAll(".screen")];

  function show(id) {
    screens.forEach(s => s.classList.toggle("active", s.id === id));
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2300);
  }

  const me = {
    name: localStorage.getItem("tcg_name") || "WhiskerWizard",
    avatar: +(localStorage.getItem("tcg_avatar") || 0),
    level: +(localStorage.getItem("tcg_lv") || 5),
    xp: +(localStorage.getItem("tcg_xp") || 400),
    bot: false, ready: false, score: 0, skill: 1,
  };

  let catImg = null, avatarsImg = null, lobby = [], mapVotes = {}, myVote = null, readyT = null;

  function loadImg(src) {
    return new Promise(res => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = src;
    });
  }

  function chromaKey(img) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 512;
    const c = cv.getContext("2d");
    c.drawImage(img, 0, 0, 512, 512);
    const im = c.getImageData(0, 0, 512, 512), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (g > 90 && g > r * 1.3 && g > b * 1.3) d[i + 3] = 0;
      else if (g > 75 && g > r * 1.12 && g > b * 1.12) d[i + 3] = Math.max(0, d[i + 3] - 150);
    }
    c.putImageData(im, 0, 0);
    return cv;
  }

  function fallbackCat() {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 512;
    const c = cv.getContext("2d");
    c.fillStyle = "#fff"; c.strokeStyle = "#222"; c.lineWidth = 10;
    c.beginPath(); c.ellipse(256, 330, 130, 150, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.arc(256, 150, 95, 0, 7); c.fill(); c.stroke();
    [[180, 90, 200, 20, 240, 75], [332, 90, 312, 20, 272, 75]].forEach(p => {
      c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); c.lineTo(p[4], p[5]); c.closePath(); c.fill(); c.stroke();
    });
    c.fillStyle = "#222";
    c.beginPath(); c.arc(225, 145, 10, 0, 7); c.fill();
    c.beginPath(); c.arc(287, 145, 10, 0, 7); c.fill();
    return cv;
  }

  function drawAvatar(canvas, idx) {
    if (!avatarsImg) return;
    const c = canvas.getContext("2d");
    const cols = 4, rows = 2;
    const cw = avatarsImg.width / cols, ch = avatarsImg.height / rows;
    const sx = (idx % cols) * cw, sy = Math.floor(idx / cols) * ch;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.beginPath();
    c.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, 7);
    c.clip();
    c.drawImage(avatarsImg, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
    c.restore();
  }

  function refreshProfile() {
    $("menu-name").textContent = me.name;
    $("menu-lv").textContent = me.level;
    $("menu-xp").textContent = me.xp.toLocaleString();
    if (avatarsImg) drawAvatar($("menu-avatar"), me.avatar);
  }

  async function boot() {
    const msgs = ["Connecting…", "Auth…", "Loading paw-ssets…", "Syncing…", "Joining region…", "Ready!"];
    let p = 0;
    const int = setInterval(() => {
      p = Math.min(96, p + Math.random() * 10);
      $("boot-bar").style.width = p + "%";
      $("boot-msg").textContent = msgs[Math.min(msgs.length - 1, (p / 18) | 0)];
    }, 100);

    const [key, cat, av] = await Promise.all([
      loadImg("assets/keyart.jpg"),
      loadImg("assets/cat-white.jpg"),
      loadImg("assets/avatars.jpg"),
      ...MAPS.map(m => loadImg(m.src)),
    ]).then(a => a.slice(0, 3));

    avatarsImg = av;
    catImg = cat ? chromaKey(cat) : fallbackCat();
    if (key) $("menu-bg").src = "assets/keyart.jpg";

    buildPalette();
    buildPoses();
    buildEmotes();
    Engine.init({ catImg, hooks });

    setTimeout(() => {
      clearInterval(int);
      $("boot-bar").style.width = "100%";
      refreshProfile();
      show("screen-menu");
      AudioFX.startMusic();
    }, 1400);
  }

  Net.on("stats", s => {
    $("online-n").textContent = s.online.toLocaleString();
    $("ping-label").textContent = s.ping + "ms";
  });

  const click = () => AudioFX.S.click();

  $("btn-play").onclick = () => { click(); startMM(false); };
  $("btn-private").onclick = () => { click(); startMM(true); };
  $("btn-custom").onclick = () => { click(); openCustom(); };
  $("btn-help").onclick = () => { click(); show("screen-help"); };
  $("btn-opts").onclick = () => { click(); show("screen-opts"); };
  $("btn-profile").onclick = () => { click(); openCustom(); };
  document.querySelectorAll("[data-back]").forEach(b => {
    b.onclick = () => { click(); show("screen-" + b.dataset.back); };
  });

  $("opt-sfx").onchange = e => AudioFX.setSfx(e.target.checked);
  $("opt-music").onchange = e => AudioFX.setMusic(e.target.checked);
  $("opt-region").onchange = e => {
    Net.setRegion(e.target.value);
    $("region-label").textContent = e.target.value;
    toast("Region → " + e.target.value);
  };
  $("opt-outline").onchange = e => { window.SHOW_OUTLINES = e.target.checked; };
  $("btn-mute").onclick = () => {
    AudioFX.setMuted(!AudioFX.muted);
    $("btn-mute").textContent = AudioFX.muted ? "🔇" : "🔊";
  };

  function openCustom() {
    show("screen-custom");
    $("name-input").value = me.name;
    const grid = $("avatar-picks");
    grid.innerHTML = "";
    for (let i = 0; i < 8; i++) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 80;
      if (avatarsImg) drawAvatar(cv, i);
      if (i === me.avatar) cv.classList.add("sel");
      cv.onclick = () => {
        AudioFX.S.pick();
        me.avatar = i;
        grid.querySelectorAll("canvas").forEach(x => x.classList.remove("sel"));
        cv.classList.add("sel");
        drawCustomPrev();
      };
      grid.appendChild(cv);
    }
    drawCustomPrev();
  }

  function drawCustomPrev() {
    const cv = $("custom-preview");
    const c = cv.getContext("2d");
    c.clearRect(0, 0, 200, 200);
    c.drawImage(catImg, 0, 0, 200, 200);
    if (avatarsImg) {
      const b = document.createElement("canvas");
      b.width = b.height = 56;
      drawAvatar(b, me.avatar);
      c.save(); c.beginPath(); c.arc(160, 40, 28, 0, 7); c.clip();
      c.drawImage(b, 132, 12, 56, 56); c.restore();
    }
  }

  $("btn-save-custom").onclick = () => {
    me.name = $("name-input").value.trim() || "WhiskerWizard";
    localStorage.setItem("tcg_name", me.name);
    localStorage.setItem("tcg_avatar", me.avatar);
    refreshProfile();
    AudioFX.S.ready();
    toast("Saved, " + me.name + "!");
    show("screen-menu");
  };

  function startMM(priv) {
    show("screen-mm");
    $("mm-title").textContent = priv ? "PRIVATE ROOM…" : "FINDING MATCH…";
    $("mm-status").textContent = priv ? "Waiting for cats…" : `Searching ${Net.stats.region}…`;
    $("mm-list").innerHTML = "";
    lobby = [me];
    me.ready = false; me.score = 0;
    addMM(me.name + " (you)");
    Net.findMatch(7, bot => {
      lobby.push(bot);
      addMM(bot.name);
      AudioFX.S.join();
      $("mm-status").textContent = `${lobby.length}/8 players`;
    }, enterLobby, priv);
  }

  function addMM(name) {
    const s = document.createElement("span");
    s.textContent = "🐱 " + name;
    $("mm-list").appendChild(s);
  }

  $("btn-mm-cancel").onclick = () => { click(); Net.cancelMatch(); show("screen-menu"); };

  function enterLobby() {
    show("screen-lobby");
    $("room-code").textContent = "#" + Net.roomCode();
    $("chat-log").innerHTML = "";
    mapVotes = {}; myVote = null;
    me.ready = false;
    $("btn-ready").textContent = "READY UP";
    sys("Vote a map and READY UP.");
    renderRoster();
    renderMaps();
    Net.startLobbyChat(lobby.filter(p => p.bot), chatLine);

    lobby.filter(p => p.bot).forEach((b, i) => {
      setTimeout(() => {
        mapVotes[b.name] = MAPS[(Math.random() * MAPS.length) | 0].id;
        renderMaps();
      }, 900 + i * 550 + Math.random() * 1200);
      setTimeout(() => {
        b.ready = true;
        renderRoster();
        AudioFX.S.msg();
        checkReady();
      }, 3200 + i * 900 + Math.random() * 2500);
    });
  }

  function renderRoster() {
    const wrap = $("lobby-roster");
    wrap.innerHTML = "";
    lobby.forEach(p => {
      const d = document.createElement("div");
      d.className = "roster-card" + (p.ready ? " ready" : "");
      const cv = document.createElement("canvas");
      cv.width = cv.height = 36;
      if (avatarsImg) drawAvatar(cv, p.avatar);
      d.appendChild(cv);
      const info = document.createElement("div");
      info.innerHTML = `<strong>${p.name}${p === me ? " (you)" : ""}</strong>
        <div class="meta">${p.bot ? p.level : "LV " + me.level} · ${p.bot ? p.ping : Net.stats.ping}ms</div>`;
      d.appendChild(info);
      const r = document.createElement("div");
      r.className = "rdy";
      r.textContent = p.ready ? "READY" : "…";
      d.appendChild(r);
      wrap.appendChild(d);
    });
  }

  function renderMaps() {
    const wrap = $("map-votes");
    wrap.innerHTML = "";
    MAPS.forEach(m => {
      const votes = Object.values(mapVotes).filter(v => v === m.id).length;
      const d = document.createElement("div");
      d.className = "map-card" + (myVote === m.id ? " sel" : "");
      d.innerHTML = `<img src="${m.src}" alt=""><div class="mn">${m.name}</div>${votes ? `<div class="mv">${votes}</div>` : ""}`;
      d.onclick = () => {
        AudioFX.S.pick();
        myVote = m.id;
        mapVotes[me.name] = m.id;
        renderMaps();
      };
      wrap.appendChild(d);
    });
  }

  function chatLine(name, text, cls = "") {
    const log = $("chat-log");
    const d = document.createElement("div");
    d.className = "chat-msg " + cls;
    d.innerHTML = `<b>${name}:</b> ${String(text).replace(/</g, "&lt;")}`;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    if (log.children.length > 50) log.removeChild(log.firstChild);
    AudioFX.S.msg();
  }

  function sys(t) {
    const d = document.createElement("div");
    d.className = "chat-msg sys";
    d.textContent = "★ " + t;
    $("chat-log").appendChild(d);
  }

  function sendChat() {
    const t = $("chat-in").value.trim();
    if (!t) return;
    chatLine(me.name, t, "me");
    $("chat-in").value = "";
    Net.maybeReply(chatLine);
  }

  $("btn-chat").onclick = sendChat;
  $("chat-in").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

  function buildEmotes() {
    EMOTES.forEach(em => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = em;
      b.onclick = () => { chatLine(me.name, em, "me"); Net.maybeReply(chatLine); };
      $("emotes").appendChild(b);
    });
  }

  $("btn-ready").onclick = () => {
    me.ready = !me.ready;
    $("btn-ready").textContent = me.ready ? "UNREADY" : "READY UP";
    AudioFX.S.ready();
    renderRoster();
    checkReady();
  };

  $("btn-leave-lobby").onclick = () => {
    click(); Net.stopChat(); clearTimeout(readyT); show("screen-menu");
  };

  function checkReady() {
    if (!lobby.every(p => p.ready)) return;
    sys("All ready — starting in 3…");
    let n = 3;
    clearTimeout(readyT);
    const tick = () => {
      n--;
      if (n > 0) { sys(n + "…"); readyT = setTimeout(tick, 1000); }
      else beginMatch();
    };
    readyT = setTimeout(tick, 1000);
  }

  function beginMatch() {
    Net.stopChat();
    const tally = {};
    Object.values(mapVotes).forEach(v => { tally[v] = (tally[v] || 0) + 1; });
    const win = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || MAPS[0].id;
    const map = MAPS.find(m => m.id === win) || MAPS[0];
    show("screen-game");
    $("game-chat").innerHTML = "";
    Engine.startMatch(lobby, me, map);
  }

  function gameChat(name, text) {
    $("game-chat").innerHTML = `<b>${name}:</b> ${String(text).replace(/</g, "&lt;")}`;
  }

  function buildPalette() {
    PALETTE.forEach(c => {
      const s = document.createElement("div");
      s.className = "swatch";
      s.style.background = c;
      s.onclick = () => {
        document.querySelectorAll(".swatch").forEach(x => x.classList.remove("on"));
        s.classList.add("on");
        Engine.setColor(c);
        AudioFX.S.pick();
      };
      $("palette").appendChild(s);
    });
    $("color-dot").style.background = "#ff4fa3";
  }

  function buildPoses() {
    POSES.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pose-btn" + (p.id === "stand" ? " on" : "");
      b.dataset.pose = p.id;
      b.innerHTML = `<span class="e">${p.e}</span>${p.name}`;
      b.onclick = () => {
        document.querySelectorAll(".pose-btn").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        Engine.setPose(p.id);
      };
      $("pose-btns").appendChild(b);
    });
  }

  function highlightPose(id) {
    document.querySelectorAll(".pose-btn").forEach(x => x.classList.toggle("on", x.dataset.pose === id));
  }

  const hooks = {
    onRound(n, role) {
      $("hud-round").textContent = `ROUND ${n}/3`;
      $("hud-role").textContent = role === "HIDER" ? "🫥 HIDER" : "🔍 SEEKER";
      $("hud-taps").hidden = true;
      $("hud-camo").hidden = true;
      $("paint-dock").hidden = true;
      $("btn-flip").hidden = true;
      $("btn-lock").hidden = true;
      $("btn-taunt").hidden = true;
      $("feed").innerHTML = "";
      Net.stopChat();
      Net.banter(lobby.filter(p => p.bot), role === "HIDER" ? CHAT.hide : CHAT.seek, gameChat);
    },
    onPhase(phase) {
      const labels = {
        paint: "PAINT PHASE", place: "HIDE PHASE", seek: "SEEK PHASE",
        seekAsSeeker: "SEEK PHASE", converted: "YOU'RE SEEKING",
      };
      $("hud-phase").textContent = labels[phase] || phase;
      $("paint-dock").hidden = phase !== "paint";
      $("btn-flip").hidden = phase !== "place";
      $("btn-lock").hidden = phase !== "place";
      $("btn-taunt").hidden = !["place", "seek", "seekAsSeeker", "converted"].includes(phase);
      $("hud-camo").hidden = !(phase === "place" || phase === "seek");
      $("hud-taps").hidden = !(phase === "seekAsSeeker" || phase === "converted");
      if (phase === "paint") toast("💧 Eyedropper + click the STAGE for real colors");
      if (phase === "place") toast("WASD / drag · R poses · watch CAMO %");
      if (phase === "seekAsSeeker") toast("Tap cats! Misses cost 3 seconds");
      if (phase === "converted") {
        $("hud-role").textContent = "🔍 SEEKER";
        toast("You're hunting now!");
      }
    },
    onTimer(t) {
      const el = $("hud-timer");
      el.textContent = Math.floor(t / 60) + ":" + String(Math.max(0, t) % 60).padStart(2, "0");
      el.classList.toggle("low", t <= 10);
    },
    onScore(s) { $("hud-score").textContent = "⭐ " + s; },
    onTaps(n) { $("hud-taps").hidden = false; $("hud-taps").textContent = "👆 " + n; },
    onCamo(v) {
      $("camo-pct").textContent = v;
      $("camo-pct").style.color = v > 70 ? "#28e0c8" : v > 40 ? "#ffd93d" : "#ff5252";
    },
    onColor(c) { $("color-dot").style.background = c; },
    onPose(id) { highlightPose(id); },
    onEvent(text, cls) {
      const d = document.createElement("div");
      d.className = "feed-item " + (cls || "");
      d.textContent = text;
      $("feed").appendChild(d);
      setTimeout(() => d.remove(), 4800);
    },
    onChat: gameChat,
    onRoundEnd(done, standings, over) {
      Net.stopChat();
      showResults(done, standings, over);
    },
  };

  document.querySelectorAll(".tool[data-tool]").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".tool[data-tool]").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      Engine.setTool(b.dataset.tool);
      click();
      if (b.dataset.tool === "eyedrop") toast("Click STAGE or paint canvas to sample");
    };
  });
  $("btn-undo").onclick = () => { Engine.undoPaint(); click(); };
  $("btn-clear").onclick = () => { Engine.clearPaint(); click(); };
  $("brush-size").oninput = e => Engine.setBrush(+e.target.value);
  $("btn-flip").onclick = () => { Engine.flipMine(); click(); };
  $("btn-lock").onclick = () => { Engine.lockIn(); AudioFX.S.ready(); };
  $("btn-taunt").onclick = () => Engine.taunt();

  function showResults(done, standings, over) {
    show("screen-results");
    $("res-title").textContent = over ? "🏁 MATCH RESULTS" : `ROUND ${done} RESULTS`;
    const rank = standings.indexOf(me) + 1;
    $("res-sub").textContent = over
      ? (rank === 1 ? "👑 VICTORY — ultimate chameleon!" : `You placed #${rank} of ${standings.length}`)
      : `You're #${rank} heading into round ${done + 1}`;
    const tbl = $("res-table");
    tbl.innerHTML = "";
    standings.forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "res-row" + (p === me ? " me" : "");
      d.innerHTML = `<div class="rank">${["🥇", "🥈", "🥉"][i] || i + 1}</div>
        <div class="nm">${p.name}${p === me ? " (you)" : ""}</div>
        <div class="pts">⭐ ${p.score}</div>`;
      tbl.appendChild(d);
    });

    if (over) {
      if (rank === 1) AudioFX.S.win(); else AudioFX.S.lose();
      const gain = 120 + Math.max(0, (standings.length - rank) * 40) + Math.round(me.score / 10);
      me.xp += gain;
      let up = false;
      while (me.xp >= me.level * 400) { me.xp -= me.level * 400; me.level++; up = true; }
      localStorage.setItem("tcg_xp", me.xp);
      localStorage.setItem("tcg_lv", me.level);
      $("xp-box").hidden = false;
      $("xp-label").textContent = `XP +${gain}${up ? " · LEVEL UP!" : ""}`;
      $("xp-fill").style.width = "6%";
      setTimeout(() => { $("xp-fill").style.width = Math.min(100, (me.xp / (me.level * 400)) * 100) + "%"; }, 80);
      $("btn-res-next").textContent = "PLAY AGAIN";
      $("btn-res-menu").hidden = false;
      refreshProfile();
    } else {
      $("xp-box").hidden = true;
      $("btn-res-next").textContent = "NEXT ROUND";
      $("btn-res-menu").hidden = true;
    }

    $("btn-res-next").onclick = () => {
      click();
      if (over) startMM(false);
      else { show("screen-game"); Engine.skipNext(); }
    };
    $("btn-res-menu").onclick = () => { click(); show("screen-menu"); };
  }

  window.addEventListener("pointerdown", () => AudioFX.unlock(), { once: true });
  boot();
})();
