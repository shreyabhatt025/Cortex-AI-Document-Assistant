Server.js 

pdfParser.js  → extracts text from pdf
chunker.js    → cuts text into chunks  
embedder.js   → converts chunks to vectors
db.js         → saves to mongodb

 Nobody is calling these files
 Nobody is connecting them together
 Nobody is receiving the uploaded PDF from admin
 Nobody is deciding WHAT to do and WHEN to do it

These 4 files are just sitting there doing nothing
like 4 workers in a factory with no manager 
and no conveyor belt connecting them

Server.js

Creates the web server (so admin can hit an endpoint)
 Receives the uploaded PDF via Multer
Calls pdfParser.js → gets text
Calls chunker.js → gets chunks array
Loops through chunks → calls embedder.js for each
Calls db.js to save each chunk + vector
Sends back success/failure response to admin 



WORKING OF FILE =

Admin uploads PDF via Postman or Frontend
 ↓
Multer catches the file → saves to /uploads folder
 ↓
server.js receives req.file (file info)
  ↓
calls parsePDF(req.file.path) → gets big text string
 ↓
calls chunkText(fullText) → gets array of chunks
 ↓
loops through every chunk:
 → calls generateEmbedding(chunk) → gets vector
 → calls saveChunk({text, vector sourceFile, chunkIndex})
  ↓
After all chunks saved → sends JSON response to admin
{
  message: "PDF uploaded and processed!",
  totalChunks: 47
}

