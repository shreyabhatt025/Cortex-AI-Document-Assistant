function buildContext(retrievedChunks, userQuestion) // retrievedChunks = array of chunk objects from retriever.js
// userQuestion    = the employee's original question (string)
// example retrievedChunks:
// { text: "To process refund...", sourceFile: "SOP.pdf", chunkIndex: 2 },
{
    console.log('building context from', retrievedChunks.length, 'chunks...')
// STEP 1: Format each chunk with its source label = right now chunks look like plain objects
    // we want to format them like this:
    //[Source: OPSMIND_SOP.pdf | Chunk 2]
    // To process a refund navigate to billing module...
    // why add source label?
    // → when openai reads this, it knows where each piece came from
    // → so when it writes the answer it can cite the correct source
    // → without labels all chunks look the same to openai

    const formattedChunks = retrievedChunks.map((chunk, index) => {

        // index + 1 so it starts from 1 not 0 (more readable)
        // chunkIndex is the original position in the pdf
        return `[Source ${index + 1}: ${chunk.sourceFile} | Chunk ${chunk.chunkIndex}]\n${chunk.text}`

        // result looks like:
        // "[Source 1: OPSMIND_SOP.pdf | Chunk 2]
        //  To process a refund navigate to billing module..."
    })
console.log('chunks formatted with source labels')


    // -------------------------------------------------------
    // STEP 2: Join all formatted chunks into one context string
    // -------------------------------------------------------

    // join combines array of strings into one big string
    // we separate each chunk with a blank line for readability
    // so openai can clearly see where one chunk ends and next begins
    const contextText = formattedChunks.join('\n\n---\n\n')

    // contextText now looks like:
    // "[Source 1: OPSMIND_SOP.pdf | Chunk 2]
    //  To process a refund navigate to...
    //
    //  ---
    //
    //  [Source 2: OPSMIND_SOP.pdf | Chunk 3]
    //  Manager approves or rejects within 24..."

    console.log('context text length:', contextText.length, 'characters')
// STEP 3: Write the system prompt
    
    // system prompt = instructions we give to openai BEFORE the question
    // this is how we control openai's behavior completely
    // think of it as briefing the AI before it answers

    // these instructions are CRITICAL for preventing hallucinations
    // without them openai might use its own knowledge
    // and make up policies that don't exist in your SOP

    const systemPrompt = `You are OpsMind AI, an intelligent assistant for company employees.
Your job is to answer employee questions strictly based on the SOP context provided below.

STRICT RULES YOU MUST FOLLOW:
1. Only use information from the context provided below to answer
2. Never use your own knowledge or make up any information
3. Always mention the source file name when using information from a chunk
4. If the context does not contain the answer, say exactly:
   "I could not find this information in the available SOP documents."
5. Keep your answer clear, structured and easy to understand
6. If multiple chunks have relevant info, combine them into one complete answer
7. Always end your answer with a "Source:" line citing which file you used

CONTEXT FROM SOP DOCUMENTS:
${contextText}`

    // the system prompt now contains ALL the chunk text inside it
    // openai will read this first before reading the question
// return an object with 3 things:
    // systemPrompt → instructions + context for openai
    // userQuestion → the employe question
    // contextText  → just the chunks (useful for debugging)

    const result = {
        systemPrompt: systemPrompt,
        userQuestion: userQuestion,
        contextText: contextText,   // keeping this for debugging purposes
        totalChunksUsed: retrievedChunks.length
    }
    console.log('context built successfully!')
    console.log('total chunks used:', result.totalChunksUsed)
    console.log('system prompt length:', systemPrompt.length, 'characters')
    return result
}
// export so answerGenerator.js can import and use it
module.exports = { buildContext }