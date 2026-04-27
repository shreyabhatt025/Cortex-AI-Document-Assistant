// embedder.js
// this file has one job — take a piece of text (one chunk)
// and convert it into a vector (array of 1536 numbers)
// using openai's embedding model
// these numbers capture the MEANING of the text
// so later we can do similarity search in mongodb


// OpenAI is the class we import from the openai package
// we installed this via npm install openai
const { OpenAI } = require('openai')

// dotenv loads our .env file
// so process.env.OPENAI_API_KEY is available here
require('dotenv').config()


// ============================================================
// initialize openai client
// this creates one openai connection that we reuse
// every time generateEmbedding is called
// we don't create a new client every time — that would be wasteful
// ============================================================

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY  // reads from .env file
})


// ============================================================
// generateEmbedding - the only function in this file
//
// text = one chunk of text (string)
// example: "To process a refund navigate to billing module..."
//
// returns = array of 1536 numbers
// example: [0.231, -0.872, 0.341, 0.009, 0.112, ...]
// ============================================================

async function generateEmbedding(text) {

    try {

        // -------------------------------------------------------
        // STEP 1: Send the text to OpenAI embedding API
        // -------------------------------------------------------

        // openai.embeddings.create() sends our text to openai servers
        // openai runs it through their embedding model internally
        // and sends back the vector
        // this is async because it's a network request — takes time
        const response = await openai.embeddings.create({

            // text-embedding-3-small is the model we use
            // it produces 1536 numbers per text input
            // there's also text-embedding-3-large (3072 numbers, more expensive)
            // small is enough for our use case and much cheaper
            model: 'text-embedding-3-small',

            // input is the actual text we want to convert
            // openai reads this and produces the vector for it
            input: text
        })


        // -------------------------------------------------------
        // STEP 2: Extract the vector from the response
        // -------------------------------------------------------

        // response object looks like this:
        // {
        //   data: [
        //     {
        //       embedding: [0.231, -0.872, 0.341, ...],  ← 1536 numbers
        //       index: 0,
        //       object: "embedding"
        //     }
        //   ],
        //   model: "text-embedding-3-small",
        //   usage: { prompt_tokens: 47, total_tokens: 47 }
        // }

        // we only need response.data[0].embedding
        // [0] because we sent one text, so only one result comes back
        // .embedding is the actual array of 1536 numbers
        const vector = response.data[0].embedding

        console.log('embedding generated! vector length:', vector.length)
        // vector.length will always be 1536 for text-embedding-3-small


        // -------------------------------------------------------
        // STEP 3: Return the vector
        // -------------------------------------------------------

        // this vector goes back to server.js
        // server.js then saves it in mongodb alongside the chunk text
        return vector

    } catch (error) {

        // common errors:
        // → invalid api key (check your .env file)
        // → rate limit hit (too many requests per minute)
        // → network issue (no internet connection)
        console.log('error generating embedding:', error.message)

        // throw re-raises the error to server.js
        // so server.js knows something went wrong
        // and can send error response to the admin
        throw error
    }
}


// export so server.js can import and use it
module.exports = { generateEmbedding }
