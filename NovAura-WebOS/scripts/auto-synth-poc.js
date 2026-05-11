import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Cybeni Auto-Synthesis Proof of Concept
 * 
 * Usage: node scripts/auto-synth-poc.js <github-repo-url>
 * Example: node scripts/auto-synth-poc.js https://github.com/bradtraversy/50projects50days
 */

const REPO_URL = process.argv[2];
const WORKSPACE_DIR = path.join(process.cwd(), 'synth_workspace');

// The programmatic style guide we established
const DESIGN_SYSTEM = {
  background: 'bg-[#020205] text-white',
  glassPanel: 'bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
  gradientText: 'bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent',
  button: 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-bold rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.4)]',
};

async function runSynthesis() {
  if (!REPO_URL) {
    console.error('❌ Error: Please provide a GitHub repository URL.');
    console.log('Usage: node auto-synth-poc.js https://github.com/user/repo');
    process.exit(1);
  }

  const repoName = REPO_URL.split('/').pop().replace('.git', '');
  const targetDir = path.join(WORKSPACE_DIR, repoName);

  console.log(`\n🚀 [Cybeni Synthesis] Initializing pipeline for: ${repoName}`);

  // 1. Prepare Workspace
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR);
  }
  if (fs.existsSync(targetDir)) {
    console.log(`🧹 Cleaning previous workspace for ${repoName}...`);
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  // 2. Clone the Raw App
  console.log(`\n📦 [Step 1] Cloning raw asset from GitHub...`);
  try {
    execSync(`git clone ${REPO_URL} "${targetDir}"`, { stdio: 'inherit' });
    console.log(`✅ Clone successful.`);
  } catch (err) {
    console.error(`❌ Failed to clone repository:`, err.message);
    process.exit(1);
  }

  // 3. Scan and Rebrand (The Innovative Feature)
  console.log(`\n✨ [Step 2] Injecting NovAura Design System (Rebranding)...`);
  
  let filesModified = 0;

  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        // Skip node_modules and .git
        if (file !== 'node_modules' && file !== '.git') {
          walkDir(fullPath);
        }
      } else {
        // Only process HTML, CSS, and JS/JSX files for PoC
        if (file.endsWith('.html') || file.endsWith('.css') || file.endsWith('.js') || file.endsWith('.jsx')) {
          let content = fs.readFileSync(fullPath, 'utf8');
          let changed = false;

          // --- REBRANDING LOGIC ---
          // Replace generic white/light backgrounds with NovAura Deep Space
          if (content.includes('bg-white') || content.includes('background-color: white') || content.includes('#ffffff')) {
            content = content.replace(/bg-white/g, DESIGN_SYSTEM.background);
            content = content.replace(/background-color:\s*(white|#ffffff|#fff);?/gi, `background-color: #020205; color: white;`);
            changed = true;
          }

          // Replace generic shadow boxes with NovAura Glassmorphism
          if (content.includes('shadow-md') || content.includes('shadow-lg') || content.includes('bg-gray-100')) {
            content = content.replace(/shadow-(md|lg|xl)/g, '');
            content = content.replace(/bg-gray-100/g, DESIGN_SYSTEM.glassPanel);
            changed = true;
          }

          // If HTML, inject Tailwind CDN to ensure our injected classes work for the PoC
          if (file.endsWith('.html') && !content.includes('tailwindcss')) {
            content = content.replace('</head>', `  <script src="https://cdn.tailwindcss.com"></script>\n</head>`);
            changed = true;
          }

          if (changed) {
            fs.writeFileSync(fullPath, content);
            filesModified++;
          }
        }
      }
    }
  }

  walkDir(targetDir);
  console.log(`✅ Rebranding complete. Injected NovAura styles into ${filesModified} files.`);

  // 4. Output next steps
  console.log(`\n🔥 [Step 3] Synthesis Complete!`);
  console.log(`The white-label app is now signatured to NovAura.`);
  console.log(`Location: ${targetDir}`);
  console.log(`\nNext automated step would be: firebase deploy --only hosting:${repoName}`);
}

runSynthesis();
