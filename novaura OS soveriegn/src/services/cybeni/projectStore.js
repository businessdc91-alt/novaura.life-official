// projectStore.js — Cybeni projects as real files under /projects/cybeni/<slug>/
// (visible in the Files app and committable to NovaHub), plus checkpoints taken
// before every AI run so any change can be rolled back.

import { db } from '../../database/sovereignDatabase.js';
import { saveFile } from '../fileStorageService.js';
import { mimeFor, normalizePath } from './previewBuilder.js';

const ROOT = '/projects/cybeni';
const REGISTRY_KEY = 'cybeni_projects';
const MAX_CHECKPOINTS = 30;

export const TEMPLATES = {
  react: {
    label: 'React + Tailwind',
    files: [
      { path: 'index.html', content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>New app</title>\n  <script src="https://cdn.tailwindcss.com"></script>\n</head>\n<body class="bg-slate-50 text-slate-900">\n  <div id="root"></div>\n  <script type="module" src="/src/main.jsx"></script>\n</body>\n</html>\n' },
      { path: 'src/main.jsx', content: "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\n\ncreateRoot(document.getElementById('root')).render(<App />);\n" },
      { path: 'src/App.jsx', content: "export default function App() {\n  return (\n    <main className=\"min-h-screen flex items-center justify-center p-8\">\n      <div className=\"text-center\">\n        <h1 className=\"text-3xl font-bold\">Ready to build</h1>\n        <p className=\"mt-2 text-slate-500\">Describe what you want in the Cybeni panel.</p>\n      </div>\n    </main>\n  );\n}\n" },
    ],
  },
  vanilla: {
    label: 'HTML, CSS & JavaScript',
    files: [
      { path: 'index.html', content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>New app</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n  <main id="app"><h1>Ready to build</h1></main>\n  <script type="module" src="app.js"></script>\n</body>\n</html>\n' },
      { path: 'styles.css', content: 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n}\n' },
      { path: 'app.js', content: "console.log('App ready');\n" },
    ],
  },
  blank: { label: 'Empty (Cybeni chooses)', files: [] },
};

export function slugify(name) {
  return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project';
}

const projectPrefix = (slug) => `${ROOT}/${slug}/`;

async function readRegistry() {
  const list = await db.getSetting(REGISTRY_KEY, []);
  return Array.isArray(list) ? list : [];
}

async function writeRegistry(list) {
  await db.setSetting(REGISTRY_KEY, list);
}

// The old single-file Cybeni kept files directly in /projects/cybeni/.
async function migrateLegacy(registry) {
  if (registry.length) return registry;
  const legacy = await db.documents.where('path').startsWith(`${ROOT}/`).toArray().catch(() => []);
  const loose = legacy.filter(d => d.type === 'file' && d.path.split('/').length === 4);
  if (!loose.length) return registry;
  const slug = 'starter';
  for (const doc of loose) {
    await saveFile(`${ROOT}/${slug}/${doc.name}`, typeof doc.content === 'string' ? doc.content : '', mimeFor(doc.name));
    await db.documents.delete(doc.id);
  }
  const next = [{ slug, name: 'Starter project', createdAt: Date.now(), updatedAt: Date.now() }];
  await writeRegistry(next);
  return next;
}

export async function listProjects() {
  const registry = await migrateLegacy(await readRegistry());
  return [...registry].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function createProject(name, templateId = 'react') {
  const registry = await readRegistry();
  let slug = slugify(name);
  const base = slug;
  for (let i = 2; registry.some(p => p.slug === slug); i++) slug = `${base}-${i}`;
  const project = { slug, name: String(name || 'Untitled').trim().slice(0, 60) || 'Untitled', createdAt: Date.now(), updatedAt: Date.now(), runs: [] };
  await writeRegistry([...registry, project]);
  for (const f of (TEMPLATES[templateId] || TEMPLATES.react).files) {
    await saveFile(`${projectPrefix(slug)}${f.path}`, f.content, mimeFor(f.path));
  }
  return project;
}

export async function updateProject(slug, patch) {
  const registry = await readRegistry();
  const next = registry.map(p => (p.slug === slug ? { ...p, ...patch, updatedAt: Date.now() } : p));
  await writeRegistry(next);
  return next.find(p => p.slug === slug);
}

export async function deleteProject(slug) {
  const docs = await db.documents.where('path').startsWith(projectPrefix(slug)).toArray();
  const folder = await db.documents.where('path').equals(`${ROOT}/${slug}`).toArray();
  await db.documents.bulkDelete([...docs, ...folder].map(d => d.id));
  await db.cybeni_checkpoints.where('project').equals(slug).delete();
  await writeRegistry((await readRegistry()).filter(p => p.slug !== slug));
}

/** Project files with project-relative paths, sorted. */
export async function loadProjectFiles(slug) {
  const prefix = projectPrefix(slug);
  const docs = await db.documents.where('path').startsWith(prefix).toArray().catch(() => []);
  return docs
    .filter(d => d.type === 'file')
    .map(d => ({ path: d.path.slice(prefix.length), content: typeof d.content === 'string' ? d.content : '' }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function saveProjectFile(slug, path, content) {
  const clean = normalizePath(path);
  if (!clean) throw new Error('Invalid file path.');
  await saveFile(`${projectPrefix(slug)}${clean}`, content, mimeFor(clean));
  await updateProject(slug, {});
}

export async function deleteProjectFile(slug, path) {
  const doc = await db.documents.where('path').equals(`${projectPrefix(slug)}${normalizePath(path)}`).first();
  if (doc) await db.documents.delete(doc.id);
}

/** Make the stored project match `files` exactly (writes changed files, removes the rest). */
export async function replaceProjectFiles(slug, files) {
  const current = new Map((await loadProjectFiles(slug)).map(f => [f.path, f.content]));
  const wanted = new Map(files.map(f => [normalizePath(f.path), f.content]));
  for (const [path, content] of wanted) {
    if (current.get(path) !== content) await saveFile(`${projectPrefix(slug)}${path}`, content, mimeFor(path));
  }
  for (const path of current.keys()) {
    if (!wanted.has(path)) await deleteProjectFile(slug, path);
  }
  await updateProject(slug, {});
}

// ── Checkpoints ────────────────────────────────────────────────────────────

export async function createCheckpoint(slug, label, files) {
  const id = `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  await db.cybeni_checkpoints.put({ id, project: slug, label: String(label || '').slice(0, 200), createdAt: Date.now(), files });
  const all = await db.cybeni_checkpoints.where('project').equals(slug).sortBy('createdAt');
  if (all.length > MAX_CHECKPOINTS) await db.cybeni_checkpoints.bulkDelete(all.slice(0, all.length - MAX_CHECKPOINTS).map(c => c.id));
  return id;
}

export async function listCheckpoints(slug) {
  const all = await db.cybeni_checkpoints.where('project').equals(slug).sortBy('createdAt').catch(() => []);
  return all.reverse().map(({ files, ...meta }) => ({ ...meta, fileCount: files.length }));
}

export async function restoreCheckpoint(slug, id) {
  const cp = await db.cybeni_checkpoints.get(id);
  if (!cp || cp.project !== slug) throw new Error('Checkpoint not found.');
  await replaceProjectFiles(slug, cp.files);
  return cp.files;
}

// ZIP export lives in the shared zip service; re-exported for existing callers.
export { buildZip } from '../zipService.js';

export function downloadBytes(filename, data, mime) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
