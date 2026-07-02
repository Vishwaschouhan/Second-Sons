import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { InMemorySessionService, Runner } from '@google/adk';
import { rootAgent } from './agents/rootAgent.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ADK session service (in-memory, per-server-instance)
const sessionService = new InMemorySessionService();

// Create an ADK runner with our root agent
const runner = new Runner({
  agent: rootAgent,
  appName: 'secondsons',
  sessionService,
});

// POST /chat — main chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, userId, sessionId } = req.body;

    if (!message || !userId) {
      return res.status(400).json({ error: 'message and userId are required' });
    }

    const sid = sessionId || `session_${userId}_${Date.now()}`;

    // Get or create session
    let session = await sessionService.getSession({
      appName: 'secondsons',
      userId,
      sessionId: sid,
    });

    if (!session) {
      session = await sessionService.createSession({
        appName: 'secondsons',
        userId,
        sessionId: sid,
        state: {
          userId,
          currentDateTime: new Date().toISOString(),
        },
      });
    } else {
      // Update datetime on each message
      session.state.currentDateTime = new Date().toISOString();
    }

    // Inject current date/time context into the message
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const contextMessage = `[System context: Current date is ${dateStr}, time is ${timeStr}. User ID: ${userId}]\n\nUser: ${message}`;

    // Run the agent
    const content = {
      role: 'user',
      parts: [{ text: contextMessage }],
    };

    let reply = '';
    let errorMsg = '';
    const events = runner.runAsync({
      userId,
      sessionId: sid,
      newMessage: content,
    });

    // Timeout wrapper — prevent infinite agent loops
    const TIMEOUT_MS = 45000;
    const processEvents = async () => {
      for await (const event of events) {
        const author = event.author || 'unknown';

        // Handle API errors (e.g. 429 rate limit)
        if (event.errorCode || event.errorMessage) {
          console.error(`[Error] author=${author}, code=${event.errorCode}, msg=${event.errorMessage?.substring(0, 200)}`);
          if (event.errorCode === '429') {
            errorMsg = "I'm a bit busy right now due to high demand. Please wait a moment and try again.";
          } else {
            errorMsg = event.errorMessage || 'An unexpected error occurred.';
          }
          continue;
        }

        // Extract text, tool calls, and tool responses from content parts
        const parts = event.content?.parts || [];
        const contentRole = event.content?.role;

        for (const part of parts) {
          if (part.text && part.text.trim()) {
            console.log(`[Event] author=${author}, role=${contentRole}, text="${part.text.substring(0, 100)}..."`);
            reply = part.text;
          }
          if (part.functionCall) {
            console.log(`[Tool Call] ${author}: ${part.functionCall.name}(${JSON.stringify(part.functionCall.args).substring(0, 200)})`);
          }
          if (part.functionResponse) {
            const resp = JSON.stringify(part.functionResponse.response || {}).substring(0, 300);
            console.log(`[Tool Response] ${part.functionResponse.name}: ${resp}`);
          }
        }
      }
    };

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Agent timeout')), TIMEOUT_MS)
    );

    try {
      await Promise.race([processEvents(), timeout]);
    } catch (err) {
      if (err.message === 'Agent timeout') {
        console.warn('[Server] Agent timed out after 45s');
        if (!reply) {
          errorMsg = "The request took too long. Please try again.";
        }
      } else {
        throw err;
      }
    }

    const finalReply = reply || errorMsg || "I'm sorry, I couldn't process that request. Could you try again?";

    res.json({
      reply: finalReply,
      sessionId: sid,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Internal server error',
      reply: "I'm having trouble processing your request. Please try again.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'secondsons_assistant' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SecondSons AI backend running on http://localhost:${PORT}`);
  console.log(`Chat endpoint: POST http://localhost:${PORT}/chat`);
});
