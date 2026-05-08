// this is the main file of the entire backend
// week 1 → upload route (admin uploads PDF → store in mongodb)
// week 2 → ask route (employee asks question → get cited answer)

// express is the framework that lets us create a web server it define routes like POST /upload, GET /health etc
const express = require('express')
// multer is middleware specifically for handling file uploads ,normal express cannot handle file uploads — multer fills that gap
const multer = require('multer')

// path helps us work with file paths in a safe cross-platform way
// example: path.join('uploads', 'file.pdf') works on both windows and mac
const path = require('path')

// dotenv loads our .env file so process.env variables work
require('dotenv').config()

// WEEK 1 IMPORTS
// these 4 files handle the PDF ingestion pipeline
const { parsePDF } = require('./pdfParser')         // extracts text from pdf
const { chunkText } = require('./chunker')           // cuts text into chunks
const { generateEmbedding } = require('./embedder')  // converts text to vector 
const { connectDB, saveChunk } = require('./db')     // mongodb connection and save function
// these 3 files handle the question answering pipeline
const { searchSimilarChunks } = require('./retriever')    // searches mongodb for relevant chunks
const { buildContext } = require('./contextBuilder')       // formats chunks + writes AI instructions
const { generateAnswer } = require('./answerGenerator')   // sends to openai, gets cited answer back
// CREATE EXPRESS APP =app is our web server instance
// every route and every middleware is attached to this app object
const app = express()
app.use(express.json()) // this tells express to automatically parse JSON request bodies ,so if someone sends { "question": "how to refund?" } we can read req.body.question without this line req.body will be undefined
// MULTER SETUP=multer handles the file upload part , we need to configure 2 things:
// 1. WHERE to save uploaded files (storage)
// 2. WHICH files to accept (fileFilter)
// diskStorage tells multer to save files on disk (not in memory)
// we give it 2 functions:
// destination → which folder to save in
// filename    → what name to give the saved file
const storage = multer.diskStorage({

    destination: function(req, file, cb) {
        // cb means callback — multer's way of saying "i'm done, here's the answer"
        // null means no error
        // './uploads' is the folder where file will be saved
        cb(null, './uploads')
    },

    filename: function(req, file, cb) {
        // we add Date.now() at start of filename to make every filename unique
        // without this: if 2 admins upload "policy.pdf"
        // the second one overwrites the first 
        // with this: "1720000000000-policy.pdf" and "1720000001000-policy.pdf" 
        const uniqueName = Date.now() + '-' + file.originalname
        cb(null, uniqueName)
    }
})

// fileFilter decides which files to ACCEPT and which to REJECT
// we only want PDF files — reject everything else (images, word docs, etc)
const fileFilter = function(req, file, cb) {
// file.mimetype is the file type sent by the browser , PDFs always have mimetype 'application/pdf'
    if (file.mimetype === 'application/pdf') {
        cb(null, true)   // true = accept this file
    } else {
        cb(new Error('only PDF files are allowed!'), false)  // false = reject
    }
}
// combine storage + fileFilter into one multer instance
// this 'upload' variable is what we use in our routes
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

// ROUTE 2: POST /uploaD , admin hits this endpoint with a PDF file attached
// this route runs the entire ingestion pipeline:
// receive → parse → chunk → embed → save in mongodb

app.post('/upload', upload.single('pdf'), async (req, res) => {
    // upload.single('pdf') is multer middleware
    // it runs BEFORE our function and:
    // → catches the uploaded file from the request
    // → saves it to /uploads folder automatically
    // → attaches file info to req.file object
    // 'pdf' is the field name — postman/frontend must send file with key 'pdf'

    // GUARD CHECK: did admin actually attach a file?
    // if multer found no file attached, req.file will be undefined
    if (!req.file) {
        return res.status(400).json({
            error: 'no file uploaded. please attach a PDF file'
        })
    }
    console.log('new pdf received:', req.file.originalname)
    console.log('saved temporarily at:', req.file.path)
try {

        //1=  Parse the PDF
        // req.file.path = path where multer saved the file
        // parsePDF reads this file and returns one big clean text string
        console.log('step 1: parsing pdf...')
        const fullText = await parsePDF(req.file.path)
// if pdf was empty or unreadable (scanned image), stop here
        if (!fullText || fullText.length === 0) {
            return res.status(400).json({
                error: 'could not extract text from this PDF. is it a scanned image?'
            })
        }
        console.log('step 1 done! extracted', fullText.length, 'characters')
//2: Chunk the text
        // chunkText cuts fullText into array of smaller strings
        // each string is max 1000 characters with 100 char overlap
        console.log('step 2: chunking text...')
        const chunks = chunkText(fullText, 1000, 100)
        console.log('step 2 done! created', chunks.length, 'chunks')
//3=Embed each chunk and save to mongodb
        // loop through every chunk, for each one:
        // → convert to vector using openai embeddings
        // → save chunk text + vector + source info to mongodb
        console.log('step 3: embedding and saving chunks...')
        let savedCount = 0
        for (let i = 0; i < chunks.length; i++) {
// generateEmbedding sends chunk text to openai , // gets back array of 1536 numbers that represent its meaning
            const vector = await generateEmbedding(chunks[i])
// saveChunk stores the chunk + vector in mongodb
            await saveChunk({
                text: chunks[i],                    // actual paragraph text
                embedding: vector,                  // the 1536 numbers
                sourceFile: req.file.originalname,  // original pdf name (used for citation later)
                chunkIndex: i                       // chunk number (0, 1, 2, 3...)
            })
            savedCount++
// log progress after every 5 chunks so we know its not frozen
            if (i % 5 === 0) {
                console.log(`  progress: ${i + 1} / ${chunks.length} chunks saved`)
            }
        }
        console.log('step 3 done! all chunks embedded and saved to mongodb')
 // 4: Send success response back to admin
        res.status(201).json({
            message: 'PDF successfully uploaded and processed!',
            fileName: req.file.originalname,
            totalCharacters: fullText.length,
            totalChunks: savedCount,
            status: 'indexed and ready for search'
        })
    } catch (error) {
        console.log('error during processing:', error.message)
        // 500 = Internal Server Error
        res.status(500).json({
            error: 'something went wrong while processing the PDF',
            details: error.message
        })
    }
})

// ROUTE 3: POST /ask  (WEEK 2)
// employee sends a question and gets a cited answer back
// this route runs the full retrieval + answer pipeline:
// question → embed → search mongodb → build context → openai → answer
// expected request body (JSON):
// { "question": "How do I process a refund?" }

app.post('/ask', async (req, res) => {

    // GUARD CHECK: did employee actually send a question?
    const question = req.body.question

    if (!question || question.trim().length === 0) {
        return res.status(400).json({
            error: 'please provide a question in the request body',
            example: '{ "question": "How do I process a refund?" }'
        })
    }
console.log('new question received:', question)
try {
// 1 Convert question to vector
      console.log('step 1: converting question to vector...')
        const questionVector = await generateEmbedding(question)
        console.log('step 1 done! question converted to vector')
// 2 Search MongoDB for relevant chunks
        console.log('step 2: searching mongodb for relevant chunks...')
        const relevantChunks = await searchSimilarChunks(questionVector, 4)
        if (relevantChunks.length === 0) {
            return res.status(404).json({
                error: 'no relevant information found in the SOP documents',
                suggestion: 'make sure PDFs are uploaded and vector index is active in Atlas'
            })
        }
console.log('step 2 done! found', relevantChunks.length, 'relevant chunks')
// 3 Build context package
        // buildContext does 2 things:
        // → formats the chunks with source labels like [Source: SOP.pdf | Chunk 2]
        // → writes strict instructions for openai (no hallucination, cite sources)
        console.log('step 3: building context window...')
        const contextPackage = buildContext(relevantChunks, question)
        console.log('step 3 done! context package ready')
// 4 Generate answer using OpenAI
        // generateAnswer sends contextPackage to openai chat api
        // openai reads the chunks, follows our strict rules AND  returns a cited answer based ONLY on the SOP content
        console.log('step 4: sending to openai for answer...')
        const result = await generateAnswer(contextPackage)
        console.log('step 4 done! answer generated successfully')
//5=  Send final answer back to employee
      res.status(200).json({
            question: question,
            answer: result.answer,
            chunksUsed: result.chunksUsed,
            tokensUsed: result.tokensUsed
        })
} catch (error) {
console.log('error processing question:', error.message)

        res.status(500).json({
            error: 'something went wrong while answering your question',
            details: error.message
        })
    }
})
// START THE SERVER
// we connect to mongodb FIRST, then start listening
// order matters — db must be ready before any request comes in
// if db connection fails, process.exit(1) inside connectDB
// stops everything — no point running without a database
const PORT = process.env.PORT || 3000
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log('==============================================')
        console.log(`OpsMind AI server running on port ${PORT}`)
        console.log(`open http://localhost:${PORT} to verify`)
        console.log('routes available:')
        console.log('  GET  /        → health check')
        console.log('  POST /upload  → admin uploads PDF (week 1)')
        console.log('  POST /ask     → employee asks question (week 2)')
        console.log('==============================================')
    })
})