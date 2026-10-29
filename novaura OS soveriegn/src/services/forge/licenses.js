// licenses.js — What a license lets you do, in plain words.
// Not legal advice; it errs on the side of caution, and anything unknown is
// treated as "do not reuse until you check".

const L = (category, rebrand, commercial, obligations, summary) => ({ category, rebrand, commercial, obligations, summary });

const KEEP = 'Keep the original copyright notice and license text in your copy.';

export const LICENSES = {
  'mit': L('permissive', true, true, [KEEP], 'Do almost anything, including rebranding and selling.'),
  'isc': L('permissive', true, true, [KEEP], 'Do almost anything, including rebranding and selling.'),
  '0bsd': L('public-domain', true, true, [], 'No conditions at all.'),
  'bsd-2-clause': L('permissive', true, true, [KEEP], 'Do almost anything, including rebranding and selling.'),
  'bsd-3-clause': L('permissive', true, true, [KEEP, 'Do not use the original authors’ names to promote your version.'], 'Rebrand and sell freely; do not imply the original authors endorse you.'),
  'apache-2.0': L('permissive', true, true, [KEEP, 'Keep any NOTICE file and mark files you changed.', 'Rebrand freely, but the original trademarks are not licensed to you.'], 'Rebrand and sell freely; keep NOTICE files and note your changes.'),
  'zlib': L('permissive', true, true, ['Do not claim you wrote the original; mark altered versions.'], 'Rebrand and sell; just do not misrepresent the origin.'),
  'unlicense': L('public-domain', true, true, [], 'Public domain: no conditions.'),
  'cc0-1.0': L('public-domain', true, true, [], 'Public domain: no conditions.'),
  'wtfpl': L('public-domain', true, true, [], 'No conditions.'),
  'mpl-2.0': L('weak-copyleft', true, true, [KEEP, 'Changes to MPL-licensed files must be shared under the MPL; your own new files can stay closed.'], 'Rebrand and sell; changes to the original files must stay open.'),
  'lgpl-2.1': L('weak-copyleft', true, true, [KEEP, 'Changes to the library itself must stay open (LGPL), and users must be able to swap the library.'], 'Usable in closed apps as a library; changes to it stay open.'),
  'lgpl-3.0': L('weak-copyleft', true, true, [KEEP, 'Changes to the library itself must stay open (LGPL), and users must be able to swap the library.'], 'Usable in closed apps as a library; changes to it stay open.'),
  'gpl-2.0': L('copyleft', true, true, [KEEP, 'Your whole app must be released under the GPL, with source code, to anyone you distribute it to.'], 'Rebrand and sell only if your version is also open source under the GPL.'),
  'gpl-3.0': L('copyleft', true, true, [KEEP, 'Your whole app must be released under the GPL-3.0, with source code, to anyone you distribute it to.'], 'Rebrand and sell only if your version is also open source under the GPL.'),
  'agpl-3.0': L('copyleft', true, true, [KEEP, 'Your whole app must be open source under the AGPL, including when people only use it over a network.'], 'Strongest copyleft: even hosting it means publishing your source.'),
  'cc-by-4.0': L('permissive', true, true, ['Credit the original creator and link the license.'], 'Use and rebrand freely with credit.'),
  'cc-by-sa-4.0': L('copyleft', true, true, ['Credit the creator and share your version under CC BY-SA.'], 'Use with credit; derivatives must use the same license.'),
  'cc-by-nc-4.0': L('non-commercial', true, false, ['Credit the creator.', 'No commercial use.'], 'Personal and non-commercial use only.'),
  'cc-by-nc-sa-4.0': L('non-commercial', true, false, ['Credit the creator, share alike.', 'No commercial use.'], 'Personal and non-commercial use only.'),
  'cc-by-nd-4.0': L('no-derivatives', false, true, ['Credit the creator.', 'No modified versions.'], 'Can be shared unchanged, but not rebranded or modified.'),
  'openrail': L('responsible-ai', true, true, ['Follow the use restrictions (no harmful uses) and pass them on to your users.'], 'Commercial use allowed, with use restrictions you must pass on.'),
  'openrail++': L('responsible-ai', true, true, ['Follow the use restrictions (no harmful uses) and pass them on to your users.'], 'Commercial use allowed, with use restrictions you must pass on.'),
  'creativeml-openrail-m': L('responsible-ai', true, true, ['Follow the use restrictions and pass them on to your users.'], 'Commercial use allowed, with use restrictions you must pass on.'),
  'llama3': L('custom-ai', true, true, ['Show "Built with Llama".', 'Over 700M monthly users needs a separate license from Meta.', 'Follow Meta’s acceptable use policy.'], 'Commercial use allowed under Meta’s conditions.'),
  'llama3.1': L('custom-ai', true, true, ['Show "Built with Llama".', 'Over 700M monthly users needs a separate license from Meta.'], 'Commercial use allowed under Meta’s conditions.'),
  'gemma': L('custom-ai', true, true, ['Follow Google’s Gemma prohibited use policy and pass it on.'], 'Commercial use allowed under Google’s Gemma terms.'),
  'other': L('unknown', false, false, ['Read the license on the source page before using it.'], 'Custom license: read it before reusing anything.'),
};

const ALIASES = {
  'mit license': 'mit', 'apache license 2.0': 'apache-2.0', 'apache 2.0': 'apache-2.0', 'apache-2': 'apache-2.0',
  'gplv3': 'gpl-3.0', 'gpl-3.0-only': 'gpl-3.0', 'gpl-3.0-or-later': 'gpl-3.0', 'gplv2': 'gpl-2.0', 'gpl-2.0-only': 'gpl-2.0', 'gpl-2.0-or-later': 'gpl-2.0',
  'agpl-3.0-only': 'agpl-3.0', 'agpl-3.0-or-later': 'agpl-3.0', 'lgpl-3.0-only': 'lgpl-3.0', 'lgpl-2.1-only': 'lgpl-2.1',
  'cc-by-4': 'cc-by-4.0', 'cc0': 'cc0-1.0', 'public domain': 'unlicense', 'bsd-3': 'bsd-3-clause', 'bsd-2': 'bsd-2-clause',
  'creativeml-openrail++-m': 'openrail++', 'llama3.2': 'llama3.1', 'llama3.3': 'llama3.1',
};

/**
 * Analyse a license identifier (SPDX id, Hugging Face tag or free text).
 * Returns { id, category, rebrand, commercial, whiteLabel, obligations, summary, verdict }.
 */
export function analyzeLicense(raw) {
  const text = String(raw || '').trim().toLowerCase().replace(/^license:/, '').replace(/-(only|or-later)$/, '');
  if (!text || text === 'noassertion' || text === 'none' || text === 'unknown') {
    return {
      id: '', category: 'unlicensed', rebrand: false, commercial: false, whiteLabel: false,
      obligations: ['Without a license, all rights stay with the author. Ask them for permission first.'],
      summary: 'No license: you may look, but not reuse.', verdict: 'Not reusable without permission',
    };
  }
  // Whole-word match for free text, so "permitted" is not read as "mit".
  const wordMatch = (k) => new RegExp(`(^|[^a-z0-9.+-])${k.replace(/[.+]/g, '\\$&')}($|[^a-z0-9.+-])`).test(text);
  const id = LICENSES[text] ? text : ALIASES[text] || Object.keys(LICENSES).find(k => k !== 'other' && wordMatch(k)) || 'other';
  const info = LICENSES[id];
  const whiteLabel = info.rebrand && info.commercial && ['permissive', 'public-domain', 'responsible-ai'].includes(info.category);
  const verdict = whiteLabel
    ? 'Free to white-label and sell'
    : info.category === 'copyleft' ? 'Rebrand only as open source'
      : info.category === 'weak-copyleft' ? 'Rebrand; keep changes to it open'
        : info.category === 'non-commercial' ? 'Non-commercial only'
          : info.category === 'no-derivatives' ? 'No modified versions'
            : info.category === 'custom-ai' ? 'Allowed under the owner’s terms'
              : 'Check the license first';
  return { id: id === 'other' ? text : id, ...info, whiteLabel, verdict };
}

export const VERDICT_TONE = {
  permissive: 'good', 'public-domain': 'good', 'responsible-ai': 'good',
  'weak-copyleft': 'warn', 'custom-ai': 'warn', copyleft: 'warn',
  'non-commercial': 'bad', 'no-derivatives': 'bad', unknown: 'bad', unlicensed: 'bad',
};
