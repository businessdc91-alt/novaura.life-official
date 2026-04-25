/**
 * User Key Hub Window
 * Premium users ($29.99+ tier) can add their own API keys
 * Keys are encrypted and stored securely
 */

import React, { useState, useEffect } from 'react';
import {
  Key, Crown, CheckCircle, XCircle, Eye, EyeOff,
  Save, RefreshCw, ExternalLink, Trash2, Sparkles,
  Lock, AlertCircle, Zap
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const USER_SERVICES = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '💎',
    description: 'Use your own Gemini 1.5, 2.0, or 3.0 credits from Google AI Studio',
    keyPlaceholder: 'AIza...',
    website: 'https://aistudio.google.com/app/apikey',
    benefits: ['Gemini 1.5 Pro/Flash', '1M+ context window', 'Native multimodal support']
  },
  {
    id: 'kimi',
    name: 'Kimi / Moonshot',
    icon: '🎋',
    description: 'Use your own Kimi/Moonshot AI credits for advanced linguistic reasoning',
    keyPlaceholder: 'sk-...',
    website: 'https://platform.moonshot.cn/',
    benefits: ['Kimi k2.6 model support', 'Superior Chinese/English logic', 'Long-form reasoning']
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: '🧠',
    description: 'Use your own Claude 3.5 Sonnet or Opus credits',
    keyPlaceholder: 'sk-ant-...',
    website: 'https://console.anthropic.com/',
    benefits: ['Claude 3.5 Sonnet', 'Top-tier coding performance', 'Human-like reasoning']
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    icon: '🎙️',
    description: 'Use your own voice synthesis credits',
    keyPlaceholder: 'Enter your API key',
    website: 'https://elevenlabs.io/app/settings/api-keys',
    benefits: ['Professional voice cloning', 'Ultra-realistic synthesis', 'Multi-language support']
  }
];

export default function UserKeyHubWindow() {
  const { user, tier } = useAuth();
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userTier, setUserTier] = useState(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://us-central1-novaura-systems.cloudfunctions.net/api';
  const MIN_TIER_LEVEL = 3; // Catalyst = $29.99 (0:free, 1:spark, 2:emergent, 3:catalyst)

  useEffect(() => {
    checkTier();
  }, [tier]);

  const checkTier = async () => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${BACKEND_URL}/user/keys/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      setUserTier(data.minTierName);

      // Initialize services
      const initialized = USER_SERVICES.map(s => ({
        ...s,
        configured: false,
        masked: null
      }));
      setServices(initialized);

      // If premium, fetch their keys
      if (tier && ['catalyst', 'nova', 'catalytic-crew'].includes(tier)) {
        fetchUserKeys();
      }
    } catch (err) {
      setError('Failed to load service information');
    }
  };

  const fetchUserKeys = async () => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${BACKEND_URL}/user/keys`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch keys');

      const data = await response.json();

      // Update services with user key status
      setServices(prev => prev.map(s => ({
        ...s,
        configured: data.keys[s.id]?.configured || false,
        masked: data.keys[s.id]?.masked || null,
        addedAt: data.keys[s.id]?.addedAt || null
      })));
    } catch (err) {
      console.error('Failed to fetch user keys:', err);
    }
  };

  const testKey = async () => {
    if (!apiKey || !selectedService) return;

    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${BACKEND_URL}/user/keys/${selectedService.id}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey })
      });

      const data = await response.json();

      if (data.valid) {
        setSuccess(`${selectedService.name} API key is valid and working!`);
      } else {
        setError('API key validation failed. Please check your key.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const saveKey = async () => {
    if (!apiKey || !selectedService) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await user.getIdToken();
      const payload = selectedService.hasEndpoint
        ? { apiKey: `${apiKey}|${endpoint}`, provider: selectedService.id }
        : { apiKey };

      const response = await fetch(`${BACKEND_URL}/user/keys/${selectedService.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setApiKey('');
        fetchUserKeys();
      } else {
        setError(data.error || 'Failed to save key');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteKey = async () => {
    if (!selectedService) return;

    if (!window.confirm(`Remove your ${selectedService.name} API key?`)) return;

    setDeleting(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${BACKEND_URL}/user/keys/${selectedService.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        fetchUserKeys();
        setSelectedService(null);
      } else {
        setError(data.error || 'Failed to remove key');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Check if user has required tier
  const hasRequiredTier = ['catalyst', 'nova', 'catalytic-crew', 'catalyst-crew-founders', 'founding-father', 'council-member', 'strategic-investor', 'founding-catalyst', 'founding-nova'].includes(tier) ||
    ['lostitonce420@gmail.com', 'dillan.copeland@novaura.xyz'].includes(user?.email);

  if (!hasRequiredTier) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0a0a0f] text-white p-8">
        <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-6">
          <Crown className="w-10 h-10 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Premium Feature</h2>
        <p className="text-white/50 text-center max-w-md mb-6">
          Connect your own API keys to use your own credits and bypass platform limits.
          Available on Catalyst tier ($29.99/month) and above.
        </p>
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 w-full max-w-md">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-amber-400" />
            Benefits of bringing your own keys:
          </h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-center gap-2">
              <Zap size={14} className="text-green-400" />
              No credit limits from Novaura
            </li>
            <li className="flex items-center gap-2">
              <Zap size={14} className="text-green-400" />
              Access to latest models immediately
            </li>
            <li className="flex items-center gap-2">
              <Zap size={14} className="text-green-400" />
              Priority processing queues
            </li>
            <li className="flex items-center gap-2">
              <Zap size={14} className="text-green-400" />
              Use multiple providers simultaneously
            </li>
          </ul>
        </div>
        <button className="mt-6 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-medium transition-colors">
          Upgrade to Catalyst
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-white p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <Key className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Your API Keys</h1>
          <p className="text-sm text-white/50">Connect your own AI service accounts</p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
            <Crown size={12} />
            {tier?.charAt(0).toUpperCase() + tier?.slice(1)} Tier
          </div>
          {['lostitonce420@gmail.com', 'dillan.copeland@novaura.xyz'].includes(user?.email) && (
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
              <Zap className="w-2.5 h-2.5" /> Unlimited Credits
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Services List */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-white/70 mb-3">Available Services</h2>
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => {
                setSelectedService(service);
                setApiKey('');
                setEndpoint('');
                setError(null);
                setSuccess(null);
              }}
              className={`w-full p-4 rounded-xl border transition-all text-left ${selectedService?.id === service.id
                  ? 'bg-amber-500/10 border-amber-500/50'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{service.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{service.name}</h3>
                    {service.configured ? (
                      <CheckCircle size={14} className="text-green-400" />
                    ) : null}
                  </div>
                  <p className="text-xs text-white/50 mt-1">{service.description}</p>
                  {service.configured && service.masked && (
                    <p className="text-xs text-green-400 mt-2 font-mono">
                      {service.masked}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Key Management */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          {selectedService ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">{selectedService.icon}</span>
                <div>
                  <h2 className="text-lg font-medium">{selectedService.name}</h2>
                  <a
                    href={selectedService.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    Get API key <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Benefits */}
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-indigo-400 mb-2">Benefits</h4>
                <ul className="space-y-1">
                  {selectedService.benefits.map((benefit, i) => (
                    <li key={i} className="text-xs text-white/70 flex items-center gap-2">
                      <Sparkles size={12} className="text-indigo-400" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key Input */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-white/70 mb-2 block">
                    Your API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={selectedService.keyPlaceholder}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {selectedService.hasEndpoint && (
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-2 block">
                      Endpoint URL
                    </label>
                    <input
                      type="text"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder={selectedService.endpointPlaceholder}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={testKey}
                    disabled={!apiKey || testing}
                    className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {testing ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    Test
                  </button>
                  <button
                    onClick={saveKey}
                    disabled={!apiKey || loading}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Save Key
                  </button>
                </div>

                {selectedService.configured && (
                  <button
                    onClick={deleteKey}
                    disabled={deleting}
                    className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Remove Key
                  </button>
                )}

                {/* Status Messages */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-start gap-2">
                    <CheckCircle size={16} className="shrink-0 mt-0.5" />
                    {success}
                  </div>
                )}

                {/* Security Note */}
                <div className="flex items-start gap-2 p-3 bg-white/5 rounded-lg">
                  <Lock size={14} className="text-white/50 shrink-0 mt-0.5" />
                  <p className="text-xs text-white/50">
                    Your API key is encrypted and stored securely. Novaura never shares or uses your key for other users.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-white/30">
              <Key size={48} className="mb-4" />
              <p>Select a service to add your API key</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
