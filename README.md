# 🐱🎨 TIKTOK CHAMELEON GROK

**Paint. Hide. Seek.**

Browser hide-and-seek party game inspired by Meccha Chameleon mechanics:
paint a pure white cat body to blend into the stage, pose, and outlast the seekers.

Built from scratch for **TIKTOK CHAMELEON GROK**. Original AI art. Vanilla HTML/CSS/JS.

## Play

```bash
cd tiktok-chameleon-grok
python3 -m http.server 8755
# open http://localhost:8755
```

Or open `index.html` directly.

## Session (~5 min)

1. Menu (online count, region, profile)
2. Quick match / private room
3. Lobby — map vote, chat, ready-up
4. **3 rounds** — Hider → Seeker → Hider
5. Results + XP

## Systems

| Feature | Notes |
|---------|--------|
| Paint | Brush, spray, fill, eraser, eyedropper (sample map), undo |
| Poses | Stand, crouch, stretch, ball, wall, crawl |
| Hide | WASD / drag, flip, live CAMO % |
| Seek | Limited taps; misses burn time; found players become seekers |
| Online feel | Matchmaking, bots, chat, ping, regions |
| Maps | Graffiti Alley, Sunset Beach, Candy Shop, Cozy Living |

## Controls

- `WASD` move · `R` cycle pose · `4–9` poses · `Ctrl` crouch · `Space` wall · `1` taunt
- 💧 eyedropper + click stage = steal colors

## Stack

No build step. No frameworks. Canvas + WebAudio.

## License

MIT. Fan mechanical tribute with original art — not affiliated with any commercial game.
