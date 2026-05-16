now we will add /ask route in server.js 
(POST /ask  → employee asks question → gets cited answer back)

till now we ony have 1 route = POST /upload  → admin uploads PDF → stores in MongoDB

Without this route there is no way for an employee to actually talk to the AI


Employee sends:
{ "question": "How do I process a refund?" }
↓
server.js receives the question
↓
calls embedder.js → converts question to vector
↓
calls retriever.js → finds top 4 matching chunks from MongoDB
↓
calls contextBuilder.js → formats chunks + writes instructions
 ↓
calls answerGenerator.js → sends to OpenAI → gets cited answer
↓
server.js sends back:
