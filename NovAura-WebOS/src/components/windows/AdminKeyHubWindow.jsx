/**
 * Admin Key Hub Window
 * Secure API key management for Novaura platform
 * Only accessible by admin users
 */

import React, { useState, useEffect } from 'react';
import { 
  Key, Shield, CheckCircle, XCircle, Eye, EyeOff, 
  Save, RefreshCw, AlertTriangle, Lock, DollarSign,
  Activity, Settings, Database
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const AI_SERVICES = [
  { id: 'gemini', name: 'Google Gemini', icon: '✨', description: 'Primary LLM for chat, text, and image generation' },
  { id: 'vertex', name: 'Google Vertex AI', icon: '🔺', description: 'Imagen, Veo, Lyria via Vertex AI' },
  { id: 'pixai', name: 'PixAI', icon: '🎨', description: 'Anime/character image generation' },
  { id: 'openai', name: 'OpenAI', icon: '🤖', description: 'GPT-4, DALL-E fallback option' },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠', description: 'Claude models for advanced reasoning' },
  { id: 'stability', name: 'Stability AI', icon: '🖼️', description: 'Stable Diffusion models' },
];

export default function AdminKeyHubWindow() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [usage, setUsage] = useState(null);
  const [activeTab, setActiveTab] = useState('keys');

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://us-central1-novaura-systems.cloudfunctions.net/api';

  useEffect(() => {
    fetchServices();
    fetchUsage();
  }, []);

  const fetchServices = async () => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${BACKEND_URL}/admin/keys/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch services');
      
      const data = await response.json();
      setServices(data.services);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchUsage = async () => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${BACKEND_URL}/admin/keys/usage`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch usage');
      
      const data = await response.json();
      setUsage(data.usage);
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    }
  };

  const testKey = async () => {
    if (!apiKey || !selectedService) return;
    
    setTesting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${BACKEND_URL}/admin/keys/${selectedService.id}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey })
      });
      
      const data = await response.json();
      
      if (data.valid) {
        setSuccess(`${selectedService.name} API key is valid!`);
      } else {
        setError('API key validation failed. Please check the key.');
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
      const response = await fetch(`${BACKEND_URL}/admin/keys/${selectedService.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey, enabled: true })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        setApiKey('');
        fetchServices();
      } else {
        setError(data.error || 'Failed to save key');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (serviceId) => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${BACKEND_URL}/admin/keys/${serviceId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      return data;
    } catch (err) {
      return { valid: false, error: err.message };
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-white p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Admin Key Hub</h1>
          <p className="text-sm text-white/50">Manage platform AI service credentials</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('keys')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'keys' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
          }`}
        >
          <Key size={16} /> API Keys
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'usage' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
          }`}
        >
          <Activity size={16} /> Usage & Costs
        </button>
      </div>

      {activeTab === 'keys' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Services List */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-white/70 mb-3">AI Services</h2>
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => {
                  setSelectedService(service);
                  setApiKey('');
                  setError(null);
                  setSuccess(null);
                }}
                className={`w-full p-4 rounded-xl border transition-all text-left ${
                  selectedService?.id === service.id
                    ? 'bg-indigo-500/10 border-indigo-500/50'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{service.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{service.name}</h3>
                      {service.isConfigured ? (
                        <CheckCircle size={14} className="text-green-400" />
                      ) : (
                        <XCircle size={14} className="text-red-400" />
                      )}
                    </div>
                    <p className="text-xs text-white/50 mt-1">{service.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        service.isConfigured 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {service.isConfigured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>
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
                    <p className="text-sm text-white/50">{selectedService.description}</p>
                  </div>
                </div>

                {/* Alert */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3 mb-6">
                  <AlertTriangle className="shrink-0 text-amber-500" size={20} />
                  <div className="text-sm text-amber-200/90">
                    <p className="font-medium text-amber-500 mb-1">Security Warning</p>
                    <p>These keys power the entire platform. Store them securely and rotate regularly.</p>
                  </div>
                </div>

                {/* Key Input */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-2 block">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={`Enter ${selectedService.name} API Key`}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                      >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

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
                      Test Key
                    </button>
                    <button
                      onClick={saveKey}
                      disabled={!apiKey || loading}
                      className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      Save Key
                    </button>
                  </div>

                  {/* Status Messages */}
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
                      {success}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/30">
                <Lock size={48} className="mb-4" />
                <p>Select a service to manage its API key</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Usage Tab */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <Activity size={20} className="text-indigo-400" />
                <span className="text-sm text-white/70">Total API Calls (30d)</span>
              </div>
              <p className="text-2xl font-bold">
                {usage ? Object.values(usage).reduce((sum, s) => sum + s.calls30Days, 0).toLocaleString() : '...'}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign size={20} className="text-green-400" />
                <span className="text-sm text-white/70">Est. Cost (30d)</span>
              </div>
              <p className="text-2xl font-bold">
                ${usage ? Object.values(usage).reduce((sum, s) => sum + s.estimatedCost30Days, 0).toFixed(2) : '...'}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <Database size={20} className="text-blue-400" />
                <span className="text-sm text-white/70">Active Services</span>
              </div>
              <p className="text-2xl font-bold">
                {services.filter(s => s.isConfigured).length} / {services.length}
              </p>
            </div>
          </div>

          {usage && (
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-white/70">Service</th>
                    <th className="text-right p-4 text-sm font-medium text-white/70">Calls (30d)</th>
                    <th className="text-right p-4 text-sm font-medium text-white/70">Avg/Day</th>
                    <th className="text-right p-4 text-sm font-medium text-white/70">Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usage).map(([serviceId, data]) => (
                    <tr key={serviceId} className="border-t border-white/5">
                      <td className="p-4">
                        <span className="font-medium">{data.service}</span>
                      </td>
                      <td className="p-4 text-right">{data.calls30Days.toLocaleString()}</td>
                      <td className="p-4 text-right">{data.avgPerDay}</td>
                      <td className="p-4 text-right">${data.estimatedCost30Days.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
