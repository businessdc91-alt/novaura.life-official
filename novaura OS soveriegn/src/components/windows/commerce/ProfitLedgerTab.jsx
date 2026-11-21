import React from 'react';
import { TrendingUp, Download } from 'lucide-react';
import { summarizeLedger, formatCentsUsd } from '../../../services/commerce/pricingEngine.js';

function exportLedgerCsv(entries) {
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = 'id,createdAt,storeId,orderId,type,rail,amountUsd';
  const rows = entries.map(e =>
    [e.id, e.createdAt, e.storeId, e.orderId || '', e.type, e.rail || '', ((Number(e.amountCents) || 0) / 100).toFixed(2)]
      .map(esc)
      .join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novaura-commerce-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ProfitLedgerTab({ stores, activeStore, ledgerEntries }) {
  const storeEntries = activeStore
    ? ledgerEntries.filter(e => e.storeId === activeStore.id)
    : ledgerEntries;
  const activePnl = summarizeLedger(storeEntries);
  const platformPnl = summarizeLedger(ledgerEntries);

  const kpis = [
    { label: 'Gross Revenue', value: formatCentsUsd(activePnl.grossRevenueCents), tone: 'text-slate-100' },
    { label: 'Supplier + Shipping', value: formatCentsUsd(activePnl.supplierCostCents + activePnl.shippingCostCents), tone: 'text-amber-300' },
    { label: 'Gateway Fees', value: formatCentsUsd(activePnl.gatewayFeesCents), tone: 'text-slate-300' },
    { label: 'Paid Ad Spend', value: formatCentsUsd(activePnl.adSpendCents), tone: 'text-purple-300' },
    { label: 'Platform 5% Profit Split', value: formatCentsUsd(activePnl.platformProfitFeeCents), tone: 'text-cyan-300' },
    { label: 'Merchant Net Profit', value: formatCentsUsd(activePnl.merchantNetProfitCents), tone: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-5">
      {/* Store KPI Strip */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>{activeStore ? `${activeStore.name} Live P&L` : 'All Stores Live P&L'}</span>
        </h3>
        <button
          type="button"
          onClick={() => exportLedgerCsv(storeEntries)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs border border-slate-700 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Accounting CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {kpis.map((k) => (
          <div key={k.label} className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase">{k.label}</div>
            <div className={`text-base font-extrabold font-mono mt-1 ${k.tone}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Multi-Tenant Platform Rollup (5% Profit Share Across All Hosted Stores) */}
      <div className="p-4 bg-slate-900/90 border border-cyan-500/30 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
            Platform Multi-Tenant Rollup ({stores.length} Storefronts)
          </span>
          <span className="text-xs font-mono text-emerald-400 font-bold">
            Total 5% Platform Earnings: {formatCentsUsd(platformPnl.platformProfitFeeCents)}
          </span>
        </div>
        <div className="divide-y divide-slate-800 bg-slate-950 rounded-lg border border-slate-800 px-3 text-xs">
          {stores.length === 0 ? (
            <div className="py-4 text-center text-slate-500">No stores provisioned yet.</div>
          ) : (
            stores.map((s) => {
              const pnl = summarizeLedger(ledgerEntries.filter(e => e.storeId === s.id));
              return (
                <div key={s.id} className="py-2 flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="text-slate-100 font-sans font-semibold truncate">{s.name} (/{s.slug})</span>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-slate-400">Rev {formatCentsUsd(pnl.grossRevenueCents)}</span>
                    <span className="text-cyan-300">5% {formatCentsUsd(pnl.platformProfitFeeCents)}</span>
                    <span className="text-emerald-400">Net {formatCentsUsd(pnl.merchantNetProfitCents)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Immutable Ledger Audit Feed */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Double-Entry Accounting Ledger ({storeEntries.length} records)
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60 bg-slate-950 rounded-xl border border-slate-800 px-3">
          {storeEntries.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Ledger is empty. Recorded sales, supplier purchases, refunds, and 5% profit splits appear here automatically.
            </div>
          ) : (
            storeEntries.map((e) => (
              <div key={e.id} className="py-2 flex items-center justify-between gap-2 text-[11px] font-mono">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">{e.type}</span>
                  <span className="text-slate-400 truncate">{e.orderId || e.rail || 'manual'}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={e.amountCents >= 0 ? 'text-emerald-400 font-bold' : 'text-amber-300'}>
                    {formatCentsUsd(e.amountCents)}
                  </span>
                  <span className="text-slate-600">{String(e.createdAt || '').slice(0, 19).replace('T', ' ')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

