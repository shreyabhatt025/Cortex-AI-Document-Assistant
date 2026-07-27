// utils/tokenCounter.js
// This file has one job: give the rest of the codebase a way to count
// how many tokens a piece of text contains, using the exact same tokenizer
// that the embedding model uses internally.
//
// Why do we need exact token counts at all?
// The embedding model (all-MiniLM-L6-v2) has a hard limit of 256 tokens.
// If a chunk is longer than that, the model silently cuts off the end
// and we lose information without any warning. The old code estimated
// tokens using character_count / 4, which can be off by 50% or more
// for technical text. The only safe approach is to use the model's own
// tokenizer so our count matches what the model actually sees.
//
// Why a singleton?
// Loading a tokenizer from disk takes around 100ms and downloads model
// files on the first run. If every call to countTokens() triggered a
// fresh load, ingesting a 50-chunk document would add 5 seconds of
// unnecessary overhead. We load once at server startup and reuse the
// same instance everywhere.
//
// How does the singleton pattern work here?
// We store a Promise (not the tokenizer itself) in _tokenizerPromise.
// If two parts of the code both call initializeTokenizer() before the
// first one finishes loading, they both get back the same Promise and
// wait on it together. Only one load ever happens.

const { AutoTokenizer } = require('@xenova/transformers')

// This holds the Promise that resolves to the loaded tokenizer.
// It stays null until the first call to initializeTokenizer().
let _tokenizerPromise = null

// Call this once at server startup (in the connectDB().then() block).
// After that, countTokens() will work immediately without any delay.
async function initializeTokenizer() {

    // If we already started loading, just return the same Promise.
    // This is what prevents double-loading if two callers race.
    if (_tokenizerPromise) return _tokenizerPromise

    _tokenizerPromise = AutoTokenizer
        .from_pretrained('Xenova/all-MiniLM-L6-v2')
        .then(tokenizer => {
            console.log('tokenizer loaded: Xenova/all-MiniLM-L6-v2')
            return tokenizer
        })
        .catch(err => {
            // If loading fails, clear the cached Promise so the next
            // server restart can try again instead of being stuck forever.
            _tokenizerPromise = null
            throw new Error('tokenizer failed to load: ' + err.message)
        })

    return _tokenizerPromise
}

// Count how many tokens a string produces when passed through the
// all-MiniLM-L6-v2 tokenizer. The count includes the special [CLS] and
// [SEP] tokens that BERT-style models add automatically, because those
// tokens still consume space inside the model's 256-token context window.
async function countTokens(text) {

    // Nothing to count for empty input, just return 0.
    if (!text || text.trim() === '') return 0

    const tokenizer = await initializeTokenizer()

    // We pass truncation: false because we want the real count, not
    // the count after the model has already cut the text off at 256.
    // If we used the default truncation setting we would never detect
    // that a chunk is too long — it would just silently look fine.
    const encoded = tokenizer(text, { truncation: false, padding: false })

    const inputIds = encoded.input_ids

    // Xenova returns input_ids as a Tensor object. The actual array of
    // token IDs lives inside .data, which is a TypedArray. Its length
    // is the number of tokens, which is what we want.
    if (inputIds && inputIds.data) {
        return inputIds.data.length
    }

    // Some versions of the Xenova API return a plain JavaScript array
    // instead of a Tensor. This handles that case just in case.
    if (Array.isArray(inputIds)) {
        return inputIds.length
    }

    // This fallback should never be reached with a supported Xenova version.
    // If it is, we log a warning and return a rough estimate so the rest
    // of the pipeline keeps working rather than crashing.
    console.warn('[tokenCounter] unexpected input_ids shape, using rough estimate')
    return Math.ceil(text.length / 4)
}

module.exports = { initializeTokenizer, countTokens }