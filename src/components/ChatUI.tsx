"use client";
import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: Source[];
    timestamp?: string;
}

interface Source {
    pageContent: string;
    metadata: {
        source: string;
        score?: number;
        used?: boolean;
        [key: string]: unknown;
    };
}

interface SupabaseMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: Source[];
    timestamp: string;
}

interface SessionMessage {
    session_id: string;
    content: string;
    timestamp: string;
}

interface SourceData {
    source: string;
    score: number;
    used: boolean;
}

export default function ChatUI() {
    const [isClient, setIsClient] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [localInput, setLocalInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Memory persistence state
    const [sessionId, setSessionId] = useState<string>('');
    const [chatSessions, setChatSessions] = useState<Array<{ id: string; messageCount: number; lastMessage: string; timestamp: string }>>([]);
    const [showSessionList, setShowSessionList] = useState(false);
    const [conversationContext, setConversationContext] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

    // RAG control state
    const [topK, setTopK] = useState<number>(15); // Increased for better coverage
    const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.05); // Configurable threshold for broader recall
    const [useSystemPrompt, setUseSystemPrompt] = useState<boolean>(true);
    const [customSystemPrompt, setCustomSystemPrompt] = useState<string>('You are a helpful AI assistant. Answer questions based on the provided context and be concise.');
    const [showSystemPromptInput, setShowSystemPromptInput] = useState<boolean>(false);
    const [showRagControls, setShowRagControls] = useState<boolean>(true);
    const [showUnusedSources, setShowUnusedSources] = useState<boolean>(false);
    const [showUsedSources, setShowUsedSources] = useState<boolean>(false);

    useEffect(() => {
        setIsClient(true);
        initializeChat();
        
        // Load custom system prompt from localStorage
        const savedPrompt = localStorage.getItem('custom_system_prompt');
        if (savedPrompt) {
            setCustomSystemPrompt(savedPrompt);
        }
        
        // Load saved similarity threshold from localStorage
        const savedThreshold = localStorage.getItem('similarity_threshold');
        if (savedThreshold) {
            setSimilarityThreshold(Number(savedThreshold));
        }
    }, []);

    const initializeChat = async () => {
        try {
            // Generate or retrieve session ID
            let sessionId = localStorage.getItem('chat_session_id');
            if (!sessionId) {
                sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem('chat_session_id', sessionId);
            }
            setSessionId(sessionId);

            try {
                // Load previous messages from Supabase
                const { data: previousMessages, error } = await getSupabase()
                    .from('chat_messages_chatbot')
                    .select('*')
                    .eq('session_id', sessionId)
                    .order('timestamp', { ascending: true });

                if (error) {
                    console.error('Error loading messages from Supabase:', error);
                    setMessages([]);
                } else if (previousMessages && previousMessages.length > 0) {
                    console.log(`Loaded ${previousMessages.length} messages from Supabase for session: ${sessionId}`);

                    const mappedMessages = previousMessages.map((msg: SupabaseMessage) => ({
                        id: msg.id,
                        role: msg.role as 'user' | 'assistant',
                        content: msg.content,
                        sources: msg.sources || [],
                        timestamp: msg.timestamp
                    }));

                    setMessages(mappedMessages);

                    // Set up conversation context for memory persistence
                    const context = mappedMessages.map((msg: SupabaseMessage) => ({
                        role: msg.role,
                        content: msg.content
                    }));
                    setConversationContext(context);
                } else {
                    setMessages([]);
                }
            } catch (supabaseError) {
                console.warn('Supabase not available, starting with empty chat:', supabaseError);
                setMessages([]);
            }
        } catch (error) {
            console.error('Error initializing chat:', error);
            setMessages([]);
        }
    };

        // Load available chat sessions
    const loadChatSessions = async () => {
        try {
            const { data: sessions, error } = await getSupabase()
                .from('chat_messages_chatbot')
                .select('session_id, content, timestamp')
                .order('timestamp', { ascending: false });

            if (error) {
                console.error('Error loading chat sessions:', error);
                return;
            }

            // Group messages by session and get session info
            const sessionMap = new Map();
            sessions?.forEach((msg: SessionMessage) => {
                if (!sessionMap.has(msg.session_id)) {
                    sessionMap.set(msg.session_id, {
                        id: msg.session_id,
                        messageCount: 0,
                        lastMessage: '',
                        timestamp: msg.timestamp
                    });
                }
                const session = sessionMap.get(msg.session_id);
                session.messageCount++;
                if (!session.lastMessage) {
                    session.lastMessage = msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '');
                }
            });

            const sessionList = Array.from(sessionMap.values());
            setChatSessions(sessionList);
        } catch (error) {
            console.warn('Supabase not available for loading chat sessions:', error);
            setChatSessions([]);
        }
    };

    // Switch to a different chat session
    const switchToSession = async (newSessionId: string) => {
        try {
            setSessionId(newSessionId);
            localStorage.setItem('chat_session_id', newSessionId);

            try {
                // Load messages for the new session
                const { data: sessionMessages, error } = await getSupabase()
                    .from('chat_messages_chatbot')
                    .select('*')
                    .eq('session_id', newSessionId)
                    .order('timestamp', { ascending: true });

                if (error) {
                    console.error('Error loading session messages:', error);
                    setMessages([]);
                } else if (sessionMessages && sessionMessages.length > 0) {
                    const mappedMessages = sessionMessages.map((msg: SupabaseMessage) => ({
                        id: msg.id,
                        role: msg.role as 'user' | 'assistant',
                        content: msg.content,
                        sources: msg.sources || [],
                        timestamp: msg.timestamp
                    }));
                    setMessages(mappedMessages);

                    // Set up conversation context for the new session
                    const context = mappedMessages.map((msg: SupabaseMessage) => ({
                        role: msg.role,
                        content: msg.content
                    }));
                    setConversationContext(context);
                } else {
                    setMessages([]);
                }
            } catch (supabaseError) {
                console.warn('Supabase not available for switching sessions:', supabaseError);
                setMessages([]);
            }

            setShowSessionList(false);
        } catch (error) {
            console.error('Error switching sessions:', error);
        }
    };

    // Load sessions when component mounts
    useEffect(() => {
        loadChatSessions();
    }, []);

    const sendMessage = async (content: string) => {
        if (!content.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: content.trim()
        };

        // Add user message immediately
        setMessages(prev => [...prev, userMessage]);
        setLocalInput('');
        setIsLoading(true);

        try {
            // Save user message to Supabase
            await saveMessageToSupabase(userMessage);

            // Create the full conversation context including the new user message
            const fullConversationContext = [
                ...conversationContext,
                { role: 'user' as const, content: content.trim() }
            ];

            console.log(`Sending conversation context to backend: ${fullConversationContext.length} messages`);

            const requestBody = {
                messages: fullConversationContext,
                topK: topK,
                similarityThreshold: similarityThreshold,
                useSystemPrompt: useSystemPrompt,
                systemPrompt: customSystemPrompt,
            };

            console.log('Request body:', requestBody);

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            let assistantMessage = '';
            const assistantId = Date.now().toString() + '_assistant';

            // Add assistant message placeholder
            setMessages(prev => [...prev, {
                id: assistantId,
                role: 'assistant',
                content: ''
            }]);

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = new TextDecoder().decode(value);
                    assistantMessage += chunk;

                    // Update the assistant message with accumulated content
                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantId
                            ? { ...msg, content: assistantMessage, sources: [] }
                            : msg
                    ));
                }
            } finally {
                reader.releaseLock();
            }

            // Parse sources from the response
            let parsedSources: Source[] = [];
            let cleanContent = assistantMessage;
            
            console.log('🔍 Parsing response for sources:', assistantMessage.substring(0, 200) + '...');
            console.log('🔍 Full response length:', assistantMessage.length);
            
            // Look for sources metadata JSON at the end of the response
            const sourcesMatch = assistantMessage.match(/---\s*\n(\{.*"type":"sources_metadata".*\})$/);
            if (sourcesMatch) {
                try {
                    const sourcesData = JSON.parse(sourcesMatch[1]);
                    console.log('✅ Found sources metadata:', sourcesData);
                    
                    if (sourcesData.type === 'sources_metadata' && sourcesData.sources) {
                        parsedSources = sourcesData.sources.map((s: SourceData) => ({
                            pageContent: '',
                            metadata: {
                                source: s.source,
                                score: s.score,
                                used: s.used
                            }
                        }));
                        
                        // Remove the metadata from the content
                        cleanContent = assistantMessage.replace(sourcesMatch[0], '').trim();
                        
                        console.log('✅ Parsed sources:', parsedSources.length);
                        console.log('🔍 All parsed sources metadata:', parsedSources.map(s => ({ source: s.metadata.source, score: s.metadata.score, used: s.metadata.used })));
                    }
                } catch (parseError) {
                    console.error('❌ Error parsing sources metadata:', parseError);
                    cleanContent = assistantMessage;
                }
            } else {
                console.log('❌ No sources metadata found in response');
                cleanContent = assistantMessage;
            }

            // Create final assistant message object
            const finalAssistantMessage = {
                id: assistantId,
                role: 'assistant' as const,
                content: cleanContent,
                sources: parsedSources
            };

            // Update the message in the UI with the final parsed sources
            setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                    ? { ...msg, content: cleanContent, sources: parsedSources }
                    : msg
            ));

            // Save assistant message to Supabase
            await saveMessageToSupabase(finalAssistantMessage);

            // Update conversation context for memory persistence
            const updatedContext = [
                ...fullConversationContext,
                { role: 'assistant' as const, content: cleanContent }
            ];
            setConversationContext(updatedContext);

            // Refresh the session list to show updated counts
            await loadChatSessions();

        } catch (error) {
            console.error('Error sending message:', error);
            // Add error message
            setMessages(prev => [...prev, {
                id: Date.now().toString() + '_error',
                role: 'assistant',
                content: 'Sorry, there was an error processing your message. Please try again.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

        const saveMessageToSupabase = async (message: { id: string; role: 'user' | 'assistant'; content: string; sources?: Source[] }) => {
        try {
            const { error } = await getSupabase()
                .from('chat_messages_chatbot')
                .insert({
                    id: message.id,
                    role: message.role,
                    content: message.content,
                    session_id: sessionId,
                    sources: message.sources || [],
                    timestamp: new Date().toISOString()
                });

            if (error) {
                console.error('Error saving message to Supabase:', error);
            } else {
                console.log(`Message saved to Supabase: ${message.role} - ${message.content.substring(0, 50)}...`);
            }
        } catch (error) {
            console.warn('Supabase not available for saving message:', error);
            // Continue without saving - this allows the chat to work even without persistence
        }
    };

    const clearChatSession = async () => {
        try {
            // Clear messages from Supabase
            const { error } = await getSupabase()
                .from('chat_messages_chatbot')
                .delete()
                .eq('session_id', sessionId);

            if (error) {
                console.error('Error clearing messages:', error);
            } else {
                // Clear local state
                setMessages([]);
                setConversationContext([]);

                // Generate new session ID
                const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                setSessionId(newSessionId);
                localStorage.setItem('chat_session_id', newSessionId);

                // Refresh the session list
                await loadChatSessions();
            }
        } catch (error) {
            console.warn('Supabase not available for clearing session:', error);
            // Clear local state even if Supabase is not available
            setMessages([]);
            setConversationContext([]);

            // Generate new session ID
            const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            setSessionId(newSessionId);
            localStorage.setItem('chat_session_id', newSessionId);
        }
    };

    const currentHandleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setLocalInput(e.target.value);
    const currentHandleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        await sendMessage(localInput);
    };

    useEffect(() => {
        if (isClient) {
            const el = listRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        }
    }, [messages, isLoading, isClient]);

    if (!isClient) {
        return <div className="flex items-center justify-center h-96">Loading...</div>;
    }

    return (
        <>
            <style jsx>{`
                .slider::-webkit-slider-thumb {
                    appearance: none;
                    height: 16px;
                    width: 16px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .slider::-moz-range-thumb {
                    height: 16px;
                    width: 16px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
            `}</style>
            <div className="mx-auto w-full max-w-4xl">
            {/* Chat Header with Session Management */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-semibold tracking-tight text-orange-700">Pulmo RAGbot</h1>
                    <div className="text-sm text-gray-500">
                        Session: {sessionId.substring(0, 8)}... | Context: {conversationContext.length} messages
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSessionList(!showSessionList)}
                        className="px-3 py-1 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 border border-blue-500/30 rounded-md transition-colors"
                    >
                        {showSessionList ? 'Hide Sessions' : 'Show Sessions'}
                    </button>
                    <button
                        onClick={clearChatSession}
                        className="px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-700 border border-red-500/30 rounded-md transition-colors"
                    >
                        Clear Session
                    </button>
                </div>
            </div>

            {/* RAG Controls */}
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h4 className="text-sm font-medium text-gray-800">RAG Controls</h4>
                        <p className="text-xs text-gray-600 mt-1">
                            💡 <strong>Relevance Filter:</strong> Controls how strict the document matching is. Lower = More precise, Higher = More flexible
                        </p>
                    </div>
                    <button
                        onClick={() => setShowRagControls(!showRagControls)}
                        className="px-3 py-1 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 border border-blue-500/30 rounded-md transition-colors"
                    >
                        {showRagControls ? 'Hide Controls' : 'Show Controls'}
                    </button>
                </div>
                
                                 {/* Quick Tips */}
                 <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                     <p className="text-xs text-yellow-800">
                         <strong>💡 Quick Tips:</strong> Start with &quot;Balanced&quot; (0.05) for most queries. Use &quot;Very Precise&quot; (0.08-0.10) for specific technical questions. Use &quot;Very Flexible&quot; (0.01-0.03) when you want broader context. If no sources are found, try lowering the threshold.
                     </p>
                     <p className="text-xs text-yellow-700 mt-1">
                         <strong>🔍 Source Visibility:</strong> You&apos;ll see ALL retrieved sources below each answer - green ones were used, gray ones were below your threshold.
                     </p>
                 </div>
                
                {showRagControls && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Top-K Control */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-700">
                                Top-K Results: {topK}
                            </label>
                            <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-200">
                                <p className="text-xs text-blue-800">
                                    <strong>💡 Top-K Results:</strong> Controls how many most relevant documents to retrieve from your knowledge base. Higher values (10-20) provide more context but may include less relevant information. Lower values (1-5) focus on the most relevant sources.
                                </p>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="20"
                                value={topK}
                                onChange={(e) => setTopK(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                            />
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>1</span>
                                <span>5</span>
                                <span>10</span>
                                <span>15</span>
                                <span>20</span>
                            </div>
                        </div>

                        {/* Similarity Threshold Control - Configurable */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-700">
                                Relevance Filter: {similarityThreshold.toFixed(2)}
                                <span className="ml-1 text-gray-500">
                                    ({similarityThreshold <= 0.03 ? 'More sources, broader context' :
                                      similarityThreshold <= 0.06 ? 'Balanced coverage' :
                                      'Fewer sources, more precise'})
                                </span>
                            </label>
                            <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-200">
                                <p className="text-xs text-blue-800">
                                    <strong>💡 Relevance Filter:</strong> Controls how strict the document matching is. Lower values (0.01-0.03) = More flexible, Higher values (0.08-0.10) = More precise. Current setting: {similarityThreshold.toFixed(2)}.
                                </p>
                            </div>
                            <input
                                type="range"
                                min="0.01"
                                max="0.10"
                                step="0.01"
                                value={similarityThreshold}
                                onChange={(e) => {
                                    const newThreshold = Number(e.target.value);
                                    setSimilarityThreshold(newThreshold);
                                    // Save to localStorage
                                    localStorage.setItem('similarity_threshold', newThreshold.toString());
                                }}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                            />
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>0.01</span>
                                <span>0.03</span>
                                <span>0.05</span>
                                <span>0.07</span>
                                <span>0.10</span>
                            </div>
                            <div className="text-xs text-gray-600 text-center mb-2">
                                <span className={`px-2 py-1 rounded ${
                                    similarityThreshold <= 0.03 ? 'bg-green-100 text-green-700' :
                                    similarityThreshold <= 0.06 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    {similarityThreshold <= 0.03 ? 'Very Flexible' :
                                     similarityThreshold <= 0.06 ? 'Balanced' : 'Very Precise'}
                                </span>
                            </div>
                            
                            {/* Quick Preset Buttons */}
                            <div className="flex gap-2 justify-center mb-2">
                                <button
                                    onClick={() => {
                                        setSimilarityThreshold(0.01);
                                        localStorage.setItem('similarity_threshold', '0.01');
                                    }}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                                        similarityThreshold === 0.01 
                                            ? 'bg-green-500 text-white border-green-500' 
                                            : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                    }`}
                                >
                                    Very Flexible
                                </button>
                                <button
                                    onClick={() => {
                                        setSimilarityThreshold(0.05);
                                        localStorage.setItem('similarity_threshold', '0.05');
                                    }}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                                        similarityThreshold === 0.05 
                                            ? 'bg-green-500 text-white border-green-500' 
                                            : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                                    }`}
                                >
                                    Balanced
                                </button>
                                <button
                                    onClick={() => {
                                        setSimilarityThreshold(0.10);
                                        localStorage.setItem('similarity_threshold', '0.10');
                                    }}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                                        similarityThreshold === 0.10 
                                            ? 'bg-red-500 text-white border-red-500' 
                                            : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                    }`}
                                >
                                    Very Precise
                                </button>
                            </div>
                            
                            {/* Reset Button */}
                            <div className="text-center">
                                <button
                                    onClick={() => {
                                        setSimilarityThreshold(0.05);
                                        localStorage.setItem('similarity_threshold', '0.05');
                                    }}
                                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded transition-colors"
                                >
                                    Reset to Default (0.05)
                                </button>
                            </div>
                        </div>

                        {/* System Prompt Toggle */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-700">
                                System Prompt
                            </label>
                            <div className="mb-2 p-2 bg-purple-50 rounded border border-purple-200">
                                <p className="text-xs text-purple-800">
                                    <strong>💡 System Prompt:</strong> When enabled, provides the AI with specific instructions about how to respond. This helps maintain consistent behavior and tone. Disabling it allows the AI to respond more freely based on the retrieved context.
                                </p>
                            </div>
                            
                            {/* System Prompt Toggle */}
                            <div className="flex items-center justify-center mb-2">
                                <button
                                    onClick={() => setUseSystemPrompt(!useSystemPrompt)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        useSystemPrompt ? 'bg-blue-600' : 'bg-gray-200'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            useSystemPrompt ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                            <div className="text-xs text-gray-500 text-center mb-2">
                                {useSystemPrompt ? 'Enabled' : 'Disabled'}
                            </div>
                            
                            {/* Custom System Prompt Input */}
                            {useSystemPrompt && (
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setShowSystemPromptInput(!showSystemPromptInput)}
                                        className="w-full px-3 py-2 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300 rounded-md transition-colors"
                                    >
                                        {showSystemPromptInput ? 'Hide Custom Prompt' : 'Customize System Prompt'}
                                    </button>
                                    
                                    {showSystemPromptInput && (
                                        <div className="space-y-2">
                                            <textarea
                                                value={customSystemPrompt}
                                                onChange={(e) => {
                                                    const newPrompt = e.target.value;
                                                    setCustomSystemPrompt(newPrompt);
                                                    // Auto-save to localStorage
                                                    localStorage.setItem('custom_system_prompt', newPrompt);
                                                }}
                                                placeholder="Enter your custom system prompt..."
                                                rows={3}
                                                className="w-full p-2 text-xs border border-purple-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        const defaultPrompt = 'You are a helpful AI assistant. Answer questions based on the provided context and be concise.';
                                                        setCustomSystemPrompt(defaultPrompt);
                                                        localStorage.setItem('custom_system_prompt', defaultPrompt);
                                                    }}
                                                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded transition-colors"
                                                >
                                                    Reset to Default
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        localStorage.setItem('custom_system_prompt', customSystemPrompt);
                                                        setShowSystemPromptInput(false);
                                                    }}
                                                    className="px-2 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300 rounded transition-colors"
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
                )}
            </div>

            {/* Session List Dropdown */}
            {showSessionList && (
                <div className="p-4 border-b border-gray-200 bg-gray-50/80 backdrop-blur-sm">
                    <h4 className="text-sm font-medium text-gray-800 mb-3">Previous Chat Sessions</h4>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                        {chatSessions.length > 0 ? (
                            chatSessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => switchToSession(session.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                        session.id === sessionId
                                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-700'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">
                                                Session {session.id.substring(0, 8)}...
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">
                                                {session.lastMessage}
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-400 ml-2">
                                            {session.messageCount} messages
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-gray-500 text-center py-4">
                                No previous sessions found
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="px-4">
                <div ref={listRef} className="mt-4 h-[66vh] overflow-y-auto rounded-lg border bg-white p-4">
                    {messages.length === 0 && (
                        <div className="text-gray-400 text-sm">Ask a question to get started.</div>
                    )}
                    {messages.map((m) => (
                        <div key={m.id} className={`mb-4 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-[15px] shadow-sm ${m.role === 'user'
                                    ? 'border border-orange-200 bg-orange-50 text-orange-700'
                                    : 'border border-blue-200 bg-blue-50 text-blue-700'
                                }`}>
                                {m.content || (m.role === 'assistant' ? 'Thinking...' : '')}

                                                                 {/* Display sources if available */}
                                 {m.sources && m.sources.length > 0 && (
                                     <div className="mt-3 pt-3 border-t border-gray-200">
                                         {/* Sources Summary */}
                                         {(() => {
                                             const usedCount = m.sources.filter(s => s.metadata?.used).length;
                                             const unusedCount = m.sources.length - usedCount;
                                             return (
                                                 <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                                                     <div className="text-xs text-blue-800 font-medium mb-1">
                                                         Sources Summary:
                                                     </div>
                                                     <div className="flex gap-4 text-xs text-blue-700">
                                                         <span>📚 Total Retrieved: {m.sources.length}</span>
                                                         <span>✅ Used in Answer: {usedCount}</span>
                                                         <span>⭕ Below Threshold: {unusedCount}</span>
                                                     </div>
                                                 </div>
                                             );
                                         })()}
                                         
                                         {/* Used Sources Section */}
                                         <div className="mb-4">
                                             <div className="flex items-center justify-between mb-2">
                                                 <div className="text-xs text-gray-700 font-medium flex items-center gap-2">
                                                     <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                     Sources Used in Answer ({m.sources.filter(s => s.metadata?.used).length})
                                                 </div>
                                                 <button
                                                     onClick={() => setShowUsedSources(!showUsedSources)}
                                                     className="text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded border border-green-200 hover:border-green-300 transition-colors"
                                                 >
                                                     {showUsedSources ? 'Show Less' : 'Show All'}
                                                 </button>
                                             </div>
                                             <div className="space-y-1">
                                                 {m.sources.filter(s => s.metadata?.used).slice(0, showUsedSources ? undefined : 5).map((source: Source, index: number) => (
                                                     <div key={`used-${index}`} className="text-xs rounded px-3 py-2 bg-green-50 border border-green-200 flex justify-between items-center">
                                                         <div className="flex items-center gap-2 flex-1 min-w-0">
                                                             <span className="text-xs px-2 py-1 rounded bg-green-200 text-green-700 font-medium">
                                                                 ✓ Used
                                                             </span>
                                                             <span className="truncate text-green-800">
                                                                 {source.metadata?.source || `Source ${index + 1}`}
                                                             </span>
                                                         </div>
                                                         {typeof source.metadata?.score === 'number' && (
                                                             <span className="text-xs ml-2 text-green-600 font-medium">
                                                                 {source.metadata.score.toFixed(3)}
                                                             </span>
                                                         )}
                                                     </div>
                                                 ))}
                                                 {!showUsedSources && m.sources.filter(s => s.metadata?.used).length > 5 && (
                                                     <div className="text-xs text-green-600 text-center py-1">
                                                         +{m.sources.filter(s => s.metadata?.used).length - 5} more used sources
                                                     </div>
                                                 )}
                                             </div>
                                         </div>

                                         {/* Unused Sources Section */}
                                         {m.sources.filter(s => !s.metadata?.used).length > 0 && (
                                             <div className="mb-4">
                                                 <div className="flex items-center justify-between mb-2">
                                                     <div className="text-xs text-gray-700 font-medium flex items-center gap-2">
                                                         <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                                         Sources Below Threshold ({m.sources.filter(s => !s.metadata?.used).length})
                                                     </div>
                                                     <button
                                                         onClick={() => setShowUnusedSources(!showUnusedSources)}
                                                         className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                                                     >
                                                         {showUnusedSources ? 'Hide Details' : 'Show Details'}
                                                     </button>
                                                 </div>
                                                 
                                                 {showUnusedSources && (
                                                     <>
                                                         <div className="space-y-1 max-h-32 overflow-y-auto">
                                                             {m.sources.filter(s => !s.metadata?.used).slice(0, showUnusedSources ? 12 : 6).map((source: Source, index: number) => (
                                                                 <div key={`unused-${index}`} className="text-xs rounded px-3 py-2 bg-gray-50 border border-gray-200 flex justify-between items-center">
                                                                     <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                         <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600 font-medium">
                                                                             ○ Below Threshold
                                                                         </span>
                                                                         <span className="truncate text-gray-600">
                                                                             {source.metadata?.source || `Source ${index + 1}`}
                                                                         </span>
                                                                     </div>
                                                                     {typeof source.metadata?.score === 'number' && (
                                                                         <span className="text-xs ml-2 text-gray-500 font-medium">
                                                                             {source.metadata.score.toFixed(3)}
                                                                         </span>
                                                                     )}
                                                                 </div>
                                                             ))}
                                                             {!showUnusedSources && m.sources.filter(s => !s.metadata?.used).length > 6 && (
                                                                 <div className="text-xs text-gray-500 text-center py-1">
                                                                     +{m.sources.filter(s => !s.metadata?.used).length - 6} more below threshold
                                                                 </div>
                                                             )}
                                                             {showUnusedSources && m.sources.filter(s => !s.metadata?.used).length > 12 && (
                                                                 <div className="text-xs text-gray-500 text-center py-1">
                                                                     +{m.sources.filter(s => !s.metadata?.used).length - 12} more below threshold
                                                                 </div>
                                                             )}
                                                         </div>
                                                         <div className="text-xs text-gray-500 text-center mt-2">
                                                             💡 These sources were retrieved but didn&apos;t meet your relevance threshold of {similarityThreshold.toFixed(2)}
                                                         </div>
                                                     </>
                                                 )}
                                             </div>
                                         )}

                                         {/* Legend */}
                                         <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                                             <div className="text-xs text-blue-800 font-medium mb-1">Legend:</div>
                                             <div className="flex flex-wrap gap-4 text-xs text-blue-700">
                                                 <span className="flex items-center gap-1">
                                                     <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                     Green: Used in answer
                                                 </span>
                                                 <span className="flex items-center gap-1">
                                                     <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                                     Gray: Below threshold
                                                 </span>
                                             </div>
                                         </div>
                                     </div>
                                 )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start mb-4">
                            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-[15px] shadow-sm border border-gray-200 bg-gray-50 text-gray-500">
                                Assistant is thinking…
                            </div>
                        </div>
                    )}
                </div>

                <form
                    onSubmit={currentHandleSubmit}
                    className="sticky bottom-4 mt-4 flex items-end gap-2"
                >
                    <textarea
                        value={localInput}
                        onChange={currentHandleInputChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                            }
                        }}
                        placeholder="Ask anything…"
                        rows={1}
                        className="min-h-[44px] max-h-40 flex-1 resize-y rounded-lg border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10 text-gray-900 placeholder-gray-500"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !localInput.trim()}
                        className="h-11 shrink-0 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50"
                    >
                        {isLoading ? 'Sending…' : 'Send'}
                    </button>
                </form>

                <div className="mt-2 flex items-center justify-between px-1 text-xs text-gray-400">
                    <button
                        type="button"
                        onClick={() => setLocalInput('')}
                        className="hover:text-gray-500"
                    >
                        Clear input
                    </button>
                </div>
            </div>
        </div>
        </>
    );
}


