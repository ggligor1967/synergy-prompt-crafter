import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' }));

// P1.1 — Rate limiting: max 30 requests per minute per IP.
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
});
app.use('/api/', apiLimiter);

if (!process.env.GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not set. API calls will fail.');
}

// P4.2 — Allowlist of models the client may request.
// The server validates the model field so clients cannot invoke arbitrary endpoints.
const ALLOWED_GEMINI_MODELS = [
  'gemini-2.5-flash-preview-04-17',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

app.get('/api/health', (_req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ ok: false, error: 'GEMINI_API_KEY not configured on server.' });
  }
  res.json({ ok: true });
});

app.post('/api/gemini/generate-content', async (req, res) => {
  try {
    const { contents, config, model: requestedModel } = req.body;

    if (!contents) {
      return res.status(400).json({ error: 'contents is required' });
    }

    // P1.3 — Validate size regardless of whether contents is a string or object.
    const contentsStr = typeof contents === 'string' ? contents : JSON.stringify(contents);
    if (contentsStr.length > 50000) {
      return res.status(400).json({ error: 'Request contents too large (max 50,000 characters).' });
    }

    // P4.2 — Use the client-requested model only if it is in the allowlist.
    const model =
      typeof requestedModel === 'string' && ALLOWED_GEMINI_MODELS.includes(requestedModel)
        ? requestedModel
        : DEFAULT_GEMINI_MODEL;

    const response = await ai.models.generateContent({
      model,
      contents,
      config: config || {},
    });

    res.json({ text: response.text });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
