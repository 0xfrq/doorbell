require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const geminiChat = require('./api/gemini-chat');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('[Server] User connected:', socket.id);

    socket.on('message', async (data) => {
        try {
            console.log('[Server] Received message:', data.message);
            
            // Send user message back to client for display
            socket.emit('userMessage', { message: data.message });
            
            // Process with Gemini AI
            await geminiChat(data.message, (chunk) => {
                // Stream response chunks to client
                socket.emit('aiResponse', { chunk });
            }, data.resetHistory || false);
            
            // Signal end of response
            socket.emit('responseComplete');
            
        } catch (error) {
            console.error('[Server] Error processing message:', error);
            socket.emit('error', { message: 'Error processing your message' });
        }
    });

    socket.on('disconnect', () => {
        console.log('[Server] User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`[Server] web chat running on http://localhost:${PORT}`);
});
