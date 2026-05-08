

 WEEK 1 used:   openai.embeddings.create()
  → converts text to numbers (vector)
 → returns 1536 numbers, no readable text

WEEK 2 uses:   openai.chat.completions.create()
   → reads context and generates human answer
  → used for ANSWERING questions
  → returns readable text like a real person

  Package from contextBuilder.js
{ systemPrompt, userQuestion }
   ↓
Send to OpenAI Chat API with:
→ role: "system" → systemPrompt (instructions + context)
→ role: "user"   → userQuestion (employee's question)
   ↓
OpenAI reads the context
finds relevant information
generates a cited answer
  ↓
We receive OpenAI's response object
   ↓
Extract just the answer text from it
  ↓
Return clean answer string to server.js
   ↓
server.js sends it to employee as JSON response