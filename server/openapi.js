/** OpenAPI 3.0 specification for the Synergy Prompt Crafter REST API. */
export const spec = {
  openapi: '3.0.0',
  info: {
    title: 'Synergy Prompt Crafter API',
    version: '1.0.0',
    description: 'REST API for managing AI-generated prompts.',
  },
  servers: [{ url: '/api', description: 'Local dev server' }],
  paths: {
    '/prompts': {
      get: {
        summary: 'List prompts',
        operationId: 'listPrompts',
        parameters: [
          {
            name: 'search',
            in: 'query',
            description: 'Filter by title, coreIdea, or generatedPrompt (case-insensitive)',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Array of prompt records sorted newest-first',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PromptRecord' } } } },
          },
        },
      },
      post: {
        summary: 'Create a prompt',
        operationId: 'createPrompt',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePromptBody' } } },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/PromptRecord' } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/prompts/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: {
        summary: 'Get a prompt by ID',
        operationId: 'getPrompt',
        responses: {
          200: { description: 'Prompt record', content: { 'application/json': { schema: { $ref: '#/components/schemas/PromptRecord' } } } },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      put: {
        summary: 'Update a prompt',
        operationId: 'updatePrompt',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatePromptBody' } } },
        },
        responses: {
          200: { description: 'Updated record', content: { 'application/json': { schema: { $ref: '#/components/schemas/PromptRecord' } } } },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      delete: {
        summary: 'Delete a prompt',
        operationId: 'deletePrompt',
        responses: {
          204: { description: 'Deleted' },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
  },
  components: {
    schemas: {
      PromptRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          coreIdea: { type: 'string' },
          promptData: { type: 'object', description: 'Structured prompt fields (role, context, task, etc.)' },
          generatedPrompt: { type: 'string' },
          disciplines: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          isFavorite: { type: 'boolean' },
          createdAt: { type: 'number', description: 'Unix timestamp (ms)' },
          updatedAt: { type: 'number', description: 'Unix timestamp (ms)' },
        },
      },
      CreatePromptBody: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          coreIdea: { type: 'string' },
          promptData: { type: 'object' },
          generatedPrompt: { type: 'string' },
          disciplines: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          isFavorite: { type: 'boolean', default: false },
        },
      },
      UpdatePromptBody: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          coreIdea: { type: 'string' },
          promptData: { type: 'object' },
          generatedPrompt: { type: 'string' },
          disciplines: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          isFavorite: { type: 'boolean' },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
};
