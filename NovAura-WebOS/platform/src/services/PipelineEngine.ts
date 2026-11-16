import { aiOrchestrator, type AIResponse } from './aiOrchestrator';
import { vaultService, type VaultFile } from './vaultService';
import { logicBranchingService, type LogicBranch } from './LogicBranchingService';

export type PipelineStatus = 'idle' | 'running' | 'repairing' | 'validating' | 'consensus_gate' | 'capped' | 'failed';

export interface PipelinePass {
  id: number;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  findings: string[];
  branches: LogicBranch[];
}

export interface PipelineState {
  currentPass: number;
  totalPasses: number;
  status: PipelineStatus;
  history: PipelinePass[];
}

class PipelineEngine {
  private state: PipelineState = {
    currentPass: 0,
    totalPasses: 3,
    status: 'idle',
    history: []
  };

  private subscribers: ((state: PipelineState) => void)[] = [];

  subscribe(callback: (state: PipelineState) => void) {
    this.subscribers.push(callback);
    callback(this.state);
  }

  private notify() {
    this.subscribers.forEach(cb => cb(this.state));
  }

  async startRecursivePipeline(userId: string, projectId: string, projectName: string, files: VaultFile[]) {
    // Audit log
    console.log(`[PIPELINE] User ${userId} starting pipeline for ${projectName} (${projectId})`);
    
    this.state = {
      currentPass: 1,
      totalPasses: 3,
      status: 'running',
      history: [
        { id: 1, label: 'Initial Structural Scan', status: 'active', findings: [], branches: [] }
      ]
    };
    this.notify();

    try {
      // PASS 1: SCAN & BRANCH
      await this.executePass(1, 'SCAN', files);
      
      // PASS 2: RECURSIVE REPAIR (Based on Branching Logic)
      this.state.status = 'repairing';
      this.state.currentPass = 2;
      this.state.history.push({ id: 2, label: 'Recursive Self-Correction', status: 'active', findings: [], branches: [] });
      this.notify();
      await this.executePass(2, 'REPAIR', files);

      // PASS 3: CONSENSUS GATE
      this.state.status = 'consensus_gate';
      this.state.currentPass = 3;
      this.state.history.push({ id: 3, label: 'Consensus Gate (M1+M2+M3)', status: 'active', findings: [], branches: [] });
      this.notify();
      await this.executePass(3, 'CONSENSUS', files);

      this.state.status = 'capped';
      this.state.history.forEach(p => p.status = 'completed');
      this.notify();

      // Mirror state with Vault
      const reportFile: VaultFile = {
        path: 'pipeline_report.json',
        name: 'pipeline_report.json',
        content: JSON.stringify(this.state.history),
        lastSynced: new Date().toISOString(),
        version: 1
      };
      vaultService.mirrorFile(userId, projectId, projectName, reportFile);
    } catch (error) {
      this.state.status = 'failed';
      this.notify();
      throw error;
    }
  }

  private async executePass(passNum: number, type: 'SCAN' | 'REPAIR' | 'CONSENSUS', files: VaultFile[]) {
    const prompt = `PIPELINE_PASS_${type}: Analyzing ${files.length} files. Pass ${passNum}/3.`;
    const response: AIResponse = await aiOrchestrator.sendMessage(prompt, "Aura is performing a recursive pipeline pass.");
    
    const pass = this.state.history.find(p => p.id === passNum);
    if (pass) {
      pass.status = 'completed';
      
      // Integrate Logic Branching
      const content = typeof response === 'string' ? response : (response as any).content || 'No content';
      const branch = logicBranchingService.getBranchForFinding(content, passNum);
      pass.branches.push(branch);
      logicBranchingService.logBranch(branch);

      if (branch.type === 'FAILURE' && type !== 'REPAIR') {
        console.warn(`[PIPELINE] Cascading failure detected: ${branch.label}`);
      }
    }
  }

  getState(): PipelineState {
    return this.state;
  }
}

export const pipelineEngine = new PipelineEngine();
