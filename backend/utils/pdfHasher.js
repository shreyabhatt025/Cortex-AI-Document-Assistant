// utils/pdfHasher.js
// This file takes the raw bytes of a PDF file and produces a unique
// fingerprint for it using SHA-256 hashing.
//
// Why do we need this at all?
// Without it, an admin could accidentally upload the same PDF twice and
// we'd end up with duplicate chunks in MongoDB. When that happens, vector
// search returns the same chunk twice (with nearly identical scores),
// the context builder stuffs duplicate text into the prompt, and answer
// quality drops. The hash lets us detect the duplicate before any of
// that processing begins.
//
// Why hash the raw bytes instead of using the filename?
// Filenames are unreliable. The same file can be renamed and uploaded
// again ("SOP_v1.pdf" vs "SOP_final.pdf"). A different file can
// accidentally be given the same name. SHA-256 of the actual file content
// catches both cases correctly — identical content always produces the
// same hash, and different content always produces a different one.
//
// Why SHA-256 and not something simpler like MD5?
// MD5 has known collision vulnerabilities (two different files can be
// crafted to produce the same hash). SHA-256 has no known collisions,
// which means we can trust it as a reliable content fingerprint.
// It's also built into Node's standard crypto module, so there's no
// extra dependency to install.

const crypto = require('crypto')

// Takes the PDF file as a Buffer (the raw bytes read from disk) and
// returns a 64-character lowercase hex string that uniquely identifies
// the content of that file.
function hashPDF(buffer) {

    // If someone accidentally passes something other than a Buffer, we
    // throw immediately with a clear message rather than producing a
    // silently wrong hash.
    if (!Buffer.isBuffer(buffer)) {
        throw new TypeError(
            'hashPDF expected a Buffer but received ' + typeof buffer +
            '. Make sure you pass fs.readFileSync() output directly.'
        )
    }

    // Create a SHA-256 hasher, feed it the entire file buffer in one
    // shot, and return the result as a hex string.
    return crypto.createHash('sha256').update(buffer).digest('hex')
}

module.exports = { hashPDF }