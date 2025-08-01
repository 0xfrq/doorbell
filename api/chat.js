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

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    // Send user message event
    res.write(`data: ${JSON.stringify({ type: 'userMessage', message })}\n\n`);

    // Send typing indicator
    res.write(`data: ${JSON.stringify({ type: 'typing' })}\n\n`);

    // Process with Gemini AI
    await geminiChat(message, (chunk) => {
      // Stream response chunks to client
      res.write(`data: ${JSON.stringify({ type: 'aiResponse', chunk })}\n\n`);
    }, resetHistory);

    // Signal end of response
    res.write(`data: ${JSON.stringify({ type: 'responseComplete' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('[API] Error processing message:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Error processing your message' })}\n\n`);
    res.end();
  }
};
