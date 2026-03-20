import { Router } from 'express';
import { defaultStore } from '../store.js';

/**
 * Returns an Express Router for the /api/prompts endpoints.
 * Accepts an optional store instance for dependency injection (testing).
 *
 * @param {ReturnType<import('../store.js').createStore>} [store]
 */
export function createPromptsRouter(store = defaultStore) {
  const router = Router();

  // GET /api/prompts?search=...
  router.get('/', (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    res.json(store.getAll({ search }));
  });

  // GET /api/prompts/:id
  router.get('/:id', (req, res) => {
    const record = store.getById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  });

  // POST /api/prompts
  router.post('/', (req, res) => {
    const { title, coreIdea, promptData, generatedPrompt, disciplines, tags, isFavorite } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: '`title` is required' });
    }
    const record = store.create({
      title: title.trim(),
      coreIdea: coreIdea || '',
      promptData: promptData && typeof promptData === 'object' ? promptData : {},
      generatedPrompt: generatedPrompt || '',
      disciplines: Array.isArray(disciplines) ? disciplines : [],
      tags: Array.isArray(tags) ? tags : [],
      isFavorite: Boolean(isFavorite),
    });
    res.status(201).json(record);
  });

  // PUT /api/prompts/:id
  router.put('/:id', (req, res) => {
    const { id } = req.params;
    // Prevent id from being overwritten
    const { id: _ignored, createdAt: _c, ...changes } = req.body;
    const updated = store.update(id, changes);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  });

  // DELETE /api/prompts/:id
  router.delete('/:id', (req, res) => {
    const deleted = store.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  });

  return router;
}

export default createPromptsRouter();
