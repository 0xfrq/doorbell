const output = document.getElementById('output');
const input = document.getElementById('input');
const cursor = document.querySelector('.cursor');
const scrollIndicator = document.getElementById('scrollIndicator');

let isTyping = false;
let currentAiMessage = null;
let isUserScrolling = false;
let scrollTimeout = null;

input.focus();

output.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = output;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
    
    if (!isAtBottom) {
        isUserScrolling = true;
        scrollIndicator.classList.add('show');
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isUserScrolling = false;
        }, 2000);
    } else {
        isUserScrolling = false;
        scrollIndicator.classList.remove('show');
    }
});

scrollIndicator.addEventListener('click', () => {
    isUserScrolling = false;
    smoothScrollToBottom();
    scrollIndicator.classList.remove('show');
});

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isTyping) {
        const message = input.value.trim();
        if (message) {
            handleCommand(message);
            input.value = '';
        }
    }
});

document.addEventListener('click', () => {
    input.focus();
});

function handleCommand(message) {
    if (message === '/clear') {
        sendMessage(message);
        return;
    }
    
    if (message === '/reset') {
        sendMessage('/clear');
        return;
    }
    
    if (message.startsWith('/search ')) {
        if (message.trim() === '/search') {
            addMessage('Usage: /search your search query here', 'error');
            return;
        }
        sendMessage(message);
        return;
    }
    
    sendMessage(message);
}

function sendMessage(message, resetHistory = false) {
    if (isTyping) return;
    
    isTyping = true;
    cursor.style.display = 'none';
    
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, resetHistory })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        function readStream() {
            return reader.read().then(({ done, value }) => {
                if (done) {
                    return;
                }
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            handleSSEMessage(data);
                        } catch (e) {
                        }
                    }
                });
                
                return readStream();
            });
        }
        
        return readStream();
    })
    .catch(error => {
        console.error('Error:', error);
        hideTyping();
        addMessage('Error processing your message', 'error');
        currentAiMessage = null;
        isTyping = false;
        cursor.style.display = 'inline';
        input.focus();
    });
}

function handleSSEMessage(data) {
    switch (data.type) {
        case 'userMessage':
            addMessage(data.message, 'user-message');
            break;
            
        case 'typing':
            showTyping();
            smoothScrollToBottom();
            break;
            
        case 'aiResponse':
            hideTyping();
            
            if (!currentAiMessage) {
                currentAiMessage = addAiMessage();
                currentAiMessage.textContent = ' '; 
            }
            
            currentAiMessage.textContent += data.chunk;
            scrollToBottom();
            break;
            
        case 'responseComplete':
            currentAiMessage = null;
            isTyping = false;
            cursor.style.display = 'inline';
            input.focus();
            smoothScrollToBottom();
            break;
            
        case 'error':
            hideTyping();
            addMessage(data.message, 'error');
            currentAiMessage = null;
            isTyping = false;
            cursor.style.display = 'inline';
            input.focus();
            break;
    }
}

function clearOutput() {
    isUserScrolling = false;
    scrollIndicator.classList.remove('show');
    output.innerHTML = `
        <div class="system-info">
                    <pre>
 █████╗ ██████╗ ███████╗██╗     
██╔══██╗██╔══██╗██╔════╝██║     
███████║██████╔╝█████╗  ██║     
██╔══██║██╔══██╗██╔══╝  ██║     
██║  ██║██████╔╝███████╗███████╗
╚═╝  ╚═╝╚═════╝ ╚══════╝╚══════╝
                    </pre>
                    <div class="welcome-text">
                        <p>Type your message and press Enter to chat with abel.</p>
                        <p>Commands: /clear (reset conversation), /search (web search)</p>
                        <p>Shortcuts: Ctrl+L (clear display only)</p>
                        <p>Shortcuts: Ctrl+End (scroll to bottom), Page Up/Down (scroll)</p>
                        <p>Your conversation history persists between sessions until you use /clear</p>
                    </div>        </div>
    `;
}

function addMessage(text, className) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${className}`;
    messageDiv.textContent = text;
    output.appendChild(messageDiv);
    scrollToBottom();
}

function addAiMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';
    output.appendChild(messageDiv);
    scrollToBottom();
    return messageDiv;
}

function scrollToBottom(force = false) {
    if (!isUserScrolling || force) {
        requestAnimationFrame(() => {
            output.scrollTop = output.scrollHeight;
        });
    }
}

function smoothScrollToBottom() {
    const start = output.scrollTop;
    const end = output.scrollHeight - output.clientHeight;
    const duration = 300;
    const startTime = performance.now();
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        
        output.scrollTop = start + (end - start) * easeOutCubic;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message typing';
    typingDiv.textContent = 'abel is typing';
    typingDiv.id = 'typing-indicator';
    output.appendChild(typingDiv);
    scrollToBottom();
}

function hideTyping() {
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) {
        typingDiv.remove();
    }
}

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'c') {
        input.value = '';
        e.preventDefault();
    }
    
    if (e.ctrlKey && e.key === 'l') {
        clearOutput();
        e.preventDefault();
    }
    
    if (e.key === 'PageUp') {
        isUserScrolling = true;
        output.scrollTop -= output.clientHeight * 0.8;
        e.preventDefault();
    }
    
    if (e.key === 'PageDown') {
        isUserScrolling = true;
        output.scrollTop += output.clientHeight * 0.8;
        e.preventDefault();
    }
    
    if (e.key === 'End' && e.ctrlKey) {
        isUserScrolling = false;
        smoothScrollToBottom();
        e.preventDefault();
    }
    
    if (e.key === 'Home' && e.ctrlKey) {
        isUserScrolling = true;
        output.scrollTop = 0;
        e.preventDefault();
    }
});
