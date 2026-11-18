// ownership.js — the Sentinel Probe's hard ownership gate. A target is probed only
// when this node can PROVE it owns it:
//   mesh    — the Nova Registry record for the name is registered to this node's key
//             (nameStatus(name).state === 'yours'); its published site is the content.
//   project — the slug is one of this node's Cybeni projects; its files are the content.
// Anything else — a third-party domain, an unknown name, a name owned by another key —
// is refused, and no content is ever returned for a target that was not verified.

import { nameStatus } from '../web/novaRegistry.js';
import { listProjects, loadProjectFiles } from '../cybeni/projectStore.js';
import { db } from '../../database/sovereignDatabase.js';
import { targetId } from './targetStore.js';

const refuse = (reason) => ({ ok: false, reason });

/**
 * resolveTarget({ kind, name, slug }) -> { ok: true, target } | { ok: false, reason }
 * On success, target is { id, kind, ref, name, content: { files } }.
 */
export async function resolveTarget({ kind, name, slug } = {}) {
  if (kind === 'mesh') {
    const status = await nameStatus(name).catch(() => null);
    if (status?.state !== 'yours') {
      return refuse(`“${name}” is not registered to this node, so it cannot be probed.`);
    }
    const site = (await db.hosted_sites.get(name).catch(() => null))
      || (await db.hosted_sites.where('domain').equals(name).toArray().catch(() => []))[0];
    const html = site?.htmlContent;
    if (!html) return refuse(`“${name}” has no published site content to probe.`);
    return {
      ok: true,
      target: { id: targetId('mesh', name), kind: 'mesh', ref: name, name, content: { files: [{ path: 'index.html', content: html }] } },
    };
  }

  if (kind === 'project') {
    const project = (await listProjects().catch(() => [])).find((p) => p.slug === slug);
    if (!project) return refuse(`No Cybeni project “${slug}” on this node.`);
    const files = await loadProjectFiles(slug).catch(() => []);
    return {
      ok: true,
      target: { id: targetId('project', slug), kind: 'project', ref: slug, name: project.name, content: { files } },
    };
  }

  return refuse(`Unknown target kind “${kind}”.`);
}
