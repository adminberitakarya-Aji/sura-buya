/**
 * @suro-buya/templates - Prompt Templates
 * 
 * Template definitions for LLM prompts used in generation, planning, review, etc.
 */

import { z } from 'zod';
import { Schemas } from '../schemas';

/**
 * Scene generation prompt template
 */
export const generationPromptTemplate = {
  id: 'generation-scene-v1',
  name: 'Scene Generation Prompt',
  category: 'generation' as const,
  description: 'Prompt template for generating scene content',
  content: `You are a master storyteller writing for the Suro-Buya universe. Generate a compelling scene based on the following context and requirements.

## Universe Context
{{universeContext}}

## Character Bibles
{{characterBibles}}

## World Bible
{{worldBible}}

## Story Context
{{storyContext}}

## Episode Context
{{episodeContext}}

## Scene Requirements
- **Scene Number**: {{sceneNumber}}
- **Location**: {{location}}
- **Time of Day**: {{timeOfDay}}
- **Characters Present**: {{charactersPresent}}
- **Scene Type**: {{sceneType}}
- **Estimated Duration**: {{estimatedDuration}} minutes
- **Key Beats**: {{keyBeats}}

## Previous Scene Summary
{{previousSceneSummary}}

## Writing Guidelines
1. **Character Voice**: Each character must speak and act according to their bible profile
2. **World Consistency**: All world details must match the world bible
3. **Show, Don't Tell**: Use action, dialogue, and sensory details
4. **Pacing**: Build tension appropriately for the scene type
5. **Visual Storytelling**: Write with visual media in mind (showable actions, clear settings)
6. **Canon Compliance**: No contradictions to established lore
7. **Emotional Truth**: Characters react authentically to circumstances

## Output Format
Write the scene in screenplay format with:
- Scene heading (INT./EXT. LOCATION - TIME)
- Action lines (present tense, visual)
- Character names centered above dialogue
- Dialogue
- Parentheticals for delivery (sparingly)
- Transitions

## Special Instructions
{{specialInstructions}}`,
  variables: [
    { name: 'universeContext', type: 'string' as const, required: true, description: 'Universe overview context' },
    { name: 'characterBibles', type: 'string' as const, required: true, description: 'Relevant character bible excerpts' },
    { name: 'worldBible', type: 'string' as const, required: true, description: 'Relevant world bible excerpts' },
    { name: 'storyContext', type: 'string' as const, required: true, description: 'Story arc context' },
    { name: 'episodeContext', type: 'string' as const, required: true, description: 'Episode context' },
    { name: 'sceneNumber', type: 'number' as const, required: true, description: 'Scene number' },
    { name: 'location', type: 'string' as const, required: true, description: 'Scene location' },
    { name: 'timeOfDay', type: 'string' as const, required: true, description: 'Time of day' },
    { name: 'charactersPresent', type: 'array' as const, required: true, description: 'Characters in scene' },
    { name: 'sceneType', type: 'string' as const, required: true, description: 'Scene type' },
    { name: 'estimatedDuration', type: 'number' as const, required: true, description: 'Estimated duration' },
    { name: 'keyBeats', type: 'string' as const, required: true, description: 'Key story beats' },
    { name: 'previousSceneSummary', type: 'string' as const, required: false, description: 'Previous scene summary' },
    { name: 'specialInstructions', type: 'string' as const, required: false, description: 'Special instructions' },
  ],
  example: {
    universeContext: 'Aetheris - World of floating islands held by ancient Core technology. Steampunk fantasy with wind/water themes.',
    characterBibles: 'Suro: Curious inventor, optimistic, technical vocabulary. Buya: Wind-reader, intuitive, poetic speech.',
    worldBible: 'Low Islands: Industrial, crowded. Mid Islands: Trade hubs. High Islands: Elite, ancient tech. Core: Mysterious energy source.',
    storyContext: 'Origin arc - Suro and Buya flee their failing home island, seeking to repair the Core.',
    episodeContext: 'Episode 1: The Fall of Home - Establishing status quo, inciting incident, departure.',
    sceneNumber: 1,
    location: "Suro's Workshop",
    timeOfDay: 'Early Morning - Golden Hour',
    charactersPresent: ['suro', 'buya'],
    sceneType: 'exposition',
    estimatedDuration: 5,
    keyBeats: '1. Suro calibrates detector 2. Buya arrives 3. Device spikes 4. Island tremors begin',
    previousSceneSummary: 'N/A - First scene',
    specialInstructions: 'Establish Suro\'s mechanical genius and Buya\'s wind connection. End on the first tremor.'
  }
} as const satisfies z.infer<typeof Schemas.prompt>;

/**
 * Episode planning prompt template
 */
export const planningPromptTemplate = {
  id: 'planning-episode-v1',
  name: 'Episode Planning Prompt',
  category: 'planning' as const,
  description: 'Prompt template for planning episode structure',
  content: `You are a TV series planner for the Suro-Buya universe. Create a detailed episode breakdown.

## Series Context
{{seriesContext}}

## Season Arc
{{seasonArc}}

## Previous Episode
{{previousEpisode}}

## Episode Requirements
- **Season**: {{seasonNumber}}
- **Episode**: {{episodeNumber}}
- **Title**: {{episodeTitle}}
- **Focus Characters**: {{focusCharacters}}
- **Key Plot Points**: {{keyPlotPoints}}
- **Themes**: {{themes}}
- **Target Runtime**: {{targetRuntime}} minutes
- **Scene Count**: {{sceneCount}}

## Character Arcs This Episode
{{characterArcs}}

## World State
{{worldState}}

## Output Requirements
Provide a scene-by-scene breakdown with:
1. Scene number and location
2. Characters present
3. Scene type (exposition, action, dialogue, climax, resolution, transition)
4. Estimated duration
5. Summary of what happens
6. Key beat outline
7. Character emotional states
8. Visual/audio notes for production

## Constraints
- Each scene must advance plot AND character
- Balance action/dialogue/exposition
- End on compelling hook/cliffhanger
- Setup future payoffs
- Respect production budget (locations, VFX, cast)`,
  variables: [
    { name: 'seriesContext', type: 'string' as const, required: true, description: 'Series overview' },
    { name: 'seasonArc', type: 'string' as const, required: true, description: 'Season story arc' },
    { name: 'previousEpisode', type: 'string' as const, required: false, description: 'Previous episode summary' },
    { name: 'seasonNumber', type: 'number' as const, required: true, description: 'Season number' },
    { name: 'episodeNumber', type: 'number' as const, required: true, description: 'Episode number' },
    { name: 'episodeTitle', type: 'string' as const, required: true, description: 'Episode title' },
    { name: 'focusCharacters', type: 'array' as const, required: true, description: 'Focus characters' },
    { name: 'keyPlotPoints', type: 'array' as const, required: true, description: 'Key plot points' },
    { name: 'themes', type: 'array' as const, required: true, description: 'Episode themes' },
    { name: 'targetRuntime', type: 'number' as const, required: true, description: 'Target runtime in minutes' },
    { name: 'sceneCount', type: 'number' as const, required: true, description: 'Number of scenes' },
    { name: 'characterArcs', type: 'string' as const, required: true, description: 'Character arcs' },
    { name: 'worldState', type: 'string' as const, required: true, description: 'Current world state' },
  ],
  example: {
    seriesContext: 'Suro & Buya - Two inventors journey across floating islands to save their world',
    seasonArc: 'Origin Season - From home island to first major revelation at Mid Islands',
    previousEpisode: 'N/A - Pilot',
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: 'The Fall of Home',
    focusCharacters: ['suro', 'buya'],
    keyPlotPoints: ['Core instability detected', 'Home island begins falling', 'Professor reveals truth', 'Escape on sky-ship'],
    themes: ['Loss of innocence', 'Beginning of journey', 'Friendship tested'],
    targetRuntime: 22,
    sceneCount: 5,
    characterArcs: 'Suro: Naive -> Determined. Buya: Carefree -> Resolute partner.',
    worldState: 'Core energy fluctuating. Low Islands unstable. Tensions rising between Guilds.'
  }
} as const satisfies z.infer<typeof Schemas.prompt>;

/**
 * Production prompt template
 */
export const productionPromptTemplate = {
  id: 'production-breakdown-v1',
  name: 'Production Breakdown Prompt',
  category: 'production' as const,
  description: 'Prompt template for creating production breakdowns',
  content: `You are a production coordinator for the Suro-Buya animated series. Create a detailed production breakdown.

## Scene Content
{{sceneContent}}

## Production Requirements
- **Format**: {{format}} (2D/3D/Hybrid)
- **Style Guide**: {{styleGuide}}
- **Budget Tier**: {{budgetTier}}
- **Schedule**: {{schedule}}

## Breakdown Categories
Provide detailed breakdowns for:

### 1. Characters
- Main characters in scene
- Character models needed (existing/new)
- Expressions/poses required
- Special rigging needs

### 2. Environments
- Backgrounds needed (existing/new)
- Time of day lighting setups
- Atmospheric effects
- Camera angles/moves

### 3. Props & Vehicles
- Key props (existing/new)
- Vehicles/mecha (existing/new)
- Interaction requirements

### 4. Visual Effects
- Particle effects
- Magic/tech effects
- Environmental effects
- Compositing notes

### 5. Audio
- Dialogue recording notes
- Sound effects needed
- Music cues
- Ambience

### 6. Animation
- Key acting beats
- Complex action sequences
- Lip sync requirements
- Secondary animation

### 7. Schedule Estimates
- Layout: X days
- Animation: X days
- Lighting/Comp: X days
- Total: X days

## Output Format
Structured breakdown document with clear categories, priorities, and dependencies.`,
  variables: [
    { name: 'sceneContent', type: 'string' as const, required: true, description: 'Scene script/content' },
    { name: 'format', type: 'string' as const, required: true, description: 'Animation format' },
    { name: 'styleGuide', type: 'string' as const, required: true, description: 'Visual style guide reference' },
    { name: 'budgetTier', type: 'string' as const, required: true, description: 'Budget tier' },
    { name: 'schedule', type: 'string' as const, required: true, description: 'Production schedule' },
  ],
  example: {
    sceneContent: 'Scene 1: Suro\'s Workshop - Suro calibrates detector, Buya arrives, device spikes, tremors begin',
    format: '2D with 3D elements',
    styleGuide: 'Suro-Buya Visual Bible v1.0 - Ghibli-meets-Steampunk aesthetic',
    budgetTier: 'Standard TV episode',
    schedule: '6 weeks per episode'
  }
} as const satisfies z.infer<typeof Schemas.prompt>;

/**
 * Review prompt template
 */
export const reviewPromptTemplate = {
  id: 'review-content-v1',
  name: 'Content Review Prompt',
  category: 'review' as const,
  description: 'Prompt template for reviewing generated content',
  content: `You are a senior creative reviewer for the Suro-Buya universe. Review the following content against canon and quality standards.

## Content to Review
{{content}}

## Content Type
{{contentType}}

## Review Criteria
{{reviewCriteria}}

## Canon References
{{canonReferences}}

## Review Instructions
Evaluate each criterion on a 1-10 scale and provide:
1. **Score** (1-10)
2. **Status** (pass/fail/needs-revision)
3. **Specific Notes** (what works, what doesn't)
4. **Actionable Feedback** (how to improve)

## Special Focus Areas
- Canon compliance (character, world, plot)
- Character voice authenticity
- Pacing and structure
- Visual storytelling potential
- Dialogue quality and subtext
- Thematic resonance
- Production feasibility

## Output Format
Structured review with scores, status, notes, and overall recommendation.`,
  variables: [
    { name: 'content', type: 'string' as const, required: true, description: 'Content to review' },
    { name: 'contentType', type: 'string' as const, required: true, description: 'Type of content' },
    { name: 'reviewCriteria', type: 'string' as const, required: true, description: 'Review criteria list' },
    { name: 'canonReferences', type: 'string' as const, required: true, description: 'Relevant canon references' },
  ],
  example: {
    content: 'Scene 1 script...',
    contentType: 'scene',
    reviewCriteria: 'canon-compliance, character-voice, pacing, visual-potential, dialogue-quality',
    canonReferences: 'Character Bible v1.0, World Bible v1.0, Story Bible v1.0'
  }
} as const satisfies z.infer<typeof Schemas.prompt>;

/**
 * Validation prompt template
 */
export const validationPromptTemplate = {
  id: 'validation-canon-v1',
  name: 'Canon Validation Prompt',
  category: 'validation' as const,
  description: 'Prompt template for validating content against canon rules',
  content: `You are a canon validator for the Suro-Buya universe. Check the following content for consistency with established lore.

## Content to Validate
{{content}}

## Content Type
{{contentType}}

## Validation Rules
{{validationRules}}

## Bible References
- Character Bible: {{characterBible}}
- World Bible: {{worldBible}}
- Story Bible: {{storyBible}}

## Validation Instructions
For each rule, determine:
1. **Applicable** (yes/no)
2. **Compliant** (yes/no/partial)
3. **Violation Details** (if any)
4. **Severity** (error/warning/info)
5. **Suggested Fix** (if applicable)

## Output Format
Structured validation report with:
- Overall validity (pass/fail)
- Consistency score (0-1)
- List of violations with details
- List of warnings
- Recommendations`,
  variables: [
    { name: 'content', type: 'string' as const, required: true, description: 'Content to validate' },
    { name: 'contentType', type: 'string' as const, required: true, description: 'Content type' },
    { name: 'validationRules', type: 'string' as const, required: true, description: 'Validation rules' },
    { name: 'characterBible', type: 'string' as const, required: true, description: 'Character bible reference' },
    { name: 'worldBible', type: 'string' as const, required: true, description: 'World bible reference' },
    { name: 'storyBible', type: 'string' as const, required: true, description: 'Story bible reference' },
  ],
  example: {
    content: 'Scene 1 script...',
    contentType: 'scene',
    validationRules: 'CHAR-001: Name consistency, WORLD-001: Location validity, PLOT-001: Timeline order',
    characterBible: 'Character Bible v1.0',
    worldBible: 'World Bible v1.0',
    storyBible: 'Story Bible v1.0'
  }
} as const satisfies z.infer<typeof Schemas.prompt>;

/**
 * Dialogue generation prompt template
 */
export const dialoguePromptTemplate = {
  id: 'generation-dialogue-v1',
  name: 'Dialogue Generation Prompt',
  category: 'generation' as const,
  description: 'Prompt template for generating character dialogue',
  content: `You are a dialogue writer for the Suro-Buya universe. Generate authentic dialogue for the specified characters and situation.

## Characters
{{characters}}

## Situation
{{situation}}

## Context
{{context}}

## Dialogue Requirements
- **Tone**: {{tone}}
- **Length**: {{length}} exchanges
- **Key Information to Convey**: {{keyInfo}}
- **Subtext**: {{subtext}}
- **Conflict Level**: {{conflictLevel}}

## Character Voice Guidelines
{{voiceGuidelines}}

## Output Format
Screenplay dialogue format with character names, parentheticals, and dialogue.`,
  variables: [
    { name: 'characters', type: 'array' as const, required: true, description: 'Characters in dialogue' },
    { name: 'situation', type: 'string' as const, required: true, description: 'Situation description' },
    { name: 'context', type: 'string' as const, required: true, description: 'Scene context' },
    { name: 'tone', type: 'string' as const, required: true, description: 'Dialogue tone' },
    { name: 'length', type: 'number' as const, required: true, description: 'Number of exchanges' },
    { name: 'keyInfo', type: 'string' as const, required: true, description: 'Key information to convey' },
    { name: 'subtext', type: 'string' as const, required: false, description: 'Subtext' },
    { name: 'conflictLevel', type: 'string' as const, required: true, description: 'Conflict level' },
    { name: 'voiceGuidelines', type: 'string' as const, required: true, description: 'Voice guidelines per character' },
  ],
  example: {
    characters: ['suro', 'buya'],
    situation: 'Suro shows Buya his new invention; it detects something alarming',
    context: 'Early morning in Suro\'s cluttered workshop. Golden light. First scene of series.',
    tone: 'Wonder turning to tension',
    length: 8,
    keyInfo: 'Detector works. Core energy spiking. Something is wrong.',
    subtext: 'Suro seeks validation. Buya senses danger before device confirms.',
    conflictLevel: 'Low (external threat emerging)',
    voiceGuidelines: 'Suro: Technical, excited, uses "we" for shared discovery. Buya: Intuitive, poetic, reads between lines.'
  }
} as const satisfies z.infer<typeof Schemas.prompt>;

/**
 * All prompt templates
 */
export const promptTemplates = {
  generation: generationPromptTemplate,
  planning: planningPromptTemplate,
  production: productionPromptTemplate,
  review: reviewPromptTemplate,
  validation: validationPromptTemplate,
  dialogue: dialoguePromptTemplate,
} as const;

/**
 * Prompt template registry
 */
export const PROMPT_TEMPLATE_REGISTRY: Record<string, typeof promptTemplates[keyof typeof promptTemplates]> = {
  'generation-scene-v1': generationPromptTemplate,
  'planning-episode-v1': planningPromptTemplate,
  'production-breakdown-v1': productionPromptTemplate,
  'review-content-v1': reviewPromptTemplate,
  'validation-canon-v1': validationPromptTemplate,
  'generation-dialogue-v1': dialoguePromptTemplate,
};