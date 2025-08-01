const path = require('path');
const geminiChat = require(path.join(process.cwd(), 'api', 'gemini-chat'));

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
};
