chunker.js gives an array of chunks 
now How does AI later find the right chunk when an employee ask a questions ?

answer=just search for matching words 

eg=Employee asks: "How do I return money to a customer?"

Word search looks for: "return" "money" "customer"

Chunk 1 has: "refund" "billing" "process"
 Word search FAILS because:
   → Employee said "return money" 
   → Chunk has "refund"  
   → Same meaning, completely different words
   → Simple word matching can't understand meaning

   Now we need embeddings .

   Embedding understands MEANING not just words

"return money to customer"  →  [0.231, -0.872, 0.341...]
"process a refund"          →  [0.229, -0.868, 0.339...]
                                 ↑↑↑ almost same
                                 numbers!

Because same meaning = similar numbers
MongoDB then finds chunks whose numbers are closest
to the question's numbers → perfect match every time 

Normal human:    "process a refund"  ← words we understand

Computer:        [0.231, -0.872, 0.341, 0.009, 0.112,
                  0.445, -0.231, 0.887, 0.023, -0.445,
                  ...1536 numbers total]  ← what computer understands

Embedding = the process of converting words → those numbers
            in a way that PRESERVES the meaning


One chunk of text (string)
         ↓
Send to OpenAI embedding API
         ↓
OpenAI's model reads the text
         ↓
Returns array of 1536 numbers
         ↓
We return those numbers back to server.js
         ↓
server.js saves text + numbers together in MongoDB