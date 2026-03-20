import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import { createPromptsRouter } from './routes/prompts.js';
import { spec } from './openapi.js';

export function createApp({ store } = {}) {
  const app = express();

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '100kb' }));

  // Shared-secret auth (optional — only enforced when API_SECRET is set)
  const API_SECRET = process.env.API_SECRET;
  if (API_SECRET) {
    app.use('/api/', (req, res, next) => {
      if (req.path === '/docs' || req.path === '/openapi.json') {
        return next();
      }
      if (req.headers['x-api-key'] !== API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    });
  }

  // Rate limiting: 30 req/min per IP
  const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a moment before trying again.' },
  });
  app.use('/api/', apiLimiter);

  // Gemini setup
  if (!process.env.GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY is not set. AI calls will fail.');
  }
  const ALLOWED_GEMINI_MODELS = [
    'gemini-2.5-flash-preview-04-17',
    'gemini-2.5-pro-preview-06-05',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];
  const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  // Health check
  app.get('/api/health', (_req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ ok: false, error: 'GEMINI_API_KEY not configured on server.' });
    }
    res.json({ ok: true });
  });

  // Gemini proxy
  app.post('/api/gemini/generate-content', async (req, res) => {
    try {
      const { contents, config, model: requestedModel } = req.body;
      if (!contents) return res.status(400).json({ error: 'contents is required' });
      const contentsStr = typeof contents === 'string' ? contents : JSON.stringify(contents);
      if (contentsStr.length > 50000) {
        return res.status(400).json({ error: 'Request contents too large (max 50,000 characters).' });
      }
      const model =
        typeof requestedModel === 'string' && ALLOWED_GEMINI_MODELS.includes(requestedModel)
          ? requestedModel
          : DEFAULT_GEMINI_MODEL;
      const response = await ai.models.generateContent({ model, contents, config: config || {} });
      res.json({ text: response.text });
    } catch (error) {
      console.error('Gemini API Error:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
  });

  // Prompts CRUD
  app.use('/api/prompts', store ? createPromptsRouter(store) : createPromptsRouter());

  // OpenAPI spec
  app.get('/api/openapi.json', (_req, res) => res.json(spec));

  // Swagger UI (CDN-hosted, zero install)
  app.get('/api/docs', (_req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Synergy Prompt Crafter API Docs</title>
  <meta charset="utf-8"/>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
  SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui', presets: [SwaggerUIBundle.presets.apis] });
</script>
</body>
</html>`);
  });

  return app;
}
