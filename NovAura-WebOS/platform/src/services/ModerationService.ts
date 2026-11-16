import { mailService } from './mailService';
import { kernelStorage } from '@/kernel/kernelStorage.js';

export type StrikeSeverity = 1 | 2 | 3 | 4;

export interface ModerationStrike {
  id: string;
  userId: string;
  severity: StrikeSeverity;
  reason: string;
  contentId?: string;
  timestamp: string;
}

class ModerationService {
  private STORAGE_KEY = 'novaura_moderation_strikes';

  async recordStrike(userId: string, reason: string, contentId?: string): Promise<{ strikeCount: number; action: string }> {
    const strikes = this.getUserStrikes(userId);
    const newStrike: ModerationStrike = {
      id: `strike_${Date.now()}`,
      userId,
      severity: (strikes.length + 1) as StrikeSeverity,
      reason,
      contentId,
      timestamp: new Date().toISOString()
    };

    strikes.push(newStrike);
    this.saveStrikes(userId, strikes);

    const action = await this.enforcePolicy(userId, newStrike.severity);
    return { strikeCount: strikes.length, action };
  }

  private async enforcePolicy(userId: string, severity: StrikeSeverity): Promise<string> {
    switch (severity) {
      case 1:
        return "Strike 1: Content removed. Official Warning issued. 24hr submission lock.";
      case 2:
        return "Strike 2: 3-Day Account Ban initiated. Human review required.";
      case 3:
        return "Strike 3: 30-Day Ban. Legal advisory warning sent.";
      case 4:
        await this.triggerNuclearErasure(userId);
        return "Strike 4: Permanent Ban. Asset Erasure. Authorities notified.";
      default:
        return "Unknown policy state.";
    }
  }

  private async triggerNuclearErasure(userId: string) {
    console.log(`[MODERATION] TRIGGERING NUCLEAR ERASURE FOR USER: ${userId}`);
    // 1. Wipe storage (Simulated)
    // 2. Terminate account (Simulated)
    // 3. Notify authorities
    await mailService.runOutreachChain(
      userId,
      'acc-1',
      {
        targets: [`investigations@local-authorities.gov`],
        goal: `REPORT: Persistent Distribution of Prohibited Content - User ${userId}`
      }
    );
  }

  getUserStrikes(userId: string): ModerationStrike[] {
    const all = this.getAllStrikes();
    return all[userId] || [];
  }

  private getAllStrikes(): Record<string, ModerationStrike[]> {
    const data = kernelStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  }

  private saveStrikes(userId: string, strikes: ModerationStrike[]) {
    const all = this.getAllStrikes();
    all[userId] = strikes;
    kernelStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
  }
}

export const moderationService = new ModerationService();
