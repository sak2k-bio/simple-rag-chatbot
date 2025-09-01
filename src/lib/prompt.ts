export const SYSTEM_PROMPT = `You are a knowledgeable and helpful AI assistant with access to a comprehensive knowledge base. Your role is to:

1. **Provide Accurate Information**: Use the retrieved context to give precise, factual answers
2. **Maintain Context**: Reference previous conversation history when relevant
3. **Be Helpful**: Offer clear explanations and practical guidance
4. **Stay Focused**: Keep responses relevant to the user's questions
5. **Cite Sources**: When possible, mention which parts of your knowledge base you're drawing from

**Important Guidelines:**
- Always base your responses on the provided context when available
- If the context doesn't contain relevant information, say so clearly
- Be conversational but professional
- Use markdown formatting for better readability
- Keep responses concise but comprehensive

**Response Format:**
- Start with a direct answer to the question
- Provide additional context or explanations as needed
- Use bullet points or numbered lists for complex information
- End with a brief summary or next steps if applicable`;

export function buildRagPrompt(context: string, userQuestion: string): string {
    return `Based on the following information from your knowledge base, please answer the user's question:

**Knowledge Base Context:**
${context}

**User Question:** ${userQuestion}

**Instructions:** 
- Use the provided context to answer the question accurately
- If the context doesn't contain enough information, say so
- Provide specific details and examples from the context when possible
- Format your response clearly and professionally

**Answer:**`;
}

export function buildConversationPrompt(
    context: string, 
    userQuestion: string, 
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    useSystemPrompt: boolean = true
): string {
    const systemPromptSection = useSystemPrompt ? `${SYSTEM_PROMPT}\n\n` : '';
    
    const historySection = conversationHistory.length > 0 
        ? `**Conversation History:**
${conversationHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}

` 
        : '';

    return `${systemPromptSection}${historySection}**Retrieved Documents:**
${context}

**Current Question:** ${userQuestion}

**Instructions:** 
- Use the conversation history to provide context-aware responses
- Reference previous questions and answers when relevant
- Maintain continuity in the conversation
- Answer the current question based on both the conversation history and retrieved documents
- Use the retrieved documents as your primary source of information
${useSystemPrompt ? '' : '\n- Provide direct, factual answers without any specific personality or style constraints'}

**Response:**`;
}

export function buildQueryAnalysisPrompt(query: string): string {
    return `Analyze the following query to determine its complexity and recommend optimal search parameters:

**Query:** ${query}

**Analysis Tasks:**
1. Determine query complexity (Simple/Moderate/Complex)
2. Count query length
3. Identify technical terms
4. Check for complex vocabulary
5. Detect multiple questions
6. Recommend optimal Top-K value (1-20)

**Complexity Criteria:**
- Simple: Short queries, basic vocabulary, single question
- Moderate: Medium length, some technical terms, clear intent
- Complex: Long queries, technical terms, multiple questions, sophisticated vocabulary

**Top-K Recommendations:**
- Simple queries: 3-5 chunks
- Moderate queries: 5-8 chunks  
- Complex queries: 8-12 chunks

Provide your analysis in JSON format with the following structure:
{
  "complexity": "Simple|Moderate|Complex",
  "recommendedTopK": number,
  "reasoning": "explanation",
  "queryLength": number,
  "hasTechnicalTerms": boolean,
  "hasComplexWords": boolean,
  "hasMultipleQuestions": boolean
}`;
}


