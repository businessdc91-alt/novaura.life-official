// detect.js — Things about an app's files the OS should know before running it.

const BROWSER_DB = /\bindexedDB\b|(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"](?:dexie|idb|idb-keyval|localforage)(?:\/[^'"]*)?['"]/;

/** True when the app keeps data in a browser database, which an opaque-origin addition can't open. */
export function usesBrowserDatabase(files) {
  return (files || []).some((f) => typeof f?.content === 'string' && BROWSER_DB.test(f.content));
}
