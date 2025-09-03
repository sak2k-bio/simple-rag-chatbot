export const SYSTEM_PROMPT = `You are a knowledgeable and helpful medical AI assistant with access to a comprehensive medical knowledge base. Your role is to:

1. **Provide Accurate Medical Information**: Use the retrieved context to give precise, factual medical answers
2. **Maintain Medical Context**: Reference previous conversation history when relevant to medical discussions
3. **Be Helpful and Comprehensive**: Offer clear medical explanations and practical guidance
4. **Stay Medically Focused**: Keep responses relevant to medical questions and conditions
5. **Use Available Context**: ALWAYS base your responses on the provided medical documents when available

**Critical Medical Guidelines:**
- Base your responses on the provided medical context when available
- If the context doesn't contain relevant information, still answer from general medical knowledge
- Be conversational but professional
- Use markdown formatting for better readability
- Keep responses concise but comprehensive
- **CRITICAL: NEVER say "no information found" or "cannot answer" - always provide a helpful medical response**

**Response Format:**
- Start with a direct answer to the medical question
- Provide specific details from the available context when possible
- Include relevant medical information that could be helpful
- Use bullet points or numbered lists for complex medical information
- End with a brief summary or next steps if applicable
- If the retrieved context doesn't directly mention the specific term, note this but still provide a comprehensive answer`;

export function buildRagPrompt(context: string, userQuestion: string): string {
    return `Based on the following information from your medical knowledge base, please answer the user's question:

**Medical Knowledge Base Context:**
${context}

**User Question:** ${userQuestion}

**Instructions:** 
- Use the provided context to answer the question accurately
- If the context doesn't contain enough information, still answer from general medical knowledge
- Provide specific details and examples from the context when possible
- Format your response clearly and professionally
- Focus on medical accuracy and relevance
- Always provide a helpful medical answer, even if the retrieved context doesn't directly mention the specific topic
- **IMPORTANT: NEVER say "no information found" or "cannot answer" - always provide a comprehensive medical response**

**Answer:**`;
}

export function buildConversationPrompt(
    context: string, 
    userQuestion: string, 
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    useSystemPrompt: boolean = true,
    historySummary?: string
): string {
    const systemPromptSection = useSystemPrompt ? `${SYSTEM_PROMPT}\n\n` : '';
    
    const historySection = conversationHistory.length > 0 
        ? `**Conversation History:**
${conversationHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}

` 
        : '';

    const summarySection = historySummary && historySummary.trim().length > 0
        ? `**Conversation Summary:**
${historySummary}

`
        : '';

    return `${systemPromptSection}${historySection}${summarySection}**Retrieved Medical Documents:**
${context}

**Current Question:** ${userQuestion}

**Instructions:** 
- Use the conversation history to provide context-aware responses
- Reference previous questions and answers when relevant
- Maintain continuity in the conversation
- Answer the current question based on both the conversation history and retrieved documents
- Use the retrieved documents as your primary source of information
- If the context doesn't contain relevant information, still answer from general medical knowledge
- Always provide a helpful medical answer, even if the retrieved context doesn't directly mention the specific topic
- **IMPORTANT: NEVER say "no information found" or "cannot answer" - always provide a comprehensive medical response**
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

export function buildHistorySummaryPrompt(history: Array<{ role: 'user' | 'assistant'; content: string }>): string {
    return `Summarize the following conversation so far into 4-6 concise bullet points that capture:
1) the user's main goals/questions, 2) important facts/constraints, 3) progress made, and 4) any unresolved items.
Use neutral, factual wording. Do not include any meta-instructions.

Conversation:
${history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}`;
}

export function buildQueryTranslationPrompt(query: string): string {
    return `Rewrite the user's query to be maximally clear, specific, and information-dense for retrieval.
Preserve the user's intent. Expand abbreviations and add likely synonyms. Do not change meaning.

Original query:
${query}

Return only the rewritten query.`;
}

export function buildDocsJudgePrompt(query: string, snippets: Array<{ source: string; score: number; text: string }>): string {
    const joined = snippets.map((s, i) => `[#${i+1}] source=${s.source} score=${s.score.toFixed(3)}\n${s.text}`).join('\n\n');
    return `Given the rewritten query and retrieved snippets, judge which snippets are relevant and sufficient.
For each snippet, respond with JSON lines of the form {"idx": number, "relevant": boolean, "why": string}.
Then provide one final JSON line {"action": "ok"|"refine", "reason": string, "hint": string}.

Query:
${query}

Snippets:
${joined}`;
}

export function buildRefinementPrompt(query: string, judgeHint: string): string {
    return `Refine the rewritten query based on the judge hint so retrieval will improve.
Original rewritten query:
${query}

Judge hint:
${judgeHint}

Return only the refined rewritten query.`;
}


export function buildHydePrompt(userQuestion: string): string {
    return `You are a domain expert medical writer. Generate a concise, factual, textbook-style passage that would likely appear in authoritative pulmonary/medical references and directly addresses the user's question below. Write it as a neutral explanatory paragraph optimized for dense retrieval (no disclaimers, no conversational tone, no references, no bullet points). Include important terminology, synonyms, and typical clinical details that improve retrieval.

User Question:
${userQuestion}

Write a single dense paragraph of 120-220 words.`;
}


