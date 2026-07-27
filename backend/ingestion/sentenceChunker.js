// ingestion/sentenceChunker.js
//
// This file replaces the old chunker.js that used fixed character counts.
//
// What was wrong with the old approach?
// The old chunker split text every 1000 characters regardless of where
// sentences ended. That meant a step-by-step procedure could get cut in
// the middle of a step, a numbered list item could be split across two
// chunks, and the context the reranker receives is incomplete. Also,
// character count divided by 4 is just a rough estimate of token count —
// it can be off by 50% for technical documents with lots of short words
// or special terms. We need the real count from the actual tokenizer.
//
// How does this file work instead?
// Step 1 — Split the full document text into individual sentences.
// Step 2 — Tokenize every sentence at once, in parallel, so we know
//           exactly how many tokens each sentence contains.
// Step 3 — Walk through the sentences one by one, adding them to the
//           current chunk. When we get close to the token limit, we close
//           the chunk at a sentence boundary and start a new one.
// Step 4 — Carry the last few sentences of the finished chunk into the
//           beginning of the next one (the overlap). This makes sure that
//           information sitting right at a boundary doesn't get lost.
//
// One small math detail worth understanding:
// When we tokenize a sentence by itself, the model wraps it with a
// [CLS] token at the start and a [SEP] token at the end. That adds 2
// extra tokens to every individual sentence count. But when sentences
// are joined together into one chunk, the model only adds [CLS] and [SEP]
// once for the whole thing. So if we naively summed up individual sentence
// counts, we would overestimate the chunk size by 2 tokens per sentence.
// To avoid that, we track "content tokens" (raw count minus 2) while
// building the chunk, then compute the exact count by tokenizing the
// fully joined text when we actually save the chunk.

const config          = require('../config/retrieval.config')
const { countTokens } = require('../utils/tokenCounter')


// Splits a full document text into an array of sentence strings.
// We use a marker-based approach rather than a single complex regex so
// the logic is easy to read and debug step by step.
function splitIntoSentences(text) {

    if (!text || !text.trim()) return []

    // Normalise all line endings to \n so the rest of the logic only
    // has to deal with one style.
    let t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()

    // Double newlines mean a paragraph break, which is the strongest
    // possible sentence boundary. We mark these first.
    t = t.replace(/\n{2,}/g, '\n<|S|>\n')

    // Numbered list items that start on their own line are also clear
    // sentence boundaries. Things like "1. Do this" or "2) Do that".
    t = t.replace(/\n(\s*\d+[.)]\s)/g, '\n<|S|>$1')

    // Bullet points and dashes on their own line get the same treatment.
    t = t.replace(/\n(\s*[-•*]\s)/g, '\n<|S|>$1')

    // Any remaining single newlines are just line wraps inside a
    // paragraph. Collapse them to a space so the text flows naturally.
    t = t.replace(/\n/g, ' ')

    // A period, exclamation mark, or question mark followed by a space
    // and an uppercase letter is almost certainly a sentence boundary.
    // We require at least two lowercase letters before the punctuation
    // to avoid splitting on abbreviations like "Mr. Smith" or "Dr. Khan"
    // which only have one letter before the dot.
    t = t.replace(/([a-z]{2,}[.!?])\s+([A-Z])/g, '$1<|S|>$2')

    // Handle the case where a sentence ends with a closing quote or
    // bracket after the punctuation, like: He said "done." Then she left.
    t = t.replace(/([.!?]['"])\s+([A-Z])/g, '$1<|S|>$2')

    // Now split on our marker, trim each piece, and remove empty strings.
    return t
        .split('<|S|>')
        .map(s => s.trim())
        .filter(s => s.length > 0)
}


// Sometimes a single sentence is longer than our MAX_TOKENS limit.
// This happens with very long run-on sentences, URLs, or dense technical
// descriptions. This function breaks such a sentence into smaller pieces.
// We try to split at natural language boundaries rather than arbitrary
// word positions, but we fall back to word-count halving if we have to.
function splitOversizedSentence(sentence) {

    // Semicolons and colons separate independent clauses, so they make
    // the cleanest split points.
    const atColon = sentence.split(/[;:]\s+/)
    if (atColon.length > 1) {
        return atColon.map(s => s.trim()).filter(s => s.length > 0)
    }

    // Commas are weaker but still clause boundaries. We merge adjacent
    // comma-separated pieces into pairs so we don't end up with tiny
    // one-word fragments.
    const atComma = sentence.split(/,\s+/)
    if (atComma.length > 1) {
        const merged = []
        for (let i = 0; i < atComma.length; i += 2) {
            const piece = [atComma[i], atComma[i + 1]]
                .filter(Boolean)
                .join(', ')
            merged.push(piece.trim())
        }
        return merged.filter(s => s.length > 0)
    }

    // Last resort — if there are no punctuation split points at all, just
    // cut the sentence roughly in half by word count.
    const words = sentence.split(/\s+/)
    const mid   = Math.ceil(words.length / 2)
    return [
        words.slice(0, mid).join(' '),
        words.slice(mid).join(' '),
    ].filter(s => s.trim().length > 0)
}


// The main export. Takes the full text of a document and returns an array
// of chunk objects ready to be embedded and saved to MongoDB.
//
// Each chunk object looks like this:
//   {
//     text:          the actual text of the chunk
//     tokenCount:    exact token count from the real tokenizer
//     sentenceCount: how many sentences are in this chunk
//     chunkIndex:    position of this chunk in the document (0, 1, 2...)
//   }
async function chunkText(text) {

    const sentences = splitIntoSentences(text)
    if (sentences.length === 0) return []

    // Tokenize every sentence at the same time rather than one by one.
    // For a 50-sentence document, doing them in parallel saves several
    // seconds compared to waiting for each one sequentially.
    const rawCounts = await Promise.all(sentences.map(s => countTokens(s)))

    // Content tokens = raw token count minus the 2 special tokens (CLS + SEP)
    // that the tokenizer adds around every individual sentence.
    // We track these separately from the raw counts because when we join
    // sentences together, those 2 special tokens only appear once for
    // the whole chunk, not once per sentence.
    const contentCounts = rawCounts.map(c => Math.max(0, c - 2))

    const chunks = []

    // We track the current chunk as a list of sentence indices (positions
    // in the sentences array) rather than copying the text around.
    let sentenceIndices = []
    let contentTokenSum = 0

    // This gives us the approximate token count for whatever sentences
    // we've accumulated so far. The 2 accounts for the single CLS+SEP
    // pair that will be added when we join the sentences into one string.
    const approxChunkTokens = () =>
        sentenceIndices.length === 0 ? 0 : 2 + contentTokenSum

    // Close the current chunk and add it to the results array.
    // We tokenize the fully joined text here to get the exact count —
    // this is the number that gets stored in MongoDB and used later by
    // the context builder. We only do this expensive call at flush time,
    // not on every sentence addition.
    const flushChunk = async () => {
        if (sentenceIndices.length === 0) return

        const joined     = sentenceIndices.map(i => sentences[i]).join(' ')
        const tokenCount = await countTokens(joined)

        chunks.push({
            text:          joined,
            tokenCount,
            sentenceCount: sentenceIndices.length,
            chunkIndex:    chunks.length,
        })
    }

    // After flushing a chunk, we don't start the next one from scratch.
    // Instead we carry the last OVERLAP_SENTENCES sentences forward so
    // there's continuity between adjacent chunks.
    const startOverlap = () => {
        const overlapIdx   = sentenceIndices.slice(-config.OVERLAP_SENTENCES)
        sentenceIndices    = [...overlapIdx]
        contentTokenSum    = overlapIdx.reduce((sum, i) => sum + contentCounts[i], 0)
    }

    // Walk through every sentence in the document.
    for (let i = 0; i < sentences.length; i++) {

        const raw     = rawCounts[i]
        const content = contentCounts[i]

        // If a single sentence is already longer than our hard limit on its
        // own, we can't fit it into a chunk normally. Flush whatever we
        // have, then split the sentence into smaller pieces and save each
        // piece as its own chunk directly.
        if (raw > config.MAX_TOKENS) {

            await flushChunk()
            startOverlap()

            const parts = splitOversizedSentence(sentences[i])

            for (const part of parts) {
                const partTokens = await countTokens(part)

                chunks.push({
                    text:          part.trim(),
                    tokenCount:    partTokens,
                    sentenceCount: 1,
                    chunkIndex:    chunks.length,
                })

                // This shouldn't happen often, but if a part is still over
                // the limit (e.g. a very long URL with no split points),
                // we log a warning and store it anyway rather than crashing.
                if (partTokens > config.MAX_TOKENS) {
                    console.warn(
                        `[sentenceChunker] chunk ${chunks.length - 1} has ${partTokens} tokens ` +
                        `which exceeds MAX_TOKENS (${config.MAX_TOKENS}). ` +
                        `This is likely a very long URL or unbreakable string.`
                    )
                }
            }

            // Reset the accumulator after handling the oversized sentence.
            sentenceIndices = []
            contentTokenSum = 0
            continue
        }

        // If adding this sentence would push the chunk over the hard token
        // limit, close the current chunk first and then start fresh with
        // the overlap window before adding this sentence.
        if (approxChunkTokens() + content > config.MAX_TOKENS && sentenceIndices.length > 0) {
            await flushChunk()
            startOverlap()
        }

        // Add the sentence to the current chunk.
        sentenceIndices.push(i)
        contentTokenSum += content

        // Once we've accumulated enough tokens, close the chunk cleanly at
        // this sentence boundary and set up the overlap for the next one.
        if (approxChunkTokens() >= config.TARGET_TOKENS) {
            await flushChunk()
            startOverlap()
        }
    }

    // After the loop, there may be leftover sentences that never triggered
    // the TARGET_TOKENS threshold. Save them as the final chunk, but only
    // if they contain at least 10 tokens — we don't want to store a chunk
    // that's just a stray header or a couple of whitespace characters.
    if (sentenceIndices.length > 0 && approxChunkTokens() >= 10) {
        await flushChunk()
    }

    return chunks
}

module.exports = { chunkText, splitIntoSentences }