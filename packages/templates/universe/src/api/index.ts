/**
 * @suro-buya/templates - API Templates
 * 
 * Template definitions for API requests/responses and integration contracts.
 */

import { z } from 'zod';
import { Schemas } from '../schemas';

/**
 * API request templates
 */
export const apiRequestTemplates = {
  generateScene: {
    id: 'api-generate-scene',
    name: 'Generate Scene Request',
    category: 'schema' as const,
    description: 'API request template for scene generation',
    content: `POST /api/v1/universes/{universeId}/scenes/generate
Content-Type: application/json

{
  "episodeId": "{{episodeId}}",
  "sceneNumber": {{sceneNumber}},
  "context": {
    "previousScenes": {{previousScenes}},
    "characterStates": {{characterStates}},
    "worldState": {{worldState}}
  },
  "options": {
    "model": "{{model}}",
    "temperature": {{temperature}},
    "maxTokens": {{maxTokens}},
    "stream": {{stream}}
  }
}`,
    variables: [
      { name: 'universeId', type: 'string' as const, required: true, description: 'Universe identifier' },
      { name: 'episodeId', type: 'string' as const, required: true, description: 'Episode identifier' },
      { name: 'sceneNumber', type: 'number' as const, required: true, description: 'Scene number' },
      { name: 'previousScenes', type: 'array' as const, required: false, description: 'Previous scene IDs' },
      { name: 'characterStates', type: 'object' as const, required: false, description: 'Character states' },
      { name: 'worldState', type: 'object' as const, required: false, description: 'World state' },
      { name: 'model', type: 'string' as const, required: false, description: 'LLM model', default: 'gpt-4' },
      { name: 'temperature', type: 'number' as const, required: false, description: 'Temperature', default: 0.7 },
      { name: 'maxTokens', type: 'number' as const, required: false, description: 'Max tokens', default: 4096 },
      { name: 'stream', type: 'boolean' as const, required: false, description: 'Stream response', default: false },
    ],
    example: {
      universeId: 'suro-buya',
      episodeId: 's01e01',
      sceneNumber: 1,
      previousScenes: [],
      characterStates: { suro: { location: 'workshop', mood: 'focused' }, buya: { location: 'workshop', mood: 'curious' } },
      worldState: { coreStability: 'stable', timeOfDay: 'morning' },
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 4096,
      stream: false
    }
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,

  generateEpisode: {
    id: 'api-generate-episode',
    name: 'Generate Episode Request',
    category: 'schema' as const,
    description: 'API request template for episode generation',
    content: `POST /api/v1/universes/{universeId}/episodes/generate
Content-Type: application/json

{
  "seasonNumber": {{seasonNumber}},
  "episodeNumber": {{episodeNumber}},
  "storyArc": "{{storyArc}}",
  "options": {
    "model": "{{model}}",
    "temperature": {{temperature}},
    "maxTokens": {{maxTokens}}
  }
}`,
    variables: [
      { name: 'universeId', type: 'string' as const, required: true, description: 'Universe identifier' },
      { name: 'seasonNumber', type: 'number' as const, required: true, description: 'Season number' },
      { name: 'episodeNumber', type: 'number' as const, required: true, description: 'Episode number' },
      { name: 'storyArc', type: 'string' as const, required: false, description: 'Story arc identifier' },
      { name: 'model', type: 'string' as const, required: false, description: 'LLM model', default: 'gpt-4' },
      { name: 'temperature', type: 'number' as const, required: false, description: 'Temperature', default: 0.7 },
      { name: 'maxTokens', type: 'number' as const, required: false, description: 'Max tokens', default: 8192 },
    ],
    example: {
      universeId: 'suro-buya',
      seasonNumber: 1,
      episodeNumber: 1,
      storyArc: 'origin',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 8192
    }
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,

  validateCanon: {
    id: 'api-validate-canon',
    name: 'Validate Canon Request',
    category: 'schema' as const,
    description: 'API request template for canon validation',
    content: `POST /api/v1/universes/{universeId}/validate
Content-Type: application/json

{
  "content": "{{content}}",
  "contentType": "{{contentType}}",
  "strictMode": {{strictMode}}
}`,
    variables: [
      { name: 'universeId', type: 'string' as const, required: true, description: 'Universe identifier' },
      { name: 'content', type: 'string' as const, required: true, description: 'Content to validate' },
      { name: 'contentType', type: 'string' as const, required: true, description: 'Content type (scene, episode, story, character, world)' },
      { name: 'strictMode', type: 'boolean' as const, required: false, description: 'Strict validation mode', default: false },
    ],
    example: {
      universeId: 'suro-buya',
      content: 'Scene 1 script content...',
      contentType: 'scene',
      strictMode: true
    }
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,

  getContext: {
    id: 'api-get-context',
    name: 'Get Generation Context Request',
    category: 'schema' as const,
    description: 'API request template for retrieving generation context',
    content: `GET /api/v1/universes/{universeId}/context?episodeId={{episodeId}}&sceneNumber={{sceneNumber}}`,
    variables: [
      { name: 'universeId', type: 'string' as const, required: true, description: 'Universe identifier' },
      { name: 'episodeId', type: 'string' as const, required: true, description: 'Episode identifier' },
      { name: 'sceneNumber', type: 'number' as const, required: true, description: 'Scene number' },
    ],
    example: {
      universeId: 'suro-buya',
      episodeId: 's01e01',
      sceneNumber: 1
    }
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,

  listTemplates: {
    id: 'api-list-templates',
    name: 'List Templates Request',
    category: 'schema' as const,
    description: 'API request template for listing available templates',
    content: `GET /api/v1/universes/{universeId}/templates?category={{category}}`,
    variables: [
      { name: 'universeId', type: 'string' as const, required: true, description: 'Universe identifier' },
      { name: 'category', type: 'string' as const, required: false, description: 'Template category filter' },
    ],
    example: {
      universeId: 'suro-buya',
      category: 'character'
    }
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,
};

/**
 * API response templates
 */
export const apiResponseTemplates = {
  generateSceneSuccess: {
    id: 'api-generate-scene-success',
    name: 'Generate Scene Success Response',
    category: 'schema' as const,
    description: 'API response template for successful scene generation',
    content: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "requestId": "{{requestId}}",
  "success": true,
  "data": {
    "scene": {{scene}},
    "metadata": {
      "model": "{{model}}",
      "tokensUsed": {{tokensUsed}},
      "duration": {{duration}},
      "timestamp": "{{timestamp}}"
    }
  }
}`,
    variables: [
      { name: 'requestId', type: 'string' as const, required: true, description: 'Request UUID' },
      { name: 'scene', type: 'object' as const, required: true, description: 'Generated scene object' },
      { name: 'model', type: 'string' as const, required: true, description: 'Model used' },
      { name: 'tokensUsed', type: 'number' as const, required: true, description: 'Tokens consumed' },
      { name: 'duration', type: 'number' as const, required: true, description: 'Duration in ms' },
      { name: 'timestamp', type: 'string' as const, required: true, description: 'ISO timestamp' },
    ],
    example: {
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      scene: { id: 'scene-s01e01-sc01', number: 1, content: '...' },
      model: 'gpt-4',
      tokensUsed: 2341,
      duration: 12500,
      timestamp: '2024-01-15T10:30:00Z'
    }
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,

  generateSceneError: {
    id: 'api-generate-scene-error',
    name: 'Generate Scene Error Response',
    category: 'schema' as const,
    description: 'API response template for scene generation errors',
    content: `HTTP/1.1 {{statusCode}} {{statusText}}
Content-Type: application/json

{
  "requestId": "{{requestId}}",
  "success": false,
  "error": {
    "code": "{{errorCode}}",
    "message": "{{errorMessage}}",
    "details": {{errorDetails}}
  }
}`,
    variables: [
      { name: 'statusCode', type: 'number' as const, required: true, description: 'HTTP status code' },
      { name: 'statusText', type: 'string' as const, required: true, description: 'HTTP status text' },
      { name: 'requestId', type: 'string' as const, required: true, description: 'Request UUID' },
      { name: 'errorCode', type: 'string' as const, required: true, description: 'Error code' },
      { name: 'errorMessage', type: 'string' as const, required: true, description: 'Error message' },
      { name: 'errorDetails', type: 'object' as const, required: false, description: 'Error details' },
    ],
    example: {
      statusCode: 400,
      statusText: 'Bad Request',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Invalid request parameters',
      errorDetails: { field: 'sceneNumber', issue: 'Must be positive integer' }
    }
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,

  validateCanonSuccess: {
    id: 'api-validate-canon-success',
    name: 'Validate Canon Success Response',
    category: 'schema' as const,
    description: 'API response template for successful canon validation',
    content: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "requestId": "{{requestId}}",
  "success": true,
  "data": {
    "valid": {{valid}},
    "violations": {{violations}},
    "consistencyScore": {{consistencyScore}}
  }
}`,
    variables: [
      { name: 'requestId', type: 'string' as const, required: true, description: 'Request UUID' },
      { name: 'valid', type: 'boolean' as const, required: true, description: 'Overall validity' },
      { name: 'violations', type: 'array' as const, required: true, description: 'Violation list' },
      { name: 'consistencyScore', type: 'number' as const, required: true, description: 'Consistency score 0-1' },
    ],
    example: {
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      valid: false,
      violations: [
        { rule: 'CHAR-001', severity: 'error', location: 'line 5', expected: 'Suro', actual: 'Soru', suggestion: 'Use exact name from bible' }
      ],
      consistencyScore: 0.85
    }
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,

  getContextSuccess: {
    id: 'api-get-context-success',
    name: 'Get Context Success Response',
    category: 'schema' as const,
    description: 'API response template for successful context retrieval',
    content: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "requestId": "{{requestId}}",
  "success": true,
  "data": {
    "universeContext": "{{universeContext}}",
    "characterBibles": {{characterBibles}},
    "worldBible": "{{worldBible}}",
    "storyContext": "{{storyContext}}",
    "episodeContext": "{{episodeContext}}",
    "previousScenes": {{previousScenes}},
    "characterStates": {{characterStates}},
    "worldState": {{worldState}}
  }
}`,
    variables: [
      { name: 'requestId', type: 'string' as const, required: true, description: 'Request UUID' },
      { name: 'universeContext', type: 'string' as const, required: true, description: 'Universe context' },
      { name: 'characterBibles', type: 'object' as const, required: true, description: 'Character bibles' },
      { name: 'worldBible', type: 'string' as const, required: true, description: 'World bible' },
      { name: 'storyContext', type: 'string' as const, required: true, description: 'Story context' },
      { name: 'episodeContext', type: 'string' as const, required: true, description: 'Episode context' },
      { name: 'previousScenes', type: 'array' as const, required: true, description: 'Previous scenes' },
      { name: 'characterStates', type: 'object' as const, required: true, description: 'Character states' },
      { name: 'worldState', type: 'object' as const, required: true, description: 'World state' },
    ],
    example: {
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      universeContext: 'Aetheris world...',
      characterBibles: { suro: '...', buya: '...' },
      worldBible: 'Floating islands...',
      storyContext: 'Origin arc...',
      episodeContext: 'Episode 1...',
      previousScenes: [],
      characterStates: { suro: {}, buya: {} },
      worldState: { coreStability: 'stable' }
    }
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,
};

/**
 * Webhook templates
 */
export const webhookTemplates = {
  generationComplete: {
    id: 'webhook-generation-complete',
    name: 'Generation Complete Webhook',
    category: 'schema' as const,
    description: 'Webhook payload for generation completion',
    content: `POST {{webhookUrl}}
Content-Type: application/json
X-Webhook-Signature: {{signature}}

{
  "event": "generation.complete",
  "timestamp": "{{timestamp}}",
  "data": {
    "requestId": "{{requestId}}",
    "universeId": "{{universeId}}",
    "contentType": "{{contentType}}",
    "contentId": "{{contentId}}",
    "status": "completed",
    "resultUrl": "{{resultUrl}}"
  }
}`,
    variables: [
      { name: 'webhookUrl', type: 'string' as const, required: true, description: 'Webhook URL' },
      { name: 'signature', type: 'string' as const, required: true, description: 'HMAC signature' },
      { name: 'timestamp', type: 'string' as const, required: true, description: 'ISO timestamp' },
      { name: 'requestId', type: 'string' as const, required: true, description: 'Original request ID' },
      { name: 'universeId', type: 'string' as const, required: true, description: 'Universe ID' },
      { name: 'contentType', type: 'string' as const, required: true, description: 'Content type' },
      { name: 'contentId', type: 'string' as const, required: true, description: 'Generated content ID' },
      { name: 'resultUrl', type: 'string' as const, required: true, description: 'Result download URL' },
    ],
    example: {
      webhookUrl: 'https://studio.example.com/webhooks/generation',
      signature: 'sha256=abc123...',
      timestamp: '2024-01-15T10:30:00Z',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      universeId: 'suro-buya',
      contentType: 'scene',
      contentId: 'scene-s01e01-sc01',
      resultUrl: 'https://storage.example.com/scenes/scene-s01e01-sc01.json'
    }
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,

  validationFailed: {
    id: 'webhook-validation-failed',
    name: 'Validation Failed Webhook',
    category: 'schema' as const,
    description: 'Webhook payload for validation failures',
    content: `POST {{webhookUrl}}
Content-Type: application/json
X-Webhook-Signature: {{signature}}

{
  "event": "validation.failed",
  "timestamp": "{{timestamp}}",
  "data": {
    "requestId": "{{requestId}}",
    "universeId": "{{universeId}}",
    "contentType": "{{contentType}}",
    "contentId": "{{contentId}}",
    "violations": {{violations}},
    "consistencyScore": {{consistencyScore}}
  }
}`,
    variables: [
      { name: 'webhookUrl', type: 'string' as const, required: true, description: 'Webhook URL' },
      { name: 'signature', type: 'string' as const, required: true, description: 'HMAC signature' },
      { name: 'timestamp', type: 'string' as const, required: true, description: 'ISO timestamp' },
      { name: 'requestId', type: 'string' as const, required: true, description: 'Original request ID' },
      { name: 'universeId', type: 'string' as const, required: true, description: 'Universe ID' },
      { name: 'contentType', type: 'string' as const, required: true, description: 'Content type' },
      { name: 'contentId', type: 'string' as const, required: true, description: 'Content ID' },
      { name: 'violations', type: 'array' as const, required: true, description: 'Violation list' },
      { name: 'consistencyScore', type: 'number' as const, required: true, description: 'Consistency score' },
    ],
    example: {
      webhookUrl: 'https://studio.example.com/webhooks/validation',
      signature: 'sha256=abc123...',
      timestamp: '2024-01-15T10:30:00Z',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      universeId: 'suro-buya',
      contentType: 'scene',
      contentId: 'scene-s01e01-sc01',
      violations: [{ rule: 'CHAR-001', severity: 'error', location: 'line 5' }],
      consistencyScore: 0.65
    }
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,
};

/**
 * SDK usage templates
 */
export const sdkTemplates = {
  typescriptClient: {
    id: 'sdk-typescript-client',
    name: 'TypeScript SDK Client',
    category: 'schema' as const,
    description: 'TypeScript SDK usage example',
    content: `import { SuroBuyaClient } from '@suro-buya/sdk';

const client = new SuroBuyaClient({
  apiKey: process.env.SURO_BUYA_API_KEY,
  baseUrl: 'https://api.suro-buya.com/v1',
  universeId: 'suro-buya'
});

// Generate a scene
const scene = await client.scenes.generate({
  episodeId: 's01e01',
  sceneNumber: 1,
  context: {
    previousScenes: [],
    characterStates: {
      suro: { location: 'workshop', mood: 'focused' },
      buya: { location: 'workshop', mood: 'curious' }
    }
  },
  options: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4096
  }
});

// Validate canon
const validation = await client.canon.validate({
  content: scene.content,
  contentType: 'scene',
  strictMode: true
});

if (!validation.valid) {
  console.error('Canon violations:', validation.violations);
}

// Get generation context
const context = await client.context.get({
  episodeId: 's01e01',
  sceneNumber: 1
});`,
    variables: [],
    example: {}
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,

  pythonClient: {
    id: 'sdk-python-client',
    name: 'Python SDK Client',
    category: 'schema' as const,
    description: 'Python SDK usage example',
    content: `from suro_buya import SuroBuyaClient

client = SuroBuyaClient(
    api_key=os.environ["SURO_BUYA_API_KEY"],
    base_url="https://api.suro-buya.com/v1",
    universe_id="suro-buya"
)

# Generate a scene
scene = client.scenes.generate(
    episode_id="s01e01",
    scene_number=1,
    context={
        "previous_scenes": [],
        "character_states": {
            "suro": {"location": "workshop", "mood": "focused"},
            "buya": {"location": "workshop", "mood": "curious"}
        }
    },
    options={
        "model": "gpt-4",
        "temperature": 0.7,
        "max_tokens": 4096
    }
)

# Validate canon
validation = client.canon.validate(
    content=scene.content,
    content_type="scene",
    strict_mode=True
)

if not validation.valid:
    print(f"Canon violations: {validation.violations}")

# Get generation context
context = client.context.get(
    episode_id="s01e01",
    scene_number=1
)`,
    variables: [],
    example: {}
  } as const satisfies z.infer<typeof Schemas.baseTemplate>,
};

/**
 * All API templates combined
 */
export const apiTemplates = {
  requests: apiRequestTemplates,
  responses: apiResponseTemplates,
  webhooks: webhookTemplates,
  sdk: sdkTemplates,
} as const;

/**
 * API template registry
 */
export const API_TEMPLATE_REGISTRY: Record<string, z.infer<typeof Schemas.baseTemplate>> = {
  // Requests
  'api-generate-scene': apiRequestTemplates.generateScene,
  'api-generate-episode': apiRequestTemplates.generateEpisode,
  'api-validate-canon': apiRequestTemplates.validateCanon,
  'api-get-context': apiRequestTemplates.getContext,
  'api-list-templates': apiRequestTemplates.listTemplates,
  // Responses
  'api-generate-scene-success': apiResponseTemplates.generateSceneSuccess,
  'api-generate-scene-error': apiResponseTemplates.generateSceneError,
  'api-validate-canon-success': apiResponseTemplates.validateCanonSuccess,
  'api-get-context-success': apiResponseTemplates.getContextSuccess,
  // Webhooks
  'webhook-generation-complete': webhookTemplates.generationComplete,
  'webhook-validation-failed': webhookTemplates.validationFailed,
  // SDK
  'sdk-typescript-client': sdkTemplates.typescriptClient,
  'sdk-python-client': sdkTemplates.pythonClient,
};
