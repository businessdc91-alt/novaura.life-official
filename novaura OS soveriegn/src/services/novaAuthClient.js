/**
 * novaAuthClient.js — Zero-Dependency Client SDK for .nova Websites & Cybeni Builds
 * Enables 1-Click "Sign in with NovAura" (SIWN) over postMessage and localStorage.
 * Can be imported in ES6 modules or injected into standard HTML via script tag.
 */

class NovaAuthClientClass {
  constructor() {
    this._session = null;
    this._listeners = new Set();
    this._initStorage();
  }

  _initStorage() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('nova_auth_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          this._session = parsed;
        } else {
          localStorage.removeItem('nova_auth_session');
        }
      }
    } catch {}
  }

  getSession() {
    return this._session;
  }

  isAuthenticated() {
    return Boolean(this._session && (!this._session.expiresAt || Date.now() < this._session.expiresAt));
  }

  onAuthChange(callback) {
    if (typeof callback === 'function') {
      this._listeners.add(callback);
      callback(this._session);
    }
    return () => this._listeners.delete(callback);
  }

  _notify(session) {
    this._session = session;
    this._listeners.forEach(cb => {
      try { cb(session); } catch {}
    });
  }

  /**
   * Request Sign In with NovAura via OS / Browser Sandbox postMessage
   */
  // `nonce`: pass a challenge from your own server and check it when you verify
  // the token (verifySovereignToken(token, { audience, nonce })), so a token
  // can't be replayed from another sign-in.
  async requestLogin({ appName = document.title || 'Sovereign Web App', scopes = ['identity:read', 'node:verify'], timeoutMs = 60000, nonce: siteNonce = null } = {}) {
    if (typeof window === 'undefined') throw new Error('NovaAuthClient requires a browser environment.');

    return new Promise((resolve, reject) => {
      const nonce = siteNonce || ('n_' + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join(''));
      let timer = null;

      const handleMessage = (event) => {
        const data = event.data;
        if (!data || data.type !== 'NOVA_AUTH_RESPONSE') return;
        if (data.nonce !== nonce) return;

        cleanup();

        if (data.success && data.token) {
          const sessionData = {
            token: data.token,
            operator: data.session,
            scopes: data.scopes,
            expiresAt: data.expiresAt,
            authorizedAt: new Date().toISOString(),
          };
          try {
            localStorage.setItem('nova_auth_session', JSON.stringify(sessionData));
          } catch {}
          this._notify(sessionData);
          resolve(sessionData);
        } else {
          reject(new Error(data.error || 'Authorization was rejected by the sovereign operator.'));
        }
      };

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        window.removeEventListener('message', handleMessage);
      };

      window.addEventListener('message', handleMessage);

      timer = setTimeout(() => {
        cleanup();
        reject(new Error('Sign in request timed out. Make sure you are running inside NovAura Sovereign Browser or OS.'));
      }, timeoutMs);

      // Post auth request to parent window (the Sovereign OS / BrowserWindow container)
      const targetWindow = window.parent !== window ? window.parent : window;
      targetWindow.postMessage({
        type: 'NOVA_AUTH_REQUEST',
        domain: window.location.hostname || document.title || 'app.nova',
        appName,
        scopes,
        nonce,
      }, '*');
    });
  }

  logout() {
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem('nova_auth_session'); } catch {}
    }
    this._notify(null);
  }

  /**
   * Automatically render a high-polish, glowing "Sign in with NovAura" button
   */
  renderButton(containerId, options = {}) {
    if (typeof document === 'undefined') return;
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    const render = (session) => {
      container.innerHTML = '';
      if (session && session.operator) {
        const loggedInBox = document.createElement('div');
        loggedInBox.style.cssText = `
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(0, 240, 255, 0.4);
          border-radius: 9999px;
          padding: 6px 16px 6px 8px;
          box-shadow: 0 0 15px rgba(0, 240, 255, 0.15);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          color: #f8fafc;
        `;

        const avatar = document.createElement('div');
        avatar.style.cssText = `
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${session.operator.avatarColor || '#00f0ff'};
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 11px;
          color: #020617;
        `;
        avatar.innerText = (session.operator.handle || 'O')[0].toUpperCase();

        const info = document.createElement('span');
        const strong = document.createElement('strong');
        strong.style.color = '#00f0ff';
        strong.textContent = `@${session.operator.handle}`;
        info.append('Signed in as ', strong);

        const logoutBtn = document.createElement('button');
        logoutBtn.innerText = 'Sign Out';
        logoutBtn.style.cssText = `
          background: transparent;
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #f87171;
          border-radius: 6px;
          padding: 2px 8px;
          font-size: 11px;
          cursor: pointer;
          margin-left: 6px;
          transition: background 0.2s;
        `;
        logoutBtn.onmouseover = () => { logoutBtn.style.background = 'rgba(239, 68, 68, 0.15)'; };
        logoutBtn.onmouseout = () => { logoutBtn.style.background = 'transparent'; };
        logoutBtn.onclick = () => this.logout();

        loggedInBox.appendChild(avatar);
        loggedInBox.appendChild(info);
        loggedInBox.appendChild(logoutBtn);
        container.appendChild(loggedInBox);
      } else {
        const btn = document.createElement('button');
        btn.style.cssText = `
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%);
          color: #ffffff;
          border: 1px solid rgba(0, 240, 255, 0.4);
          border-radius: 8px;
          padding: 9px 18px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 0 15px rgba(2, 132, 199, 0.4);
          transition: all 0.2s ease;
        `;
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>Sign in with NovAura</span>
        `;
        btn.onmouseover = () => {
          btn.style.transform = 'translateY(-1px)';
          btn.style.boxShadow = '0 0 20px rgba(0, 240, 255, 0.6)';
        };
        btn.onmouseout = () => {
          btn.style.transform = 'none';
          btn.style.boxShadow = '0 0 15px rgba(2, 132, 199, 0.4)';
        };
        btn.onclick = async () => {
          btn.disabled = true;
          btn.style.opacity = '0.7';
          try {
            await this.requestLogin(options);
          } catch (e) {
            alert(e.message);
          } finally {
            btn.disabled = false;
            btn.style.opacity = '1';
          }
        };
        container.appendChild(btn);
      }
    };

    render(this._session);
    this.onAuthChange(render);
  }
}

export const NovaAuthClient = new NovaAuthClientClass();

if (typeof window !== 'undefined') {
  window.NovaAuthClient = NovaAuthClient;
  window.NovaAuth = NovaAuthClient;
}

/**
 * Generates the clean self-contained script snippet for automated 1-click injection in Website Builder
 */
export function generateAuthEmbedSnippet(domain = 'app.nova') {
  return `<!-- NovAura Sovereign Decentralized Authentication SDK (SIWN) -->
<script>
(function() {
  window.NovaAuth = {
    session: null,
    getSession: function() {
      try { return JSON.parse(localStorage.getItem('nova_auth_session')); } catch(e) { return null; }
    },
    login: function(appName, scopes, siteNonce) {
      return new Promise(function(resolve, reject) {
        var nonce = siteNonce || ('n_' + Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(12)), function(b) { return ('0' + b.toString(16)).slice(-2); }).join(''));
        function onMsg(e) {
          if (!e.data || e.data.type !== 'NOVA_AUTH_RESPONSE' || e.data.nonce !== nonce) return;
          window.removeEventListener('message', onMsg);
          if (e.data.success) {
            var sess = { token: e.data.token, operator: e.data.session, scopes: e.data.scopes, expiresAt: e.data.expiresAt };
            localStorage.setItem('nova_auth_session', JSON.stringify(sess));
            if (window.onNovaAuthSuccess) window.onNovaAuthSuccess(sess);
            resolve(sess);
          } else {
            reject(new Error(e.data.error || 'Auth declined'));
          }
        }
        window.addEventListener('message', onMsg);
        var target = window.parent !== window ? window.parent : window;
        target.postMessage({
          type: 'NOVA_AUTH_REQUEST',
          domain: ${JSON.stringify(String(domain))},
          appName: appName || document.title || ${JSON.stringify(String(domain))},
          scopes: scopes || ['identity:read', 'node:verify'],
          nonce: nonce
        }, '*');
      });
    },
    logout: function() {
      localStorage.removeItem('nova_auth_session');
      if (window.onNovaAuthLogout) window.onNovaAuthLogout();
    }
  };
})();
</script>`;
}

export default NovaAuthClient;
