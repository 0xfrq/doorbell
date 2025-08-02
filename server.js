const express = require('express');
const path = require('path');
const geminiChat = require('./api/gemini-chat');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  const { message, resetHistory = false } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    res.write(`data: ${JSON.stringify({ type: 'userMessage', message })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'typing' })}\n\n`);
    await geminiChat(message, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'aiResponse', chunk })}\n\n`);
    }, resetHistory);

    res.write(`data: ${JSON.stringify({ type: 'responseComplete' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('[API] Error processing message:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Error processing your message' })}\n\n`);
    res.end();
  }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`[Server] web chat running on http://localhost:${PORT}`);
    });
}

module.exports = app;