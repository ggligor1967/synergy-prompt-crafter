import React, { useState, useEffect, useCallback } from 'react';
import { PromptRecord, getAllPrompts, deletePrompt, toggleFavorite } from '../services/storage';
import { useDebounce } from '../hooks/useDebounce';

interface PromptHistoryProps {
  onRestore: (record: PromptRecord) => void;
  onClose: () => void;
  refreshTrigger: number;
}

const StarIcon: React.FC<{ filled: boolean; className?: string }> = ({ filled, className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const RestoreIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const PromptHistory: React.FC<PromptHistoryProps> = ({ onRestore, onClose, refreshTrigger }) => {
  const [records, setRecords] = useState<PromptRecord[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const all = await getAllPrompts();
    setRecords(all);
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id);
    await load();
  };

  const handleDelete = async (id: string) => {
    await deletePrompt(id);
    setPendingDeleteId(null);
    await load();
  };

  const filtered = records.filter(r => {
    if (favoritesOnly && !r.isFavorite) return false;
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.coreIdea.toLowerCase().includes(q) || r.generatedPrompt.toLowerCase().includes(q);
  });

  return (
    <div
      className="fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col z-50"
      role="complementary"
      aria-label="Prompt history"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h2 className="text-base font-semibold text-sky-400">Prompt History</h2>
        <button onClick={onClose} aria-label="Close history panel" className="text-slate-400 hover:text-slate-100 transition-colors">
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 space-y-2 border-b border-slate-700">
        <input
          type="text"
          placeholder="Search prompts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search prompts"
          className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={e => setFavoritesOnly(e.target.checked)}
            className="accent-sky-500"
          />
          Favorites only
        </label>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <p className="text-slate-500 text-sm text-center mt-8 px-4">
            {records.length === 0 ? 'No saved prompts yet.' : 'No prompts match your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {filtered.map(record => (
              <li key={record.id} className="px-4 py-3 hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate" title={record.title}>{record.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{record.coreIdea}</p>
                    <p className="text-xs text-slate-500">{new Date(record.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleFavorite(record.id)}
                      aria-label={record.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      className={`p-1 rounded hover:bg-slate-700 transition-colors ${record.isFavorite ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}
                    >
                      <StarIcon filled={record.isFavorite} className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRestore(record)}
                      aria-label={`Restore prompt: ${record.title}`}
                      className="p-1 rounded text-slate-600 hover:text-sky-400 hover:bg-slate-700 transition-colors"
                    >
                      <RestoreIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(record.id)}
                      aria-label={`Delete prompt: ${record.title}`}
                      className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-700 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Delete confirmation */}
                {pendingDeleteId === record.id && (
                  <div className="mt-2 p-2 bg-red-900/30 border border-red-700 rounded-md text-xs">
                    <p className="text-red-300 mb-2">Delete this prompt?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PromptHistory;
