// memeTemplates.js — The four offline meme templates (moved unchanged from the original Creative Studio).

const SVG_SHIBA = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" style="background:#0f172a">
  <circle cx="300" cy="200" r="120" fill="#06b6d4" opacity="0.25"/>
  <polygon points="210,140 240,60 270,120" fill="#f59e0b"/>
  <polygon points="390,140 360,60 330,120" fill="#f59e0b"/>
  <polygon points="225,120 240,80 255,115" fill="#fef3c7"/>
  <polygon points="375,120 360,80 345,115" fill="#fef3c7"/>
  <circle cx="300" cy="180" r="85" fill="#fbbf24"/>
  <ellipse cx="300" cy="210" rx="55" ry="40" fill="#fef3c7"/>
  <circle cx="300" cy="195" r="12" fill="#0f172a"/>
  <rect x="235" y="145" width="130" height="28" rx="6" fill="#06b6d4" opacity="0.9"/>
  <line x1="240" y1="159" x2="360" y2="159" stroke="#ffffff" stroke-width="2"/>
  <text x="300" y="320" font-family="monospace" font-size="22" font-weight="black" fill="#06b6d4" text-anchor="middle" letter-spacing="4">MUCH SOVEREIGN</text>
  <text x="300" y="350" font-family="monospace" font-size="14" fill="#a855f7" text-anchor="middle" letter-spacing="2">VERY DECENTRALIZED · WOW</text>
</svg>`)}`;

const SVG_CYBERPUNK = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0a051b"/>
      <stop offset="60%" stop-color="#1f0d3d"/>
      <stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
  </defs>
  <rect width="600" height="260" fill="url(#sky)"/>
  <circle cx="300" cy="200" r="85" fill="#f43f5e" opacity="0.9"/>
  <polygon points="40,260 40,140 70,140 70,260" fill="#0f172a"/>
  <polygon points="75,260 75,100 115,100 115,260" fill="#1e1b4b"/>
  <polygon points="120,260 120,160 150,160 150,260" fill="#0f172a"/>
  <polygon points="160,260 160,80 200,80 200,260" fill="#1e1b4b"/>
  <polygon points="210,260 210,120 250,120 250,260" fill="#0f172a"/>
  <polygon points="350,260 350,90 390,90 390,260" fill="#1e1b4b"/>
  <polygon points="400,260 400,150 435,150 435,260" fill="#0f172a"/>
  <polygon points="445,260 445,110 490,110 490,260" fill="#1e1b4b"/>
  <polygon points="500,260 500,140 550,140 550,260" fill="#0f172a"/>
  <rect y="260" width="600" height="140" fill="#020617"/>
  <g stroke="#06b6d4" stroke-width="1.2" opacity="0.65">
    <line x1="300" y1="260" x2="0" y2="400"/>
    <line x1="300" y1="260" x2="100" y2="400"/>
    <line x1="300" y1="260" x2="200" y2="400"/>
    <line x1="300" y1="260" x2="300" y2="400"/>
    <line x1="300" y1="260" x2="400" y2="400"/>
    <line x1="300" y1="260" x2="500" y2="400"/>
    <line x1="300" y1="260" x2="600" y2="400"/>
    <line x1="0" y1="270" x2="600" y2="270"/>
    <line x1="0" y1="285" x2="600" y2="285"/>
    <line x1="0" y1="310" x2="600" y2="310"/>
    <line x1="0" y1="345" x2="600" y2="345"/>
    <line x1="0" y1="390" x2="600" y2="390"/>
  </g>
</svg>`)}`;

const SVG_MATRIX = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" style="background:#020b05">
  <g font-family="monospace" font-size="14" fill="#22c55e" opacity="0.75">
    <text x="30" y="50">0 1 0 1 1 0 1</text>
    <text x="30" y="80">1 0 1 1 0 0 1</text>
    <text x="30" y="110">0 1 1 0 1 0 1</text>
    <text x="30" y="140" fill="#86efac" font-weight="bold">1 0 1 0 1 1 1</text>
    <text x="120" y="70">N O V A U R A</text>
    <text x="120" y="100">S O V E R E I G N</text>
    <text x="120" y="130">0 x 8 F 4 2 D A</text>
    <text x="120" y="160" fill="#fff" font-weight="bold">E N C R Y P T</text>
    <text x="260" y="40">λ f . ( λ x . f ( x x ) )</text>
    <text x="260" y="70">P 2 P _ M E S H _ N E T</text>
    <text x="260" y="100">D E C E N T R A L I Z E D</text>
    <text x="260" y="130">K E R N E L _ V 2 . 4</text>
    <text x="260" y="160" fill="#4ade80">S E C U R E _ B O O T</text>
    <text x="420" y="60">1 0 0 1 0 1 0</text>
    <text x="420" y="90">0 1 1 0 1 1 0</text>
    <text x="420" y="120">1 1 0 0 1 0 1</text>
    <text x="420" y="150" fill="#fff">A U R A _ C O R E</text>
    <text x="50" y="220">d x . e v a l ( p a c k e t )</text>
    <text x="50" y="250">e d 2 5 5 1 9 _ s i g n</text>
    <text x="50" y="280">x 2 5 5 1 9 _ s h a r e</text>
    <text x="50" y="310" fill="#86efac">V A U L T _ S E A L E D</text>
    <text x="220" y="240">Z E R O _ C L O U D</text>
    <text x="220" y="270">P R I V A T E _ D A T A</text>
    <text x="220" y="300">D E X I E _ C A C H E D</text>
    <text x="220" y="330" fill="#fff">1 0 0 % _ L O C A L</text>
  </g>
</svg>`)}`;

const SVG_COSMOS = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" style="background:#030712">
  <defs>
    <radialGradient id="nebula1" cx="30%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.6"/>
      <stop offset="60%" stop-color="#3b82f6" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#030712" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="nebula2" cx="70%" cy="60%" r="45%">
      <stop offset="0%" stop-color="#ec4899" stop-opacity="0.5"/>
      <stop offset="70%" stop-color="#06b6d4" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#030712" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="400" fill="url(#nebula1)"/>
  <rect width="600" height="400" fill="url(#nebula2)"/>
  <g fill="#ffffff">
    <circle cx="45" cy="60" r="1.5" opacity="0.9"/>
    <circle cx="120" cy="30" r="1.0" opacity="0.8"/>
    <circle cx="180" cy="90" r="2.0" opacity="1.0"/>
    <circle cx="230" cy="40" r="1.2" opacity="0.7"/>
    <circle cx="310" cy="80" r="2.5" opacity="1.0"/>
    <circle cx="390" cy="45" r="1.2" opacity="0.8"/>
    <circle cx="470" cy="70" r="1.8" opacity="0.9"/>
    <circle cx="530" cy="35" r="1.0" opacity="0.6"/>
    <circle cx="70" cy="180" r="1.5" opacity="0.8"/>
    <circle cx="140" cy="220" r="2.2" opacity="1.0"/>
    <circle cx="280" cy="190" r="1.0" opacity="0.7"/>
    <circle cx="350" cy="230" r="1.8" opacity="0.9"/>
    <circle cx="440" cy="170" r="2.4" opacity="1.0"/>
    <circle cx="510" cy="210" r="1.2" opacity="0.8"/>
    <circle cx="90" cy="320" r="1.7" opacity="0.9"/>
    <circle cx="190" cy="360" r="1.2" opacity="0.7"/>
    <circle cx="260" cy="310" r="2.0" opacity="1.0"/>
    <circle cx="380" cy="350" r="1.5" opacity="0.8"/>
    <circle cx="480" cy="320" r="2.2" opacity="1.0"/>
  </g>
  <circle cx="460" cy="140" r="45" fill="#38bdf8"/>
  <ellipse cx="460" cy="140" rx="75" ry="16" fill="none" stroke="#f472b6" stroke-width="4" transform="rotate(-15 460 140)"/>
</svg>`)}`;

export const MEME_TEMPLATES = [
  { id: 'doge', name: 'Cyber Shiba / Much Wow', url: SVG_SHIBA },
  { id: 'city', name: 'Cyberpunk Metropolis', url: SVG_CYBERPUNK },
  { id: 'matrix', name: 'Digital Rain / Code', url: SVG_MATRIX },
  { id: 'spaceman', name: 'Cosmic Voyager', url: SVG_COSMOS },
];
