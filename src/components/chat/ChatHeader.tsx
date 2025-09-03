"use client";
import { useTheme } from '@/lib/theme';

interface ChatHeaderProps {
    sessionId: string;
    contextLength: number;
    showSessionList: boolean;
    onToggleSessionList: () => void;
    onClearSession: () => void;
}

export default function ChatHeader({
    sessionId,
    contextLength,
    showSessionList,
    onToggleSessionList,
    onClearSession
}: ChatHeaderProps) {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-200 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-t-lg gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <h1 className="text-xl font-bold tracking-tight text-orange-700 dark:text-orange-300">Pulmo RAGbot</h1>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    Session: {sessionId.substring(0, 8)}... | Context: {contextLength} messages
                </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={toggleTheme}
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 rounded-md transition-colors dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 font-medium"
                    aria-label="Toggle theme"
                >
                    {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                </button>
                <button
                    onClick={onToggleSessionList}
                    className="px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 rounded-md transition-colors dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-800/50 font-medium"
                >
                    {showSessionList ? '📁 Hide Sessions' : '📁 Show Sessions'}
                </button>
                <button
                    onClick={onClearSession}
                    className="px-3 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 rounded-md transition-colors dark:bg-red-900/50 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-800/50 font-medium"
                >
                    🗑️ Clear Session
                </button>
            </div>
        </div>
    );
}
