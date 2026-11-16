export type BranchType = 'SUCCESS' | 'FAILURE' | 'UNCERTAINTY';

export interface LogicBranch {
  id: string;
  type: BranchType;
  label: string;
  action: string;
  targetPass: number;
}

class LogicBranchingService {
  private activeBranches: LogicBranch[] = [];

  getBranchForFinding(finding: string, currentPass: number): LogicBranch {
    // Decision Matrix: Cascading Logic
    if (finding.toLowerCase().includes('critical error') || finding.toLowerCase().includes('fail')) {
      return {
        id: `branch_${Date.now()}`,
        type: 'FAILURE',
        label: 'Emergency Repair Branch',
        action: 'Triggering RecursiveRepairLoop: Diagnostic -> Fix -> Re-Verify',
        targetPass: currentPass // Loop back to current pass after repair
      };
    }

    if (finding.toLowerCase().includes('uncertain') || finding.toLowerCase().includes('missing context')) {
      return {
        id: `branch_${Date.now()}`,
        type: 'UNCERTAINTY',
        label: 'Deep Reasoning Branch',
        action: 'Triggering DeepReasoningService: External research & self-querying',
        targetPass: currentPass
      };
    }

    return {
      id: `branch_${Date.now()}`,
      type: 'SUCCESS',
      label: 'Optimization Branch',
      action: 'Advancing to next pipeline pass.',
      targetPass: currentPass + 1
    };
  }

  logBranch(branch: LogicBranch) {
    this.activeBranches.push(branch);
    console.log(`[LOGIC_BRANCHING] ${branch.type}: ${branch.label} -> ${branch.action}`);
  }

  getActiveBranches(): LogicBranch[] {
    return this.activeBranches;
  }
}

export const logicBranchingService = new LogicBranchingService();
