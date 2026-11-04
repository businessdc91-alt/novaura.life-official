import React, { useEffect, useState } from 'react';
import EngineSetup from './engines/EngineSetup.jsx';
import BuiltinAiSetup from './engines/BuiltinAiSetup.jsx';

/**
 * Standalone home for the local AI engines and their models. Other apps (AI
 * Benchmarks' "Get it") hand over { builtinModel } or { hfRepo } to show a model.
 */
export default function AIEnginesWindow({ props: windowProps } = {}) {
  const [request, setRequest] = useState(windowProps?.openId ? windowProps : null);
  useEffect(() => {
    const onContext = (e) => {
      if (e.detail?.appId === 'ai_engines' && e.detail.props?.openId) setRequest(e.detail.props);
    };
    window.addEventListener('novaura:app_context', onContext);
    return () => window.removeEventListener('novaura:app_context', onContext);
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <div className="text-lg font-bold text-white">AI Engines</div>
      <div className="text-[12px] text-slate-400 mb-3">
        AI that runs on your own PC. The built-in AI handles chat, writing and code; the image engine (ComfyUI) makes music, album covers and app icons.
      </div>
      <BuiltinAiSetup request={request} />
      <div className="text-sm font-semibold text-white mt-5 mb-2">Image and music engine</div>
      <EngineSetup />
    </div>
  );
}
