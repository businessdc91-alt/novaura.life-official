// launcherVisibility.js — pure predicate for whether an app shows in the App Launcher. Kept
// React-free so it can be unit-tested. `terminalOnly` apps are HARD-gated: never shown in the
// launcher under any search (they open only via their terminal command). `hidden` apps are
// soft-hidden: out of the normal grid but findable by a name/keyword search, as before.

export function isLauncherVisible(app, search = '', activeCategory = 'all') {
  if (app.terminalOnly) return false;

  const q = String(search).trim().toLowerCase();
  if (app.hidden) {
    const softShown = !!q && (
      q.includes('founder') || q.includes('admin') || q.includes('office') || q.includes('enclave') ||
      app.label.toLowerCase().includes(q)
    );
    if (!softShown) return false;
  }

  const s = String(search).toLowerCase();
  const matchesCategory = activeCategory === 'all' || app.category === activeCategory;
  const matchesSearch = app.label.toLowerCase().includes(s) || app.title.toLowerCase().includes(s);
  return matchesCategory && matchesSearch;
}
