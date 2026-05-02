Week 2 — you USE that knowledge to ANSWER questions
"Employee asks question → find relevant chunks → generate answer"

Employee asks: "How do I process a refund?"
  ↓
Convert question to vector (embedder.js)
  ↓
Search MongoDB for top 3-5 chunks closest to that vector
(retriever.js)
 ↓
Merge those chunks into one big context paragraph
(contextBuilder.js)
  ↓
Send question + context to OpenAI GPT
(answerGenerator.js)
  ↓
Get back answer WITH source citation
"According to OPSMIND_SOP.pdf, Section 1.3..."