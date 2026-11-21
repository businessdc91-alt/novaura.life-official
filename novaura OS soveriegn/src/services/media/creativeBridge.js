// creativeBridge.js — Cross-app visual asset handoff bridge across Sovereign OS.
// Enables 1-click routing from Media Foundry / Vault / Card Forge / Comic Studio into:
//   - Creative Studio (layered Photopea-parity editor)
//   - TCG Card Forge (injects artwork directly into the active printable card)
//   - Greeting Card Studio (injects cover art onto foldable mail-ready cards)
//   - Comic & Manga Page Designer (places image into active panel)
//   - Sovereign Commerce Studio (turns artwork/prints into storefront merchandise)

function dispatchAppHandoff(appId, props) {
  if (typeof window === 'undefined') return false;
  const payload = { ...props, openId: `handoff_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` };
  window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId, props: payload, toggle: false } }));
  window.dispatchEvent(new CustomEvent('novaura:app_context', { detail: { appId, props: payload } }));
  return true;
}

export function sendImageToCreativeStudio({ imageUrl, title = 'Generated Artwork' }) {
  return dispatchAppHandoff('creative_studio', { imageUrl, title });
}

export function sendImageToCardForge({ imageUrl, title = '', prompt = '' }) {
  return dispatchAppHandoff('card_forge', { artworkUrl: imageUrl, title, prompt });
}

export function sendImageToGreetingCard({ imageUrl, title = '' }) {
  return dispatchAppHandoff('greeting_card', { coverArtUrl: imageUrl, title });
}

export function sendImageToBusinessCard({ imageUrl, title = '' }) {
  return dispatchAppHandoff('card_creator', { logoUrl: imageUrl, title });
}

export function sendImageToMediaFoundry({ imageUrl, tab = 'video', title = '', prompt = '' }) {
  return dispatchAppHandoff('media_foundry', { sourceImageUrl: imageUrl, tab, title, prompt });
}

export function sendImageToCommerceStudio({ imageUrl, title = '', prompt = '' }) {
  return dispatchAppHandoff('commerce_studio', { assetUrl: imageUrl, title, prompt });
}

