// offlineShims.js — Offline-resilient UI styling fallback and unified line diff utility
// for Cybeni previews and code review diffs.

/**
 * Compact utility CSS stylesheet injected into Cybeni previews ONLY when
 * cdn.tailwindcss.com fails to load (offline mode / blocked external network).
 */
export const OFFLINE_TAILWIND_FALLBACK_CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5}
.min-h-screen{min-height:100vh}.h-full{height:100%}.w-full{width:100%}.h-screen{height:100vh}
.max-w-md{max-width:28rem}.max-w-lg{max-width:32rem}.max-w-xl{max-width:36rem}.max-w-2xl{max-width:42rem}.max-w-4xl{max-width:56rem}.max-w-6xl{max-width:72rem}
.mx-auto{margin-left:auto;margin-right:auto}.my-2{margin-top:.5rem;margin-bottom:.5rem}.my-4{margin-top:1rem;margin-bottom:1rem}
.mt-1{margin-top:.25rem}.mt-2{margin-top:.5rem}.mt-3{margin-top:.75rem}.mt-4{margin-top:1rem}.mt-6{margin-top:1.5rem}
.mb-1{margin-bottom:.25rem}.mb-2{margin-bottom:.5rem}.mb-4{margin-bottom:1rem}.ml-auto{margin-left:auto}.mr-2{margin-right:.5rem}
.p-2{padding:.5rem}.p-3{padding:.75rem}.p-4{padding:1rem}.p-6{padding:1.5rem}.p-8{padding:2rem}
.px-2{padding-left:.5rem;padding-right:.5rem}.px-3{padding-left:.75rem;padding-right:.75rem}.px-4{padding-left:1rem;padding-right:1rem}.px-6{padding-left:1.5rem;padding-right:1.5rem}
.py-1{padding-top:.25rem;padding-bottom:.25rem}.py-1\\.5{padding-top:.375rem;padding-bottom:.375rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}.py-3{padding-top:.75rem;padding-bottom:.75rem}.py-4{padding-top:1rem;padding-bottom:1rem}
.flex{display:flex}.inline-flex{display:inline-flex}.grid{display:grid}.block{display:block}.inline-block{display:inline-block}.hidden{display:none}
.flex-col{flex-direction:column}.flex-row{flex-direction:row}.flex-wrap{flex-wrap:wrap}.flex-1{flex:1 1 0%}.shrink-0{flex-shrink:0}
.items-center{align-items:center}.items-start{align-items:flex-start}.items-end{align-items:flex-end}
.justify-center{justify-content:center}.justify-between{justify-content:space-between}.justify-end{justify-content:flex-end}
.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.gap-1{gap:.25rem}.gap-2{gap:.5rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}.gap-6{gap:1.5rem}
.space-y-2>*+*{margin-top:.5rem}.space-y-3>*+*{margin-top:.75rem}.space-y-4>*+*{margin-top:1rem}
.space-x-2>*+*{margin-left:.5rem}.space-x-3>*+*{margin-left:.75rem}
.text-xs{font-size:.75rem}.text-sm{font-size:.875rem}.text-base{font-size:1rem}.text-lg{font-size:1.125rem}.text-xl{font-size:1.25rem}.text-2xl{font-size:1.5rem}.text-3xl{font-size:1.875rem}.text-4xl{font-size:2.25rem}
.font-medium{font-weight:500}.font-semibold{font-weight:600}.font-bold{font-weight:700}
.text-center{text-align:center}.text-left{text-align:left}.text-right{text-align:right}
.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rounded{border-radius:.25rem}.rounded-md{border-radius:.375rem}.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}.rounded-2xl{border-radius:1rem}.rounded-full{border-radius:9999px}
.border{border:1px solid #cbd5e1}.border-b{border-bottom:1px solid #cbd5e1}.border-t{border-top:1px solid #cbd5e1}.border-r{border-right:1px solid #cbd5e1}
.shadow{box-shadow:0 1px 3px rgba(0,0,0,.1)}.shadow-md{box-shadow:0 4px 6px rgba(0,0,0,.1)}.shadow-lg{box-shadow:0 10px 15px rgba(0,0,0,.12)}.shadow-xl{box-shadow:0 20px 25px rgba(0,0,0,.15)}
.overflow-hidden{overflow:hidden}.overflow-auto{overflow:auto}.cursor-pointer{cursor:pointer}
.bg-white{background-color:#fff}.bg-slate-50{background-color:#f8fafc}.bg-slate-100{background-color:#f1f5f9}.bg-slate-800{background-color:#1e293b}.bg-slate-900{background-color:#0f172a}.bg-slate-950{background-color:#020617}
.bg-purple-600{background-color:#9333ea}.bg-indigo-600{background-color:#4f46e5}.bg-cyan-600{background-color:#0891b2}.bg-emerald-600{background-color:#059669}.bg-rose-600{background-color:#e11d48}.bg-amber-500{background-color:#f59e0b}
.text-white{color:#fff}.text-slate-900{color:#0f172a}.text-slate-700{color:#334155}.text-slate-500{color:#64748b}.text-slate-400{color:#94a3b8}.text-slate-300{color:#cbd5e1}.text-slate-100{color:#f1f5f9}
.text-purple-600{color:#9333ea}.text-cyan-400{color:#22d3ee}.text-emerald-500{color:#10b981}.text-rose-500{color:#f43f5e}.text-amber-500{color:#f59e0b}
.border-slate-200{border-color:#e2e8f0}.border-slate-700{border-color:#334155}.border-slate-800{border-color:#1e293b}
button,input,select,textarea{font:inherit}
@media(min-width:768px){.md\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.md\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}}
`.trim();

/**
 * Self-contained DOM script injected into preview <head>:
 * if the external Tailwind CDN fails to hydrate styles (e.g. offline), injects the local fallback stylesheet.
 */
export const OFFLINE_TAILWIND_FALLBACK_SCRIPT = `(function(){
  var css = ${JSON.stringify(OFFLINE_TAILWIND_FALLBACK_CSS)};
  function hasTailwind(){
    try{
      var styles=document.querySelectorAll('style');
      for(var i=0;i<styles.length;i++){
        if(styles[i].id!=='cybeni-offline-tw'&&/--tw-/.test(styles[i].textContent||''))return true;
      }
    }catch(e){}
    return false;
  }
  function inject(){
    if(document.getElementById('cybeni-offline-tw')||hasTailwind())return;
    var s=document.createElement('style');
    s.id='cybeni-offline-tw';
    s.textContent=css;
    (document.head||document.documentElement).appendChild(s);
  }
  if(typeof navigator!=='undefined'&&navigator.onLine===false){
    if(document.head)inject();else document.addEventListener('DOMContentLoaded',inject);
  }else{
    window.addEventListener('DOMContentLoaded',function(){setTimeout(inject,900);});
  }
})();`;

const MAX_LCS_CELLS = 450000;

/**
 * Compute a line-by-line diff between two strings.
 * Uses Myers/DP LCS on normal files and cleanly falls back to prefix/suffix diffing on huge files.
 * Returns { lines: [{ type: 'same'|'add'|'del', line, oldLineNo, newLineNo }], added, removed, approximate }.
 */
export function computeLineDiff(beforeText = '', afterText = '') {
  const a = String(beforeText ?? '').replace(/\r\n/g, '\n').split('\n');
  const b = String(afterText ?? '').replace(/\r\n/g, '\n').split('\n');
  if (a.length === 1 && a[0] === '' && String(beforeText ?? '') === '') a.pop();
  if (b.length === 1 && b[0] === '' && String(afterText ?? '') === '') b.pop();

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }

  const lines = [];
  for (let i = 0; i < start; i++) {
    lines.push({ type: 'same', line: a[i], oldLineNo: i + 1, newLineNo: i + 1 });
  }

  const midA = a.slice(start, endA + 1);
  const midB = b.slice(start, endB + 1);
  let added = 0;
  let removed = 0;
  let approximate = false;

  if (midA.length * midB.length > MAX_LCS_CELLS) {
    approximate = true;
    for (let i = 0; i < midA.length; i++) {
      lines.push({ type: 'del', line: midA[i], oldLineNo: start + i + 1, newLineNo: null });
      removed++;
    }
    for (let j = 0; j < midB.length; j++) {
      lines.push({ type: 'add', line: midB[j], oldLineNo: null, newLineNo: start + j + 1 });
      added++;
    }
  } else {
    const m = midA.length;
    const n = midB.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        if (midA[i] === midB[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
    let i = 0;
    let j = 0;
    while (i < m || j < n) {
      if (i < m && j < n && midA[i] === midB[j]) {
        lines.push({ type: 'same', line: midA[i], oldLineNo: start + i + 1, newLineNo: start + j + 1 });
        i++;
        j++;
      } else if (i < m && (j === n || dp[i + 1][j] >= dp[i][j + 1])) {
        lines.push({ type: 'del', line: midA[i], oldLineNo: start + i + 1, newLineNo: null });
        removed++;
        i++;
      } else {
        lines.push({ type: 'add', line: midB[j], oldLineNo: null, newLineNo: start + j + 1 });
        added++;
        j++;
      }
    }
  }

  const tailCount = a.length - 1 - endA;
  for (let k = 0; k < tailCount; k++) {
    const oi = endA + 1 + k;
    const ni = endB + 1 + k;
    lines.push({ type: 'same', line: a[oi], oldLineNo: oi + 1, newLineNo: ni + 1 });
  }

  return { lines, added, removed, approximate };
}

