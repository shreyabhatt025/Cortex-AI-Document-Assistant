// server.js
// this is the main file of the entire backend
// week 1 → upload route (admin uploads PDF → store in mongodb)
// week 2 → ask route (employee asks question → get cited answer)
// week 3 → updated ask route (streaming response word by word via SSE)

// express lets us create a web server and define routes
const express = require('express')

// multer handles file uploads, normal express cant do this
const multer = require('multer')

// path helps with file paths, works on both windows and mac
const path = require('path')

// loads .env file so process.env variables are accessible
require('dotenv').config()

const { parsePDF } = require('./pdfParser')         // extracts text from pdf
const { chunkText } = require('./chunker')           // cuts text into chunks
const { generateEmbedding } = require('./embedder')  // converts text to vector, used in week1 AND week2 both
const { connectDB, saveChunk } = require('./db')     // mongodb connection and save function

// these handle the question answering pipeline
const { searchSimilarChunks } = require('./retriever')    // searches mongodb for relevant chunks
const { buildContext } = require('./contextBuilder')       // formats chunks + writes AI instructions

const { generateAnswerStream } = require('./answerGenerator')


// create the express app, all routes attach to this
const app = express()

app.use(express.json())

const storage = multer.diskStorage({

    destination: function(req, file, cb) {
        // null = no error, './uploads' = save here
        cb(null, './uploads')
    },

    filename: function(req, file, cb) {
        // Date.now() makes filename unique
        // without it two files with same name overwrite each other
        const uniqueName = Date.now() + '-' + file.originalname
        cb(null, uniqueName)
    }
})

// only allow PDFs, reject everything else
const fileFilter = function(req, file, cb) {
    if (file.mimetype === 'application/pdf') {
        cb(null, true)   // accept
    } else {
        cb(new Error('only PDF files are allowed!'), false)  // reject
    }
}

const upload = multer({
    storage: storage,
    fileFilter: fileFilter
})

app.get('/', (req, res) => {
    res.json({
        message: 'OpsMind AI backend is running!',
        status: 'healthy'
    })
})

app.post('/upload', upload.single('pdf'), async (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            error: 'no file uploaded. please attach a PDF file'
        })
    }

    console.log('new pdf received:', req.file.originalname)
    console.log('saved at:', req.file.path)

    try {

        // step 1: extract all text from the pdf
        console.log('step 1: parsing pdf...')
        const fullText = await parsePDF(req.file.path)

        // scanned PDFs have no text, catch that early
        if (!fullText || fullText.length === 0) {
            return res.status(400).json({
                error: 'could not extract text from this PDF. is it a scanned image?'
            })
        }

        console.log('step 1 done! extracted', fullText.length, 'characters')

        // step 2: cut text into 1000 char pieces with 100 char overlap
        console.log('step 2: chunking text...')
        const chunks = chunkText(fullText, 1000, 100)
        console.log('step 2 done! created', chunks.length, 'chunks')

        // step 3: for each chunk convert to vector and save in mongodb
        console.log('step 3: embedding and saving chunks...')
        let savedCount = 0

        for (let i = 0; i < chunks.length; i++) {

            // convert chunk text to 1536 numbers via openai
            const vector = await generateEmbedding(chunks[i])

            // save text + vector + source info to mongodb
            await saveChunk({
                text: chunks[i],
                embedding: vector,
                sourceFile: req.file.originalname,  // for citation later
                chunkIndex: i
            })

            savedCount++

            // log every 5 chunks so we know its not frozen
            if (i % 5 === 0) {
                console.log(`  progress: ${i + 1} / ${chunks.length} chunks saved`)
            }
        }

        console.log('step 3 done! all chunks saved to mongodb')

        // 201 = created, something new was stored successfully
        res.status(201).json({
            message: 'PDF successfully uploaded and processed!',
            fileName: req.file.originalname,
            totalCharacters: fullText.length,
            totalChunks: savedCount,
            status: 'indexed and ready for search'
        })

    } catch (error) {
        console.log('error during processing:', error.message)
        res.status(500).json({
            error: 'something went wrong while processing the PDF',
            details: error.message
        })
    }
})

app.post('/ask', async (req, res) => {

    const question = req.body.question

    // guard check: question must exist and not be empty
    if (!question || question.trim().length === 0) {
        return res.status(400).json({
            error: 'please provide a question',
            example: '{ "question": "How do I process a refund?" }'
        })
    }
console.log('new question received:', question)
 
    res.setHeader('Content-Type', 'text/event-stream')

    // no-cache = dont buffer or cache, send each piece fresh
    res.setHeader('Cache-Control', 'no-cache')

    res.setHeader('Connection', 'keep-alive')

    // send headers to browser immediately before pipeline starts
    res.flushHeaders()


    try {

        // step 1: convert question to vector
        // reusing generateEmbedding from week 1 — same function!
        // question gets same 1536 numbers treatment as pdf chunks
        console.log('step 1: converting question to vector...')
        const questionVector = await generateEmbedding(question)
        console.log('step 1 done!')

        // step 2: search mongodb for top 4 matching chunks
        console.log('step 2: searching mongodb...')
        const relevantChunks = await searchSimilarChunks(questionVector, 4)

        // if nothing found send error through SSE and stop
        // we cant use res.status().json() anymore because
        // SSE headers are already sent above
        if (relevantChunks.length === 0) {
            res.write(`data: ERROR: no relevant information found\n\n`)
            res.write(`data: [DONE]\n\n`)
            res.end()
            return
        }

        console.log('step 2 done! found', relevantChunks.length, 'chunks')

        // step 3: format chunks + write strict AI instructions
        console.log('step 3: building context...')
        const contextPackage = buildContext(relevantChunks, question)
        console.log('step 3 done!')

        // step 4: start groq stream
        // this returns a stream object, NOT a complete answer
        // groq starts generating and sends pieces as it goes
        console.log('step 4: starting groq stream...')
        const stream = await generateAnswerStream(contextPackage)


        // ── STREAM LOOP ───────────────────────────────────────
        // for await loops through stream pieces as they arrive
        // we dont wait for all pieces to come before processing
        // each piece is handled the moment it arrives

        console.log('step 5: streaming to frontend...')

        let fullAnswer = ''  // collecting full answer just for terminal log

        for await (const piece of stream) {

            // piece.choices[0].delta.content = the new text in this piece
            // delta means "whats new" — could be a word, half word, punctuation
            // ?. is optional chaining — avoids crash if property is missing
            // || '' is fallback — if content is null/undefined use empty string
            const newText = piece.choices[0]?.delta?.content || ''

            // groq sends empty pieces sometimes at start and end
            // skip them so we dont send empty SSE events
            if (newText === '') continue

            fullAnswer += newText

            // SSE FORMAT: every piece must be "data: <text>\n\n"
            // the \n\n at end is required — browser uses it to
            // know where one SSE event ends and next begins
            res.write(`data: ${newText}\n\n`)

            // flush forces this piece to be sent immediately
            // without flush some servers buffer pieces and send together
            // which defeats the whole purpose of streaming
            if (res.flush) res.flush()
        }

        // send [DONE] signal so React knows streaming is finished
        // React listens for this and stops reading the stream
        res.write(`data: [DONE]\n\n`)
        res.end()

        console.log('streaming complete!')
        console.log('answer preview:', fullAnswer.substring(0, 100) + '...')
       

    } catch (error) {

        console.log('error during streaming:', error.message)

        // cant use res.status(500) here because SSE headers already sent
        // so we send error as SSE event then close connection
        res.write(`data: ERROR: ${error.message}\n\n`)
        res.write(`data: [DONE]\n\n`)
        res.end()
    }
})

const PORT = process.env.PORT || 3000

onnectDB().then(() => {
    app.listen(PORT, () => {
       
        console.log(`OpsMind AI server running on port ${PORT}`)
        console.log(`visit http://localhost:${PORT} to verify`)
        console.log('routes available:')
        console.log('  GET  /        → health check')
        console.log('  POST /upload  → admin uploads PDF (week 1)')
        console.log('  POST /ask     → employee asks question (week 3 streaming)')
        
    })
})