"use client";
import { RAGSettings } from '@/types/chat';

interface RAGControlsProps {
    settings: RAGSettings;
    onUpdateSettings: (updates: Partial<RAGSettings>) => void;
    onResetSettings: () => void;
}

export default function RAGControls({ settings, onUpdateSettings, onResetSettings }: RAGControlsProps) {
    const updateSimilarityThreshold = (threshold: number) => {
        onUpdateSettings({ similarityThreshold: threshold });
        localStorage.setItem('similarity_threshold', threshold.toString());
    };

    const updateSystemPrompt = (prompt: string) => {
        onUpdateSettings({ customSystemPrompt: prompt });
        localStorage.setItem('custom_system_prompt', prompt);
    };

    const updateHydeEnabled = (enabled: boolean) => {
        onUpdateSettings({ hydeEnabled: enabled });
        localStorage.setItem('hyde_enabled', enabled ? '1' : '0');
    };

    const updateHybridEnabled = (enabled: boolean) => {
        onUpdateSettings({ hybridEnabled: enabled });
        localStorage.setItem('hybrid_enabled', enabled ? '1' : '0');
    };

    const updateMmrEnabled = (enabled: boolean) => {
        onUpdateSettings({ mmrEnabled: enabled });
        localStorage.setItem('mmr_enabled', enabled ? '1' : '0');
    };

    const updateCrossEncoderEnabled = (enabled: boolean) => {
        onUpdateSettings({ crossEncoderEnabled: enabled });
        localStorage.setItem('cross_encoder_enabled', enabled ? '1' : '0');
    };

    return (
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">RAG Controls</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        💡 <strong>Relevance Filter:</strong> Controls how strict the document matching is. Lower = More precise, Higher = More flexible
                    </p>
                </div>
                <div className="flex gap-2 ml-4">
                    <button
                        onClick={() => onUpdateSettings({ showRagControls: !settings.showRagControls })}
                        className="px-4 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 border border-blue-500/30 rounded-md transition-colors dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/20"
                        title={settings.showRagControls ? 'Hide parameter controls' : 'Show parameter controls'}
                    >
                        {settings.showRagControls ? 'Hide Controls' : 'Show Controls'}
                    </button>
                    <button
                        onClick={onResetSettings}
                        className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-md transition-colors dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                        title="Reset all RAG settings to defaults"
                    >
                        Reset All
                    </button>
                </div>
            </div>

            {/* Quick Tips */}
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-900/30">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-yellow-200 rounded-full flex items-center justify-center dark:bg-yellow-800">
                        <span className="text-yellow-700 dark:text-yellow-300 text-sm">💡</span>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
                            <strong>Quick Tips:</strong> Start with "Balanced" (0.05) for most queries. Use "Very Precise" (0.1) for specific technical questions. Use "Broader" (0.01) when you want broader context. If no sources are found, try lowering the threshold.
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">
                            <strong>🔍 Source Visibility:</strong> You'll see ALL retrieved sources below each answer - green ones were used, gray ones were below your threshold.
                        </p>
                    </div>
                </div>
            </div>

            {settings.showRagControls && (
                <div className="space-y-8">
                    {/* Section: Retrieval */}
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <div className="flex items-center gap-3 mb-6">
                            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">RETRIEVAL</h3>
                            <a
                                href="/docs/SIMILARITY_SCORE_OPTIMIZATION.md"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-6 h-6 rounded-full border border-gray-300 text-gray-600 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center justify-center text-xs font-bold"
                                title="Open similarity optimization guide"
                            >
                                ?
                            </a>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Top-K Control */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                            Top-K Results
                                        </label>
                                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                            {settings.topK}
                                        </span>
                                    </div>

                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <p className="text-sm text-blue-800 dark:text-blue-300">
                                            <strong>💡 Top-K Results:</strong> Controls how many most relevant documents to retrieve from your knowledge base. Higher values (10-20) provide more context but may include less relevant information. Lower values (1-5) focus on the most relevant sources.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <input
                                            type="range"
                                            min="1"
                                            max="20"
                                            value={settings.topK}
                                            onChange={(e) => onUpdateSettings({ topK: Number(e.target.value) })}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                                            title="Number of top documents to retrieve"
                                        />
                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                            <span>1</span>
                                            <span>5</span>
                                            <span>10</span>
                                            <span>15</span>
                                            <span>20</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Similarity Threshold Control */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                            Relevance Threshold
                                        </label>
                                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                            {settings.similarityThreshold.toFixed(2)}
                                        </span>
                                    </div>

                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Higher = stricter; Range: 0.01–0.1
                                    </p>

                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <p className="text-sm text-blue-800 dark:text-blue-300">
                                            <strong>💡 Relevance Threshold (cosine similarity):</strong> Keep documents with score ≥ threshold. Try 0.05 (balanced), 0.1 (precise), 0.01 (broader). Current: {settings.similarityThreshold.toFixed(2)}.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <input
                                            type="range"
                                            min="0.01"
                                            max="0.1"
                                            step="0.01"
                                            value={settings.similarityThreshold}
                                            onChange={(e) => updateSimilarityThreshold(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                                            title="Minimum cosine similarity for a document to be used"
                                        />
                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                            <span>0.01</span>
                                            <span>0.03</span>
                                            <span>0.05</span>
                                            <span>0.08</span>
                                            <span>0.1</span>
                                        </div>
                                    </div>

                                    <div className="text-center">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${settings.similarityThreshold >= 0.09 ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' :
                                            settings.similarityThreshold >= 0.05 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' :
                                                'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                            }`}>
                                            {settings.similarityThreshold >= 0.09 ? 'Very Precise' :
                                                settings.similarityThreshold >= 0.05 ? 'Balanced' : 'Broader'}
                                        </span>
                                    </div>

                                    {/* Quick Preset Buttons */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={() => updateSimilarityThreshold(0.01)}
                                            className={`px-3 py-2 text-sm rounded-lg border transition-colors font-medium ${settings.similarityThreshold === 0.01
                                                ? 'bg-green-500 text-white border-green-500'
                                                : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/30'
                                                }`}
                                        >
                                            Broader
                                        </button>
                                        <button
                                            onClick={() => updateSimilarityThreshold(0.05)}
                                            className={`px-3 py-2 text-sm rounded-lg border transition-colors font-medium ${settings.similarityThreshold === 0.05
                                                ? 'bg-yellow-500 text-white border-yellow-500'
                                                : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800 dark:hover:bg-yellow-900/30'
                                                }`}
                                        >
                                            Balanced
                                        </button>
                                        <button
                                            onClick={() => updateSimilarityThreshold(0.1)}
                                            className={`px-3 py-2 text-sm rounded-lg border transition-colors font-medium ${settings.similarityThreshold === 0.1
                                                ? 'bg-red-500 text-white border-red-500'
                                                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/30'
                                                }`}
                                        >
                                            Very Precise
                                        </button>
                                    </div>

                                    {/* Reset Button */}
                                    <div className="text-center">
                                        <button
                                            onClick={() => updateSimilarityThreshold(0.05)}
                                            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                                        >
                                            Reset to Default (0.05)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Experiments Section */}
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <div className="flex items-center gap-3 mb-6">
                            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">EXPERIMENTS</h3>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Hybrid Search */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                            Hybrid Search (Dense + BM25-like)
                                        </label>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${settings.hybridEnabled
                                            ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                            {settings.hybridEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                    <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
                                        <p className="text-sm text-teal-800 dark:text-teal-300">
                                            Combines cosine similarity with a keyword-based score to improve matching for proper nouns and abbreviations.
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <button
                                            onClick={() => updateHybridEnabled(!settings.hybridEnabled)}
                                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${settings.hybridEnabled ? 'bg-teal-600' : 'bg-gray-200 dark:bg-gray-700'
                                                }`}
                                            title="Combine dense and keyword scoring"
                                        >
                                            <span
                                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.hybridEnabled ? 'translate-x-7' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* MMR Diversification */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                            MMR Diversification
                                        </label>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${settings.mmrEnabled
                                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                            {settings.mmrEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                        <p className="text-sm text-orange-800 dark:text-orange-300">
                                            Selects a diverse set of results to reduce redundancy. Useful when many chunks come from the same section.
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <button
                                            onClick={() => updateMmrEnabled(!settings.mmrEnabled)}
                                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${settings.mmrEnabled ? 'bg-orange-600' : 'bg-gray-200 dark:bg-gray-700'
                                                }`}
                                            title="Maximal Marginal Relevance selection"
                                        >
                                            <span
                                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.mmrEnabled ? 'translate-x-7' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Cross-encoder Reranking */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                            Cross-encoder Rerank
                                        </label>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${settings.crossEncoderEnabled
                                            ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                            {settings.crossEncoderEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                    <div className="p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
                                        <p className="text-sm text-pink-800 dark:text-pink-300">
                                            Reranks the top candidates using an LLM-based relevance score for sharper precision. Adds latency and token cost.
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <button
                                            onClick={() => updateCrossEncoderEnabled(!settings.crossEncoderEnabled)}
                                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${settings.crossEncoderEnabled ? 'bg-pink-600' : 'bg-gray-200 dark:bg-gray-700'
                                                }`}
                                            title="Rerank with LLM-based scoring"
                                        >
                                            <span
                                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.crossEncoderEnabled ? 'translate-x-7' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* System Prompt Section */}
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <div className="flex items-center gap-3 mb-6">
                            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">GUIDANCE</h3>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                        System Prompt
                                    </label>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${settings.useSystemPrompt
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                        }`}>
                                        {settings.useSystemPrompt ? 'Enabled' : 'Disabled'}
                                    </span>
                                </div>

                                <div className="flex items-center justify-center">
                                    <button
                                        onClick={() => onUpdateSettings({ useSystemPrompt: !settings.useSystemPrompt })}
                                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${settings.useSystemPrompt ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                                            }`}
                                        title="Toggle system prompt guidance"
                                    >
                                        <span
                                            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.useSystemPrompt ? 'translate-x-7' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>

                                {settings.useSystemPrompt && (
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => onUpdateSettings({ showSystemPromptInput: !settings.showSystemPromptInput })}
                                            className="w-full px-4 py-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300 rounded-lg transition-colors dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800 dark:hover:bg-purple-900/30"
                                        >
                                            {settings.showSystemPromptInput ? 'Hide Custom Prompt' : 'Customize System Prompt'}
                                        </button>

                                        {settings.showSystemPromptInput && (
                                            <div className="space-y-3">
                                                <textarea
                                                    value={settings.customSystemPrompt}
                                                    onChange={(e) => updateSystemPrompt(e.target.value)}
                                                    placeholder="Enter your custom system prompt..."
                                                    rows={4}
                                                    className="w-full p-3 text-sm border border-purple-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const defaultPrompt = 'You are a helpful AI assistant. Answer questions based on the provided context and be concise.';
                                                            updateSystemPrompt(defaultPrompt);
                                                        }}
                                                        className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                                                    >
                                                        Reset to Default
                                                    </button>
                                                    <button
                                                        onClick={() => onUpdateSettings({ showSystemPromptInput: false })}
                                                        className="flex-1 px-3 py-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300 rounded-lg transition-colors dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800 dark:hover:bg-purple-900/30"
                                                    >
                                                        Save & Close
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Advanced Section */}
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <div className="flex items-center gap-3 mb-6">
                            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">ADVANCED</h3>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* HyDE Retrieval Toggle */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                            HyDE Retrieval
                                        </label>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${settings.hydeEnabled
                                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                            {settings.hydeEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>

                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                        <p className="text-sm text-indigo-800 dark:text-indigo-300">
                                            <strong>💡 HyDE:</strong> Generates a hypothetical answer first and uses its embedding to retrieve more relevant documents. Often improves recall for vague queries.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-center">
                                        <button
                                            onClick={() => updateHydeEnabled(!settings.hydeEnabled)}
                                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${settings.hydeEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                                                }`}
                                            title="Generate hypothetical answer to improve retrieval"
                                        >
                                            <span
                                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.hydeEnabled ? 'translate-x-7' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Auto Tuning Toggle */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                            Auto Retrieval Tuning
                                        </label>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${settings.autoTuneEnabled
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                            {settings.autoTuneEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>

                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                        <p className="text-sm text-emerald-800 dark:text-emerald-300">
                                            <strong>💡 Auto Tuning:</strong> Uses your query to recommend Top-K and threshold automatically. This helps optimize retrieval parameters based on the specific question being asked.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-center">
                                        <button
                                            onClick={() => onUpdateSettings({ autoTuneEnabled: !settings.autoTuneEnabled })}
                                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${settings.autoTuneEnabled ? 'bg-emerald-600' : 'bg-gray-200 dark:bg-gray-700'
                                                }`}
                                            title="Automatically set Top-K and threshold per query"
                                        >
                                            <span
                                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.autoTuneEnabled ? 'translate-x-7' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Streaming & Quality Section */}
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <div className="flex items-center gap-3 mb-6">
                            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">STREAMING & QUALITY</h3>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Structured Stream (JSONL) */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                            Structured Stream (JSONL)
                                        </label>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${settings.structuredStreamEnabled
                                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                            {settings.structuredStreamEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>

                                    <div className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
                                        <p className="text-sm text-sky-800 dark:text-sky-300">
                                            <strong>💡 JSONL Streaming:</strong> Streams JSONL events for robust parsing and incremental citations. Provides better control over streaming responses.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-center">
                                        <button
                                            onClick={() => onUpdateSettings({ structuredStreamEnabled: !settings.structuredStreamEnabled })}
                                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${settings.structuredStreamEnabled ? 'bg-sky-600' : 'bg-gray-200 dark:bg-gray-700'
                                                }`}
                                            title="Emit JSONL events for robust incremental rendering"
                                        >
                                            <span
                                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.structuredStreamEnabled ? 'translate-x-7' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Corrective RAG (CRAG) */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                            Corrective RAG (CRAG)
                                        </label>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${settings.cragEnabled
                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                            {settings.cragEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>

                                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
                                        <p className="text-sm text-rose-800 dark:text-rose-300">
                                            <strong>💡 CRAG:</strong> Translates query → retrieves → judges docs → optionally refines query → re-retrieves for higher quality results.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-center">
                                        <button
                                            onClick={() => onUpdateSettings({ cragEnabled: !settings.cragEnabled })}
                                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${settings.cragEnabled ? 'bg-rose-600' : 'bg-gray-200 dark:bg-gray-700'
                                                }`}
                                            title="Translate → judge → refine → re-retrieve loop"
                                        >
                                            <span
                                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.cragEnabled ? 'translate-x-7' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
