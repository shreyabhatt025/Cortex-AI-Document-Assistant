// server.js
// this is the main file of the entire backend
// week 1 → upload route (admin uploads PDF → store in mongodb)
// week 2 → ask route (employee asks question → get cited answer)
// week 3 → updated ask route (streaming response word by word via SSE)
// week 4 → sources event added (sends chunk previews after stream ends)

const express = require('express')
const multer  = require('multer')
const path    = require('path')
require('dotenv').config()

// ── WEEK 1 IMPORTS ───────────────────────────────────────────────────────────
const { parsePDF }                    = require('./pdfParser')
const { chunkText }                   = require('./chunker')
const { generateEmbedding }           = require('./embedder')
const { connectDB, saveChunk }        = require('./db')

// ── WEEK 2 IMPORTS ───────────────────────────────────────────────────────────
const { searchSimilarChunks }         = require('./retriever')
const { buildContext }                = require('./contextBuilder')

// ── WEEK 3 IMPORT ────────────────────────────────────────────────────────────
const { generateAnswerStream }        = require('./answerGenerator')

const app = express()
app.use(express.json())


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
        message: 'OpsMind AI backend is running!',
        status:  'healthy'
    })
})


// ── ROUTE 2: POST /upload (WEEK 1) ───────────────────────────────────────────
app.post('/upload', upload.single('pdf'), async (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            error: 'no file uploaded. please attach a PDF file'
        })
    }

    console.log('new pdf received:', req.file.originalname)
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


// ── ROUTE 3: POST /ask (WEEK 3 + WEEK 4) ─────────────────────────────────────
// week 3 → streams answer word by word via SSE
// week 4 → after stream ends, sends one [SOURCES] event with chunk previews
//           so the frontend can show clickable citations
//
// SSE event order:
//   data: To\n\n
//   data:  process\n\n
//   ...all tokens...
//   data: [SOURCES]{"sources":[{...},{...}]}\n\n   ← NEW in week 4
//   data: [DONE]\n\n

app.post('/ask', async (req, res) => {

    const question = req.body.question

    if (!question || question.trim().length === 0) {
        return res.status(400).json({
            error:   'please provide a question',
            example: '{ "question": "How do I process a refund?" }'
        })
    }

    console.log('new question received:', question)

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

            // plain text SSE token — frontend reads line.slice(6)
            res.write(`data: ${newText}\n\n`)
            if (res.flush) res.flush()
        }

        console.log('streaming complete!')
        console.log('answer preview:', fullAnswer.substring(0, 100) + '...')

        // ── WEEK 4: send sources after streaming is done ──────────────────
        // build a clean sources array from the retrieved chunks
        // each source has: file name, chunk index, and a short text preview
        // frontend will display these as clickable citation cards

        const sources = relevantChunks.map((chunk, i) => ({
            id:         i,
            file:       chunk.sourceFile  || 'Unknown document',
            chunkIndex: chunk.chunkIndex  ?? i,
            preview:    (chunk.text || '').trim().substring(0, 300),   // first 300 chars shown in drawer
            score:      chunk.score ? parseFloat(chunk.score.toFixed(3)) : null
        }))

        // send as one SSE event — frontend detects [SOURCES] prefix
        res.write(`data: [SOURCES]${JSON.stringify({ sources })}\n\n`)
        if (res.flush) res.flush()

        // signal stream is fully done
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
        console.log(`OpsMind AI server running on port ${PORT}`)
        console.log(`visit http://localhost:${PORT} to verify`)
        console.log('routes available:')
        console.log('  GET  /        → health check')
        console.log('  POST /upload  → admin uploads PDF (week 1)')
        console.log('  POST /ask     → employee asks question (week 3 + 4 streaming + sources)')
    })
})