/**
 * @suro-buya/templates - Creator Templates
 * 
 * Template definitions for creator-facing content (characters, worlds, stories, etc.)
 */

import { z } from 'zod';
import { Schemas } from '../schemas';

/**
 * Character template definition
 */
export const characterTemplate = {
  id: 'character-base',
  name: 'Base Character Template',
  category: 'character' as const,
  description: 'Base template for creating character profiles',
  content: `# Character Profile: {{name}}

## Basic Information
- **Name**: {{name}}
- **Archetype**: {{archetype}}
- **Role**: {{role}}

## Description
{{description}}

## Backstory
{{backstory}}

## Personality Traits
{{#each traits}}
- {{this}}
{{/each}}

## Voice & Speech
{{#if voice}}
- **Tone**: {{voice.tone}}
- **Vocabulary**: {{#each voice.vocabulary}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Speech Patterns**: {{#each voice.speechPatterns}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{#if voice.catchphrases}}
- **Catchphrases**: {{#each voice.catchphrases}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{/if}}

## Relationships
{{#if relationships}}
{{#each relationships}}
- **{{@key}}** ({{this.type}}): {{this.description}} [Strength: {{this.strength}}]
{{/each}}
{{/if}}

## Abilities & Skills
{{#if abilities}}
{{#each abilities}}
- {{this}}
{{/each}}
{{/if}}

## Weaknesses
{{#if weaknesses}}
{{#each weaknesses}}
- {{this}}
{{/each}}
{{/if}}

## Character Arc
{{#if arc}}
- **Beginning**: {{arc.start}}
- **Middle**: {{arc.middle}}
- **End**: {{arc.end}}
{{/if}}

## Visual Reference
{{#if visualReference}}
{{visualReference}}
{{/if}}`,
  variables: [
    { name: 'name', type: 'string' as const, required: true, description: 'Character name' },
    { name: 'archetype', type: 'string' as const, required: true, description: 'Character archetype' },
    { name: 'role', type: 'string' as const, required: false, description: 'Character role in story', default: 'Supporting' },
    { name: 'description', type: 'string' as const, required: true, description: 'Brief character description' },
    { name: 'backstory', type: 'string' as const, required: false, description: 'Detailed backstory' },
    { name: 'traits', type: 'array' as const, required: true, description: 'Personality traits array' },
    { name: 'voice', type: 'object' as const, required: false, description: 'Voice characteristics' },
    { name: 'relationships', type: 'object' as const, required: false, description: 'Relationship map' },
    { name: 'abilities', type: 'array' as const, required: false, description: 'Abilities and skills' },
    { name: 'weaknesses', type: 'array' as const, required: false, description: 'Character weaknesses' },
    { name: 'arc', type: 'object' as const, required: false, description: 'Character arc structure' },
    { name: 'visualReference', type: 'string' as const, required: false, description: 'Visual reference description' },
  ],
  example: {
    name: 'Suro',
    archetype: 'protagonist',
    role: 'Main Protagonist',
    description: 'A curious young inventor from the floating islands',
    backstory: 'Born on the lowest floating island, Suro dreamed of reaching the Core...',
    traits: ['Curious', 'Inventive', 'Compassionate', 'Determined'],
    voice: {
      tone: 'Optimistic and inquisitive',
      vocabulary: ['gadget', 'mechanism', 'wonder', 'discovery'],
      speechPatterns: ['Asks questions', 'Uses technical terms casually'],
      catchphrases: ['Let\'s figure this out!', 'Fascinating...']
    },
    relationships: {
      'Buya': { type: 'partner', description: 'Best friend and co-adventurer', strength: 0.9 },
      'Professor Gear': { type: 'mentor', description: 'Former teacher', strength: 0.7 }
    },
    abilities: ['Mechanical intuition', 'Improvisation', 'Pattern recognition'],
    weaknesses: ['Impulsive', 'Overtrusting', 'Fear of heights'],
    arc: {
      start: 'Naive dreamer on the lowest island',
      middle: 'Discovers the truth about the world',
      end: 'Becomes a bridge between worlds'
    },
    visualReference: 'Young teen, messy dark hair, goggles on forehead, tool belt, patched clothing'
  }
} as const satisfies z.infer<typeof Schemas.baseTemplate>;

/**
 * World template definition
 */
export const worldTemplate = {
  id: 'world-base',
  name: 'Base World Template',
  category: 'world' as const,
  description: 'Base template for creating world/location profiles',
  content: `# World Profile: {{name}}

## Basic Information
- **Name**: {{name}}
- **Type**: {{type}}
- **Region**: {{region}}

## Description
{{description}}

## Geography
{{#if geography}}
- **Climate**: {{geography.climate}}
- **Terrain**: {{#each geography.terrain}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Landmarks**: {{#each geography.landmarks}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

## Culture
{{#if culture}}
- **Languages**: {{#each culture.language}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Customs**: {{#each culture.customs}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Beliefs**: {{#each culture.beliefs}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Social Structure**: {{culture.socialStructure}}
{{/if}}

## History
{{#if history}}
### Timeline
{{#each history.timeline}}
#### {{era}}
{{#each events}}
- {{this}}
{{/each}}
{{/each}}

### Key Events
{{#each history.keyEvents}}
- {{this}}
{{/each}}
{{/if}}

## Connections
{{#if connections}}
{{#each connections}}
- {{this}}
{{/each}}
{{/if}}

## Visual Reference
{{#if visualReference}}
{{visualReference}}
{{/if}}`,
  variables: [
    { name: 'name', type: 'string' as const, required: true, description: 'World/location name' },
    { name: 'type', type: 'string' as const, required: true, description: 'World type (planet, dimension, region, city, location)' },
    { name: 'region', type: 'string' as const, required: false, description: 'Parent region', default: 'Unknown' },
    { name: 'description', type: 'string' as const, required: true, description: 'World description' },
    { name: 'geography', type: 'object' as const, required: false, description: 'Geography details' },
    { name: 'culture', type: 'object' as const, required: false, description: 'Culture details' },
    { name: 'history', type: 'object' as const, required: false, description: 'Historical timeline' },
    { name: 'connections', type: 'array' as const, required: false, description: 'Connected locations' },
    { name: 'visualReference', type: 'string' as const, required: false, description: 'Visual description' },
  ],
  example: {
    name: 'Aetheris',
    type: 'planet',
    region: 'Celestial Sector',
    description: 'A world of floating islands held aloft by ancient technology',
    geography: {
      climate: 'Temperate with variations by altitude',
      terrain: ['Floating islands', 'Cloud seas', 'Crystal formations', 'Ancient ruins'],
      landmarks: ['The Core Spire', 'The Great Library', 'The Forge of Winds', 'The Sundering']
    },
    culture: {
      language: ['Aether Common', 'Old Tech', 'Wind Script'],
      customs: ['Sky burial', 'Wind festivals', 'Inventor\'s fair', 'Island hopping'],
      beliefs: ['The Core provides', 'Balance in all things', 'Knowledge floats free'],
      socialStructure: 'Meritocratic guilds based on altitude and contribution'
    },
    history: {
      timeline: [
        { era: 'Age of Grounding', events: ['Civilization lived on solid ground', 'The Great Lifting occurred'] },
        { era: 'Age of Islands', events: ['Islands stabilized', 'Guilds formed', 'Trade routes established'] },
        { era: 'Current Age', events: ['Core instability detected', 'Suro and Buya begin journey'] }
      ],
      keyEvents: ['The Great Lifting', 'Formation of the Guilds', 'Discovery of Core Energy', 'The Sundering']
    },
    connections: ['The Underdark', 'The Cloud Cities', 'The Core'],
    visualReference: 'Massive floating landmasses connected by bridges and wind-currents, glowing core visible below'
  }
} as const satisfies z.infer<typeof Schemas.baseTemplate>;

/**
 * Story template definition
 */
export const storyTemplate = {
  id: 'story-base',
  name: 'Base Story Template',
  category: 'story' as const,
  description: 'Base template for creating story/plot outlines',
  content: `# Story: {{title}}

## Overview
- **Type**: {{type}}
- **Genre**: {{#each genre}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Audience**: {{audience}}
- **Tone**: {{tone}}

## Logline
{{logline}}

## Synopsis
{{synopsis}}

## Themes
{{#each themes}}
- {{this}}
{{/each}}

## Structure
{{#if structure}}
- **Acts**: {{structure.acts}}
- **Beats**: {{#each structure.beats}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

## Characters
{{#each characters}}
- {{this}}
{{/each}}

## Locations
{{#each locations}}
- {{this}}
{{/each}}

## Plot Points
{{#each plotPoints}}
### {{order}}. {{description}} ({{type}})
{{/each}}`,
  variables: [
    { name: 'title', type: 'string' as const, required: true, description: 'Story title' },
    { name: 'type', type: 'string' as const, required: true, description: 'Story type (series, season, episode, arc, scene)' },
    { name: 'genre', type: 'array' as const, required: true, description: 'Genre tags' },
    { name: 'audience', type: 'string' as const, required: true, description: 'Target audience' },
    { name: 'tone', type: 'string' as const, required: true, description: 'Story tone' },
    { name: 'logline', type: 'string' as const, required: true, description: 'One-sentence summary' },
    { name: 'synopsis', type: 'string' as const, required: true, description: 'Detailed synopsis' },
    { name: 'themes', type: 'array' as const, required: true, description: 'Story themes' },
    { name: 'structure', type: 'object' as const, required: false, description: 'Story structure' },
    { name: 'characters', type: 'array' as const, required: true, description: 'Character IDs' },
    { name: 'locations', type: 'array' as const, required: true, description: 'Location IDs' },
    { name: 'plotPoints', type: 'array' as const, required: true, description: 'Plot point array' },
  ],
  example: {
    title: 'The Skyward Journey',
    type: 'series',
    genre: ['Adventure', 'Fantasy', 'Steampunk', 'Coming of Age'],
    audience: 'Young Adult (13+)',
    tone: 'Hopeful, wonder-filled, with moments of tension',
    logline: 'Two young inventors from the lowest floating island must journey to the Core to save their world from falling apart.',
    synopsis: 'Suro and Buya discover that the ancient technology keeping their islands afloat is failing. With the help of a mysterious map and their complementary skills - Suro\'s mechanical genius and Buya\'s wind-reading intuition - they must navigate treacherous sky-currents, rival inventors, and the secrets of the ancient civilization that built their world.',
    themes: ['Friendship', 'Discovery', 'Balance vs Progress', 'Found Family', 'Environmental Stewardship'],
    structure: {
      acts: 3,
      beats: ['Inciting Incident: Core instability detected', 'First Threshold: Leaving home island', 'Midpoint: Truth about the Great Lifting', 'Climax: Confrontation at the Core', 'Resolution: New balance restored']
    },
    characters: ['suro', 'buya', 'professor-gear', 'captain-zephyr', 'the-archivist'],
    locations: ['aetheris', 'low-islands', 'mid-islands', 'high-islands', 'the-core', 'the-sundering'],
    plotPoints: [
      { order: 1, description: 'Suro detects anomaly in Core energy readings', type: 'inciting' },
      { order: 2, description: 'Forced to flee home island as it begins to descend', type: 'rising' },
      { order: 3, description: 'Meet Captain Zephyr, gain sky-ship', type: 'rising' },
      { order: 4, description: 'Discover ancient archives revealing true history', type: 'rising' },
      { order: 5, description: 'Confrontation with rival faction at Core', type: 'climax' },
      { order: 6, description: 'Restore balance, new era of understanding begins', type: 'resolution' }
    ]
  }
} as const satisfies z.infer<typeof Schemas.baseTemplate>;

/**
 * Episode template definition
 */
export const episodeTemplate = {
  id: 'episode-base',
  name: 'Base Episode Template',
  category: 'episode' as const,
  description: 'Base template for creating episode structures',
  content: `# Episode {{season}}x{{number}}: {{title}}

## Summary
{{summary}}

## Themes
{{#each themes}}
- {{this}}
{{/each}}

## Character Arcs Advanced
{{#each characterArcs}}
- {{this}}
{{/each}}

## Scenes
{{#each scenes}}
### Scene {{number}}: {{location}} ({{type}}, ~{{estimatedDuration}} min)
**Characters**: {{#each characters}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
**Summary**: {{summary}}
{{/each}}`,
  variables: [
    { name: 'number', type: 'number' as const, required: true, description: 'Episode number' },
    { name: 'season', type: 'number' as const, required: true, description: 'Season number' },
    { name: 'title', type: 'string' as const, required: true, description: 'Episode title' },
    { name: 'summary', type: 'string' as const, required: true, description: 'Episode summary' },
    { name: 'scenes', type: 'array' as const, required: true, description: 'Scene array' },
    { name: 'themes', type: 'array' as const, required: true, description: 'Episode themes' },
    { name: 'characterArcs', type: 'array' as const, required: true, description: 'Character arcs progressed' },
  ],
  example: {
    number: 1,
    season: 1,
    title: 'The Fall of Home',
    summary: 'Suro and Buya\'s peaceful life on the lowest island is shattered when their home begins to descend toward the deadly cloud-sea below.',
    scenes: [
      { number: 1, location: 'Suro\'s Workshop', characters: ['suro', 'buya'], summary: 'Suro shows Buya his latest invention - a Core energy detector', type: 'exposition', estimatedDuration: 5 },
      { number: 2, location: 'Village Square', characters: ['suro', 'buya', 'villagers'], summary: 'Tremors shake the island; elders argue about evacuation', type: 'action', estimatedDuration: 7 },
      { number: 3, location: 'Professor Gear\'s Lab', characters: ['suro', 'buya', 'professor-gear'], summary: 'Professor reveals the Core is failing; gives them a map', type: 'exposition', estimatedDuration: 8 },
      { number: 4, location: 'Docks', characters: ['suro', 'buya', 'captain-zephyr'], summary: 'Desperate escape on Captain Zephyr\'s sky-ship as island drops', type: 'climax', estimatedDuration: 10 },
      { number: 5, location: 'Sky-ship Deck', characters: ['suro', 'buya', 'captain-zephyr'], summary: 'Watch home disappear into clouds; vow to fix the Core', type: 'resolution', estimatedDuration: 5 }
    ],
    themes: ['Loss of innocence', 'Beginning of journey', 'Friendship tested', 'Hope amid despair'],
    characterArcs: ['suro: Naive inventor -> Determined hero', 'buya: Carefree dreamer -> Resolute partner']
  }
} as const satisfies z.infer<typeof Schemas.baseTemplate>;

/**
 * Scene template definition
 */
export const sceneTemplate = {
  id: 'scene-base',
  name: 'Base Scene Template',
  category: 'scene' as const,
  description: 'Base template for creating detailed scene breakdowns',
  content: `# Scene {{number}} (Episode {{episodeId}})

## Setting
- **Location**: {{location}}
- **Time**: {{timeOfDay}}
- **Type**: {{type}}
- **Duration**: ~{{estimatedDuration}} minutes

## Characters Present
{{#each characters}}
- {{this}}
{{/each}}

## Beats
{{#each beats}}
### Beat {{order}}
{{#if character}}**{{character}}**: {{/if}}{{description}}
{{#if dialogue}}
> "{{dialogue}}"
{{/if}}
{{#if action}}
*{{action}}*
{{/if}}
{{/each}}

## Visual Notes
{{#if visualNotes}}
{{visualNotes}}
{{/if}}

## Audio Notes
{{#if audioNotes}}
{{audioNotes}}
{{/if}}`,
  variables: [
    { name: 'number', type: 'number' as const, required: true, description: 'Scene number' },
    { name: 'episodeId', type: 'string' as const, required: true, description: 'Episode identifier' },
    { name: 'location', type: 'string' as const, required: true, description: 'Scene location' },
    { name: 'timeOfDay', type: 'string' as const, required: true, description: 'Time of day' },
    { name: 'characters', type: 'array' as const, required: true, description: 'Characters in scene' },
    { name: 'type', type: 'string' as const, required: true, description: 'Scene type' },
    { name: 'beats', type: 'array' as const, required: true, description: 'Story beats' },
    { name: 'estimatedDuration', type: 'number' as const, required: true, description: 'Estimated duration in minutes' },
    { name: 'visualNotes', type: 'string' as const, required: false, description: 'Visual direction notes' },
    { name: 'audioNotes', type: 'string' as const, required: false, description: 'Audio/sound direction notes' },
  ],
  example: {
    number: 1,
    episodeId: 's01e01',
    location: 'Suro\'s Workshop',
    timeOfDay: 'Early Morning - Golden Hour',
    characters: ['suro', 'buya'],
    type: 'exposition',
    beats: [
      { order: 1, description: 'Suro fine-tunes a brass contraption with glowing blue core', character: 'suro', action: 'Adjusts delicate gears with precision tools' },
      { order: 2, description: 'Buya enters through window, riding a thermal updraft', character: 'buya', action: 'Lands gracefully, wind settling around her' },
      { order: 3, description: 'Suro excitedly shows the Core Resonance Detector', character: 'suro', dialogue: 'Buya, look! It\'s finally calibrated. The needle shouldn\'t move unless...' },
      { order: 4, description: 'The needle spikes violently. Both freeze.', action: 'Device emits low hum. Blue light pulses.' },
      { order: 5, description: 'Distant rumble shakes the workshop. Dust falls from rafters.', action: 'Floor vibrates. A mug slides off the table.' }
    ],
    estimatedDuration: 5,
    visualNotes: 'Warm golden light through dust motes. Workshop cluttered with inventions. Blue glow from device contrasts with warm tones. Camera starts tight on device, pulls back to show both characters.',
    audioNotes: 'Ambient: Wind through cracks, distant machinery hum. SFX: Device powering up (rising synth tone), then spike (discordant pulse). Rumble: Low frequency shake. Score: Curious pizzicato strings building to tension.'
  }
} as const satisfies z.infer<typeof Schemas.baseTemplate>;

/**
 * All creator templates
 */
export const creatorTemplates = {
  character: characterTemplate,
  world: worldTemplate,
  story: storyTemplate,
  episode: episodeTemplate,
  scene: sceneTemplate,
} as const;

/**
 * Template registry for lookup
 */
export const CREATOR_TEMPLATE_REGISTRY: Record<string, typeof creatorTemplates[keyof typeof creatorTemplates]> = {
  'character-base': characterTemplate,
  'world-base': worldTemplate,
  'story-base': storyTemplate,
  'episode-base': episodeTemplate,
  'scene-base': sceneTemplate,
};