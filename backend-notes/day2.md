 chunker.js
this file has one job — take a big text string which is coming from pdfParser.js and cut it into smaller overlapping pieces called chunks.

these chunks are core unit of the entire RAG pipeline - every chunk will get its vector embedding what actually get stored in mongodb


here there is a main mechanism called overlap 

eg- My name is Aryan. I am learning to build OpsMind AI. 
It is a RAG based system. RAG stands for Retrieval 
Augmented Generation. It helps answer questions.

Without overlap (chunksize=50 , overlap=0)
Chunk 1: "My name is Aryan. I am learning to build "
Chunk 2: "OpsMind AI. It is a RAG based system. RAG"
Chunk 3: " stands for Retrieval Augmented Generation"
Chunk 4: ". It helps answer questions."

User asks: "What is Aryan learning?"
→ Chunk 1 has "Aryan" and "learning" but not WHAT
→ Chunk 2 has "OpsMind AI" but not "Aryan"
→ No single chunk answers it fully 

WITH overlap (chunkSize=50, overlap=15):

Chunk 1: "My name is Aryan. I am learning to build "
 last 15 chars ↓
Chunk 2: "rning to build OpsMind AI. It is a RAG ba"
 last 15 chars ↓
Chunk 3: "t is a RAG ba sed system. RAG stands for R"

here Each chunk REPEATS the last 15 chars of previous chunk
So "Aryan...learning to build OpsMind AI" is all in Chunk 2 
