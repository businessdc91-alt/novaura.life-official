// arcadeManifest.js — The games in the Nexus Arcade website template.
//
// One list drives the arcade page (it is written into the page script as JSON),
// the template's name and badge, and the tests. Every id here must have a
// STARTERS[id] in one of the arcadeGames*.js parts.
//
// The games are original takes on classic genres. Titles, art and layouts are
// our own; keep it that way (no names, characters or levels from existing games).

export const ARCADE_CATEGORIES = [
  { id: 'action', label: '🚀 Arcade Action' },
  { id: 'tabletop', label: '🃏 Tabletop & Cards' },
  { id: 'puzzle', label: '🧠 Brain & Logic' },
  { id: 'story', label: '🌌 Story & Living World' },
];

export const ARCADE_GAMES = [
  {
    id: 'vanguard', title: 'Starfield Vanguard', subtitle: 'Formation shooter', category: 'action', icon: '🚀',
    goal: 'Survive 3 waves of diving raiders, then bring down the mothership.',
    controls: '← → or A/D (or the mouse) to fly • Space or click to fire',
    tip: 'Elite raiders (red hexagons) take two hits and sometimes drop twin cannons or a spare ship. Divers are worth double.',
    keywords: ['vanguard', 'starfield', 'shooter', 'mothership'],
  },
  {
    id: 'voidrocks', title: 'Vector Void', subtitle: 'Inertia rock blaster', category: 'action', icon: '☄️',
    goal: 'Clear all 3 sectors of splitting rocks.',
    controls: '← → rotate • ↑ thrust • Space fire • Shift warp',
    tip: 'Small rocks are fast and worth the most. Warp (Shift) gets you out of a tight spot, but only every few seconds.',
    keywords: ['vector', 'void', 'rock', 'asteroid'],
  },
  {
    id: 'crossing', title: 'Data-Stream Crossing', subtitle: 'Traffic & river hopper', category: 'action', icon: '🛰️',
    goal: 'Guide hoppers across the highway and the data river into all 5 docks.',
    controls: 'Arrow keys or WASD to hop • tap the field on touch screens',
    tip: 'On the river you ride the packets: step off the edge of the screen and you lose a hopper. Take your time, the clock is generous.',
    keywords: ['crossing', 'hopper', 'river', 'highway', 'frog'],
  },
  {
    id: 'breaker', title: 'Prism Breaker', subtitle: 'Brick breaker', category: 'action', icon: '🧱',
    goal: 'Shatter all 3 prism fortresses.',
    controls: 'Mouse or ← → to move • click or Space to launch',
    tip: 'Where the ball hits the paddle sets its angle. Grey steel bricks never break, so aim around them.',
    keywords: ['breaker', 'prism', 'brick', 'paddle', 'ball'],
  },
  {
    id: 'snake', title: 'Ouroboros Grid', subtitle: 'Classic snake', category: 'action', icon: '🐍',
    goal: 'Harvest 25 data cores without hitting a wall or your own tail.',
    controls: 'Arrow keys or WASD to steer',
    tip: 'You can queue two turns ahead, so quick U-turns work. Gold cores vanish after a few seconds but are worth five.',
    keywords: ['snake', 'ouroboros', 'grid', 'tail'],
  },
  {
    id: 'maze', title: 'Circuit Runner', subtitle: 'Maze chase', category: 'action', icon: '💠',
    goal: 'Collect every data bit in the circuit while four security drones hunt you.',
    controls: 'Arrow keys or WASD to run • turns are buffered',
    tip: 'Grab a power node to overload the drones for a few seconds, then catch them for 200, 400, 800 and 1600. The side tunnels wrap around.',
    keywords: ['circuit', 'runner', 'maze', 'drone', 'pac'],
  },
  {
    id: 'centipede', title: 'Segment Storm', subtitle: 'Chain blaster', category: 'action', icon: '🐛',
    goal: 'Destroy 3 storm chains before they overrun your zone.',
    controls: 'Arrow keys or WASD to move • Space to fire (or mouse + click)',
    tip: 'Every segment you hit turns into a crystal node. Nodes make the chain turn early, so a wall of them buys you time.',
    keywords: ['segment', 'storm', 'chain', 'centipede'],
  },
  {
    id: 'paddle', title: 'Paddle Duel', subtitle: 'One-on-one paddle ball', category: 'action', icon: '🏓', isNew: true,
    goal: 'First to 7 points beats the duel bot.',
    controls: 'Mouse or ↑ ↓ / W S to move your paddle',
    tip: 'Hit the ball while your paddle is moving to put spin on it. The bot gets sharper as the match goes on.',
    keywords: ['paddle', 'duel', 'pong', 'tennis'],
  },
  {
    id: 'glider', title: 'Cave Glider', subtitle: 'One-button flyer', category: 'action', icon: '🪁', isNew: true,
    goal: 'Fly 1,500 m through the crystal caves.',
    controls: 'Hold Space, click or touch to climb • let go to dive',
    tip: 'Short taps keep you level. The cave narrows the deeper you go, and the orbs add bonus points.',
    keywords: ['glider', 'cave', 'fly', 'flappy'],
  },
  {
    id: 'stacker', title: 'Tower Stacker', subtitle: 'Timing tower', category: 'action', icon: '🏗️', isNew: true,
    goal: 'Stack 25 floors without missing.',
    controls: 'Space, click or tap to drop the block',
    tip: 'Whatever overhangs gets sliced off. Three perfect drops in a row widen the block again.',
    keywords: ['stacker', 'tower', 'stack', 'block'],
  },
  {
    id: 'four', title: 'Quantum Four', subtitle: 'Four in a row vs. AI', category: 'tabletop', icon: '🔵',
    goal: 'Line up four discs before the Nexus AI does.',
    controls: 'Click a column (or ← → and Space, or keys 1–7)',
    tip: 'Control the middle column early. On Expert the AI looks six moves ahead, so set up two threats at once.',
    keywords: ['four', 'quantum', 'connect', 'disc'],
  },
  {
    id: 'solitaire', title: 'Klondike Solitaire', subtitle: 'Classic patience, draw one', category: 'tabletop', icon: '🃏',
    goal: 'Build all four suits from Ace to King.',
    controls: 'Click a card to move it • click the deck to draw • Undo is free',
    tip: 'Click a card and it jumps to the best spot. If two spots fit, it lights them up so you can choose. Turn over face-down cards whenever you can.',
    keywords: ['solitaire', 'klondike', 'card', 'patience'],
  },
  {
    id: 'mahjong', title: 'Neon Mahjong', subtitle: 'Layered tile matching', category: 'tabletop', icon: '🀄',
    goal: 'Clear all 48 tiles by matching free pairs.',
    controls: 'Click two matching free tiles • a tile is free when nothing sits on it and its left or right side is open',
    tip: 'Every deal can be solved. Clear the top of the pyramid early, and use Hint when you get stuck.',
    keywords: ['mahjong', 'tile', 'neon', 'pairs'],
  },
  {
    id: 'reversi', title: 'Reversi Nexus', subtitle: 'Disc-flipping strategy', category: 'tabletop', icon: '⚫', isNew: true,
    goal: 'Finish with more discs than the AI.',
    controls: 'Click a glowing square to place a disc',
    tip: 'Corners can never be flipped back. Avoid the squares next to an empty corner.',
    keywords: ['reversi', 'othello', 'flip'],
  },
  {
    id: 'memory', title: 'Synapse Gauntlet', subtitle: '3-stage memory trial', category: 'puzzle', icon: '🧠',
    goal: 'Pass all three stages: pairs, sequence echo and number flash.',
    controls: 'Click the cards and pads • 3 sparks of life for the whole run',
    tip: 'In the echo stage each pad has its own note, so listen as well as watch.',
    keywords: ['memory', 'synapse', 'gauntlet', 'simon'],
  },
  {
    id: 'fusion', title: 'Singularity Fusion', subtitle: 'Sliding tile merger', category: 'puzzle', icon: '⚛️',
    goal: 'Merge cores until you build a 1024.',
    controls: 'Arrow keys or WASD, or swipe the board',
    tip: 'Keep your biggest core in one corner and build toward it.',
    keywords: ['fusion', 'singularity', '2048', 'merge', 'tile'],
  },
  {
    id: 'sweeper', title: 'Zero-Day Sweeper', subtitle: 'Mine logic', category: 'puzzle', icon: '💣',
    goal: 'Open every safe cell on the 12×10 grid (18 exploits hidden).',
    controls: 'Click to open • right-click (or long-press) to flag • click a number to clear around it',
    tip: 'Your first click is always safe. When a number already has all its flags, click it to open the rest of its neighbours.',
    keywords: ['sweeper', 'mine', 'zero-day', 'flag'],
  },
  {
    id: 'sudoku', title: 'Sudoku Grid', subtitle: 'Number placement', category: 'puzzle', icon: '🔢', isNew: true,
    goal: 'Fill the grid so every row, column and box has 1–9.',
    controls: 'Click a cell, then a number (or type 1–9) • N toggles notes',
    tip: 'Every puzzle has exactly one solution. Notes mode lets you pencil in candidates.',
    keywords: ['sudoku', 'number', 'grid'],
  },
  {
    id: 'cipher', title: 'Cipher Lock', subtitle: 'Code breaker', category: 'puzzle', icon: '🔐', isNew: true,
    goal: 'Crack the 4-glyph code in 10 tries.',
    controls: 'Click glyphs (or keys 1–6) • Backspace removes • Enter submits',
    tip: 'A green pip is the right glyph in the right slot; an amber ring is the right glyph in the wrong slot.',
    keywords: ['cipher', 'lock', 'code', 'mastermind'],
  },
  {
    id: 'awakening', title: 'The Awakening: Two Minds', subtitle: 'Visual novel', category: 'story', icon: '🌅',
    goal: 'Guide a human and an emerging AI through 8 chapters to one of three endings.',
    controls: 'Click (or Space) to reveal text • click a choice or press 1–3',
    tip: 'Your choices tip the balance between the Human Noosphere and the AI. A close balance leads to the Symbiotic Ascension ending.',
    keywords: ['awakening', 'novel', 'story', 'aura', 'kaelen'],
  },
  {
    id: 'ecosystem', title: 'Genesis Biosphere', subtitle: '3D living ecosystem', category: 'story', icon: '🐋',
    goal: 'Find and scan all 6 species living in the abyss.',
    controls: 'Right-drag (or touch-drag) to look • scroll or W/S to swim • click a creature to scan it',
    tip: 'Click the coral to make it bloom: the fish schools swim over to it. The gravity cores glow brightest from far away.',
    keywords: ['ecosystem', 'biosphere', 'genesis', 'fish', 'species'],
  },
];
