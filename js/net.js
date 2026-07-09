/** Simulated online layer — matchmaking, lobby bots, chat */
const Net = (() => {
  let online = 11000 + ((Math.random() * 2000) | 0);
  let region = "US-WEST";
  let ping = 24;
  const bus = {};
  let mmTimers = [];
  let chatTimers = [];

  function on(ev, fn) { (bus[ev] = bus[ev] || []).push(fn); }
  function emit(ev, data) { (bus[ev] || []).forEach(f => f(data)); }

  setInterval(() => {
    online = Math.max(8000, online + ((Math.random() * 50) | 0) - 22);
    const [lo, hi] = CFG.REGIONS[region];
    ping = Math.max(lo, Math.min(hi, ping + ((Math.random() * 9) | 0) - 4));
    emit("stats", { online, ping, region });
  }, 1400);

  function setRegion(r) {
    region = r;
    const [lo, hi] = CFG.REGIONS[r];
    ping = lo + ((Math.random() * (hi - lo)) | 0);
  }

  function makeBot(name) {
    return {
      name,
      bot: true,
      avatar: (Math.random() * 8) | 0,
      level: LV_TAGS[(Math.random() * LV_TAGS.length) | 0],
      ping: Math.max(12, ping + ((Math.random() * 40) | 0) - 10),
      ready: false,
      score: 0,
      skill: 0.35 + Math.random() * 0.55,
    };
  }

  function findMatch(n, onJoin, onDone, priv) {
    cancelMatch();
    const pool = [...BOTS].sort(() => Math.random() - 0.5).slice(0, n);
    let t = priv ? 800 : 450;
    pool.forEach((name, i) => {
      t += (priv ? 650 : 320) + Math.random() * (priv ? 1100 : 800);
      mmTimers.push(setTimeout(() => {
        onJoin(makeBot(name));
        if (i === pool.length - 1) mmTimers.push(setTimeout(onDone, 700));
      }, t));
    });
  }

  function cancelMatch() {
    mmTimers.forEach(clearTimeout);
    mmTimers = [];
  }

  function startLobbyChat(bots, say) {
    stopChat();
    if (!bots.length) return;
    const loop = () => {
      const b = bots[(Math.random() * bots.length) | 0];
      say(b.name, CHAT.lobby[(Math.random() * CHAT.lobby.length) | 0]);
      chatTimers.push(setTimeout(loop, 2400 + Math.random() * 4200));
    };
    chatTimers.push(setTimeout(loop, 1200));
  }

  function banter(bots, lines, say, lo = 5000, hi = 11000) {
    stopChat();
    if (!bots.length) return;
    const loop = () => {
      const b = bots[(Math.random() * bots.length) | 0];
      say(b.name, lines[(Math.random() * lines.length) | 0]);
      chatTimers.push(setTimeout(loop, lo + Math.random() * (hi - lo)));
    };
    chatTimers.push(setTimeout(loop, 2000));
  }

  function stopChat() {
    chatTimers.forEach(clearTimeout);
    chatTimers = [];
  }

  function maybeReply(say) {
    if (Math.random() < 0.7) {
      setTimeout(() => {
        say(BOTS[(Math.random() * BOTS.length) | 0], CHAT.reply[(Math.random() * CHAT.reply.length) | 0]);
      }, 700 + Math.random() * 2000);
    }
  }

  function roomCode() {
    const a = Math.random().toString(36).slice(2, 5).toUpperCase();
    const b = Math.random().toString(36).slice(2, 5).toUpperCase();
    return a + "-" + b;
  }

  return {
    on, setRegion, findMatch, cancelMatch, makeBot,
    startLobbyChat, banter, stopChat, maybeReply, roomCode,
    get stats() { return { online, ping, region }; },
  };
})();
