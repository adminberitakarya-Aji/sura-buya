/**
 * Suro-Buya Engine v2 - Item Continuity Skill
 * 
 * Ensures item continuity and consistency across scenes.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { PropertySkill } from '../base.js';
import type { SceneGenerationInput, SceneData, WorldProfile } from '../../types.js';

/**
 * Item Continuity configuration
 */
export interface ItemContinuityConfig extends Record<string, unknown> {
  /** Check item existence */
  checkExistence: boolean;
  /** Check item properties */
  checkProperties: boolean;
  /** Check item usage consistency */
  checkUsage: boolean;
  /** Track magical/tech items */
  trackSpecialItems: boolean;
}

/**
 * Item entry
 */
export interface ItemEntry {
  /** Item ID */
  id: string;
  /** Item name */
  name: string;
  /** Item type */
  type: 'weapon' | 'tool' | 'consumable' | 'key' | 'artifact' | 'tech' | 'clothing' | 'vehicle' | 'other';
  /** Description */
  description: string;
  /** Properties */
  properties: ItemProperties;
  /** Current owner */
  owner?: string;
  /** Location */
  location?: string;
  /** Scene introduced */
  introducedScene: number;
  /** Last seen scene */
  lastSeenScene: number;
  /** Special properties */
  special?: SpecialProperties;
}

/**
 * Item properties
 */
export interface ItemProperties {
  /** Weight */
  weight?: number;
  /** Size */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
  /** Material */
  material?: string;
  /** Durability */
  durability?: number;
  /** Value */
  value?: number;
  /** Is magical */
  magical?: boolean;
  /** Is technological */
  technological?: boolean;
  /** Is consumable */
  consumable?: boolean;
  /** Item type */
  type?: string;
  /** Requirements to use */
  requirements?: string[];
}

/**
 * Special properties for magical/tech items
 */
export interface SpecialProperties {
  /** Power source */
  powerSource?: string;
  /** Charges/uses remaining */
  charges?: number;
  /** Max charges */
  maxCharges?: number;
  /** Cooldown */
  cooldown?: number;
  /** Effects */
  effects?: string[];
  /** Limitations */
  limitations?: string[];
  /** Activation method */
  activation?: string;
  /** Last scene used */
  lastUsed?: number;
}

/**
 * Item analysis result
 */
export interface ItemAnalysis {
  /** Items in current scene */
  sceneItems: ItemEntry[];
  /** All tracked items */
  allItems: ItemEntry[];
  /** Items with issues */
  problematicItems: ItemEntry[];
  /** Issues detected */
  issues: ItemIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Item issue
 */
export interface ItemIssue {
  /** Issue type */
  type: 'property-mismatch' | 'impossible-usage' | 'charge-inconsistency' | 'ownership-gap' | 'location-jump' | 'property-violation' | 'missing-item';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Item ID */
  itemId: string;
  /** Item name */
  itemName: string;
  /** Scene numbers */
  scenes?: [number, number];
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Item Continuity Skill
 * Ensures item continuity and consistency
 */
export class ItemContinuity extends PropertySkill<SceneGenerationInput, ItemAnalysis> {
  override name = 'ItemContinuity';
  override version = '1.0.0';
  override description = 'Ensures item continuity and consistency across scenes';
  override dependencies: string[] = ['PropTracker', 'ContinuityGuard'];
  override required = false;
  
  override configSchema = z.object({
    checkExistence: z.boolean().default(true),
    checkProperties: z.boolean().default(true),
    checkUsage: z.boolean().default(true),
    trackSpecialItems: z.boolean().default(true),
  });

  override defaultConfig: Record<string, unknown> = {
    checkExistence: true,
    checkProperties: true,
    checkUsage: true,
    trackSpecialItems: true,
  };

  protected override config: ItemContinuityConfig = {
    checkExistence: true,
    checkProperties: true,
    checkUsage: true,
    trackSpecialItems: true,
  };

  // Item store
  private itemStore: Map<string, ItemEntry> = new Map();

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<ItemAnalysis>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const issues: ItemIssue[] = [];
      const recommendations: string[] = [];

      // Extract items from current scene
      const sceneItems = this.extractItemsFromScene(input, context);
      
      // Update item store
      this.updateItemStore(sceneItems, input.sceneNumber);

      // Check for issues
      if (cfg.checkExistence) {
        this.checkItemExistence(sceneItems, issues);
      }
      if (cfg.checkProperties) {
        this.checkPropertyConsistency(sceneItems, issues);
      }
      if (cfg.checkUsage) {
        this.checkUsageConsistency(sceneItems, input, context, issues);
      }
      if (cfg.trackSpecialItems) {
        this.checkSpecialItems(sceneItems, issues);
      }

      // Get all tracked items
      const allItems = Array.from(this.itemStore.values());
      
      // Find problematic items
      const problematicItems = allItems.filter(item => 
        issues.some(i => i.itemId === item.id)
      );

      // Generate recommendations
      if (issues.some(i => i.type === 'property-mismatch')) {
        recommendations.push('Verify item properties match established descriptions');
      }
      if (issues.some(i => i.type === 'charge-inconsistency')) {
        recommendations.push('Track magical/tech item charges carefully');
      }
      if (issues.some(i => i.type === 'impossible-usage')) {
        recommendations.push('Ensure item usage follows established rules');
      }

      const analysis: ItemAnalysis = {
        sceneItems,
        allItems,
        problematicItems,
        issues,
        recommendations: [...new Set(recommendations)],
      };

      return {
        success: true,
        data: analysis,
        metadata: {
          skillName: this.name,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          skipped: false,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          skillName: this.name,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          skipped: false,
        },
      };
    }
  }

  /**
   * Extract items from scene beats
   */
  private extractItemsFromScene(input: SceneGenerationInput, context: SkillContext): ItemEntry[] {
    const items: ItemEntry[] = [];
    const itemKeywords = ['sword', 'gun', 'knife', 'dagger', 'bow', 'staff', 'wand', 'pistol', 'rifle',
      'potion', 'scroll', 'book', 'key', 'map', 'compass', 'watch', 'phone', 'device',
      'ring', 'amulet', 'necklace', 'belt', 'boots', 'cloak', 'armor', 'helmet',
      'vehicle', 'car', 'horse', 'ship', 'bike', 'engine', 'generator', 'computer',
      'tool', 'hammer', 'lockpick', 'rope', 'torch', 'lantern', 'backpack', 'bag'];
    
    for (const beat of input.keyBeats) {
      const beatLower = beat.toLowerCase();
      
      for (const keyword of itemKeywords) {
        if (beatLower.includes(keyword)) {
          // Try to extract full item name
          const words = beatLower.split(' ');
          const keywordIndex = words.indexOf(keyword);
          
          if (keywordIndex !== -1) {
            // Extract surrounding words as item name
            let itemName = '';
            const start = Math.max(0, keywordIndex - 2);
            const end = Math.min(words.length, keywordIndex + 3);
            
            for (let i = start; i < end; i++) {
              itemName += words[i] + ' ';
            }
            itemName = itemName.trim().replace(/[.!?,;]+$/, '');
            
            // Check if already tracked
            let item = this.findMatchingItem(itemName);
            
            if (!item) {
              // Create new item entry
              item = {
                id: this.generateItemId(itemName),
                name: itemName,
                type: this.inferItemType(keyword),
                description: `Item from scene ${input.sceneNumber}: ${beat}`,
                properties: this.inferProperties(keyword),
                introducedScene: input.sceneNumber,
                lastSeenScene: input.sceneNumber,
              };
            }
            
            // Update context
            item.location = input.location;
            item.lastSeenScene = input.sceneNumber;
            
            // Check ownership
            for (const charId of input.characters) {
              const char = context.characterBibles[charId];
              if (char && beatLower.includes(char.name.toLowerCase())) {
                item.owner = charId;
                break;
              }
            }
            
            // Check special properties usage
            if (beatLower.includes('cast') || beatLower.includes('activate') || beatLower.includes('use')) {
              if (!item.special) item.special = {};
              if (item.special.charges !== undefined && item.special.charges > 0) {
                item.special.charges--;
              }
            }
            
            items.push(item);
          }
        }
      }
    }

    return items;
  }

  /**
   * Find matching item in store
   */
  private findMatchingItem(name: string): ItemEntry | undefined {
    const nameLower = name.toLowerCase();
    for (const item of this.itemStore.values()) {
      if (item.name.toLowerCase().includes(nameLower) || nameLower.includes(item.name.toLowerCase())) {
        return item;
      }
    }
    return undefined;
  }

  /**
   * Generate item ID
   */
  private generateItemId(name: string): string {
    return `item_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  }

  /**
   * Infer item type from keyword
   */
  private inferItemType(keyword: string): ItemEntry['type'] {
    const weaponTypes = ['sword', 'gun', 'knife', 'dagger', 'bow', 'pistol', 'rifle'];
    const toolTypes = ['hammer', 'lockpick', 'rope', 'compass', 'map', 'tool'];
    const consumableTypes = ['potion', 'scroll', 'torch', 'lantern'];
    const keyTypes = ['key'];
    const artifactTypes = ['wand', 'staff', 'ring', 'amulet', 'necklace'];
    const techTypes = ['phone', 'device', 'computer', 'engine', 'generator', 'watch'];
    const clothingTypes = ['belt', 'boots', 'cloak', 'armor', 'helmet'];
    const vehicleTypes = ['vehicle', 'car', 'horse', 'ship', 'bike'];
    
    if (weaponTypes.includes(keyword)) return 'weapon';
    if (toolTypes.includes(keyword)) return 'tool';
    if (consumableTypes.includes(keyword)) return 'consumable';
    if (keyTypes.includes(keyword)) return 'key';
    if (artifactTypes.includes(keyword)) return 'artifact';
    if (techTypes.includes(keyword)) return 'tech';
    if (clothingTypes.includes(keyword)) return 'clothing';
    if (vehicleTypes.includes(keyword)) return 'vehicle';
    return 'other';
  }

  /**
   * Infer properties from keyword
   */
  private inferProperties(keyword: string): ItemProperties {
    const defaults: ItemProperties = {
      weight: 1,
      size: 'small',
      material: 'unknown',
      durability: 100,
      value: 0,
      magical: false,
      technological: false,
      requirements: [],
    };

    const props: Record<string, Partial<ItemProperties>> = {
      sword: { weight: 3, size: 'medium', material: 'steel', durability: 80, value: 50 },
      gun: { weight: 2, size: 'small', material: 'metal', durability: 60, value: 100, technological: true },
      knife: { weight: 0.5, size: 'tiny', material: 'steel', durability: 70, value: 20 },
      potion: { weight: 0.3, size: 'tiny', material: 'glass', durability: 10, value: 30, magical: true, consumable: true },
      wand: { weight: 0.5, size: 'small', material: 'wood', durability: 50, value: 200, magical: true },
      key: { weight: 0.1, size: 'tiny', material: 'metal', durability: 100, value: 10 },
      phone: { weight: 0.2, size: 'tiny', material: 'plastic', durability: 40, value: 500, technological: true },
      vehicle: { weight: 1000, size: 'huge', material: 'metal', durability: 500, value: 10000, technological: true },
    };

    return { ...defaults, ...props[keyword] };
  }

  /**
   * Update item store
   */
  private updateItemStore(sceneItems: ItemEntry[], sceneNumber: number): void {
    for (const item of sceneItems) {
      if (this.itemStore.has(item.id)) {
        const existing = this.itemStore.get(item.id)!;
        existing.location = item.location || existing.location;
        existing.owner = item.owner || existing.owner;
        existing.lastSeenScene = sceneNumber;
        if (item.special) existing.special = { ...existing.special, ...item.special };
      } else {
        this.itemStore.set(item.id, item);
      }
    }
  }

  /**
   * Check item existence
   */
  private checkItemExistence(sceneItems: ItemEntry[], issues: ItemIssue[]): void {
    // Check for items that should exist but don't
    // This would integrate with plot requirements
  }

  /**
   * Check property consistency
   */
  private checkPropertyConsistency(sceneItems: ItemEntry[], issues: ItemIssue[]): void {
    for (const item of sceneItems) {
      const stored = this.itemStore.get(item.id);
      if (!stored) continue;

      // Check critical properties haven't changed
      const criticalProps: (keyof ItemProperties)[] = ['type', 'material', 'magical', 'technological'];
      
      for (const prop of criticalProps) {
        const storedVal = stored.properties[prop];
        const currentVal = item.properties[prop];
        
        if (storedVal !== undefined && currentVal !== undefined && storedVal !== currentVal) {
          issues.push({
            type: 'property-mismatch',
            severity: 'high',
            itemId: item.id,
            itemName: item.name,
            scenes: [stored.lastSeenScene, item.lastSeenScene!],
            description: `Item "${item.name}" property "${prop}" changed from ${storedVal} to ${currentVal}`,
            suggestion: 'Maintain consistent item properties or explain transformation',
          });
        }
      }
    }
  }

  /**
   * Check usage consistency
   */
  private checkUsageConsistency(
    sceneItems: ItemEntry[],
    input: SceneGenerationInput,
    context: SkillContext,
    issues: ItemIssue[]
  ): void {
    for (const item of sceneItems) {
      const stored = this.itemStore.get(item.id);
      if (!stored) continue;

      // Check if item used without owner present
      if (item.owner && !input.characters.includes(item.owner)) {
        issues.push({
          type: 'ownership-gap',
          severity: 'medium',
          itemId: item.id,
          itemName: item.name,
          scenes: [stored.lastSeenScene, item.lastSeenScene!],
          description: `Item "${item.name}" owned by ${item.owner} but owner not in scene`,
          suggestion: 'Include owner in scene or explain remote usage',
        });
      }

      // Check requirements
      if (stored.properties.requirements && stored.properties.requirements.length > 0) {
        const owner = item.owner;
        if (owner) {
          const char = context.characterBibles[owner];
          if (char) {
            // Check if character meets requirements
            for (const req of stored.properties.requirements) {
              if (!this.characterMeetsRequirement(char, req)) {
                issues.push({
                  type: 'property-violation',
                  severity: 'high',
                  itemId: item.id,
                  itemName: item.name,
                  scenes: [stored.lastSeenScene, item.lastSeenScene!],
                  description: `Character ${char.name} uses "${item.name}" without meeting requirement: ${req}`,
                  suggestion: 'Show character meeting requirement or change item',
                });
              }
            }
          }
        }
      }
    }
  }

  /**
   * Check if character meets requirement
   */
  private characterMeetsRequirement(character: any, requirement: string): boolean {
    const reqLower = requirement.toLowerCase();
    
    if (reqLower.includes('strength') || reqLower.includes('strong')) {
      return character.traits?.physical?.includes('strong') || character.attributes?.strength >= 15;
    }
    if (reqLower.includes('magic') || reqLower.includes('mana')) {
      return character.traits?.magical?.includes('gifted') || character.attributes?.magic >= 10;
    }
    if (reqLower.includes('training') || reqLower.includes('skill')) {
      return character.skills?.some((s: string) => s.toLowerCase().includes(reqLower.replace('training', '').trim()));
    }
    if (reqLower.includes('attunement') || reqLower.includes('bond')) {
      return character.relationships?.some((r: any) => r.type === 'item-bond');
    }
    
    return true; // Default allow
  }

  /**
   * Check special items (magical/tech)
   */
  private checkSpecialItems(sceneItems: ItemEntry[], issues: ItemIssue[]): void {
    for (const item of sceneItems) {
      if (!item.special) continue;
      
      const stored = this.itemStore.get(item.id);
      if (!stored || !stored.special) continue;

      // Check charge consistency
      if (item.special.charges !== undefined && stored.special.charges !== undefined) {
        if (item.special.charges > stored.special.charges) {
          issues.push({
            type: 'charge-inconsistency',
            severity: 'high',
            itemId: item.id,
            itemName: item.name,
            scenes: [stored.lastSeenScene, item.lastSeenScene!],
            description: `Item "${item.name}" charges increased from ${stored.special.charges} to ${item.special.charges} without recharge`,
            suggestion: 'Show recharging or justify charge increase',
          });
        } else if (item.special.charges < 0) {
          issues.push({
            type: 'charge-inconsistency',
            severity: 'high',
            itemId: item.id,
            itemName: item.name,
            scenes: [stored.lastSeenScene, item.lastSeenScene!],
            description: `Item "${item.name}" has negative charges: ${item.special.charges}`,
            suggestion: 'Fix charge tracking - cannot go below zero',
          });
        }
      }

      // Check cooldown
      if (item.special.cooldown && stored.special.lastUsed) {
        const scenesSinceUse = item.lastSeenScene - stored.lastSeenScene;
        if (scenesSinceUse < item.special.cooldown) {
          issues.push({
            type: 'impossible-usage',
            severity: 'medium',
            itemId: item.id,
            itemName: item.name,
            scenes: [stored.lastSeenScene, item.lastSeenScene!],
            description: `Item "${item.name}" used again before cooldown (${item.special.cooldown} scenes)`,
            suggestion: 'Wait for cooldown or reduce cooldown',
          });
        }
      }

      // Update last used
      if (item.special.charges !== undefined && item.special.charges < (stored.special.charges || 0)) {
        item.special.lastUsed = item.lastSeenScene;
      }
    }
  }

  /**
   * Get all tracked items
   */
  getTrackedItems(): ItemEntry[] {
    return Array.from(this.itemStore.values());
  }

  /**
   * Clear item store (for testing)
   */
  clearStore(): void {
    this.itemStore.clear();
  }
}

/**
 * Factory for creating ItemContinuity
 */
export async function createItemContinuity(
  config?: Partial<ItemContinuityConfig>
): Promise<ItemContinuity> {
  const skill = new ItemContinuity();
  await skill.initialize(config);
  return skill;
}