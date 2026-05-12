Right now your system works like this:

Employee opens Postman
Types JSON manually: { "question": "how to refund?" }
Gets back raw JSON response
Reads the answer in JSON format

This is NOT how real users interact 
Real employees want a proper chat interface
Like WhatsApp or ChatGPT — type and see response appear

Week 3 has 2things to build:

1. STREAMING RESPONSE (SSE)
   → Right now answer appears ALL AT ONCE after 5-10 seconds
   → Streaming makes it appear word by word like ChatGPT
   → SSE = Server Sent Events (backend pushes words to frontend live)
   → Much better user experience
2. REACT FRONTEND CHAT UI
   → Real chat interface in the browser
   → Employee types question, sees answer streaming in real time
   → Shows source citation below each answer
  