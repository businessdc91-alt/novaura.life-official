// starters.js — Known-good starting points for new Cybeni projects.
//
// Local models write much better code when they extend a working scaffold than
// when they start from a blank page: the entry point, mounting and game loop
// are already right, so every pass goes into the actual features.

import { detectNativeLanguage } from './nativeReference.js';

const REACT = [
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-950 text-slate-100">
    <div id="root"></div>
    <script type="module" src="./src/main.jsx"></script>
  </body>
</html>
`,
  },
  {
    path: 'src/main.jsx',
    content: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
`,
  },
  {
    path: 'src/App.jsx',
    content: `import React from 'react';

// Starter screen: replace with the real app.
export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-semibold">Starting…</h1>
    </main>
  );
}
`,
  },
];

const GAME = [
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Game</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0b0f1a; color: #e2e8f0; font-family: system-ui, sans-serif; overflow: hidden; }
      #game { display: block; width: 100vw; height: 100vh; }
      #hud { position: fixed; top: 12px; left: 16px; font-size: 18px; pointer-events: none; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <div id="hud">Score: <span id="score">0</span></div>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
`,
  },
  {
    path: 'src/main.js',
    content: `// Starter game loop: fixed canvas sizing, keyboard input and a delta-time loop.
// Replace update() and draw() with the real game.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const keys = new Set();

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(canvas.clientWidth * ratio);
  canvas.height = Math.floor(canvas.clientHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
window.addEventListener('resize', resize);
window.addEventListener('keydown', (e) => {
  keys.add(e.key);
  if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.key));
resize();

const state = { x: 100, y: 100, score: 0 };

function update(dt) {
  const speed = 240;
  if (keys.has('ArrowLeft')) state.x -= speed * dt;
  if (keys.has('ArrowRight')) state.x += speed * dt;
  if (keys.has('ArrowUp')) state.y -= speed * dt;
  if (keys.has('ArrowDown')) state.y += speed * dt;
}

function draw() {
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(state.x, state.y, 24, 24);
  document.getElementById('score').textContent = String(state.score);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
draw();
requestAnimationFrame(frame);
`,
  },
];

const CPP = [
  {
    path: 'src/main.cpp',
    content: `#include <iostream>
#include <string>
#include <vector>

int main(int argc, char** argv) {
    std::string appName = argc > 1 ? argv[1] : "Cybeni Native C++20 App";
    std::vector<std::string> modules{ "CoreEngine", "Telemetry", "Persistence" };
    std::cout << appName << " started (" << modules.size() << " modules ready)\\n";
    return 0;
}
`,
  },
  {
    path: 'CMakeLists.txt',
    content: `cmake_minimum_required(VERSION 3.20)
project(CybeniNativeCpp LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_executable(CybeniNativeCpp src/main.cpp)
if(MINGW)
  target_link_options(CybeniNativeCpp PRIVATE -static-libgcc -static-libstdc++)
endif()
`,
  },
  {
    path: 'build.ps1',
    content: `$ErrorActionPreference = 'Stop'
& g++ src/main.cpp -I. -std=c++20 -O2 -static-libgcc -static-libstdc++ -o CybeniNativeCpp.exe
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Built CybeniNativeCpp.exe"
`,
  },
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>C++20 Visual Twin Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-950 text-slate-100">
    <div id="root"></div>
    <script type="module" src="./src/main.jsx"></script>
  </body>
</html>
`,
  },
  {
    path: 'src/main.jsx',
    content: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
`,
  },
  {
    path: 'src/App.jsx',
    content: `import React from 'react';

export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="max-w-lg w-full p-6 rounded-2xl border border-slate-800 bg-slate-900/70 space-y-2">
        <div className="text-xs uppercase tracking-wider text-cyan-400 font-bold">C++20 Standalone + Visual Twin</div>
        <h1 className="text-2xl font-bold">Cybeni Native C++20 Workspace</h1>
        <p className="text-sm text-slate-400">Edit <code>src/main.cpp</code> and simulate its UI here, or compile to a standalone <code>.exe</code> via Ship.</p>
      </div>
    </main>
  );
}
`,
  },
];

const CSHARP = [
  {
    path: 'Program.cs',
    content: `using System;
using System.Collections.Generic;

namespace Cybeni.NativeApp {
    public static class Program {
        [STAThread]
        public static void Main(string[] args) {
            var items = new List<string> { "Initialized C# Standalone Runtime" };
            Console.WriteLine("Cybeni C# App ready · " + items[0]);
        }
    }
}
`,
  },
  {
    path: 'App.csproj',
    content: `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>disable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <PublishSingleFile>true</PublishSingleFile>
    <SelfContained>true</SelfContained>
  </PropertyGroup>
</Project>
`,
  },
  {
    path: 'build.ps1',
    content: `$ErrorActionPreference = 'Stop'
if (Get-Command dotnet -ErrorAction SilentlyContinue) {
  dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o ./dist
} else {
  $csc = "$env:WINDIR\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"
  & $csc /nologo /target:exe /out:CybeniCSharpApp.exe Program.cs
}
`,
  },
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>C# (.NET) Visual Twin Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-950 text-slate-100">
    <div id="root"></div>
    <script type="module" src="./src/main.jsx"></script>
  </body>
</html>
`,
  },
  {
    path: 'src/main.jsx',
    content: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
`,
  },
  {
    path: 'src/App.jsx',
    content: `import React from 'react';

export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="max-w-lg w-full p-6 rounded-2xl border border-slate-800 bg-slate-900/70 space-y-2">
        <div className="text-xs uppercase tracking-wider text-purple-400 font-bold">C# (.NET) Standalone + Visual Twin</div>
        <h1 className="text-2xl font-bold">Cybeni Native C# Workspace</h1>
        <p className="text-sm text-slate-400">Build standalone .NET / WinForms executables in <code>Program.cs</code> with a synchronized interactive browser preview here.</p>
      </div>
    </main>
  );
}
`,
  },
];

const GAME_RE = /\b(game|platformer|shooter|arcade|snake|tetris|pong|breakout|asteroids|flappy|runner|space invaders|canvas)\b/i;
// Apps about games (a game library, a tournament tracker) are ordinary apps.
const ABOUT_GAMES_RE = /\b(tracker|manager|catalog(ue)?|collection|database|store|shop|reviews?|blog|dashboard|library|wiki|planner|scheduler)\b/i;

/** Which starter fits a request: 'cpp' or 'csharp' for native targets, 'game' for canvas games, else 'react'. */
export function pickStarter(request) {
  const text = String(request || '');
  const native = detectNativeLanguage(text, []);
  if (native) return native;
  if (!GAME_RE.test(text)) return 'react';
  if (/\b(react|tailwind)\b/i.test(text)) return 'react';
  if (ABOUT_GAMES_RE.test(text)) return 'react';
  return 'game';
}

export function starterFiles(kind) {
  const table = { game: GAME, cpp: CPP, csharp: CSHARP, react: REACT };
  return (table[kind] || REACT).map(f => ({ ...f }));
}

export const STARTER_NOTE = {
  react: 'The project starts from a working React + Tailwind starter (index.html, src/main.jsx, src/App.jsx). Build the app on it; replace the starter screen.',
  game: 'The project starts from a working canvas game starter (index.html with a #game canvas and #hud, src/main.js with resizing, keyboard input and a delta-time loop). Build the game on it; replace update() and draw().',
  cpp: 'The project starts from a C++20 standalone scaffold (src/main.cpp, CMakeLists.txt, build.ps1) paired with a React Visual Twin (index.html, src/App.jsx). Implement complete native C++20 source files AND keep the Visual Twin synchronized.',
  csharp: 'The project starts from a C# (.NET) standalone scaffold (Program.cs, App.csproj, build.ps1) paired with a React Visual Twin (index.html, src/App.jsx). Implement complete C# source files AND keep the Visual Twin synchronized.',
};
