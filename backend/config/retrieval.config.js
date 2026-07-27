// config/retrieval.config.js
//
// This is the single place where every tunable number in the retrieval
// pipeline lives. Nothing is hardcoded inside the actual modules.
//
// Why does this matter?
// In Phase 6 we run a hyperparameter sweep — we try different values of
// RRF_K, RERANK_POOL_SIZE, etc. and measure which combination gives the
// best Hit@3 score on the eval set. If those numbers were scattered across
// five different files we'd have to hunt them down every time we want to
// change something. Here, one file controls everything.
//
// Every value can also be overridden by an environment variable, so you
// can do something like  RRF_K=30 node server.js
// and run the server with a different config without touching the code.
// This is how the Phase 6 sweep works in practice.
//
// Every eval result stored in MongoDB also saves a snapshot of this config
// so you know exactly which settings produced which numbers. Without that
// snapshot, results from different runs can't be compared fairly.

module.exports = {

  // Chunking settings 

  // When we're building a chunk and the total token count reaches this
  // number, we close the chunk and start a new one. We chose 200 because
  // the embedding model (all-MiniLM-L6-v2) has a hard limit of 256 tokens,
  // and we want comfortable headroom so we never accidentally go over.
  TARGET_TOKENS: parseInt(process.env.TARGET_TOKENS, 10) || 200,

  // This is the absolute ceiling — no chunk stored in MongoDB should ever
  // exceed this token count. 240 gives us 16 tokens of safety margin below
  // the model's 256 limit. If a chunk hits this, we close it immediately
  // even if we're in the middle of adding sentences.
  MAX_TOKENS: parseInt(process.env.MAX_TOKENS, 10) || 240,

  // When we finish one chunk and start the next, we carry this many
  // sentences from the end of the previous chunk into the beginning of the
  // new one. This overlap makes sure that if a useful piece of information
  // happens to sit right at a chunk boundary, it still appears in full
  // in at least one of the two adjacent chunks.
  OVERLAP_SENTENCES: parseInt(process.env.OVERLAP_SENTENCES, 10) || 2,


  // Vector search settings 

  // Before MongoDB Atlas returns results, it internally considers this many
  // candidate documents. A higher number means better recall (it looks at
  // more candidates before picking the top ones) but also means slightly
  // more work on the Atlas side. 40 is a reasonable default.
  VECTOR_NUM_CANDIDATES: parseInt(process.env.VECTOR_NUM_CANDIDATES, 10) || 40,

  // How many chunks vector search actually returns to us after considering
  // the candidates above. We ask for 20 so we have a decent pool to pass
  // into the reranker later. Must always be less than VECTOR_NUM_CANDIDATES.
  VECTOR_TOP_K: parseInt(process.env.VECTOR_TOP_K, 10) || 20,


  // BM25 search settings (added in Phase 3) 

  // How many results the BM25 keyword search returns. We keep this the same
  // as VECTOR_TOP_K so both retrieval paths contribute equally to the
  // Reciprocal Rank Fusion merge step.
  BM25_TOP_K: parseInt(process.env.BM25_TOP_K, 10) || 20,


  // Reciprocal Rank Fusion settings (added in Phase 3

  // This is the smoothing constant in the RRF formula:
  //   score = 1 / (k + rank)
  // The value 60 comes from the original RRF research paper (Cormack 2009)
  // and has been the standard default ever since. A lower k makes the
  // top-ranked results much more dominant. A higher k makes the scoring
  // more democratic. We tune this in Phase 6 by trying 30, 60, and 120
  // and seeing which gives the best Hit@3 on our eval set.
  RRF_K: parseInt(process.env.RRF_K, 10) || 60,


  // Reranker settings (added in Phase 4) 

  // After RRF merges the results from vector search and BM25, we pass this
  // many chunks into the cross-encoder reranker. The reranker reads each
  // chunk alongside the question and gives it a proper relevance score.
  // 20 is the sweet spot — enough candidates for the reranker to work with,
  // not so many that it becomes slow. Must be <= VECTOR_TOP_K.
  RERANK_POOL_SIZE: parseInt(process.env.RERANK_POOL_SIZE, 10) || 20,

  // After the reranker scores all the candidates, we only keep the top N
  // and pass them to the context builder. 4 chunks is usually enough to
  // answer most questions without bloating the prompt sent to Groq.
  FINAL_CONTEXT_CHUNKS: parseInt(process.env.FINAL_CONTEXT_CHUNKS, 10) || 4,

  // The reranker (cross-encoder model) runs locally in Node.js, which means
  // it can be slow on a basic CPU. If it takes longer than this many
  // milliseconds, we give up waiting and fall back to just using the top 4
  // chunks by RRF score instead. The user still gets an answer — just
  // without the reranking quality improvement.
  RERANK_TIMEOUT_MS: parseInt(process.env.RERANK_TIMEOUT_MS, 10) || 1200,


  // Context builder settings 

  // The total number of tokens we're allowed to send to Groq — this covers
  // the system prompt, all the retrieved chunk text, and the user's question
  // combined. 6000 is well within Groq's context window and leaves room for
  // the model to generate a decent length answer without hitting any limits.
  MAX_CONTEXT_TOKENS: parseInt(process.env.MAX_CONTEXT_TOKENS, 10) || 6000,

}