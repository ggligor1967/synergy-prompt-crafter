import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PromptRecord, getAllPrompts, deletePrompt, toggleFavorite, updatePrompt } from '../services/storage';
import { useDebounce } from '../hooks/useDebounce';
import { sanitize } from '../services/sanitize';

interface PromptHistoryProps {
  onRestore: (record: PromptRecord) => void;
  onClose: () => void;
  refreshTrigger: number;
}

const TAG_COLORS = [
  'bg-blue-700 text-blue-100',
  'bg-purple-700 text-purple-100',
  'bg-green-700 text-green-100',
  'bg-amber-700 text-amber-100',
  'bg-pink-700 text-pink-100',
  'bg-cyan-700 text-cyan-100',
];

const getTagColor = (tag: string): string => {
  const normalized = tag.toLowerCase();
  const sum = normalized.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return TAG_COLORS[sum % TAG_COLORS.length];
};

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
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [editTagValues, setEditTagValues] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');

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

  const handleEditTags = (record: PromptRecord) => {
    setEditingTagsId(record.id);
    setEditTagValues([...record.tags]);
    setNewTagInput('');
  };

  const handleAddTag = () => {
    const tag = sanitize(newTagInput.trim());
    if (tag && !editTagValues.includes(tag)) {
      setEditTagValues(prev => [...prev, tag]);
    }
    setNewTagInput('');
  };

  const handleRemoveEditTag = (tag: string) => {
    setEditTagValues(prev => prev.filter(t => t !== tag));
  };

  const handleSaveTags = async (id: string) => {
    await updatePrompt(id, { tags: editTagValues });
    setEditingTagsId(null);
    await load();
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    records.forEach(r => r.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [records]);

  const allDisciplines = useMemo(() => {
    const discSet = new Set<string>();
    records.forEach(r => r.disciplines.forEach(d => discSet.add(d)));
    return Array.from(discSet).sort();
  }, [records]);

  const filtered = records.filter(r => {
    if (favoritesOnly && !r.isFavorite) return false;
    if (tagFilter && !r.tags.includes(tagFilter)) return false;
    if (disciplineFilter && !r.disciplines.includes(disciplineFilter)) return false;
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.coreIdea.toLowerCase().includes(q) ||
      r.generatedPrompt.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      r.disciplines.some(d => d.toLowerCase().includes(q))
    );
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
        <p className="text-xs text-slate-500" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={e => setFavoritesOnly(e.target.checked)}
            className="accent-sky-500"
          />
          Favorites only
        </label>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            aria-label="Filter by tag"
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
          >
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {allDisciplines.length > 0 && (
          <select
            value={disciplineFilter}
            onChange={e => setDisciplineFilter(e.target.value)}
            aria-label="Filter by discipline"
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
          >
            <option value="">All disciplines</option>
            {allDisciplines.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
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
                    {/* Tags */}
                    {record.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {record.tags.map(tag => (
                          <span key={tag} className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getTagColor(tag)}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
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
                      onClick={() => handleEditTags(record)}
                      aria-label={`Edit tags: ${record.title}`}
                      className="p-1 rounded text-slate-600 hover:text-sky-400 hover:bg-slate-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
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

                {/* Edit Tags UI */}
                {editingTagsId === record.id && (
                  <div className="mt-2 p-2 bg-slate-800 border border-slate-600 rounded-md text-xs space-y-2">
                    <p className="text-slate-300 font-medium">Edit Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {editTagValues.map(tag => (
                        <span key={tag} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${getTagColor(tag)}`}>
                          {tag}
                          <button
                            onClick={() => handleRemoveEditTag(tag)}
                            aria-label={`Remove tag ${tag}`}
                            className="hover:opacity-70"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={e => setNewTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); handleAddTag(); } }}
                        placeholder="Add tag…"
                        aria-label="New tag input"
                        className="flex-1 bg-slate-700 border border-slate-500 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                      <button
                        onClick={handleAddTag}
                        className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-xs"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveTags(record.id)}
                        className="px-2 py-1 bg-sky-700 hover:bg-sky-600 text-white rounded text-xs"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTagsId(null)}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

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
