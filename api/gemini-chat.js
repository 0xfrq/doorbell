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

  messageHistory.push({
    role: "user",
    parts: [{ text: prompt }]
  });
  checkMessageHistory();

  let responseBuffer = ""; 

  return new Promise(async (resolve, reject) => {
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 1,
          topP: 0.95,
          topK: 60,
          maxOutputTokens: 1024,
        }
      });

      const chat = model.startChat({
        history: messageHistory.slice(0, -1), 
      });

      const result = await chat.sendMessageStream(prompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          let chunkContent = chunkText;
          if (joshpanmode) {
            chunkContent = chunkContent.toLowerCase();
          }
          for (let i = 0; i < chunkContent.length; i++) {
            onData(chunkContent[i]);
          }
          responseBuffer += chunkContent;
        }
      }

      console.log("[gemini-chat.js] Stream completed.");
      onData(" " + stopcharacter);

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
