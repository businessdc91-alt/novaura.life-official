import React, { useState } from 'react';
import { CreditCard, ShieldAlert, CheckCircle2, RotateCcw, Truck } from 'lucide-react';
import { PAYMENT_RAILS } from '../../../services/commerce/paymentAdapters.js';
import { formatCentsUsd } from '../../../services/commerce/pricingEngine.js';

export default function PaymentsFulfillmentTab({
  activeStore,
  orders,
  railSettings,
  onSaveRailSettings,
  onUpdateStore,
  onRefundOrder,
  onReleaseOrder,
}) {
  const [statusNotice, setStatusNotice] = useState('');

  if (!activeStore) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
        Create or select a store first to configure payment rails and automated fulfillment guardrails.
      </div>
    );
  }

  const minMarginPct = activeStore.pricingPolicy?.minMarginPct ?? 25;

  const handleRelease = async (order) => {
    await onReleaseOrder(order);
    setStatusNotice(`Order ${order.id} re-evaluated through fulfillment guardrails.`);
    setTimeout(() => setStatusNotice(''), 3500);
  };

  return (
    <div className="space-y-5">
      {/* Multi-Rail Payment Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {PAYMENT_RAILS.map((rail) => {
          const isPrimary = (activeStore.primaryRail || 'square') === rail.id;
          return (
            <div
              key={rail.id}
              className={`p-4 rounded-xl border space-y-2.5 ${
                isPrimary
                  ? 'bg-cyan-950/20 border-cyan-500/50'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-100">{rail.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateStore({ ...activeStore, primaryRail: rail.id })}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border cursor-pointer ${
                    isPrimary
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {isPrimary ? 'PRIMARY RAIL' : 'SET PRIMARY'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {rail.methods.map((m) => (
                  <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                    {m}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">{rail.settlementPath}</p>
            </div>
          );
        })}
      </div>

      {/* Funding Float Mode & Circuit Breakers */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Fulfillment Float Mode &amp; Loss Circuit Breakers</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Fulfillment Funding Policy</label>
            <select
              value={activeStore.fundingMode || 'instant_float'}
              onChange={(e) => onUpdateStore({ ...activeStore, fundingMode: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
            >
              <option value="instant_float">Instant Float (Square Debit / Business Credit Card)</option>
              <option value="hold_until_settled">Hold-Until-Settled (Wait for Payout, True $0 Float)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Min Net Margin Circuit Breaker (%)</label>
            <input
              type="number"
              min={5}
              max={75}
              value={minMarginPct}
              onChange={(e) =>
                onUpdateStore({
                  ...activeStore,
                  pricingPolicy: {
                    ...(activeStore.pricingPolicy || {}),
                    minMarginPct: Math.max(5, Number(e.target.value) || 20),
                  },
                })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg font-mono text-emerald-300"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Stripe Connect / Square Merchant ID (5% Auto-Split)</label>
            <input
              type="text"
              value={railSettings.stripe?.connectAccountId || ''}
              onChange={(e) =>
                onSaveRailSettings({
                  stripe: { ...(railSettings.stripe || {}), connectAccountId: e.target.value.trim() },
                })
              }
              placeholder="acct_... (optional platform Connect ID)"
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-200"
            />
          </div>
        </div>
      </div>

      {statusNotice && (
        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Live Orders Queue */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-cyan-400" />
            <span>Orders &amp; Automated Fulfillment Queue ({orders.length})</span>
          </h3>
        </div>

        {orders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
            No live orders recorded yet. Deploy your exported 24/7 Storefront Server and connect your Square, Stripe, or PayPal webhook to stream paid orders here automatically.
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((ord) => {
              const isHeld = String(ord.status || '').startsWith('HOLD_');
              const isRefunded = ord.status === 'REFUNDED';
              return (
                <div key={ord.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-4 flex-wrap text-xs">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-slate-100">{ord.id}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        isRefunded
                          ? 'bg-slate-800 text-slate-400'
                          : isHeld
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {ord.status}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-300 uppercase">{ord.rail}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Ship to: <span className="text-slate-200">{ord.shipping?.name || 'Unknown'}</span> — {ord.shipping?.address1}, {ord.shipping?.city}, {ord.shipping?.state} {ord.shipping?.postalCode} ({ord.shipping?.country})
                    </div>
                    {ord.guardrailReason && (
                      <div className="text-[10px] text-amber-300/90">{ord.guardrailReason}</div>
                    )}
                    {ord.settlement && (
                      <div className="text-[10px] font-mono text-slate-400">
                        Gross {formatCentsUsd(ord.settlement.grossRevenueCents)} &bull; Supplier {formatCentsUsd(ord.settlement.supplierCostCents)} &bull; 5% Fee {formatCentsUsd(ord.settlement.platformProfitFeeCents)} &bull; Net {formatCentsUsd(ord.settlement.merchantNetProfitCents)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isHeld && (
                      <button
                        type="button"
                        onClick={() => handleRelease(ord)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                      >
                        Verify &amp; Release
                      </button>
                    )}
                    {!isRefunded && (
                      <button
                        type="button"
                        onClick={() => onRefundOrder(ord)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 border border-rose-500/30 rounded-lg text-[11px] cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Refund</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

