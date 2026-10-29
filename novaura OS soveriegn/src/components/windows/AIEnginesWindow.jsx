import React from 'react';
import EngineSetup from './engines/EngineSetup.jsx';

/** Standalone home for the local AI engine and its models. */
export default function AIEnginesWindow() {
  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <div className="text-lg font-bold text-white">AI Engines</div>
      <div className="text-[12px] text-slate-400 mb-3">
        Install ComfyUI and models with one click. Music Studio, album covers and app icons all run on this engine, on your own PC.
      </div>
      <EngineSetup />
    </div>
  );
}
