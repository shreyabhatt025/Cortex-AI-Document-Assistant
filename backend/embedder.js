// embedder.js
// UPDATED: using free local model instead of openai
// @xenova/transformers runs the embedding model directly
// on your computer — no API key, no cost, no internet needed


// Pipeline is the main function from xenova transformers
// it loads an AI model locally and lets us run it
const { pipeline } = require('@xenova/transformers')


// ============================================================
// EMBEDDER SETUP
// we create the embedder once and reuse it
// creating it every time would be very slow
// because it has to load the model from disk each time
//
// 'feature-extraction' means we want embeddings (vectors)
// 'Xenova/all-MiniLM-L6-v2' is the model name
// it's a small but accurate sentence embedding model
// produces 384 numbers per text (openai produces 1536)
// 384 is enough for our use case
// ============================================================

// this variable holds our embedder after it's loaded
// we use let because it starts as null
let embedder = null

async function loadEmbedder() {

    // only load if not already loaded
    // this check prevents loading the model multiple times
    if (embedder === null) {
        console.log('loading local embedding model...')
        console.log('(first time takes 1-2 minutes, downloads model files)')

        // pipeline() loads the model from HuggingFace
        // first time: downloads and caches it on your computer
        // next times: loads from cache — much faster
        embedder = await pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2'
        )

        console.log('embedding model loaded successfully!')
    }

    return embedder
}


// ============================================================
// generateEmbedding - same function name as before
// so server.js doesn't need ANY changes
// we just changed what happens inside
//
// text = one chunk of text (string)
// returns = array of 384 numbers
// ============================================================

async function generateEmbedding(text) {

    try {

        // -------------------------------------------------------
        // STEP 1: Make sure model is loaded
        // -------------------------------------------------------

        // loadEmbedder() either loads model or returns cached one
        const embed = await loadEmbedder()


        // -------------------------------------------------------
        // STEP 2: Generate the embedding
        // -------------------------------------------------------

        // embed() runs the text through the model
        // pooling: 'mean' means average all word vectors into one
        // normalize: true means scale numbers between -1 and 1
        // this makes similarity search more accurate
        const result = await embed(text, {
            pooling: 'mean',
            normalize: true
        })


        // -------------------------------------------------------
        // STEP 3: Convert to plain javascript array
        // -------------------------------------------------------

        // result.data is a special Float32Array (not normal array)
        // mongodb needs a normal javascript array to save it
        // Array.from() converts it to normal array
        const vector = Array.from(result.data)

        console.log('embedding generated! vector length:', vector.length)
        // vector.length will be 384 for all-MiniLM-L6-v2

        return vector


    } catch (error) {
        console.log('error generating embedding:', error.message)
        throw error
    }
}


module.exports = { generateEmbedding }