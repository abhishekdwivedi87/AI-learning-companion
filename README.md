# AI Learning Companion

AI Learning Companion helps you turn study material into useful learning
resources. Upload notes, ask questions, and explore ideas with an AI assistant.

## What it can do

- Summarize text files, PDFs, and images.
- Follow custom instructions, such as explaining key terms or creating a quiz.
- Generate an educational image from a prompt and your study material.
- Capture a page with your camera, where camera access is supported.
- Chat with an AI study assistant and create concept maps from your notes.
- Search saved notes with retrieval-augmented generation (RAG) and see cited
  passages.
- Save note summaries and conversation history in your browser and database.

## Technologies

- **Frontend:** React
- **Backend:** Node.js and Express
- **Database:** MongoDB with Mongoose
- **AI:** Google Gemini for summaries, chat, embeddings, concept maps etc...

## Run locally

You need Node.js, npm, a MongoDB database, and a Gemini API key.

1. In `backend`, create a `.env` file with your own credentials:

   ```env
   GEMINI_API_KEY=your_gemini_api_key
   MONGO_URI=your_mongodb_connection_string
   ```

   Optional settings:

   ```env
   PORT=5000
   GEMINI_MODEL=your_gemini_text_model
   MONGODB_VECTOR_INDEX=vector_index
   ```

2. In a terminal, install and start the backend:

   ```powershell
   cd backend
   npm install
   npm start
   ```

3. In a second terminal, install and start the frontend:

   ```powershell
   cd frontend
   npm install
   npm start
   ```

   The frontend uses the local backend at `http://127.0.0.1:5000`.

4. Open `http://localhost:5000/` to check that the backend is running. It
   displays a plain-text status message. The detailed health endpoint is
   available at `http://localhost:5000/api/health`.

## Notes

- Keep your `.env` file private; do not commit API keys or database credentials.
- RAG uses stored note embeddings. MongoDB Atlas Vector Search can use a
  configured vector index; when that index is unavailable, the backend falls
  back to local similarity search over saved embeddings.
- Camera access generally requires `localhost` or HTTPS.
