import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { isPopoutWindow, startWindowBridge } from './services/popoutWindows.js'

// Proactively unregister any legacy service workers or stale caches from past web sessions
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
}
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((keys) => {
    for (const key of keys) {
      caches.delete(key);
    }
  }).catch(() => {});
}

// Relays UI events between the desktop and any pop-out windows.
startWindowBridge();

// A pop-out window loads just its one app, not the desktop and its boot-time services.
const root = isPopoutWindow() ? import('./components/PopoutHost.jsx') : import('./App.jsx');
root.then(({ default: Root }) => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
})
