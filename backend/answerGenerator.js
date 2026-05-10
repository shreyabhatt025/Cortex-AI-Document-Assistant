// answerGenerator.js
// UPDATED: using Groq instead of OpenAI for answer generation
// Groq is completely free and actually faster than OpenAI
// it runs open source models like llama3 on their servers
// no credit card needed — just free API key from console.groq.com

const Groq = require('groq-sdk')
require('dotenv').config()

// initialize groq client with our free api key from .env
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
})
async function generateAnswer(contextPackage) {

    console.log('sending context to Groq for answer generation...')
    console.log('user question:', contextPackage.userQuestion)
    console.log('chunks used as context:', contextPackage.totalChunksUsed)

    try {
        const response = await groq.chat.completions.create({
             model: 'llama-3.3-70b-versatile',
             messages: [
                {
                    role: 'system',
                    content: contextPackage.systemPrompt
                },
                {
                    role: 'user',
                    content: contextPackage.userQuestion
                }
            ],
            max_tokens: 1024,

            // temperature = how creative the model is
            // 0.2 = mostly factual, slight natural language flow
            // low temperature prevents hallucination for SOP use case
            temperature: 0.2
        })

        console.log('Groq responded successfully!')
        const answerText = response.choices[0].message.content
        const usage = response.usage
        console.log('tokens used this query:')
        console.log('  prompt tokens:', usage.prompt_tokens)
        console.log('  completion tokens:', usage.completion_tokens)
        console.log('  total tokens:', usage.total_tokens)

        return {
            answer: answerText,
            chunksUsed: contextPackage.totalChunksUsed,
            tokensUsed: usage.total_tokens
        }

    } catch (error) {
        console.log('error calling Groq API:', error.message)
        throw error
    }
}
module.exports = { generateAnswer }