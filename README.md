# Abel Web Chat - Vercel Deployment

A terminal-style web chat interface powered by Google's Gemini AI, now deployable on Vercel.

## Features

- Terminal-style interface
- Character-by-character streaming responses
- Conversation history persistence
- No WebSocket dependency (uses Server-Sent Events)
- Secure API key handling
- Mobile responsive

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and add your Gemini API key:
   ```bash
   cp .env.example .env
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Vercel Deployment

1. Fork this repository or push to your GitHub account

2. Go to [Vercel Dashboard](https://vercel.com/dashboard)

3. Click "Import Project" and select your repository

4. Configure environment variables in Vercel:
   - Go to Settings > Environment Variables
   - Add `GEMINI_API_KEY` with your actual API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

5. Deploy! Vercel will automatically deploy your app.

## Environment Variables

- `GEMINI_API_KEY` - Required. Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Security

- API keys are handled server-side only
- No sensitive information exposed to the client
- CORS headers properly configured

## API Endpoints

- `GET /` - Serves the main chat interface
- `POST /api/chat` - Handles chat messages with Server-Sent Events streaming

## Technology Stack

- Frontend: Vanilla JavaScript, HTML, CSS
- Backend: Node.js, Express
- AI: Google Gemini API
- Deployment: Vercel
- Streaming: Server-Sent Events (SSE)
