retriever.js gives you: 4 random answer pieces (like puzzle pieces)

contextBuilder.js does:arranges those pieces properly
                        
  4 chunk objects from retriever.js
    ↓
Loop through each chunk
↓
Format each chunk with its source label:
"[Source: OPSMIND_SOP.pdf | Chunk 2]
To process a refund navigate to..."
 ↓
Join all formatted chunks into one big context string
↓
Write a system prompt (instructions for OpenAI)
"You are an AI assistant. Only use the context below.
 Always cite your source. Never make things up..."
 ↓
Return:
{
  systemPrompt: "instructions for OpenAI...",
  contextText: "all 4 chunks combined...",
  userMessage: "How do I process a refund?"
}
   ↓
answerGenerator.js receives this and sends to OpenAI                      

