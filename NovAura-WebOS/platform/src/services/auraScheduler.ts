import { workflowService } from './workflowService';
import { aiOrchestrator } from './aiOrchestrator';
import { kernelStorage } from '../kernel/kernelStorage.js';

export interface ScheduledTask {
  id: string;
  pipelineId: string;
  frequency: 'hourly' | 'daily' | 'twice-daily' | 'custom';
  customIntervalMs?: number;
  lastRun?: string;
  isActive: boolean;
}

const STORAGE_KEYS = {
  tasks: 'novaura_scheduled_tasks_',
};

class AuraScheduler {
  private timers: Map<string, any> = new Map();

  private getTaskKey(userId: string) { return `${STORAGE_KEYS.tasks}${userId}`; }

  getTasks(userId: string): ScheduledTask[] {
    const data = kernelStorage.getItem(this.getTaskKey(userId));
    return data ? JSON.parse(data) : [];
  }

  saveTask(userId: string, task: ScheduledTask) {
    const tasks = this.getTasks(userId);
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) tasks[existingIndex] = task;
    else tasks.push(task);
    kernelStorage.setItem(this.getTaskKey(userId), JSON.stringify(tasks));
    
    // Restart if active
    if (task.isActive) this.startTask(userId, task);
    else this.stopTask(task.id);
  }

  startTask(userId: string, task: ScheduledTask) {
    this.stopTask(task.id);
    
    const interval = this.getIntervalMs(task);
    const timer = setInterval(() => {
      this.executePipeline(userId, task.pipelineId);
    }, interval);
    
    this.timers.set(task.id, timer);
  }

  stopTask(taskId: string) {
    const timer = this.timers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(taskId);
    }
  }

  private getIntervalMs(task: ScheduledTask): number {
    if (task.customIntervalMs) return task.customIntervalMs;
    switch (task.frequency) {
      case 'hourly': return 60 * 60 * 1000;
      case 'twice-daily': return 12 * 60 * 60 * 1000;
      case 'daily': return 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  private async executePipeline(userId: string, pipelineId: string) {
    const workflows = workflowService.getWorkflows(userId);
    const pipeline = workflows.find(p => p.id === pipelineId);
    if (!pipeline) return;

    console.log(`[AURASCHEDULER] EXECUTING PIPELINE: ${pipeline.name}`);
    
    // Standard R&D Auto-Prompt flow
    for (const step of pipeline.steps) {
      console.log(`[AURASCHEDULER] Step: ${step.label} - ${step.instruction}`);
      // Here we would call the AI Orchestrator with the instruction + rules
      // For this implementation, we log the intent. In production, this pushes to the AI queue.
      await aiOrchestrator.sendMessage(
        `AUTOPROMPT SYSTEM: ${step.instruction}\nFOLLOW THESE RULES: ${pipeline.rules.join(', ')}`,
        "The system is running an autonomous R&D task."
      );
    }
  }

  init(userId: string) {
    const tasks = this.getTasks(userId);
    tasks.forEach(t => {
      if (t.isActive) this.startTask(userId, t);
    });
  }
}

export const auraScheduler = new AuraScheduler();
