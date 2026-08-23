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

// ── Chat sessions ──────────────────────────────────────────────────
// Each document here is one saved conversation (what shows up in the
// sidebar chat list). userId scopes chats to whoever owns them so one
// user can never list or open another user's chats.
//
// shareId is null by default. When a user clicks "share", we generate
// a random shareId and stamp it here — that's what turns a chat into
// a publicly viewable (read-only) link via GET /shared/:shareId.
const chatSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },

  title:  { type: String, default: 'New chat' },
  pinned: { type: Boolean, default: false },

  // null = not shared. a random url-safe string = shared, and this
  // string is the public id used in the share link.
  shareId: { type: String, default: null, index: true, sparse: true },

  // full message history for this chat, in order.
  messages: [{
    id:      String,
    role:    String, // 'user' | 'assistant'
    text:    String,
    sources: [{
      file:       String,
      chunkIndex: Number,
      preview:    String,
      score:      Number,
    }],
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

// Always delete any previously registered Chunk/Chat model before
// defining our schemas. This prevents old schemas from being reused
// (same reasoning as the Chunk model below).
if (mongoose.models.Chunk) {
  delete mongoose.models.Chunk
}
if (mongoose.models.Chat) {
  delete mongoose.models.Chat
}

const Chunk = mongoose.model('Chunk', chunkSchema)
const Chat  = mongoose.model('Chat', chatSchema)

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

// ──────────────────────────────────────────────────────────────
// CHAT FUNCTIONS
// ──────────────────────────────────────────────────────────────

// listChats
// returns this user's chats for the sidebar list — pinned chats
// first, then most recently updated. we don't send back the full
// messages array here, just enough to render the list, so this
// stays fast even once a user has hundreds of chats.
async function listChats(userId) {
  return Chat.find(
    { userId },
    { title: 1, pinned: 1, shareId: 1, updatedAt: 1, createdAt: 1 }
  ).sort({ pinned: -1, updatedAt: -1 })
}

// createChat
// makes a new empty chat for this user. title can be passed in
// (e.g. derived from the user's first question) or left as the
// schema default ("New chat").
async function createChat(userId, title) {
  const chat = new Chat({ userId, title: title || 'New chat', messages: [] })
  await chat.save()
  return chat
}

// getChat
// fetches one chat WITH its full message history, but only if it
// belongs to this userId. returns null if it doesn't exist or
// belongs to someone else — callers should treat both cases as 404.
async function getChat(chatId, userId) {
  return Chat.findOne({ _id: chatId, userId })
}

// updateChat
// applies a partial update (title, pinned, shareId) to a chat, only
// if it belongs to this userId. also bumps updatedAt so renaming or
// pinning doesn't silently change sort order in unexpected ways —
// we only want updatedAt to move on rename/pin/message activity,
// not on every read.
async function updateChat(chatId, userId, updates) {
  return Chat.findOneAndUpdate(
    { _id: chatId, userId },
    { ...updates, updatedAt: Date.now() },
    { new: true }
  )
}

// deleteChat
// removes a chat, only if it belongs to this userId.
// returns the deleted doc, or null if nothing matched.
async function deleteChat(chatId, userId) {
  return Chat.findOneAndDelete({ _id: chatId, userId })
}

// appendMessages
// pushes the user's question and the assistant's finished answer
// onto a chat's message history, and bumps updatedAt so the chat
// jumps to the top of the sidebar list. called once per /ask
// request, after streaming finishes — not on every token, since
// writing to mongo on every streamed word would be wasteful and slow.
async function appendMessages(chatId, userMessage, aiMessage) {
  return Chat.findOneAndUpdate(
    { _id: chatId },
    {
      $push: { messages: { $each: [userMessage, aiMessage] } },
      $set:  { updatedAt: Date.now() },
    },
    { new: true }
  )
}

// getChatByShareId
// public lookup used by the unauthenticated GET /shared/:shareId
// route. no userId check here on purpose — that's what makes the
// link "public". only returns something if shareId is actually set
// (i.e. sharing hasn't been turned off).
async function getChatByShareId(shareId) {
  return Chat.findOne({ shareId })
}

module.exports = {
  connectDB,
  saveChunk,
  isDuplicatePDF,
  listChats,
  createChat,
  getChat,
  updateChat,
  deleteChat,
  appendMessages,
  getChatByShareId,
}