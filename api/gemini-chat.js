require("dotenv").config();
const fs = require('fs');
const path = require('path');

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const joshpanmode = false;
const stopcharacter = "";
const MAX_WORDS_LENGTH = 31000; 

const instruction = require("./instruction");
const examples = require("./examples");

const HISTORY_FILE = path.join(__dirname, '../conversation_history.json');

function loadConversationHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const history = JSON.parse(data);
      console.log('[gemini-chat.js] Loaded conversation history with', history.length, 'messages');
      return history;
    }
  } catch (error) {
    console.error('[gemini-chat.js] Error loading conversation history:', error);
  }
  
  const defaultHistory = [
    {
      role: "user",
      parts: [{ text: instruction }]
    }
  ];

  examples.forEach(example => {
    if (example.role === "user") {
      defaultHistory.push({
        role: "user",
        parts: [{ text: example.content }]
      });
    } else if (example.role === "assistant") {
      defaultHistory.push({
        role: "model",
        parts: [{ text: example.content }]
      });
    }
  });

  console.log('[gemini-chat.js] Initialized new conversation history');
  return defaultHistory;
}

function saveConversationHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('[gemini-chat.js] Error saving conversation history:', error);
  }
}

let messageHistory = loadConversationHistory();

function wordCount(str) {
  return str.split(" ").filter(function (n) {
    return n != "";
  }).length;
}

function checkMessageHistory() {
  let totalWords = messageHistory.reduce((acc, message) => {
    if (message.parts && message.parts[0] && message.parts[0].text) {
      return acc + wordCount(message.parts[0].text);
    }
    return acc;
  }, 0);

  let removedMessages = false;
  while (totalWords > MAX_WORDS_LENGTH && messageHistory.length > 2) {
    messageHistory.splice(1, 1); 
    removedMessages = true;
    totalWords = messageHistory.reduce((acc, message) => {
      if (message.parts && message.parts[0] && message.parts[0].text) {
        return acc + wordCount(message.parts[0].text);
      }
      return acc;
    }, 0);
  }

  if (removedMessages) {
    saveConversationHistory(messageHistory);
    console.log('[gemini-chat.js] Trimmed conversation history due to length');
  }
}

function resetMessageHistory() {
  const defaultHistory = [
    {
      role: "user",
      parts: [{ text: instruction }]
    }
  ];

  examples.forEach(example => {
    if (example.role === "user") {
      defaultHistory.push({
        role: "user",
        parts: [{ text: example.content }]
      });
    } else if (example.role === "assistant") {
      defaultHistory.push({
        role: "model",
        parts: [{ text: example.content }]
      });
    }
  });

  messageHistory = defaultHistory;
  saveConversationHistory(messageHistory);
  console.log('[gemini-chat.js] Conversation history reset');
}

async function main(prompt, onData, resetHistory = false) {
  if (prompt.trim() === '/clear') {
    resetMessageHistory();
    onData("conversation history cleared. starting fresh...");
    return Promise.resolve();
  }

  if (resetHistory) {
    resetMessageHistory();
  }

  // Check if this is a search command
  const isSearchCommand = prompt.trim().startsWith('/search ');
  let searchQuery = '';
  let actualPrompt = prompt;
  
  if (isSearchCommand) {
    searchQuery = prompt.trim().substring(8); // Remove '/search ' prefix
    actualPrompt = searchQuery;
    onData(`🔍 Searching for: "${searchQuery}"\n\n`);
  }

  messageHistory.push({
    role: "user",
    parts: [{ text: actualPrompt }]
  });
  checkMessageHistory();

  let responseBuffer = ""; 

  return new Promise(async (resolve, reject) => {
    try {
      // Configure tools based on whether this is a search command
      let tools = [];
      if (isSearchCommand) {
        tools.push({
          google_search: {}
        });
      }

      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 2,
          topP: 0.95,
          topK: 80,
          maxOutputTokens: 3096,
        },
        tools: tools.length > 0 ? tools : undefined
      });

      const chat = model.startChat({
        history: messageHistory.slice(0, -1), 
      });

      const result = await chat.sendMessageStream(actualPrompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          let chunkContent = chunkText;
          if (joshpanmode) {
            chunkContent = chunkContent.toLowerCase();
          }
          // Filter out **(xxx)** patterns
          chunkContent = chunkContent.replace(/\*\*\([^)]*\)\*\*/g, '');
          onData(chunkContent);
          responseBuffer += chunkContent; 
        }
      }

      console.log("[gemini-chat.js] Stream completed.");
      onData(" " + stopcharacter);

      // If this was a search command, try to show grounding information
      if (isSearchCommand && result.response) {
        try {
          const response = await result.response;
          if (response.candidates && response.candidates[0] && response.candidates[0].groundingMetadata) {
            const groundingMetadata = response.candidates[0].groundingMetadata;
            
            if (groundingMetadata.webSearchQueries) {
              onData(`\n\n🔍 **Search queries used:** ${groundingMetadata.webSearchQueries.join(', ')}`);
            }
            
            if (groundingMetadata.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
              onData(`\n\n📚 **Sources:**`);
              groundingMetadata.groundingChunks.forEach((chunk, index) => {
                if (chunk.web) {
                  onData(`\n${index + 1}. ${chunk.web.title} - ${chunk.web.uri}`);
                }
              });
            }
          }
        } catch (error) {
          console.log("[gemini-chat.js] Could not extract grounding metadata:", error.message);
        }
      }

      messageHistory.push({
        role: "model",
        parts: [{ text: responseBuffer }]
      });
      checkMessageHistory();

      saveConversationHistory(messageHistory);

      resolve();

    } catch (error) {
      console.error("Gemini stream error:", error);
      reject(error);
    }

    console.log(
      `[gemini-chat.js] Messages in context : ${messageHistory.length}`
    );
    console.log(
      `[gemini-chat.js] Words in context    : ${messageHistory.reduce((acc, message) => {
        if (message.parts && message.parts[0] && message.parts[0].text) {
          return acc + wordCount(message.parts[0].text);
        }
        return acc;
      }, 0)}`
    );
  });
}

module.exports = main;
//s
