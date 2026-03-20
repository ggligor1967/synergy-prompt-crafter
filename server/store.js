/**
 * JSON-file-based prompt store.
 * Call createStore(path) to get a store instance bound to a specific file.
 * The default export uses server/prompts.json (auto-created on first write).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} dbPath  Absolute path to the JSON store file.
 */
export function createStore(dbPath) {
  function read() {
    if (!existsSync(dbPath)) return { prompts: [] };
    try {
      return JSON.parse(readFileSync(dbPath, 'utf-8'));
    } catch {
      return { prompts: [] };
    }
  }

  function write(data) {
    writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  return {
    /** @param {{ search?: string }} [opts] */
    getAll({ search } = {}) {
      const { prompts } = read();
      const sorted = [...prompts].sort((a, b) => b.createdAt - a.createdAt);
      if (!search) return sorted;
      const q = search.toLowerCase();
      return sorted.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          (p.coreIdea || '').toLowerCase().includes(q) ||
          (p.generatedPrompt || '').toLowerCase().includes(q),
      );
    },

    /** @param {string} id */
    getById(id) {
      return read().prompts.find(p => p.id === id) || null;
    },

    /**
     * @param {object} data  Fields without id/timestamps.
     * @returns {object}     The created record.
     */
    create(data) {
      const store = read();
      const now = Date.now();
      const record = { ...data, id: randomUUID(), createdAt: now, updatedAt: now };
      store.prompts.push(record);
      write(store);
      return record;
    },

    /**
     * @param {string} id
     * @param {object} changes
     * @returns {object|null}  Updated record, or null if not found.
     */
    update(id, changes) {
      const store = read();
      const idx = store.prompts.findIndex(p => p.id === id);
      if (idx === -1) return null;
      const updated = { ...store.prompts[idx], ...changes, id, updatedAt: Date.now() };
      store.prompts[idx] = updated;
      write(store);
      return updated;
    },

    /**
     * @param {string} id
     * @returns {boolean}  true if deleted, false if not found.
     */
    delete(id) {
      const store = read();
      const idx = store.prompts.findIndex(p => p.id === id);
      if (idx === -1) return false;
      store.prompts.splice(idx, 1);
      write(store);
      return true;
    },
  };
}

export const defaultStore = createStore(join(__dir, 'prompts.json'));
