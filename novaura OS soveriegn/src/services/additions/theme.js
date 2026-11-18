// theme.js — The OS colors an addition can match. The OS keeps them as CSS variables
// holding HSL triplets (`--background: 0 0% 4%`) on the document root, switched by its
// data-theme attribute; additions get them as ready-to-use `hsl(…)` strings.

const TOKENS = {
  background: '--background',
  foreground: '--foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  accent: '--accent',
  card: '--card',
  cardForeground: '--card-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  border: '--border',
  ring: '--ring',
  destructive: '--destructive',
  success: '--success',
  warning: '--warning',
};

/** { name, mode: 'light' | 'dark', colors } from the document's current variables. */
export function currentTheme(doc = document) {
  const root = doc.documentElement;
  const style = doc.defaultView?.getComputedStyle?.(root);
  const colors = {};
  for (const [name, variable] of Object.entries(TOKENS)) {
    const raw = String(style?.getPropertyValue(variable) || '').trim();
    colors[name] = raw ? `hsl(${raw})` : '';
  }
  const lightness = /(\d+(?:\.\d+)?)%\s*$/.exec(String(style?.getPropertyValue('--background') || '').trim());
  const mode = lightness && Number(lightness[1]) > 50 ? 'light' : 'dark';
  return { name: root?.getAttribute?.('data-theme') || 'default', mode, colors };
}

/** Call fn(theme) whenever the OS theme changes; returns a function that stops it. */
export function subscribeTheme(fn, doc = document) {
  const Observer = doc.defaultView?.MutationObserver;
  if (!Observer) return () => {};
  const observer = new Observer(() => fn(currentTheme(doc)));
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  return () => observer.disconnect();
}
