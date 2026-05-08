const mongoose = require('mongoose')
require('dotenv').config()
// chunk model is used to run queries on the chunks collection and it is already defined in db.js so insead for redefining we are using it from mongoose 

function getChunkModel() {
    // mongoose.models.Chunk checks if model was already registered by db.js when server started
    // if yes → use existing one
    // if no → this will throw error meaning db.js wasn't loaded
    if (mongoose.models.Chunk) {
        return mongoose.models.Chunk
    }
    // if somehow model doesn't exist, define it again here
    // this is a fallback, ideally db.js always loads first
    const chunkSchema = new mongoose.Schema({
        text: String,
        embedding: [Number],
        sourceFile: String,
        chunkIndex: Number,
        createdAt: { type: Date, default: Date.now }
    })

    return mongoose.model('Chunk', chunkSchema)
}
// queryVector = the question converted to 1536 numbers , generate this using embedder.js
// topK        = how many chunks to return 
async function searchSimilarChunks(queryVector, topK = 4) {

    console.log('searching mongodb for relevant chunks...')
    console.log('looking for top', topK, 'matching chunks')

    const Chunk = getChunkModel()
    // MONGODB ATLAS VECTOR SEARCH AGGREGATION PIPELINE
    
    // aggregation pipeline = series of steps mongodb runs
    // each step takes output of previous step as input
    // think of it like assembly line in a factory
    
    // $vectorSearch is a special mongodb atlas operator
    // it does the similarity comparison internally
    // we just tell it: which field has vectors, 
    // what is our query vector, how many results to return

    const results = await Chunk.aggregate([
        {
            $vectorSearch: {    // $vectorSearch is a special mongodb atlas operator , it does the similarity comparison internally
    // we just tell it: which field has vectors, 
    // what is our query vector, how many results to return

                index: 'vector_index',// index name must match what you created in Atlas
                // we'll create this index in Atlas UI in a moment
                
                path: 'embedding',    // path = which field in our documents has the vectors
                // in db.js we named it 'embedding'
               
                queryVector: queryVector, // queryVector = the employee's question as numbers
                // mongodb compares this against all stored embeddings
               
                 numCandidates: topK * 10, // numCandidates = how many chunks mongodb considers
                 limit: topK// limit = final number of chunks to return
               
            }
        },
// SECOND STAGE: pick which fields to return
    
        
        {
            $project: {
                text: 1,           
                sourceFile: 1,     
                chunkIndex: 1,    
                embedding: 0,      
                score: {
                    $meta: 'vectorSearchScore'
                }
            }
        }
    ])

    console.log('mongodb returned', results.length, 'relevant chunks')

    results.forEach((chunk, index) => {
        console.log(`  chunk ${index + 1}:`)
        console.log(`    source: ${chunk.sourceFile}`)
        console.log(`    similarity score: ${chunk.score?.toFixed(4)}`)
        console.log(`    text preview: ${chunk.text.substring(0, 80)}...`)
    })
    return results// results is an array of chunk objects like:
}
module.exports = { searchSimilarChunks }

