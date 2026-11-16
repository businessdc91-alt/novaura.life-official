import { kernelStorage } from '../kernel/kernelStorage.js';
export interface WorkflowStep {
  id: string;
  type: 'prompt' | 'audit' | 'test' | 'deploy' | 'custom';
  label: string;
  instruction: string;
  config?: Record<string, any>;
}

export interface WorkflowPipeline {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  rules: string[]; // Explicit rules to enforce during the pipeline
  createdAt: string;
}

const STORAGE_KEYS = {
  workflows: 'novaura_workflows_', // Will be prefixed with userId
};

class WorkflowService {
  private getStorageKey(userId: string) {
    return `${STORAGE_KEYS.workflows}${userId}`;
  }

  getWorkflows(userId: string): WorkflowPipeline[] {
    const data = kernelStorage.getItem(this.getStorageKey(userId));
    if (!data) {
      // Return default Genesis pipelines
      return [this.getGenesisPipeline()];
    }
    return JSON.parse(data);
  }

  private getGenesisPipeline(): WorkflowPipeline {
    return {
      id: 'p-genesis-1',
      name: 'Standard Genesis Audit',
      description: 'The standard optimization and syntax check pipeline.',
      steps: [
        { id: 's1', type: 'audit', label: 'Code Review', instruction: 'Scan for logic flaws and optimization opportunities.' },
        { id: 's2', type: 'prompt', label: 'Enhancement Draft', instruction: 'Draft proposed changes based on the audit findings.' },
        { id: 's3', type: 'test', label: 'Sandbox Verification', instruction: 'Run compiled code through the Live Canvas for safety.' }
      ],
      rules: [
        'Always use functional programming patterns.',
        'Enforce 100% type safety.',
        'No external network requests during sandbox tests.'
      ],
      createdAt: new Date().toISOString()
    };
  }

  saveWorkflow(userId: string, workflow: WorkflowPipeline) {
    const workflows = this.getWorkflows(userId);
    const existingIndex = workflows.findIndex(w => w.id === workflow.id);
    
    if (existingIndex >= 0) {
      workflows[existingIndex] = workflow;
    } else {
      workflows.push(workflow);
    }
    
    kernelStorage.setItem(this.getStorageKey(userId), JSON.stringify(workflows));
  }

  deleteWorkflow(userId: string, id: string) {
    const workflows = this.getWorkflows(userId);
    const filtered = workflows.filter(w => w.id !== id);
    kernelStorage.setItem(this.getStorageKey(userId), JSON.stringify(filtered));
  }
}

export const workflowService = new WorkflowService();
