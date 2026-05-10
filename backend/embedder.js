
const { pipeline } = require('@xenova/transformers')

// embedder variable stores the loaded model
// we keep it outside the function so it loads only once
// loading every time would be very slow (1-2 minutes each time)
let embedder = null

async function loadEmbedder() {

    if (embedder !== null) {
        return embedder
    }

    console.log('loading local embedding model...')
    console.log('first time: downloads model files (1-2 mins)')
    console.log('next times: loads from cache (few seconds)')

    embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
    )

    console.log('model loaded! ready to generate embeddings')
    return embedder
}

async function generateEmbedding(text) {

    try {

        // get the loaded model (or load it if first time)
        const embed = await loadEmbedder()

        const result = await embed(text, {
            pooling: 'mean',
            normalize: true
        })

        const vector = Array.from(result.data)

        console.log('embedding generated! vector length:', vector.length)

        return vector

    } catch (error) {
        console.log('error generating embedding:', error.message)
        throw error
    }
}
module.exports = { generateEmbedding }