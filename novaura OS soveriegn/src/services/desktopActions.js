// desktopActions.js — open vault items from anywhere (desktop, bubbles, Files):
// folders and files open in the Files window, project shortcuts in Cybeni.

const PROJECT_FOLDER = /^\/projects\/cybeni\/([^/]+)$/;

/** Ask the desktop to open (or focus, never minimize) an app window. */
export function openWindow(appId, props = {}) {
  window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId, props, toggle: false } }));
}

/** Show `path` (a folder) in the Files window, optionally selecting `select` inside it. */
export function openInFiles(path, select = null) {
  openWindow('files', { path, select });
  window.dispatchEvent(new CustomEvent('novaura:files_open_path', { detail: { path, select } }));
}

export function openCybeniProject(slug) {
  openWindow('cybeni', { project: slug });
  window.dispatchEvent(new CustomEvent('novaura:cybeni_open_project', { detail: slug }));
}

function parentOf(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  return parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/';
}

/** What a shortcut to this vault item should point at. */
export function shortcutTargetFor(doc) {
  const project = doc.type === 'folder' && PROJECT_FOLDER.exec(doc.path);
  if (project) return { kind: 'project', slug: project[1], path: doc.path };
  return { kind: doc.type === 'folder' ? 'folder' : 'file', path: doc.path };
}

/** Open whatever a shortcut points at. */
export function openShortcutTarget(target) {
  if (!target) return;
  if (target.kind === 'app') openWindow(target.appId);
  else if (target.kind === 'project') openCybeniProject(target.slug);
  else if (target.kind === 'folder') openInFiles(target.path);
  else if (target.path) openInFiles(parentOf(target.path), target.path);
}

/** Open a vault document: folders browse, files are shown selected in their folder. */
export function openVaultItem(doc) {
  if (doc.type === 'folder') openInFiles(doc.path);
  else openInFiles(doc.parentPath || parentOf(doc.path), doc.path);
}

export { parentOf };
