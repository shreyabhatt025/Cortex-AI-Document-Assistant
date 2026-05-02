
Week 1 — you FED knowledge into the brain
"Store all SOP chunks + vectors in MongoDB"

DAY 1 = 

pdfParser.js 


breaking pdf  into chunks (small paragrapgh size peice of pdf which is stored with meaning and converted into numbers so AI can find and read only the relevant pieces when someone ask a questions . )

Problem with sending full PDF:
    AI models have a limit on how much text they can read at once , slow 
   
Problem solved with chunks:
   → Employee asks "how do I process a refund?"
   → System searches all chunks and finds TOP 3-5 relevant ones
   → Only those 3-5 small chunks are sent to the AI
   → AI reads just those pieces and answers perfectly
   → Fast

A PDF file is NOT plain text.
It is a binary file — meaning it looks like this inside:

%PDF-1.4
%âãÏÓ
1 0 obj << /Type /Catalog /Pages 2 0 R >>
endobj xref 0 9 0000000000 65535 f
0000000015 00000000 n ...

← This is what your PDF actually contains
← Pure gibberish to javascript
← You cannot just do fs.readFile() and get clean text
so we need pdf-parse library which know how to decode this gibberish and give us clean readble text . 

PDF File on disk
      ↓
Read it as raw binary data (Buffer)
      ↓
Pass that binary data to pdf-parse library
      ↓
pdf-parse decodes it internally
      ↓
Returns clean readable text
      ↓
We clean up extra spaces/weird characters
      ↓
Return final clean text string
      ↓
chunker.js will receive this and cut it into chunks


