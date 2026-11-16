// useStudio.js — Read the Creative Studio store from React.
// The selector must return something that only changes when the store changes
// (a piece of state, not a newly built object), or React will re-render forever.
import { useSyncExternalStore } from 'react';

export function useStudio(store, selector = s => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
