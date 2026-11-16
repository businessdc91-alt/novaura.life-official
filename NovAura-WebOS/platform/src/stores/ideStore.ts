import { create } from 'zustand';

export interface TerminalLine {
  id: string;
  type: 'system' | 'command' | 'output' | 'success' | 'error' | 'info' | 'build';
  text: string;
}

const DEFAULT_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Genesis Project Alpha</title>
    <style>
        body {
            margin: 0;
            background: #0A0A0F;
            color: white;
            font-family: sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
        }
        .container {
            text-align: center;
            border: 1px solid rgba(0, 240, 255, 0.2);
            padding: 2rem;
            border-radius: 20px;
            background: rgba(18, 18, 26, 0.8);
            box-shadow: 0 0 40px rgba(0, 240, 255, 0.1);
        }
        h1 { color: #00F0FF; margin-bottom: 0.5rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Nova Genesis</h1>
        <p>Your neural project is ready for deployment.</p>
    </div>
</body>
</html>`;

interface IDEState {
  editorCode: string;
  setEditorCode: (code: string) => void;

  pipelineStatus: 'idle' | 'running' | 'complete' | 'error';
  setPipelineStatus: (status: IDEState['pipelineStatus']) => void;

  pipelineIteration: number;
  setPipelineIteration: (n: number) => void;

  builderBotActive: boolean;
  setBuilderBotActive: (active: boolean) => void;

  terminalLines: TerminalLine[];
  addTerminalLine: (line: Omit<TerminalLine, 'id'>) => void;
  clearTerminal: () => void;

  showSplash: boolean;
  dismissSplash: () => void;
}

export const useIDEStore = create<IDEState>((set) => ({
  editorCode: DEFAULT_CODE,
  setEditorCode: (editorCode) => set({ editorCode }),

  pipelineStatus: 'idle',
  setPipelineStatus: (pipelineStatus) => set({ pipelineStatus }),

  pipelineIteration: 0,
  setPipelineIteration: (pipelineIteration) => set({ pipelineIteration }),

  builderBotActive: false,
  setBuilderBotActive: (builderBotActive) => set({ builderBotActive }),

  terminalLines: [
    { id: '1', type: 'system', text: 'NovAura Genesis Terminal [Version 2.4.102]' },
    { id: '2', type: 'system', text: '(c) 2026 NovauraVerse Ecosystem. All rights reserved.' },
    { id: '3', type: 'system', text: '' },
    { id: '4', type: 'system', text: '[SYSTEM] Booting Neural Node 0x9f... OK' },
    { id: '5', type: 'system', text: '[SYSTEM] Syncing Genesis Swarm... CONNECTED' },
    { id: '6', type: 'system', text: '[SYSTEM] BuilderBot pipeline ready.' },
  ],
  addTerminalLine: (line) =>
    set((state) => ({
      terminalLines: [
        ...state.terminalLines,
        { ...line, id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}` },
      ],
    })),
  clearTerminal: () => set({ terminalLines: [] }),

  showSplash: true,
  dismissSplash: () => set({ showSplash: false }),
}));
