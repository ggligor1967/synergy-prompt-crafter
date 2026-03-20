import { openDB, IDBPDatabase } from 'idb';
import { PromptData } from '../types';

export interface PromptRecord {
  id: string;
  title: string;
  coreIdea: string;
  promptData: PromptData;
  generatedPrompt: string;
  disciplines: string[];
  tags: string[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'synergy-prompt-crafter';
const STORE = 'prompts';
const DB_VERSION = 1;

let dbOverride: IDBPDatabase | null = null;

/** For testing only — inject a fake-indexeddb instance. */
export function _resetDB(db: IDBPDatabase | null) {
  dbOverride = db;
}

async function getDB(): Promise<IDBPDatabase> {
  if (dbOverride) return dbOverride;
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('isFavorite', 'isFavorite');
      }
    },
  });
}

export async function savePrompt(record: Omit<PromptRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptRecord> {
  const db = await getDB();
  const now = Date.now();
  const full: PromptRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.put(STORE, full);
  return full;
}

export async function updatePrompt(id: string, changes: Partial<Omit<PromptRecord, 'id' | 'createdAt'>>): Promise<PromptRecord> {
  const db = await getDB();
  const existing = await db.get(STORE, id) as PromptRecord | undefined;
  if (!existing) throw new Error(`Prompt ${id} not found`);
  const updated: PromptRecord = { ...existing, ...changes, updatedAt: Date.now() };
  await db.put(STORE, updated);
  return updated;
}

export async function deletePrompt(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function getAllPrompts(): Promise<PromptRecord[]> {
  const db = await getDB();
  const all = await db.getAll(STORE) as PromptRecord[];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function toggleFavorite(id: string): Promise<PromptRecord> {
  const db = await getDB();
  const existing = await db.get(STORE, id) as PromptRecord | undefined;
  if (!existing) throw new Error(`Prompt ${id} not found`);
  const updated: PromptRecord = { ...existing, isFavorite: !existing.isFavorite, updatedAt: Date.now() };
  await db.put(STORE, updated);
  return updated;
}
