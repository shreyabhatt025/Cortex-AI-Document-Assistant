// server.js
// week 1 → upload route (admin uploads PDF → store in mongodb)
// week 2 → ask route (employee asks question → get cited answer)
// week 3 → updated ask route (streaming response word by word via SSE)
// week 4 → sources event added (sends chunk previews after stream ends)
// week 5 → proper auth added (register / login / verify email / JWT protection)

const express = require('express')
const multer  = require('multer')
const path    = require('path')
require('dotenv').config()

// ── WEEK 1 IMPORTS ───────────────────────────────────────────────────────────
const { parsePDF }             = require('./pdfParser')
const { chunkText }            = require('./chunker')
const { generateEmbedding }    = require('./embedder')
const { connectDB, saveChunk } = require('./db')

// ── WEEK 2 IMPORTS ───────────────────────────────────────────────────────────
const { searchSimilarChunks }  = require('./retriever')
const { buildContext }         = require('./contextBuilder')

// ── WEEK 3 IMPORT ────────────────────────────────────────────────────────────
const { generateAnswerStream } = require('./answerGenerator')

// ── WEEK 5 IMPORTS ───────────────────────────────────────────────────────────
const authRoutes      = require('./routes/authRoutes')
const authMiddleware  = require('./middleware/authMiddleware')

const app = express()
app.use(express.json())

// ── CORS ──────────────────────────────────────────────────────────────────────
// allows the React frontend (localhost:5173) to send requests with
// the Authorization header — required for JWT to work across ports
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin',  'http://localhost:5173')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // OPTIONS is a preflight request browsers send before the real request
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200)
    }
    next()
})


// ── MULTER SETUP ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, './uploads')
    },
    filename: function(req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname
        cb(null, uniqueName)
    }
})

const fileFilter = function(req, file, cb) {
    if (file.mimetype === 'application/pdf') {
        cb(null, true)
    } else {
        cb(new Error('only PDF files are allowed!'), false)
    }
}

const upload = multer({ storage, fileFilter })


// ── ROUTE 1: GET / ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        message: 'Cortex AI backend is running!',
        status:  'healthy'
    })
})


// ── WEEK 5: AUTH ROUTES ───────────────────────────────────────────────────────
// mounts all auth routes under /auth prefix
// POST /auth/register  → create account + send verification email
// POST /auth/login     → login + get JWT token
// GET  /auth/verify/:token → verify email address
// POST /auth/resend    → resend verification email
app.use('/auth', authRoutes)


// ── ROUTE 2: POST /upload (WEEK 1 + WEEK 5) ──────────────────────────────────
// authMiddleware added — user must be logged in to upload PDFs
// req.user is now available inside this route (userId, email, name)

app.post('/upload', authMiddleware, upload.single('pdf'), async (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            error: 'no file uploaded. please attach a PDF file'
        })
    }

    console.log('new pdf received:', req.file.originalname)
    console.log('uploaded by:', req.user.email)
    console.log('saved at:', req.file.path)

    try {
        // step 1: extract text
        console.log('step 1: parsing pdf...')
        const fullText = await parsePDF(req.file.path)

        if (!fullText || fullText.length === 0) {
            return res.status(400).json({
                error: 'could not extract text from this PDF. is it a scanned image?'
            })
        }
        console.log('step 1 done! extracted', fullText.length, 'characters')

        // step 2: chunk
        console.log('step 2: chunking text...')
        const chunks = chunkText(fullText, 1000, 100)
        console.log('step 2 done! created', chunks.length, 'chunks')

        // step 3: embed and save
        console.log('step 3: embedding and saving chunks...')
        let savedCount = 0

        for (let i = 0; i < chunks.length; i++) {
            const vector = await generateEmbedding(chunks[i])
            await saveChunk({
                text:       chunks[i],
                embedding:  vector,
                sourceFile: req.file.originalname,
                chunkIndex: i
            })
            savedCount++
            if (i % 5 === 0) {
                console.log(`  progress: ${i + 1} / ${chunks.length} chunks saved`)
            }
        }

        console.log('step 3 done! all chunks saved to mongodb')

        res.status(201).json({
            message:         'PDF successfully uploaded and processed!',
            fileName:        req.file.originalname,
            totalCharacters: fullText.length,
            totalChunks:     savedCount,
            status:          'indexed and ready for search'
        })

    } catch (error) {
        console.log('error during processing:', error.message)
        res.status(500).json({
            error:   'something went wrong while processing the PDF',
            details: error.message
        })
    }
})


// ── ROUTE 3: POST /ask (WEEK 3 + WEEK 4 + WEEK 5) ────────────────────────────
// authMiddleware added — user must be logged in to ask questions
// SSE still works — authMiddleware runs first, then SSE headers are set

app.post('/ask', authMiddleware, async (req, res) => {

    const question = req.body.question

    if (!question || question.trim().length === 0) {
        return res.status(400).json({
            error:   'please provide a question',
            example: '{ "question": "How do I process a refund?" }'
        })
    }

    console.log('new question from:', req.user.email)
    console.log('question:', question)

    // SSE headers — must be sent before any data
    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.flushHeaders()

    try {

        // step 1: embed the question
        console.log('step 1: converting question to vector...')
        const questionVector = await generateEmbedding(question)
        console.log('step 1 done!')

        // step 2: search mongodb
        console.log('step 2: searching mongodb...')
        const relevantChunks = await searchSimilarChunks(questionVector, 4)

        if (relevantChunks.length === 0) {
            res.write(`data: ERROR: no relevant information found in the uploaded documents\n\n`)
            res.write(`data: [DONE]\n\n`)
            res.end()
            return
        }

        console.log('step 2 done! found', relevantChunks.length, 'chunks')

        // step 3: build context + system prompt
        console.log('step 3: building context...')
        const contextPackage = buildContext(relevantChunks, question)
        console.log('step 3 done!')

        // step 4: start groq stream
        console.log('step 4: starting groq stream...')
        const stream = await generateAnswerStream(contextPackage)

        // step 5: stream tokens to frontend word by word
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

        // ── send sources after streaming ──────────────────────────────────
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

    } catch (error) {
        console.log('error during streaming:', error.message)
        res.write(`data: ERROR: ${error.message}\n\n`)
        res.write(`data: [DONE]\n\n`)
        res.end()
    }
})


// ── START SERVER ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Cortex AI server running on port ${PORT}`)
        console.log(`visit http://localhost:${PORT} to verify`)
        console.log('routes available:')
        console.log('  GET  /                  → health check')
        console.log('  POST /auth/register     → create account + send email')
        console.log('  POST /auth/login        → login + get JWT token')
        console.log('  GET  /auth/verify/:token → verify email')
        console.log('  POST /auth/resend       → resend verification email')
        console.log('  POST /upload            → upload PDF (protected)')
        console.log('  POST /ask               → ask question (protected)')
    })
})

