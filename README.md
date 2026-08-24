# Cortex — AI-Powered Document Intelligence System

Cortex is a full-stack Retrieval-Augmented Generation (RAG) application. Upload a PDF, and it becomes instantly queryable — ask questions in plain English and get answers grounded in your document, streamed word-by-word, with clickable source citations back to the exact chunk the answer came from.

Built as a real end-to-end system: authentication, document ingestion, vector search, streaming LLM responses, and persistent multi-chat history — not a single-file demo.

---

## How It Works — The 3 Big Components

![Architecture diagram](https://github.com/shreyabhatt025/opsmind-ai/blob/918515812f52308b4a6cef8d6158a188b9f96db8/opsmind_ai_architecture.svg)

| Component | What it does |
|---|---|
| **Ingestion Pipeline** | Parses a PDF → splits it into sentence-aware chunks → embeds each chunk into a 384-dimensional vector → stores it in MongoDB |
| **Retrieval Pipeline** | Converts a question into the same vector space → runs a cosine-similarity search over Atlas Vector Search → pulls back the top-K most relevant chunks |
| **Generation Pipeline** | Feeds the retrieved chunks + question into an LLM (Groq) → streams the answer back token-by-token via Server-Sent Events, with the source chunks attached |

---

## Features

- **PDF ingestion** — upload a document, it's parsed, chunked, embedded, and indexed automatically
- **Duplicate detection** — every upload is fingerprinted with a SHA-256 hash of its raw bytes *before* any processing starts, so re-uploading the same file doesn't waste embedding calls or create duplicate chunks
- **Sentence-aware chunking** — chunks respect sentence boundaries and are sized against real tokenizer counts (not naive character slicing), so no chunk silently exceeds the embedding model's limit
- **Semantic search** — MongoDB Atlas Vector Search (`$vectorSearch`) over 384-dim embeddings, cosine similarity
- **Streaming answers** — responses stream token-by-token over SSE instead of waiting for the full generation to finish
- **Source citations** — every answer links back to the exact source document and chunk index it was derived from, with a similarity score
- **Authentication** — JWT-based auth with email verification, password reset, and protected routes
- **Persistent chat history** — every conversation is saved per-user in MongoDB; users can create, rename, pin, delete, and revisit past chats
- **Public share links** — any chat can be turned into a read-only public link that works without logging in
- **Dark/light theme** — full theme toggle, persisted across sessions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), plain CSS with design tokens |
| Backend | Node.js, Express |
| Database | MongoDB Atlas + Atlas Vector Search |
| Embeddings | Local model (`Xenova/all-MiniLM-L6-v2`), 384 dimensions, runs on-device via `@xenova/transformers` — no external embedding API calls |
| LLM | Groq (`openai/gpt-oss-120b`), streamed responses |
| Auth | JWT, bcrypt, email verification via Nodemailer |
| Realtime | Server-Sent Events (SSE) |

---

## System Architecture, Step by Step

### 1. Upload (`POST /upload`, protected)
1. File hits the server via Multer, saved to `uploads/` with a timestamp-prefixed filename
2. Raw PDF bytes are hashed with **SHA-256** — if a match already exists in MongoDB, the upload is rejected with `409 Conflict` before any expensive processing happens
3. Text is extracted from the PDF
4. Text is split into sentence-aware chunks, each tagged with an exact token count and sentence count
5. Each chunk is embedded (384-dim vector) and saved to MongoDB, along with the source file's hash (for future dedup checks) and its position in the document

### 2. Ask (`POST /ask`, protected)
1. The question is embedded into the same 384-dim vector space
2. `$vectorSearch` runs against the `chunks` collection, returning the top-K most similar chunks by cosine similarity
3. The retrieved chunks are assembled into a context block and sent to Groq along with the question
4. The answer streams back over SSE, token by token
5. Once the full answer is generated, both the question and answer (plus source citations) are saved to that chat's message history in MongoDB
6. If this was a brand-new conversation, a chat is auto-created and its ID is sent back to the frontend via a `[CHAT_ID]` SSE event

### 3. Chat History (`/chats/*`, protected)
Full CRUD over saved conversations, scoped per-user:

| Route | What it does |
|---|---|
| `GET /chats` | List this user's chats — pinned first, then most recently active |
| `POST /chats` | Create a new empty chat |
| `GET /chats/:id` | Load one chat's full message history |
| `PUT /chats/:id` | Rename and/or pin/unpin a chat |
| `DELETE /chats/:id` | Delete a chat |
| `POST /chats/:id/share` | Generate a public share link for a chat |
| `DELETE /chats/:id/share` | Revoke a chat's share link |
| `GET /shared/:shareId` | **Public, no auth required** — view a shared chat read-only |

---

## API Reference

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/` | — | Health check |
| POST | `/auth/register` | — | Create account, sends verification email |
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/verify/:token` | — | Verify email |
| POST | `/auth/resend` | — | Resend verification email |
| POST | `/auth/forgot-password` | — | Send password reset email |
| POST | `/auth/reset-password` | — | Set new password |
| POST | `/upload` | ✅ | Upload and index a PDF |
| POST | `/ask` | ✅ | Ask a question, get a streamed, cited answer |
| GET | `/chats` | ✅ | List saved chats |
| POST | `/chats` | ✅ | Create a new chat |
| GET | `/chats/:id` | ✅ | Load a chat's history |
| PUT | `/chats/:id` | ✅ | Rename / pin a chat |
| DELETE | `/chats/:id` | ✅ | Delete a chat |
| POST | `/chats/:id/share` | ✅ | Turn on a public share link |
| DELETE | `/chats/:id/share` | ✅ | Turn off sharing |
| GET | `/shared/:shareId` | — | View a shared chat (public, read-only) |

---

## Project Structure

```
opsmind-ai/
├── backend/
│   ├── server.js                 # Express app, all route wiring
│   ├── db.js                     # Mongoose models + all DB functions (Chunk, Chat)
│   ├── retriever.js              # Vector search ($vectorSearch aggregation)
│   ├── pdfParser.js              # PDF text extraction
│   ├── embedder.js               # Local embedding model wrapper
│   ├── contextBuilder.js         # Assembles retrieved chunks into an LLM prompt
│   ├── answerGenerator.js        # Groq streaming completion call
│   ├── ingestion/
│   │   └── sentenceChunker.js    # Sentence-aware, token-aware chunking
│   ├── utils/
│   │   ├── pdfHasher.js          # SHA-256 fingerprinting for dedup
│   │   └── tokenCounter.js       # Tokenizer singleton, loaded once at startup
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── chatRoutes.js         # Chat history CRUD + share
│   └── middleware/
│       └── authMiddleware.js     # JWT verification
│
└── frontend/
    └── src/
        ├── App.jsx                # Entire UI: landing, auth, chat, upload, shared view
        └── index.css              # Design tokens + all styling
```

---

## Setup

### Prerequisites
- Node.js 18+
- A MongoDB Atlas cluster (free M0 tier works) with a Vector Search index configured
- A Groq API key
- A Gmail account for sending verification/reset emails (or swap in your own SMTP provider)

### 1. Clone and install

```bash
git clone https://github.com/shreyabhatt025/opsmind-ai.git
cd opsmind-ai/backend && npm install
cd ../frontend && npm install
```

### 2. Environment variables (`backend/.env`)

```env
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
PORT=3000

# Email service (verify exact variable names against your emailService.js)
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
```

> **Note:** confirm the email-related variable names against your own `emailService.js` — the names above are placeholders based on typical Nodemailer + Gmail setup and should be double-checked before assuming they're exact.

### 3. Create the Atlas Vector Search index

In MongoDB Atlas → your cluster → **Search & Vector Search** → **Create Search Index** → **Vector Search** → **JSON Editor**, on the `chunks` collection, named exactly `vector_index`:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    }
  ]
}
```

Wait for the index status to show **Active** before testing.

### 4. Run it

```bash
# terminal 1
cd backend && node server.js

# terminal 2
cd frontend && npm run dev
```

Visit `http://localhost:5173`.

---

## Measured Performance

Tested against a 91-chunk index spanning 4 SOP documents, on a MongoDB Atlas **M0 (free tier)** shared cluster, across a 9-question test set:

| Metric | Result |
|---|---|
| Chunks indexed | 91 |
| Documents indexed | 4 |
| Average retrieval latency | ~628ms |
| Latency range | 350ms – 1115ms |
| Average top-match cosine similarity | 0.81 |

The latency spread is largely attributable to the shared, throttled resources of the free-tier cluster — a dedicated cluster would be expected to perform more consistently.

---

## Known Limitations

- **Chunking can occasionally separate a label from its value.** In one test case, a leave-policy figure ("Casual Leave: 12 days per year") was split across a chunk boundary in a way that retrieval still surfaced the right chunks, but the LLM declined to answer confidently. This is a chunking-strategy tradeoff, not a retrieval failure — a smaller chunk overlap or a re-chunking pass around list-style content would likely fix it.
- **Free-tier Atlas cluster** — latency and cold-start behavior are not representative of a production-grade deployment.
- **Single embedding model** — no support yet for swapping embedding models without re-indexing all existing documents.

---

## Security Notes

- Passwords are hashed; JWTs are used for all protected routes
- Every chat and PDF-dedup check is scoped to `req.user.userId` — one user can never read, rename, or delete another user's data
- Public share links are unauthenticated by design (that's the point of sharing), but only expose the `title` and `messages` fields of a chat — never the owning user's ID or any other metadata
- Duplicate PDF detection is based on a SHA-256 hash of raw file bytes, not filename, so renamed duplicates are still caught

---
