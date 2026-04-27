// server.js
// this is the main file of the entire backend

// express is the framework that lets us create a web server
// and define routes like POST /upload, GET /health etc
const express = require('express')

// multer is middleware specifically for handling file uploads
// normal express cannot handle file uploads — multer fills that gap
const multer = require('multer')

// path helps us work with file paths in a safe cross-platform way
// example: path.join('uploads', 'file.pdf') works on both windows and mac
const path = require('path')

// dotenv loads our .env file so process.env variables work
require('dotenv').config()

// importing our own files — each handles one specific job
const { parsePDF } = require('./pdfParser')       // extracts text from pdf
const { chunkText } = require('./chunker')         // cuts text into chunks
const { generateEmbedding } = require('./embedder') // converts chunk to vector
const { connectDB, saveChunk } = require('./db')   // saves to mongodb

// CREATE EXPRESS APP -- it is our web server instance every route , every midleware is attacheted to it 
const app = express()

// this tells express to automatically parse JSON request bodies
// so if someone sends { "name": "test" } we can read req.body.name
app.use(express.json())

// MULTER SETUP
// multer handles the file upload part
// we need to configure 2 things:
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
       const uniqueName = Date.now() + '-' + file.originalname   // we will add Date.now() at start of filename to make it unique , wihtout it : if 
        // 2 admins upload "policy.pdf" the second one overwrites the first , with this : "1720000000000-policy.pdf" and "1720000001000-policy.pdf"
        cb(null, uniqueName)
    }
})


// fileFilter decides which files to ACCEPT and which to REJECT we only want PDF files — reject everything else (images, docs, etc)
const fileFilter = function(req, file, cb) {

    // file.mimetype is the file type sent by the browser
    // PDFs always have mimetype 'application/pdf'
    if (file.mimetype === 'application/pdf') {
        cb(null, true)  // true = accept this file
    } else {
        // false = reject this file
        // also pass an error message explaining why
        cb(new Error('only PDF files are allowed!'), false)
    }
}
// now combine storage + fileFilter into one multer instance
// this 'upload' variable is what we'll use in our routes
const upload = multer({
    storage: storage,
    fileFilter: fileFilter
})


// ============================================================
// ROUTE 1: GET /
// simple health check route
// just to verify the server is running
// open browser → localhost:3000 → should see the message
// ============================================================

app.get('/', (req, res) => {
    res.json({
        message: 'OpsMind AI backend is running!',
        status: 'healthy'
    })
})

// ROUTE 2: POST /upload
// admin hits this endpoint with a PDF file attached , this route runs entire ingestion pipeline that is receive → parse → chunk → embed → save

app.post('/upload', upload.single('pdf'), async (req, res) => {  
    //upload.single('pdf') means we expect one file with field name 'pdf' in the form data of the request
    //it catches that file, saves it to disk, and then we can access its info in req.file inside this async function


    // GUARD CHECK: did admin actually attach a file? //if multer found no file, req.file will be undefined
    // this happens if admin sends request without attaching PDF
    if (!req.file) {
        return res.status(400).json({
            error: 'no file uploaded. please attach a PDF file'
        })
    }

    console.log('==============================================')
    console.log('new pdf received:', req.file.originalname)
    console.log('saved temporarily at:', req.file.path)
    console.log('==============================================')


    try {
// PIPELINE STEP 1: Parse the PDF
// req.file.path = path where multer saved the file
// example: "uploads/1720000000-Refund_Policy.pdf"
// parsePDF reads this file and returns clean text string
        console.log('step 1: parsing pdf...')
        const fullText = await parsePDF(req.file.path)

        // if pdf was empty or unreadable, stop here
        if (!fullText || fullText.length === 0) {
            return res.status(400).json({
                error: 'could not extract text from PDF. is it a scanned image?'
            })
        }

        console.log('step 1 done! extracted', fullText.length, 'characters')
 // PIPELINE STEP 2: Chunk the text
    // chunkText cuts fullText into array of smaller strings each string is max 1000 characters with 100 char overlap
        console.log('step 2: chunking text...')
        const chunks = chunkText(fullText, 1000, 100)

        console.log('step 2 done! created', chunks.length, 'chunks')
// PIPELINE STEP 3: Embed each chunk and save to mongodb
// now we loop through every single chunk
// for each chunk we:
        // → generate embedding (convert to vector via openai)
        // → save chunk text + vector + metadata to mongodb
        console.log('step 3: embedding and saving chunks...')

        // savedCount tracks how many chunks we successfully saved
        let savedCount = 0

        for (let i = 0; i < chunks.length; i++) {

            // generateEmbedding sends chunk to openai
            // and gets back array of 1536 numbers
            const vector = await generateEmbedding(chunks[i])

            // saveChunk creates a new document in mongodb
            // with all this information bundled together
            await saveChunk({
                text: chunks[i],              // the actual paragraph text
                embedding: vector,            // the 1536 numbers
                sourceFile: req.file.originalname, // original pdf name (for citation)
                chunkIndex: i                 // chunk number (0, 1, 2, 3...)
            })

            savedCount++

            // log progress after every 5 chunks
            // so we can see its working and not frozen
            if (i % 5 === 0) {
                console.log(`  progress: ${i + 1} / ${chunks.length} chunks saved`)
            }
        }

        console.log('step 3 done! all chunks saved to mongodb')
        console.log('==============================================')
// STEP 4: Send success response back to admin
       
        // 201 = "Created" HTTP status code
        // means something new was successfully created in database
        res.status(201).json({
            message: 'PDF successfully uploaded and processed!',
            fileName: req.file.originalname,
            totalCharacters: fullText.length,
            totalChunks: savedCount,
            status: 'indexed and ready for search'
        })


    } catch (error) {

        // if ANYTHING goes wrong in the pipeline
        // (parse failed, openai error, mongodb error)
        // we catch it here and send error response

        console.log('error during processing:', error.message)

        // 500 = "Internal Server Error" HTTP status code
        res.status(500).json({
            error: 'something went wrong while processing the PDF',
            details: error.message
        })
    }
})
// START THE SERVER
// we first connect to mongodb
// THEN start listening for requests
// order matters — db must be ready before any request comes in


const PORT = process.env.PORT || 3000


connectDB().then(() => {

    app.listen(PORT, () => {
        console.log('==============================================')
        console.log(`OpsMind AI server running on port ${PORT}`)
        console.log(`open http://localhost:${PORT} to verify`)
        console.log('ready to receive PDF uploads!')
        console.log('==============================================')
    })
})