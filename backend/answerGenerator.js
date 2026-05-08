// this file is the last step of the answer pipeline
// it takes the prepared context package from contextBuilder.js
// sends it to openai chat api
// and returns the final cited answer to server.js

const { OpenAI } = require('openai')
require('dotenv').config()

// same openai client as embedder.js
// one client, reused across files
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})
// generateAnswer - only function in this file
// contextPackage = the object returned by contextBuilder.js
// it contains: systemPrompt, userQuestion, totalChunksUsed
async function generateAnswer(contextPackage) {
    console.log('sending context to openai for answer generation...')
    console.log('user question:', contextPackage.userQuestion)
    console.log('chunks used as context:', contextPackage.totalChunksUsed)
try {
// STEP 1: Send to OpenAI Chat Completion API
       const response = await openai.chat.completions.create({ // it reads and understand and responds based on the context we give it
       model: 'gpt-4o-mini',
// messages is an array — this is how openai chat works it takes a conversation history
            // we send 2 messages:
            // 1. system message = instructions + full context
            // 2. user message   = the actual question
            messages: [
                {
                    // system role = background instructions
                    // openai reads this FIRST before anything else
                    // this is where our strict rules + SOP context lives
                    // employee never sees this — its behind the scenes
                    role: 'system',
                    content: contextPackage.systemPrompt
                },
                {
                    // user role = the actual question being asked by the employee
                    // this is what openai answers — it must base its answer ONLY on the system prompt context
                    role: 'user',
                    content: contextPackage.userQuestion
                }
            ],
            max_tokens: 1000, //it is the maximum lenth of the answer we want from openai

            // temperature controls how creative openai is
            // 0   = very strict, only facts, no creativity
            // 1   = creative, may add own ideas
            // 0.2 = mostly factual with slight natural language flow
            // for SOP answering we want LOW temperature
            // we want facts not creativity
            temperature: 0.2
        })
console.log('openai responded successfully!')

// STEP 2: Extract the answer text from response
   const answerText = response.choices[0].message.content

        // log token usage so we can track costs
        // helps us know how much each query is costing
        const usage = response.usage
        console.log('tokens used this query:')
        console.log('  prompt tokens (context sent):', usage.prompt_tokens)
        console.log('  completion tokens (answer):', usage.completion_tokens)
        console.log('  total tokens:', usage.total_tokens)
// STEP 3: Return the final answer
        // we return an object with the answer + some metadata
        // server.js will send this as JSON to the employee
        return {
            answer: answerText,
            chunksUsed: contextPackage.totalChunksUsed,
            tokensUsed: usage.total_tokens
        }
} catch (error) {
    // common errors here:
        // → 429 rate limit or quota exceeded (add openai credits)
        // → 401 invalid api key (check .env)
        // → 500 openai server error (try again)
        console.log('error calling openai chat api:', error.message)
        throw error
    }
}
module.exports = { generateAnswer }