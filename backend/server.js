// server.js
// week 1 → upload route (admin uploads PDF → store in mongodb)
// week 2 → ask route (employee asks question → get cited answer)
// week 3 → updated ask route (streaming response word by word via SSE)
// week 4 → sources event added (sends chunk previews after stream ends)
// week 5 → proper auth added (register / login / verify email / JWT protection)
// phase 0 → sentence-aware chunking, exact token counts, PDF deduplication

const express = require('express')
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
require('dotenv').config()

// week 1 imports — ingestion pipeline
const { parsePDF }             = require('./pdfParser')
const { generateEmbedding }    = require('./embedder')
const {
    connectDB, saveChunk, isDuplicatePDF,
    // chat-session functions (added for chat history: pin / rename / delete / share)
    createChat, appendMessages, getChatByShareId,
} = require('./db')

// phase 0 — replace the old character-based chunker with the new one
// the old chunker.js file is still on disk but no longer called anywhere
const { chunkText }            = require('./ingestion/sentenceChunker')

// phase 0 — tokenizer singleton, loaded once at server startup
const { initializeTokenizer }  = require('./utils/tokenCounter')

// phase 0 — SHA-256 fingerprint of the raw PDF bytes for duplicate detection
const { hashPDF }              = require('./utils/pdfHasher')

// week 2 imports — retrieval pipeline
const { searchSimilarChunks }  = require('./retriever')
const { buildContext }         = require('./contextBuilder')

// week 3 import — streaming answer generator
const { generateAnswerStream } = require('./answerGenerator')

// week 5 imports — authentication
const authRoutes     = require('./routes/authRoutes')
const authMiddleware = require('./middleware/authMiddleware')

// chat history — list/create/rename/pin/delete/share for saved chats
const chatRoutes      = require('./routes/chatRoutes')

const app = express()
app.use(express.json())


// CORS middleware — allows the React frontend on port 5173 to send
// requests that include the Authorization header (needed for JWT).
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin',  'http://localhost:5173')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Browsers send an OPTIONS preflight before the real request.
    // We just respond 200 and let it through.
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200)
    }
    next()
})


// Multer setup — handles the multipart file upload from the frontend.
// Files get saved to the ./uploads folder with a timestamp prefix so
// two files with the same original name never overwrite each other.
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, './uploads')
    },
    filename: function(req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname
        cb(null, uniqueName)
    }
})

// Reject anything that isn't a PDF before it even hits our route handler.
const fileFilter = function(req, file, cb) {
    if (file.mimetype === 'application/pdf') {
        cb(null, true)
    } else {
        cb(new Error('only PDF files are allowed!'), false)
    }
}

const upload = multer({ storage, fileFilter })


// Health check — just confirms the server is running.
app.get('/', (req, res) => {
    res.json({
        message: 'Cortex AI backend is running!',
        status:  'healthy'
    })
})


// Auth routes — register, login, verify email, resend, forgot password, reset password.
// All mounted under /auth so they don't conflict with the main routes.
app.use('/auth', authRoutes)


// Chat history routes — list, create, rename, pin, delete, share.
// Protected: every route in chatRoutes.js requires a valid JWT.
app.use('/chats', authMiddleware, chatRoutes)


// GET /shared/:shareId
// Public, read-only view of a shared chat. Deliberately NOT behind
// authMiddleware — this is the whole point of a share link, anyone
// with it can view without logging in. getChatByShareId() returns
// null if the link was never created or has since been revoked
// (DELETE /chats/:id/share sets shareId back to null).
app.get('/shared/:shareId', async (req, res) => {
    try {
        const chat = await getChatByShareId(req.params.shareId)
        if (!chat) {
            return res.status(404).json({ error: 'this shared link is invalid or has been revoked' })
        }
        // only return what a public viewer should see — no userId, no _id churn.
        res.json({
            title:    chat.title,
            messages: chat.messages,
        })
    } catch (error) {
        console.log('error loading shared chat:', error.message)
        res.status(500).json({ error: 'could not load shared chat', details: error.message })
    }
})


// POST /upload
// Admin uploads a PDF here. The pipeline is:
//   receive file → hash for dedup → parse text → chunk into sentences →
//   embed each chunk → save to MongoDB
// Protected by JWT — only logged-in users can upload documents.
app.post('/upload', authMiddleware, upload.single('pdf'), async (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            error: 'no file uploaded. please attach a PDF file'
        })
    }

    console.log('new pdf received:', req.file.originalname)
    console.log('uploaded by:', req.user.email)
    console.log('saved at:', req.file.path)


    // Phase 0 — duplicate detection.
    // We read the raw PDF bytes and compute a SHA-256 hash before doing
    // any expensive processing. If we've seen this exact file before,
    // we return 409 immediately instead of wasting time re-embedding
    // content that's already in MongoDB.
    const pdfBuffer = fs.readFileSync(req.file.path)
    const pdfHash   = hashPDF(pdfBuffer)

    const existing = await isDuplicatePDF(pdfHash)
    if (existing) {
        return res.status(409).json({
            error:        'this document has already been indexed',
            existingFile: existing.sourceFile
        })
    }


    try {

        // Step 1 — extract the raw text from the PDF binary.
        console.log('step 1: parsing pdf...')
        const fullText = await parsePDF(req.file.path)

        if (!fullText || fullText.length === 0) {
            return res.status(400).json({
                error: 'could not extract text from this PDF. is it a scanned image?'
            })
        }
        console.log('step 1 done! extracted', fullText.length, 'characters')


        // Step 2 — split the text into sentence-aware chunks.
        // The new sentenceChunker respects sentence boundaries and uses
        // the real tokenizer to make sure no chunk exceeds the embedding
        // model's 256-token limit. Each chunk object now includes
        // tokenCount and sentenceCount alongside the text.
        console.log('step 2: chunking text...')
        const chunks = await chunkText(fullText)
        console.log('step 2 done! created', chunks.length, 'chunks')


        // Step 3 — embed each chunk and save it to MongoDB.
        // We also store the pdfHash (sourceHash) on every chunk so the
        // duplicate check above can find them on future uploads.
        console.log('step 3: embedding and saving chunks...')
        let savedCount = 0

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]

            const vector = await generateEmbedding(chunk.text)

            await saveChunk({
                text:          chunk.text,
                embedding:     vector,
                tokenCount:    chunk.tokenCount,
                sentenceCount: chunk.sentenceCount,
                sourceFile:    req.file.originalname,
                sourceHash:    pdfHash,
                chunkIndex:    chunk.chunkIndex,
            })

            savedCount++

            if (i % 5 === 0) {
                console.log(`  progress: ${i + 1} / ${chunks.length} chunks saved`)
            }
        }

        console.log('step 3 done! all chunks saved to mongodb')


        // Calculate average tokens per chunk so we can verify in the
        // console that the new chunker is producing sensible sized chunks.
        const avgTokens = Math.round(
            chunks.reduce((sum, c) => sum + c.tokenCount, 0) / chunks.length
        )

        res.status(201).json({
            message:           'PDF successfully uploaded and processed!',
            fileName:          req.file.originalname,
            totalCharacters:   fullText.length,
            totalChunks:       savedCount,
            avgTokensPerChunk: avgTokens,
            status:            'indexed and ready for search'
        })

    } catch (error) {
        console.log('error during processing:', error.message)
        res.status(500).json({
            error:   'something went wrong while processing the PDF',
            details: error.message
        })
    }
})


// POST /ask
// Employee sends a question and gets a streaming answer back via SSE.
// body: { question, chatId? } — chatId is optional; if missing, a new
// chat is created and its id is sent back via the [CHAT_ID] SSE event
// so the frontend knows which chat this conversation now lives in.
app.post('/ask', authMiddleware, async (req, res) => {

    const question = req.body.question
    let   chatId   = req.body.chatId   // may be missing — frontend sends none for a brand-new chat

    if (!question || question.trim().length === 0) {
        return res.status(400).json({
            error:   'please provide a question',
            example: '{ "question": "How do I process a refund?" }'
        })
    }

    console.log('new question from:', req.user.email)
    console.log('question:', question)


    // Chat history — if the frontend didn't pass a chatId (this is the
    // first message of a brand-new conversation), create the chat now.
    // We title it from the question itself so the sidebar shows
    // something meaningful instead of "New chat" forever.
    if (!chatId) {
        const title = question.trim().slice(0, 60) + (question.trim().length > 60 ? '…' : '')
        const chat  = await createChat(req.user.userId, title)
        chatId = chat._id.toString()
        console.log('created new chat:', chatId)
    }


    // SSE headers must be set before we write any data.
    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.flushHeaders()

    // Tell the frontend which chat this landed in. This matters most
    // on a brand-new chat — the frontend didn't know chatId until now,
    // since it was only just created above.
    res.write(`data: [CHAT_ID]${chatId}\n\n`)
    if (res.flush) res.flush()

    try {

        console.log('step 1: converting question to vector...')
        const questionVector = await generateEmbedding(question)
        console.log('step 1 done!')

        console.log('step 2: searching mongodb...')
        const relevantChunks = await searchSimilarChunks(questionVector, 4)

        if (relevantChunks.length === 0) {
            res.write(`data: ERROR: no relevant information found in the uploaded documents\n\n`)
            res.write(`data: [DONE]\n\n`)
            res.end()
            return
        }
        console.log('step 2 done! found', relevantChunks.length, 'chunks')

        console.log('step 3: building context...')
        const contextPackage = buildContext(relevantChunks, question)
        console.log('step 3 done!')

        console.log('step 4: starting groq stream...')
        const stream = await generateAnswerStream(contextPackage)

        console.log('step 5: streaming to frontend...')
        let fullAnswer = ''

        for await (const piece of stream) {
            const newText = piece.choices[0]?.delta?.content || ''
            if (newText === '') continue

            fullAnswer += newText
            res.write(`data: ${newText}\n\n`)
            if (res.flush) res.flush()
        }

        console.log('streaming complete!')
        console.log('answer preview:', fullAnswer.substring(0, 100) + '...')

        // Send the source chunks that were used to generate the answer
        // so the frontend can show clickable citation cards.
        const sources = relevantChunks.map((chunk, i) => ({
            id:         i,
            file:       chunk.sourceFile  || 'Unknown document',
            chunkIndex: chunk.chunkIndex  ?? i,
            preview:    (chunk.text || '').trim().substring(0, 300),
            score:      chunk.score ? parseFloat(chunk.score.toFixed(3)) : null
        }))

        res.write(`data: [SOURCES]${JSON.stringify({ sources })}\n\n`)
        if (res.flush) res.flush()

        res.write(`data: [DONE]\n\n`)
        res.end()

        console.log('sources sent:', sources.map(s => s.file + ' chunk ' + s.chunkIndex).join(', '))


        // Save this exchange to the chat's history. Done once here, after
        // the full answer is known — not per-token during streaming —
        // since writing to mongo on every streamed word would be slow
        // and pointless (the user only cares about the finished message).
        try {
            await appendMessages(
                chatId,
                { id: `u-${Date.now()}`,     role: 'user',      text: question },
                { id: `a-${Date.now() + 1}`, role: 'assistant', text: fullAnswer, sources },
            )
            console.log('chat history saved:', chatId)
        } catch (saveError) {
            // Don't fail the request over this — the user already has
            // their answer on screen. Just log it so we notice if the
            // save is silently failing every time.
            console.log('warning: could not save chat history:', saveError.message)
        }

    } catch (error) {
        console.log('error during streaming:', error.message)
        res.write(`data: ERROR: ${error.message}\n\n`)
        res.write(`data: [DONE]\n\n`)
        res.end()
    }
})


// Start the server.
// We connect to MongoDB first, then initialize the tokenizer (phase 0),
// then start listening. If either step fails we don't start the server.
const PORT = process.env.PORT || 3000

connectDB().then(async () => {

    // Load the tokenizer once here so it's warm and ready before the
    // first upload request arrives. Both sentenceChunker and contextBuilder
    // will reuse this same loaded instance — no double loading.
    await initializeTokenizer()

    app.listen(PORT, () => {
        console.log(`Cortex AI server running on port ${PORT}`)
        console.log(`visit http://localhost:${PORT} to verify`)
        console.log('routes available:')
        console.log('  GET  /                  → health check')
        console.log('  POST /auth/register     → create account + send email')
        console.log('  POST /auth/login        → login + get JWT token')
        console.log('  GET  /auth/verify/:token → verify email')
        console.log('  POST /auth/resend       → resend verification email')
        console.log('  POST /auth/forgot-password → send reset email')
        console.log('  POST /auth/reset-password  → set new password')
        console.log('  POST /upload            → upload PDF (protected)')
        console.log('  POST /ask               → ask question (protected)')
        console.log('  GET  /chats             → list your chats (protected)')
        console.log('  POST /chats             → create a new chat (protected)')
        console.log('  GET  /chats/:id         → load one chat (protected)')
        console.log('  PUT  /chats/:id         → rename / pin a chat (protected)')
        console.log('  DELETE /chats/:id       → delete a chat (protected)')
        console.log('  POST /chats/:id/share   → turn on a public share link (protected)')
        console.log('  DELETE /chats/:id/share → turn off sharing (protected)')
        console.log('  GET  /shared/:shareId   → view a shared chat (public)')
    })
})