/**
 * @suro-buya/templates - Engine Templates
 * 
 * Template definitions for engine-facing content (context, planning, execution, etc.)
 */

import { z } from 'zod';
import { Schemas } from '../schemas';

/**
 * Context building template
 */
export const contextTemplate = {
  id: 'context-base',
  name: 'Base Context Template',
  category: 'schema' as const,
  description: 'Template for building generation context',
  content: `# Generation Context

## Universe Context
- **Universe**: {{universeId}}
- **Version**: {{universeVersion}}
- **Locale**: {{locale}}

## Character States
{{#each characterStates}}
### {{@key}}
{{#each this}}
- **{{@key}}**: {{this}}
{{/each}}
{{/each}}

## World State
{{#each worldState}}
- **{{@key}}**: {{this}}
{{/each}}

## Previous Scenes
{{#each previousScenes}}
- {{this}}
{{/each}}

## Active Constraints
{{#each constraints}}
- {{this}}
{{/each}}`,
  variables: [
    { name: 'universeId', type: 'string' as const, required: true, description: 'Universe identifier' },
    { name: 'universeVersion', type: 'string' as const, required: true, description: 'Universe version' },
    { name: 'locale', type: 'string' as const, required: true, description: 'Current locale' },
    { name: 'characterStates', type: 'object' as const, required: false, description: 'Character state map' },
    { name: 'worldState', type: 'object' as const, required: false, description: 'World state map' },
    { name: 'previousScenes', type: 'array' as const, required: false, description: 'Previous scene summaries' },
    { name: 'constraints', type: 'array' as const, required: false, description: 'Active constraints' },
  ],
  example: {
    universeId: 'suro-buya',
    universeVersion: '1.0.0',
    locale: 'id-ID',
    characterStates: {
      suro: { location: 'sky-ship', mood: 'determined', energy: 'high' },
      buya: { location: 'sky-ship', mood: 'concerned', energy: 'medium' }
    },
    worldState: { coreStability: 'critical', weather: 'stormy', timeOfDay: 'dawn' },
    previousScenes: ['s01e01-scene1: Workshop discovery', 's01e01-scene2: Village evacuation'],
    constraints: ['Must maintain canon consistency', 'Character voices must match bible', 'No deus ex machina solutions']
  }
} as const satisfies z.infer<typeof Schemas.baseTemplate>;

/**
 * Planning template
 */
export const planningTemplate = {
  id: 'planning-base',
  name: 'Base Planning Template',
  category: 'schema' as const,
  description: 'Template for episode/scene planning',
  content: `# Planning Document: {{title}}

## Objective
{{objective}}

## Scope
- **Type**: {{type}}
- **Scale**: {{scale}}
- **Timeline**: {{timeline}}

## Input Parameters
{{#each inputs}}
- **{{@key}}**: {{this}}
{{/each}}

## Constraints
{{#each constraints}}
- {{this}}
{{/each}}

## Success Criteria
{{#each successCriteria}}
- {{this}}
{{/each}}

## Risk Assessment
{{#each risks}}
- **{{@key}}**: {{this}}
{{/each}}

## Resource Requirements
{{#each resources}}
- {{this}}
{{/each}}`,
  variables: [
    { name: 'title', type: 'string' as const, required: true, description: 'Planning document title' },
    { name: 'objective', type: 'string' as const, required: true, description: 'Primary objective' },
    { name: 'type', type: 'string' as const, required: true, description: 'Planning type' },
    { name: 'scale', type: 'string' as const, required: true, description: 'Planning scale' },
    { name: 'timeline', type: 'string' as const, required: true, description: 'Timeline estimate' },
    { name: 'inputs', type: 'object' as const, required: false, description: 'Input parameters' },
    { name: 'constraints', type: 'array' as const, required: false, description: 'Constraints' },
    { name: 'successCriteria', type: 'array' as const, required: false, description: 'Success criteria' },
    { name: 'risks', type: 'object' as const, required: false, description: 'Risk assessment' },
    { name: 'resources', type: 'array' as const, required: false, description: 'Resource requirements' },
  ],
  example: {
    title: 'Episode 1 Scene Breakdown',
    objective: 'Break down Episode 1 into 5 scenes with proper pacing',
    type: 'episode-breakdown',
    scale: 'single-episode',
    timeline: '2 hours',
    inputs: { episodeNumber: 1, seasonNumber: 1, storyArc: 'origin' },
    constraints: ['Max 5 scenes', 'Each scene 5-10 min', 'Must include all main characters', 'End on cliffhanger'],
    successCriteria: ['Clear character introductions', 'Inciting incident established', 'Stakes defined', 'Visual variety'],
    risks: { pacing: 'Too many scenes may rush character moments', scope: 'May need to cut subplots' },
    resources: ['Character bibles', 'World bible', 'Story outline', 'Previous episode (if any)']
  }
} as const satisfies z.infer<typeof Schemas.baseTemplate>;

/**
 * Execution template
 */
export const executionTemplate = {
  id: 'execution-base',
  name: 'Base Execution Template',
  category: 'schema' as const,
  description: 'Template for execution runtime configuration',
  content: `# Execution Configuration

## Task
- **ID**: {{taskId}}
- **Type**: {{taskType}}
- **Priority**: {{priority}}

## Configuration
{{#each config}}
- **{{@key}}**: {{this}}
{{/each}}

## Input
{{#each input}}
- **{{@key}}**: {{this}}
{{/each}}

## Output Specification
{{#each outputSpec}}
- **{{@key}}**: {{this}}
{{/each}}

## Monitoring
- **Timeout**: {{timeout}}ms
- **Retries**: {{retries}}
- **Checkpoint Interval**: {{checkpointInterval}}ms

## Fallback
{{#if fallback}}
- **Strategy**: {{fallback.strategy}}
- **Config**: {{fallback.config}}
{{/if}}`,
  variables: [
    { name: 'taskId', type: 'string' as const, required: true, description: 'Task identifier' },
    { name: 'taskType', type: 'string' as const, required: true, description: 'Task type' },
    { name: 'priority', type: 'string' as const, required: true, description: 'Priority level' },
    { name: 'config', type: 'object' as const, required: false, description: 'Execution config' },
    { name: 'input', type: 'object' as const, required: false, description: 'Input data' },
    { name: 'outputSpec', type: 'object' as const, required: false, description: 'Output specification' },
    { name: 'timeout', type: 'number' as const, required: true, description: 'Timeout in ms' },
    { name: 'retries', type: 'number' as const, required: true, description: 'Max retries' },
    { name: 'checkpointInterval', type: 'number' as const, required: true, description: 'Checkpoint interval' },
    { name: 'fallback', type: 'object' as const, required: false, description: 'Fallback configuration' },
  ],
  example: {
    taskId: 'generate-scene-s01e01-sc01',
    taskType: 'scene-generation',
    priority: 'high',
    config: { model: 'gpt-4', temperature: 0.7, maxTokens: 4096 },
    input: { contextId: 'ctx-s01e01', sceneTemplate: 'scene-base', variables: {} },
    outputSpec: { format: 'markdown', schema: 'scene-template', validate: true },
    timeout: 120000,
    retries: 3,
    checkpointInterval: 30000,
    fallback: { strategy: 'retry-with-lower-temperature', config: { temperature: 0.5 } }
  }
} as const satisfies z.infer<typeof Schemas.baseTemplate>;

/**
 * Production template
 */
export const productionTemplate = {
  id: 'production-base',
  name: 'Base Production Template',
  category: 'schema' as const,
  description: 'Template for production pipeline configuration',
  content: `# Production Pipeline: {{name}}

## Stages
{{#each stages}}
### {{order}}. {{name}} ({{type}})
- **Description**: {{description}}
- **Input**: {{input}}
- **Output**: {{output}}
- **Dependencies**: {{#each dependencies}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Estimated Duration**: {{duration}}min
- **Retry Policy**: {{retryPolicy}}
{{/each}}

## Quality Gates
{{#each qualityGates}}
- **Stage**: {{stage}}
- **Checks**: {{#each checks}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Threshold**: {{threshold}}
{{/each}}

## Notifications
{{#each notifications}}
- **Event**: {{event}}
- **Channels**: {{#each channels}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Recipients**: {{#each recipients}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/each}}

## Rollback
- **Strategy**: {{rollback.strategy}}
- **Triggers**: {{#each rollback.triggers}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Max Rollbacks**: {{rollback.maxRollbacks}}`,
  variables: [
    { name: 'name', type: 'string' as const, required: true, description: 'Pipeline name' },
    { name: 'stages', type: 'array' as const, required: true, description: 'Pipeline stages' },
    { name: 'qualityGates', type: 'array' as const, required: false, description: 'Quality gates' },
    { name: 'notifications', type: 'array' as const, required: false, description: 'Notification config' },
    { name: 'rollback', type: 'object' as const, required: false, description: 'Rollback config' },
  ],
  example: {
    name: 'Scene Generation Pipeline',
    stages: [
      { order: 1, name: 'Context Build', type: 'preprocessing', description: 'Build generation context from bibles', input: 'episode-id', output: 'context-object', dependencies: [], duration: 2, retryPolicy: 'retry-3' },
      { order: 2, name: 'Scene Generate', type: 'generation', description: 'Generate scene content via LLM', input: 'context + template', output: 'raw-scene', dependencies: ['context-object'], duration: 5, retryPolicy: 'retry-3' },
      { order: 3, name: 'Canon Validate', type: 'validation', description: 'Validate against canon rules', input: 'raw-scene', output: 'validated-scene', dependencies: ['raw-scene'], duration: 3, retryPolicy: 'retry-2' },
      { order: 4, name: 'Format Output', type: 'postprocessing', description: 'Format for delivery', input: 'validated-scene', output: 'final-scene', dependencies: ['validated-scene'], duration: 1, retryPolicy: 'retry-1' }
    ],
    qualityGates: [
      { stage: 'Canon Validate', checks: ['character-consistency', 'world-consistency', 'plot-consistency'], threshold: 0.85 },
      { stage: 'Format Output', checks: ['schema-validation', 'template-compliance'], threshold: 0.95 }
    ],
    notifications: [
      { event: 'stage-complete', channels: ['log'], recipients: ['system'] },
      { event: 'pipeline-failed', channels: ['slack', 'email'], recipients: ['team-lead', 'on-call'] }
    ],
    rollback: { strategy: 'full-rollback', triggers: ['quality-gate-failure', 'timeout', 'critical-error'], maxRollbacks: 2 }
  }
} as const satisfies z.infer<typeof Schemas.baseTemplate>;

/**
 * Review template
 */
export const reviewTemplate = {
  id: 'review-base',
  name: 'Base Review Template',
  category: 'schema' as const,
  description: 'Template for content review process',
  content: `# Review: {{contentId}}

## Content
- **Type**: {{contentType}}
- **Version**: {{version}}
- **Author**: {{author}}

## Review Criteria
{{#each criteria}}
- **{{name}}**: {{description}} (Weight: {{weight}})
{{/each}}

## Review Results
{{#each results}}
### {{criterion}}
- **Score**: {{score}}/{{maxScore}}
- **Status**: {{status}}
- **Notes**: {{notes}}
{{/each}}

## Overall
- **Total Score**: {{totalScore}}/{{maxTotalScore}}
- **Decision**: {{decision}}
- **Feedback**: {{feedback}}

## Next Steps
{{#each nextSteps}}
- {{this}}
{{/each}}`,
  variables: [
    { name: 'contentId', type: 'string' as const, required: true, description: 'Content identifier' },
    { name: 'contentType', type: 'string' as const, required: true, description: 'Content type' },
    { name: 'version', type: 'string' as const, required: true, description: 'Content version' },
    { name: 'author', type: 'string' as const, required: true, description: 'Content author' },
    { name: 'criteria', type: 'array' as const, required: true, description: 'Review criteria' },
    { name: 'results', type: 'array' as const, required: true, description: 'Review results' },
    { name: 'totalScore', type: 'number' as const, required: true, description: 'Total score' },
    { name: 'maxTotalScore', type: 'number' as const, required: true, description: 'Max possible score' },
    { name: 'decision', type: 'string' as const, required: true, description: 'Review decision' },
    { name: 'feedback', type: 'string' as const, required: true, description: 'Reviewer feedback' },
    { name: 'nextSteps', type: 'array' as const, required: false, description: 'Next steps' },
  ],
  example: {
    contentId: 'scene-s01e01-sc01',
    contentType: 'scene',
    version: '1.0.0',
    author: 'engine-v2',
    criteria: [
      { name: 'canon-compliance', description: 'Adheres to universe canon', weight: 0.3 },
      { name: 'character-voice', description: 'Characters sound authentic', weight: 0.25 },
      { name: 'pacing', description: 'Scene pacing serves story', weight: 0.2 },
      { name: 'visual-potential', description: 'Scene is visually compelling', weight: 0.15 },
      { name: 'dialogue-quality', description: 'Dialogue is natural and purposeful', weight: 0.1 }
    ],
    results: [
      { criterion: 'canon-compliance', score: 9, maxScore: 10, status: 'pass', notes: 'Minor world-building inconsistency in Core mechanics' },
      { criterion: 'character-voice', score: 8, maxScore: 10, status: 'pass', notes: 'Suro voice spot on; Buya could be more distinct' },
      { criterion: 'pacing', score: 7, maxScore: 10, status: 'pass', notes: 'Good build-up but climax feels rushed' },
      { criterion: 'visual-potential', score: 9, maxScore: 10, status: 'pass', notes: 'Excellent visual beats for storyboarding' },
      { criterion: 'dialogue-quality', score: 8, maxScore: 10, status: 'pass', notes: 'Natural banter, good subtext' }
    ],
    totalScore: 41,
    maxTotalScore: 50,
    decision: 'approved-with-notes',
    feedback: 'Strong scene overall. Address pacing in revision. Consider enhancing Buya\'s voice differentiation.',
    nextSteps: ['Revise pacing in beats 4-5', 'Enhance Buya dialogue distinctiveness', 'Clarify Core mechanics reference']
  }
} as const satisfies z.infer<typeof Schemas.baseTemplate>;

/**
 * Validation template
 */
export const validationTemplate = {
  id: 'validation-base',
  name: 'Base Validation Template',
  category: 'schema' as const,
  description: 'Template for canon validation rules',
  content: `# Validation Rules: {{ruleSet}}

## Rules
{{#each rules}}
### {{id}}: {{name}}
- **Severity**: {{severity}}
- **Category**: {{category}}
- **Description**: {{description}}
- **Check**: {{check}}
- **Expected**: {{expected}}
- **Message**: {{message}}
{{#if suggestion}}
- **Suggestion**: {{suggestion}}
{{/if}}
{{/each}}

## Rule Groups
{{#each groups}}
### {{name}}
- **Rules**: {{#each rules}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Threshold**: {{threshold}}
- **Action**: {{action}}
{{/each}}`,
  variables: [
    { name: 'ruleSet', type: 'string' as const, required: true, description: 'Rule set name' },
    { name: 'rules', type: 'array' as const, required: true, description: 'Validation rules' },
    { name: 'groups', type: 'array' as const, required: false, description: 'Rule groups' },
  ],
  example: {
    ruleSet: 'suro-buya-canon-v1',
    rules: [
      { id: 'CHAR-001', name: 'Character Name Consistency', severity: 'error', category: 'character', description: 'Character names must match bible exactly', check: 'exact-match', expected: 'bible-name', message: 'Character name "{{actual}}" does not match bible "{{expected}}"', suggestion: 'Use the exact name from character bible' },
      { id: 'WORLD-001', name: 'World Geography Consistency', severity: 'error', category: 'world', description: 'Locations must exist in world bible', check: 'exists-in-bible', expected: 'valid-location', message: 'Location "{{actual}}" not found in world bible', suggestion: 'Check spelling or add location to world bible' },
      { id: 'PLOT-001', name: 'Timeline Consistency', severity: 'warning', category: 'plot', description: 'Events must follow established timeline', check: 'timeline-order', expected: 'chronological', message: 'Event "{{actual}}" contradicts established timeline', suggestion: 'Verify event sequence against story bible' }
    ],
    groups: [
      { name: 'character-integrity', rules: ['CHAR-001', 'CHAR-002', 'CHAR-003'], threshold: 1.0, action: 'fail' },
      { name: 'world-integrity', rules: ['WORLD-001', 'WORLD-002'], threshold: 1.0, action: 'fail' },
      { name: 'plot-coherence', rules: ['PLOT-001', 'PLOT-002'], threshold: 0.8, action: 'warn' }
    ]
  }
} as const satisfies z.infer<typeof Schemas.baseTemplate>;

/**
 * All engine templates
 */
export const engineTemplates = {
  context: contextTemplate,
  planning: planningTemplate,
  execution: executionTemplate,
  production: productionTemplate,
  review: reviewTemplate,
  validation: validationTemplate,
} as const;

/**
 * Engine template registry
 */
export const ENGINE_TEMPLATE_REGISTRY: Record<string, typeof engineTemplates[keyof typeof engineTemplates]> = {
  'context-base': contextTemplate,
  'planning-base': planningTemplate,
  'execution-base': executionTemplate,
  'production-base': productionTemplate,
  'review-base': reviewTemplate,
  'validation-base': validationTemplate,
};