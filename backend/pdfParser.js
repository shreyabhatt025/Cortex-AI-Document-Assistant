// pdfParser.js

const fs = require('fs')

const pdfParse = require('pdf-parse')
async function parsePDF(filePath) {

    const fileBuffer = fs.readFileSync(filePath)

    console.log('pdf file read from disk successfully')
    console.log('file path was:', filePath)

    const pdfData = await pdfParse(fileBuffer)

    console.log('total pages in pdf:', pdfData.numpages)
    console.log('total raw characters extracted:', pdfData.text.length)

    const cleanedText = pdfData.text
        .replace(/\s+/g, ' ')
        .trim()

    console.log('total characters after cleaning:', cleanedText.length)

    return cleanedText
}

module.exports = { parsePDF }