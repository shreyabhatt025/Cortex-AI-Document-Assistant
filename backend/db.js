const mongoose = require('mongoose')

// sourceHash has a dedicated index so isDuplicatePDF() is a fast point-lookup
// rather than a full collection scan on every upload.
const chunkSchema = new mongoose.Schema({
  text:          { type: String, required: true },
  embedding:     { type: [Number], required: true },

  // exact token count from the all-MiniLM-L6-v2 tokenizer (includes CLS+SEP).
  // stored at ingestion so contextBuilder never re-tokenises during retrieval.
  tokenCount:    { type: Number },

  // number of complete sentences in this chunk — useful for eval diagnostics.
  sentenceCount: { type: Number },

  sourceFile:    { type: String, required: true },

  // SHA-256 of the raw PDF bytes.
  // used by isDuplicatePDF() to block duplicate ingestion.
  sourceHash:    { type: String, index: true },

  chunkIndex:    { type: Number, required: true },

  createdAt:     { type: Date, default: Date.now },
})

// Always delete any previously registered Chunk model before defining
// our schema. This prevents old schemas from being reused.
if (mongoose.models.Chunk) {
  delete mongoose.models.Chunk
}

const Chunk = mongoose.model('Chunk', chunkSchema)

// ================= DEBUG =================
console.log('Chunk schema paths:', Object.keys(Chunk.schema.paths))
// =========================================

// ──────────────────────────────────────────────────────────────

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
async function saveChunk({
  text,
  embedding,
  tokenCount,
  sentenceCount,
  sourceFile,
  sourceHash,
  chunkIndex,
}) {
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

// duplicate detection
async function isDuplicatePDF(sourceHash) {
  return Chunk.findOne(
    { sourceHash },
    { sourceFile: 1, _id: 0 }
  )
}

module.exports = {
  connectDB,
  saveChunk,
 isDuplicatePDF,
}