const Groq = require('groq-sdk')
require('dotenv').config()
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
})

async function generateAnswerStream(contextPackage) {

    console.log('starting groq streaming...')
    console.log('question:', contextPackage.userQuestion)
    console.log('chunks in context:', contextPackage.totalChunksUsed)


    const stream = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',

        messages: [
            {
                role: 'system',
                content: contextPackage.systemPrompt  // instructions + SOP context
            },
            {
                role: 'user',
                content: contextPackage.userQuestion  // employee's question
            }
        ],

        max_tokens: 1024,
        temperature: 0.2,
        stream: true
    })

    console.log('groq stream started successfully!')
    return stream
}


module.exports = { generateAnswerStream }