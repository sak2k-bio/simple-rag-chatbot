"use client";
import { ChatSession } from '@/types/chat';

interface SessionSidebarProps {
    currentSessionId: string;
    sessions: ChatSession[];
    sessionQuery: string;
    onSessionQueryChange: (query: string) => void;
    onSwitchSession: (sessionId: string) => void;
    onCreateNewSession: () => void;
    onRenameSession: (sessionId: string, newTitle: string) => void;
    onDeleteSession: (sessionId: string) => void;
    onRefreshSessions: () => void;
}

export default function SessionSidebar({
    currentSessionId,
    sessions,
    sessionQuery,
    onSessionQueryChange,
    onSwitchSession,
    onCreateNewSession,
    onRenameSession,
    onDeleteSession,
    onRefreshSessions
}: SessionSidebarProps) {
    const filteredSessions = sessions.filter(s => 
        (s.title || '').toLowerCase().includes(sessionQuery.toLowerCase()) || 
        s.id.includes(sessionQuery)
    );

    const handleRename = async (session: ChatSession) => {
        const newTitle = prompt('Rename session', session.title || 'New chat');
        if (newTitle && newTitle.trim().length > 0) {
            await onRenameSession(session.id, newTitle.trim());
        }
    };

    const handleDelete = async (session: ChatSession) => {
        if (!confirm('Delete this session?')) return;
        await onDeleteSession(session.id);
    };

    return (
        <aside className="hidden lg:block w-64 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg h-fit sticky top-4 p-2">
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-200">Sessions</div>
                <button
                    className="text-xs px-2 py-1 rounded border border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-300"
                    onClick={onCreateNewSession}
                    title="Start new chat"
                >
                    New
                </button>
            </div>
            <div className="mb-2">
                <input
                    value={sessionQuery}
                    onChange={(e) => onSessionQueryChange(e.target.value)}
                    placeholder="Search sessions..."
                    className="w-full px-2 py-1 text-xs rounded border border-gray-300 bg-gray-50 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-200"
                />
            </div>
            <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-6rem)] pr-1">
                {filteredSessions.map((session) => (
                    <div 
                        key={session.id} 
                        className={`w-full text-left px-2 py-2 rounded border text-xs ${session.id === currentSessionId
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-300'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800'}`}
                        title={session.title || session.lastMessage}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <button 
                                className="truncate font-medium flex-1 text-left" 
                                onClick={() => onSwitchSession(session.id)}
                            >
                                {session.title || `Session ${session.id.substring(0, 8)}`}
                            </button>
                            <div className="flex items-center gap-1">
                                <button
                                    className="px-1 py-0.5 rounded border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                                    title="Rename session"
                                    onClick={() => handleRename(session)}
                                >
                                    ✎
                                </button>
                                <button
                                    className="px-1 py-0.5 rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-300"
                                    title="Delete session"
                                    onClick={() => handleDelete(session)}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="truncate text-gray-500 dark:text-gray-400 mt-1">{session.lastMessage || '—'}</div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{session.messageCount} messages</div>
                    </div>
                ))}
                {filteredSessions.length === 0 && (
                    <div className="text-xs text-gray-500">No sessions yet</div>
                )}
            </div>
        </aside>
    );
}
