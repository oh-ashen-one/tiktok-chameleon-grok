/** TIKTOK CHAMELEON — static config (Meccha-style hide/paint/seek) */
const CFG = {
  W: 1280,
  H: 720,
  CAT: 118,
  PAINT: 256,
  PLAYERS: 8,
  ROUNDS: [
    { role: "HIDER", paint: 30, place: 12, seek: 50 },
    { role: "SEEKER", seek: 55, taps: 12 },
    { role: "HIDER", paint: 25, place: 10, seek: 48 },
  ],
  REGIONS: {
    "US-WEST": [18, 42],
    "US-EAST": [55, 90],
    "EU-CENTRAL": [95, 140],
    "ASIA-TOKYO": [110, 170],
  },
};

const MAPS = [
  { id: "alley", name: "Graffiti Alley", src: "assets/map-alley.jpg" },
  { id: "beach", name: "Sunset Beach", src: "assets/map-beach.jpg" },
  { id: "candy", name: "Candy Shop", src: "assets/map-candy.jpg" },
  { id: "living", name: "Cozy Living", src: "assets/map-living.jpg" },
];

const POSES = [
  { id: "stand", name: "Stand", e: "🧍", sx: 1, sy: 1, oy: 0 },
  { id: "crouch", name: "Crouch", e: "🧎", sx: 1.15, sy: 0.55, oy: 16 },
  { id: "stretch", name: "Stretch", e: "🤸", sx: 1.7, sy: 0.55, oy: 10 },
  { id: "ball", name: "Ball", e: "⚪", sx: 0.85, sy: 0.75, oy: 12 },
  { id: "wall", name: "Wall", e: "🧱", sx: 0.68, sy: 1.35, oy: 0 },
  { id: "crawl", name: "Crawl", e: "🐈", sx: 1.5, sy: 0.42, oy: 20 },
];

const PALETTE = [
  "#ffffff", "#000000", "#ff4fa3", "#ff5252", "#ff9040", "#ffd93d",
  "#7ddb40", "#28e0c8", "#3aa0ff", "#7b5cff", "#b06030", "#7a7a8c",
  "#f5e6c8", "#c4a484", "#2d5a27", "#4a3728",
];

const BOTS = [
  "PurrfectStorm", "MochiCat", "SardineLord", "NyanBandit", "CatnipQueen",
  "SirPouncelot", "VoidKitty", "TunaTornado", "MittensMcGee", "ZoomiesZane",
  "BeansBrave", "ShadowPaw", "PixelWhisker", "LoafMaster", "ChonkZilla",
  "Meowvelous", "ToeBeanTina", "GravyBoat", "ClawdiaS", "TikTokPaws",
];

const LV_TAGS = ["LV 3", "LV 7", "LV 12", "LV 18", "LV 24", "LV 31", "LV 40", "LV 52"];

const CHAT = {
  lobby: [
    "gl hf :3", "first time seeker", "ready up!!", "candy shop is chaos",
    "eyedropper meta", "dont pick beach", "camo gods only", "who from tiktok?",
    "wall pose is OP", "paint speedrun", "sussy lobby", "ez clap",
  ],
  hide: [
    "already invisible", "good luck seekers", "i am the wall", "camo check",
    "dont take my corner", "pose locked", "brb becoming scenery",
  ],
  seek: [
    "check corners", "that lump looks sus", "clock is scary", "found one!",
    "who painted hot pink??", "tap carefully", "nothing here",
  ],
  found: ["how", "LMAO", "my spot!!", "GG", "ok hunting now", "nooo", "report wallhacks"],
  taunt: ["😹", "👀", "🏳️", "come find me", "boop", "💅", "🔥"],
  reply: ["lol", "real", "^^^", "facts", "gg", ":3", "fr", "💀", "same"],
};

const EMOTES = ["😹", "🎨", "👀", "🙀", "💖", "🏳️", "🔥", "💅"];
