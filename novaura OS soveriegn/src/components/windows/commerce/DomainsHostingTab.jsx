import React, { useState, useMemo } from 'react';
import {
  Globe, Radio, Download, Search, CheckCircle2, XCircle,
  ExternalLink, Copy, Check, Eye
} from 'lucide-react';
import {
  buildStoreRoutes,
  generateCheapestDomainCandidates,
  checkDomainAvailability,
} from '../../../services/commerce/domainService.js';
import { formatCentsUsd } from '../../../services/commerce/pricingEngine.js';
import { buildStandaloneStorefrontHtml } from '../../../services/commerce/storefrontBuilder.js';
import {
  getRegistrarCredentials,
  saveRegistrarCredentials,
  publishStoreToNovaMesh,
  exportDeployableServerZip,
  saveDomainRecord,
} from '../../../services/commerce/commerceStoreService.js';

function downloadBytes(filename, bytes, mime = 'application/zip') {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DomainsHostingTab({
  kernel,
  activeStore,
  products,
  railSettings,
  onSaveRailSettings,
  onUpdateStore,
}) {
  const [registrar, setRegistrar] = useState('rdap');
  const [regCreds, setRegCreds] = useState(() => getRegistrarCredentials());
  const [tldMarkupUsd, setTldMarkupUsd] = useState(() => ((railSettings.tldMarkupCents ?? 200) / 100).toFixed(2));
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [checkingDomain, setCheckingDomain] = useState('');
  const [publishingMesh, setPublishingMesh] = useState(false);
  const [meshStatus, setMeshStatus] = useState('');
  const [exportingZip, setExportingZip] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const routes = useMemo(() => {
    if (!activeStore) return null;
    return buildStoreRoutes({
      slug: activeStore.slug,
      customDomain: activeStore.customDomain,
      meshDomain: activeStore.meshDomain,
      platformHost: railSettings.platformHost,
    });
  }, [activeStore, railSettings.platformHost]);

  const candidates = useMemo(() => {
    if (!activeStore) return [];
    const markupCents = Math.max(0, Math.round((Number(tldMarkupUsd) || 0) * 100));
    return generateCheapestDomainCandidates({
      storeName: activeStore.name,
      niche: activeStore.niche,
      tldMarkupCents: markupCents,
      maxResults: 9,
    });
  }, [activeStore, tldMarkupUsd]);

  const previewHtml = useMemo(() => {
    if (!activeStore || !showPreview) return '';
    return buildStandaloneStorefrontHtml({
      store: activeStore,
      products,
      mode: activeStore.customDomain ? 'custom_tld' : 'subpath',
      apiBaseUrl: railSettings.liveBackendUrl
        ? `${String(railSettings.liveBackendUrl).replace(/\/+$/, '')}/api/stores/${activeStore.slug}`
        : '',
    });
  }, [activeStore, products, showPreview, railSettings.liveBackendUrl]);

  if (!activeStore) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
        Create or select a store first to configure `.nova` Mesh, `novaura.xyz` subpath, or cheapest TLD domains.
      </div>
    );
  }

  const copyText = (key, text) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1800);
  };

  const handleCheckDomain = async (domain) => {
    setCheckingDomain(domain);
    try {
      const markupCents = Math.max(0, Math.round((Number(tldMarkupUsd) || 0) * 100));
      const res = await checkDomainAvailability({
        domain,
        registrar,
        credentials: regCreds[registrar] || {},
        tldMarkupCents: markupCents,
      });
      setAvailabilityMap(prev => ({ ...prev, [domain]: res }));
      await saveDomainRecord({
        storeId: activeStore.id,
        domain,
        registrar: res.registrar,
        status: res.available ? 'available' : 'taken',
        wholesaleCents: res.wholesaleCents,
        customerPriceCents: res.customerPriceCents,
      });
    } catch (err) {
      setAvailabilityMap(prev => ({ ...prev, [domain]: { error: err?.message || 'Check failed.' } }));
    } finally {
      setCheckingDomain('');
    }
  };

  const handlePublishMesh = async () => {
    setPublishingMesh(true);
    setMeshStatus('');
    try {
      const { store, siteRecord, htmlLength } = await publishStoreToNovaMesh(activeStore.id);
      await onUpdateStore(store);
      setMeshStatus(`Published signed .nova mesh store (${Math.round(htmlLength / 1024)} KB) • CID ${siteRecord.cid}`);
    } catch (err) {
      setMeshStatus(`Mesh publish error: ${err?.message || err}`);
    } finally {
      setPublishingMesh(false);
    }
  };

  const handleExportServerZip = async () => {
    setExportingZip(true);
    try {
      const { bytes } = await exportDeployableServerZip({ platformHost: railSettings.platformHost });
      downloadBytes(`novaura-commerce-server-${activeStore.slug}.zip`, bytes);
    } finally {
      setExportingZip(false);
    }
  };

  const updateRegCred = (field, val) => {
    const next = saveRegistrarCredentials(registrar, { ...(regCreds[registrar] || {}), [field]: val });
    setRegCreds({ ...next });
  };

  return (
    <div className="space-y-5">
      {/* Dual Hosting Command Deck: .nova Mesh + Subpath + 24/7 Server Export */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* .nova Sovereign Mesh Card */}
        <div className="p-4 bg-slate-900/90 border border-emerald-500/30 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-4 h-4" />
              <span>Sovereign `.nova` Mesh Hosting</span>
            </h3>
            {activeStore.meshCid && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ACTIVE ON MESH
              </span>
            )}
          </div>

          <div className="text-xs space-y-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Mesh Domain (.nova / .aura)</label>
              <input
                type="text"
                value={activeStore.meshDomain || ''}
                onChange={(e) => onUpdateStore({ ...activeStore, meshDomain: e.target.value.trim().toLowerCase() })}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg font-mono text-emerald-300"
              />
            </div>

            {routes && (
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="truncate text-emerald-300">{routes.mesh.url}</span>
                <button
                  type="button"
                  onClick={() => copyText('mesh', routes.mesh.url)}
                  className="text-slate-400 hover:text-cyan-300 shrink-0"
                >
                  {copiedKey === 'mesh' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={handlePublishMesh}
                disabled={publishingMesh}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {publishingMesh ? 'Signing & Broadcasting...' : 'Publish Signed Store to .nova Mesh'}
              </button>
              {activeStore.meshCid && (
                <button
                  type="button"
                  onClick={() => kernel?.wm?.openWindow?.('browser', { url: routes.mesh.url })}
                  className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs border border-slate-700 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open</span>
                </button>
              )}
            </div>

            {meshStatus && <div className="text-[11px] font-mono text-cyan-300 break-all">{meshStatus}</div>}
          </div>
        </div>

        {/* Public Web Hosting: Subpath + Custom TLD + 24/7 Server Export */}
        <div className="p-4 bg-slate-900/90 border border-cyan-500/30 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-4 h-4" />
              <span>Public Web Hosting (`novaura.xyz` Subpath &amp; TLD)</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Platform Host Domain</label>
              <input
                type="text"
                value={railSettings.platformHost || 'novaura.xyz'}
                onChange={(e) => onSaveRailSettings({ platformHost: e.target.value.trim().toLowerCase() })}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Custom TLD (Optional)</label>
              <input
                type="text"
                value={activeStore.customDomain || ''}
                onChange={(e) => onUpdateStore({ ...activeStore, customDomain: e.target.value.trim().toLowerCase() })}
                placeholder="e.g. ecchibonanza.xyz"
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg font-mono text-amber-300"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Live 24/7 Backend URL (for mesh &amp; checkout API)</label>
            <input
              type="text"
              value={railSettings.liveBackendUrl || ''}
              onChange={(e) => onSaveRailSettings({ liveBackendUrl: e.target.value.trim() })}
              placeholder="https://commerce.novaura.xyz"
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200"
            />
          </div>

          {routes && (
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-2 font-mono text-[11px]">
              <span className="truncate text-cyan-300">{routes.subpath.merchandiseUrl}</span>
              <button
                type="button"
                onClick={() => copyText('subpath', routes.subpath.merchandiseUrl)}
                className="text-slate-400 hover:text-cyan-300 shrink-0"
              >
                {copiedKey === 'subpath' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportServerZip}
              disabled={exportingZip}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportingZip ? 'Packaging...' : 'Export 24/7 Multi-Tenant Server (.zip)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs border border-slate-700 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? 'Hide Preview' : 'Preview Store'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sandboxed Live Storefront Preview */}
      {showPreview && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="text-[11px] font-mono text-slate-400">
            Sandboxed Storefront Preview ({activeStore.name} — {products.length} items)
          </div>
          <iframe
            title="Storefront Preview"
            sandbox="allow-scripts"
            srcDoc={previewHtml}
            className="w-full h-[460px] rounded-lg border border-slate-800 bg-slate-950"
          />
        </div>
      )}

      {/* Cheapest-TLD Autogenerator & Live Registrar Checker */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Cheapest-TLD Auto-Generator &amp; Registrar Pricing</h3>
            <p className="text-[11px] text-slate-400">
              Ranks matching store domains from lowest wholesale TLD upward and applies your transparent platform TLD markup.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <select
              value={registrar}
              onChange={(e) => setRegistrar(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
            >
              <option value="rdap">Public RDAP (Free Availability Check)</option>
              <option value="porkbun">Porkbun API v3 (Live Wholesale Price)</option>
              <option value="cloudflare">Cloudflare Registrar (At-Cost)</option>
              <option value="namecheap">Namecheap API</option>
            </select>
            <label className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>Markup $</span>
              <input
                type="number"
                step="0.50"
                min="0"
                value={tldMarkupUsd}
                onChange={(e) => {
                  setTldMarkupUsd(e.target.value);
                  onSaveRailSettings({ tldMarkupCents: Math.max(0, Math.round((Number(e.target.value) || 0) * 100)) });
                }}
                className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded font-mono text-emerald-300"
              />
            </label>
          </div>
        </div>

        {registrar === 'porkbun' && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <input
              type="password"
              placeholder="Porkbun API Key"
              value={regCreds.porkbun?.apiKey || ''}
              onChange={(e) => updateRegCred('apiKey', e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-200"
            />
            <input
              type="password"
              placeholder="Porkbun Secret API Key"
              value={regCreds.porkbun?.secretApiKey || ''}
              onChange={(e) => updateRegCred('secretApiKey', e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-200"
            />
          </div>
        )}

        {registrar === 'cloudflare' && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <input
              type="password"
              placeholder="Cloudflare API Token"
              value={regCreds.cloudflare?.apiToken || ''}
              onChange={(e) => updateRegCred('apiToken', e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-200"
            />
            <input
              type="text"
              placeholder="Cloudflare Account ID"
              value={regCreds.cloudflare?.accountId || ''}
              onChange={(e) => updateRegCred('accountId', e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-200"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {candidates.map((cand) => {
            const check = availabilityMap[cand.domain];
            return (
              <div key={cand.domain} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-slate-100 truncate">{cand.domain}</span>
                  <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                    {check?.customerPriceCents != null
                      ? formatCentsUsd(check.customerPriceCents)
                      : `~${formatCentsUsd(cand.customerPriceCents)}`}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {check?.priceSource === 'porkbun_live' ? 'Live Porkbun quote' : `${cand.label} (est. + markup)`}
                </div>

                {check && !check.error && (
                  <div className={`text-[11px] flex items-center gap-1 ${check.available ? 'text-emerald-400' : 'text-red-400'}`}>
                    {check.available ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    <span>{check.available ? 'Available' : 'Already Registered'}</span>
                  </div>
                )}
                {check?.error && <div className="text-[10px] text-amber-300">{check.error}</div>}

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCheckDomain(cand.domain)}
                    disabled={checkingDomain === cand.domain}
                    className="flex-1 flex items-center justify-center gap-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] cursor-pointer"
                  >
                    <Search className="w-3 h-3" />
                    <span>{checkingDomain === cand.domain ? 'Checking...' : 'Check Live'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStore({ ...activeStore, customDomain: cand.domain })}
                    className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 rounded text-[11px] border border-cyan-500/30 cursor-pointer"
                  >
                    Bind TLD
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

