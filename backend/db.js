const mongoose = require('mongoose')

// sourceHash has a dedicated index so isDuplicatePDF() is a fast point-lookup
// rather than a full collection scan on every upload.
const chunkSchema = new mongoose.Schema({
  text:          { type: String,  required: true },
  embedding:     { type: [Number], required: true },

  // exact token count from the all-MiniLM-L6-v2 tokenizer (includes CLS+SEP).
  // stored at ingestion so contextBuilder never re-tokenises during retrieval.
  tokenCount:    { type: Number },

  // number of complete sentences in this chunk — useful for eval diagnostics.
  sentenceCount: { type: Number },

  sourceFile:    { type: String,  required: true },

  // SHA-256 of the raw PDF bytes.
  // used by isDuplicatePDF() to block duplicate ingestion.
  // index: true creates a single-field ascending index in Atlas.
  sourceHash:    { type: String,  index: true },

  chunkIndex:    { type: Number,  required: true },
  createdAt:     { type: Date,    default: Date.now },
})

// mongoose.models guard prevents "Cannot overwrite model" errors on hot-reload
// and lets retriever.js safely call mongoose.models.Chunk without re-defining.
const Chunk = mongoose.models.Chunk || mongoose.model('Chunk', chunkSchema)

// ── connectDB ────────────────────────────────────────────────────────────────
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('mongodb connected successfully!')
  } catch (error) {
    console.log('mongodb connection error:', error.message)
    process.exit(1)
  }
}

// saveChunk 
// accepts the three new Phase 0 fields alongside the existing ones.
// callers that do not pass the new fields get undefined (stored as null),
// which is safe for backwards compatibility during the transition.
async function saveChunk({ text, embedding, tokenCount, sentenceCount, sourceFile, sourceHash, chunkIndex }) {
  const chunk = new Chunk({
    text,
    embedding,
    tokenCount,
    sentenceCount,
    sourceFile,
    sourceHash,
    chunkIndex,
  })
  await chunk.save()
}

//isDuplicatePDF 
// returns the first chunk document that shares sourceHash, or null.
// the upload route treats a non-null result as a 409 Conflict.
// we only need sourceFile for the error response, so project _id away.
async function isDuplicatePDF(sourceHash) {
  return Chunk.findOne({ sourceHash }, { sourceFile: 1, _id: 0 })
}

module.exports = { connectDB, saveChunk, isDuplicatePDF }