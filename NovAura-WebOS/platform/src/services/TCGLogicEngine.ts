import { aiOrchestrator } from './aiOrchestrator';

export interface CardAsset {
  id: string;
  name: string;
  type: 'Creature' | 'Spell' | 'Trap';
  stats?: { atk: number; def: number };
  description: string;
  visualPrompt: string;
  balanceScore: number;
}

class TCGLogicEngine {
  async evaluateCardBalance(card: Partial<CardAsset>): Promise<CardAsset> {
    const prompt = `
      TCG_BALANCE_AUDIT:
      TYPE: ${card.type}
      STATS: ${JSON.stringify(card.stats)}
      DESCRIPTION: ${card.description}
      
      Review for game balance and logical consistency. 
      Iterate until the 'TCG Math' is flawless.
    `;
    
    const response = await aiOrchestrator.sendMessage(prompt, "Aura TCG Architect is balancing a new asset.");
    
    if (response.error) {
      console.error(`[TCG_ENGINE] Balance pass failed: ${response.error}`);
    } else {
      console.log(`[TCG_ENGINE] Balance pass successful: ${response.content.length} chars generated.`);
    }
    // This would parse the response and potentially trigger another pass if balanceScore < 0.8
    return {
      id: card.id || `card_${Date.now()}`,
      name: card.name || 'Untitled Genesis Card',
      type: card.type || 'Creature',
      stats: card.stats || { atk: 1000, def: 1000 },
      description: card.description || 'Genesis effect description.',
      visualPrompt: 'A holographic warrior emerging from a void portal.',
      balanceScore: 0.95
    };
  }

  async generateGodotTres(card: CardAsset): Promise<string> {
    const tresContent = `
[gd_resource type="Resource" load_steps=2 format=2]

[ext_resource path="res://scripts/card_data.gd" type="Script" id=1]

[resource]
script = ExtResource( 1 )
card_name = "${card.name}"
card_type = "${card.type}"
atk = ${card.stats?.atk || 0}
def = ${card.stats?.def || 0}
description = "${card.description.replace(/"/g, '\\"')}"
    `;
    return tresContent;
  }
}

export const tcgLogicEngine = new TCGLogicEngine();
