import React, { useCallback, useEffect, useState } from 'react';
import { listModels } from '../services/ollamaService';
import { GEMINI_MODELS } from '../services/geminiService';
import { RefreshIcon } from './Icons';
import LoadingSpinner from './LoadingSpinner';

/** Props for the {@link SettingsPanel} modal. */
interface SettingsPanelProps {
  /** The currently active Ollama model name (persisted in localStorage). */
  selectedOllamaModel: string;
  /** Called when the user selects a different Ollama model. */
  onModelChange: (model: string) => void;
  /** The currently active Gemini model ID (persisted in localStorage). */
  selectedGeminiModel: string;
  /** Called when the user selects a different Gemini model. */
  onGeminiModelChange: (model: string) => void;
  /** Called when the panel should be dismissed (X button or backdrop click). */
  onClose: () => void;
}

/**
 * Modal settings panel.
 *
 * Ollama section: queries the local Ollama instance for available models and
 * populates a dropdown. If the currently saved model is no longer in the list
 * (e.g. it was deleted from Ollama), the first available model is selected
 * automatically.
 *
 * Gemini section: static dropdown populated from the known GEMINI_MODELS list.
 * No API call is needed since Gemini model IDs are stable constants.
 *
 * The panel can be closed via the X button or by clicking the backdrop.
 */
const SettingsPanel: React.FC<SettingsPanelProps> = ({
  selectedOllamaModel,
  onModelChange,
  selectedGeminiModel,
  onGeminiModelChange,
  onClose,
}) => {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const list = await listModels();
    setModels(list);
    if (list.length === 0) {
      setFetchError('No models found. Is Ollama running? Try: ollama serve');
    } else if (!list.includes(selectedOllamaModel)) {
      onModelChange(list[0]);
    }
    setLoading(false);
  }, [selectedOllamaModel, onModelChange]);

  useEffect(() => {
    fetchModels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-sky-400">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Gemini Model */}
        <div>
          <label htmlFor="geminiModelSelect" className="block text-sm font-medium text-slate-300 mb-2">
            Gemini Model
          </label>
          <select
            id="geminiModelSelect"
            value={selectedGeminiModel}
            onChange={(e) => onGeminiModelChange(e.target.value)}
            className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100 text-sm"
            aria-label="Select Gemini model"
          >
            {GEMINI_MODELS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Active: <span className="text-sky-400 font-mono">{selectedGeminiModel}</span>
          </p>
        </div>

        <hr className="border-slate-700" />

        {/* Ollama Model */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="ollamaModelSelect" className="text-sm font-medium text-slate-300">
              Ollama Model
            </label>
            <button
              onClick={fetchModels}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50 transition-colors"
              title="Refresh model list"
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loading && models.length === 0 ? (
            <div className="flex items-center gap-2 text-slate-400 py-2">
              <LoadingSpinner size="w-4 h-4" />
              <span className="text-sm">Loading models…</span>
            </div>
          ) : fetchError ? (
            <p className="text-sm text-amber-400">{fetchError}</p>
          ) : models.length > 0 ? (
            <select
              id="ollamaModelSelect"
              value={selectedOllamaModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100 text-sm"
            >
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : null}

          {selectedOllamaModel && models.includes(selectedOllamaModel) && (
            <p className="mt-2 text-xs text-slate-500">
              Active: <span className="text-sky-400 font-mono">{selectedOllamaModel}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
