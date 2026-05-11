import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Copy, Check, ShieldCheck, Zap, 
  Smartphone, Mail, MessageSquare, ExternalLink,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { MANUAL_PAYMENTS } from '../config/paymentConfig';

export default function ManualPaymentModal({ isOpen, onClose, tier }) {
  const [copied, setCopied] = useState(null);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success(`${type} handle copied!`);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={`relative w-full max-w-lg bg-[#0a0a12] border rounded-[2rem] overflow-hidden shadow-2xl ${
            tier?.isHighRoller 
              ? 'border-slate-400/30 shadow-slate-400/20' 
              : 'border-white/10 shadow-cyan-500/10'
          }`}
        >
          {/* Header */}
          <div className="p-8 pb-4">
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/40" />
            </button>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Direct Fulfillment</h3>
                <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Alternative Payment Methods</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 mb-6">
              <p className="text-sm text-cyan-200/70 leading-relaxed">
                You are purchasing the <span className="text-white font-bold">{tier?.name || 'Founders Pass'}</span>. 
                Direct payments are processed manually by our team to bypass standard gateway delays.
              </p>
            </div>
          </div>

          {/* Handles */}
          <div className="px-8 space-y-3">
            {/* Cash App */}
            <div className="group relative flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#00d54b]/10 flex items-center justify-center text-[#00d54b] font-black text-xl">
                  $
                </div>
                <div>
                  <div className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">Cash App</div>
                  <div className="text-sm font-mono font-bold text-white/90">{MANUAL_PAYMENTS.cashApp.handle}</div>
                </div>
              </div>
              <button 
                onClick={() => handleCopy(MANUAL_PAYMENTS.cashApp.handle, 'Cash App')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
              >
                {copied === 'Cash App' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Chime */}
            <div className="group relative flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-400/30 hover:bg-emerald-400/5 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#25da73]/10 flex items-center justify-center text-[#25da73] font-black text-xs uppercase">
                  Chime
                </div>
                <div>
                  <div className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">Chime Pay</div>
                  <div className="text-sm font-mono font-bold text-white/90">{MANUAL_PAYMENTS.chime.handle}</div>
                </div>
              </div>
              <button 
                onClick={() => handleCopy(MANUAL_PAYMENTS.chime.handle, 'Chime')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
              >
                {copied === 'Chime' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Venmo */}
            <div className="group relative flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#3d95ce]/10 flex items-center justify-center text-[#3d95ce] font-black text-xl">
                  V
                </div>
                <div>
                  <div className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">Venmo</div>
                  <div className="text-sm font-mono font-bold text-white/90">{MANUAL_PAYMENTS.venmo.handle}</div>
                </div>
              </div>
              <button 
                onClick={() => handleCopy(MANUAL_PAYMENTS.venmo.handle, 'Venmo')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
              >
                {copied === 'Venmo' ? <Check className="w-4 h-4 text-blue-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Verification Steps */}
          <div className="p-8">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-white/40">
              <Info className="w-5 h-5 shrink-0 text-cyan-400 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="text-white font-bold block mb-1 uppercase tracking-widest">Verification Protocol:</span>
                1. Send the payment for <span className="text-white font-bold">{tier?.price || '$200'}</span>.<br/>
                2. Include your <span className="text-white font-bold">Platform Username</span> in the payment note.<br/>
                3. {tier?.isHighRoller ? 'A private meeting will be scheduled immediately after.' : 'Your account will be upgraded within 5-10 minutes.'}
              </div>
            </div>
            
            {tier?.isHighRoller && (
              <button
                onClick={() => window.open('mailto:dillan.copeland@novaura.xyz?subject=Catalyst Crew Inquiry', '_blank')}
                className="w-full mt-4 py-4 rounded-2xl bg-white text-black font-bold text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Schedule Private Meeting
              </button>
            )}

            <button
              onClick={onClose}
              className={`w-full mt-3 py-4 rounded-2xl font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 ${
                tier?.isHighRoller 
                  ? 'bg-slate-500 text-white shadow-slate-500/20' 
                  : 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              I've Sent the Payment
            </button>
            
            <p className="text-[9px] text-center text-white/20 mt-4 uppercase tracking-[0.2em]">
              Encrypted Direct Fulfillment Channel
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
