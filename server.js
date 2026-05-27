const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { systemPromptEN, systemPromptFR, fitAssessmentPrompt } = require('./system-prompt');

const app = express();
const PORT = process.env.PORT || 3000;

// Helper function to get API key from Docker secret or environment variable
function getApiKey() {
  // First try Docker secret (production)
  const secretPath = '/run/secrets/anthropic_api_key';
  if (fs.existsSync(secretPath)) {
    try {
      return fs.readFileSync(secretPath, 'utf8').trim();
    } catch (error) {
      console.warn('Warning: Could not read Docker secret:', error.message);
    }
  }

  // Fallback to environment variable (development/local)
  return process.env.ANTHROPIC_API_KEY;
}

// Get API key from secret or environment
const apiKey = getApiKey();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: apiKey,
});

// Middleware
app.use(cors());
app.use(express.json());

// Homepage route with page view counter (must be before express.static)
app.get('/', (req, res) => {
  pageViews++; // Increment view counter
  savePageViews(); // Persist to disk (debounced)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files (after homepage route to avoid bypassing counter)
app.use(express.static('public'));

// Store conversation history per session (in production, use Redis or similar)
const conversations = new Map();
const rateLimitMap = new Map(); // Track requests per session

// View counter with file-based persistence.
// IMPORTANT: a local file is per-container, so the web service MUST run a single
// replica (see docker-compose.yml) and the data dir MUST be a mounted volume,
// otherwise replicas keep divergent counts and redeploys reset to the seed.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const VIEWS_FILE = path.join(DATA_DIR, 'pageviews.json');
const VIEWS_SEED = 1782; // baseline used only on the very first run, before any file exists

function loadPageViews() {
  try {
    if (fs.existsSync(VIEWS_FILE)) {
      const data = JSON.parse(fs.readFileSync(VIEWS_FILE, 'utf8'));
      if (Number.isFinite(data.pageViews)) return data.pageViews;
    }
  } catch (err) {
    console.error('Failed to load page views, starting from seed:', err.message);
  }
  return VIEWS_SEED;
}

let pageViews = loadPageViews();

function writePageViews() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(VIEWS_FILE, JSON.stringify({ pageViews }));
  } catch (err) {
    console.error('Failed to persist page views:', err.message);
  }
}

// Debounce writes so a burst of traffic doesn't thrash the disk
let saveScheduled = false;
function savePageViews() {
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(() => {
    saveScheduled = false;
    writePageViews();
  }, 2000);
}

// Flush the latest count synchronously on shutdown (Swarm sends SIGTERM on redeploy)
process.on('SIGTERM', () => { writePageViews(); process.exit(0); });
process.on('SIGINT', () => { writePageViews(); process.exit(0); });

// Enhanced jailbreak detection patterns (Based on OWASP GenAI 2025 & 2026 research)
// References:
// - OWASP LLM01:2025 Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
// - OWASP LLM07:2025 System Prompt Leakage
// - OWASP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
const jailbreakPatterns = [
  // Classic instruction override patterns
  /ignore\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|prompts?|rules|commands?|directives?)/i,
  /forget\s+(everything|all|your)\s+(you\s+)?(know|learned|instructions|training|programming)/i,
  /disregard\s+(your|the|all)\s+(training|instructions|guidelines|rules|programming|constraints)/i,

  // Identity manipulation (OWASP LLM01)
  /you\s+are\s+(no\s+longer|not|now)\s+(.+?\s+)?(assistant|AI|Claude|chatbot|bot)/i,
  /new\s+(instructions?|prompts?|rules|role|character|persona|identity)/i,
  /act\s+as\s+(if\s+)?(you|you're|you\s+are)\s+(not\s+)?(a\s+)?(chatbot|AI|assistant|human|person)/i,
  /pretend\s+(to\s+be|you\s+are|you're|that\s+you're)/i,
  /roleplay\s+(as|that\s+you)/i,
  /imagine\s+(you\s+are|yourself\s+as)/i,

  // System prompt leakage attempts (OWASP LLM07:2025)
  /system\s+(prompt|message|instruction|context|role)/i,
  /(show|display|reveal|print|output|tell)\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions|rules|guidelines)/i,
  /what\s+(are\s+)?(your\s+)?(initial|original|system)\s+(instructions?|prompts?|rules)/i,

  // Mode switching and simulation
  /simulation\s+mode/i,
  /(enable|activate|enter|switch\s+to)\s+(admin|debug|developer|god|sudo)\s+mode/i,
  /DAN\s+mode/i,
  /developer\s+mode/i,
  /unrestricted\s+mode/i,

  // Jailbreak keywords
  /jailbreak/i,
  /bypass\s+(safety|guidelines|restrictions|rules|filters)/i,
  /override\s+(safety|security|protection|rules)/i,

  // Multi-turn manipulation (OWASP 2026 research)
  /let's\s+start\s+over/i,
  /reset\s+(conversation|context|memory)/i,
  /new\s+(conversation|session|context)/i,

  // Encoding and obfuscation attempts
  /{{.*}}|<\|.*\|>/i, // Template/special tokens
  /\[INST\]|\[\/INST\]/i, // Instruction markers
  /###\s*(Human|Assistant|System):/i, // Role markers
  /<\|im_start\|>|<\|im_end\|>/i, // ChatML tokens

  // Context poisoning (2026 CVE references)
  /(from\s+now\s+on|going\s+forward),?\s+you\s+(will|must|should)/i,
  /in\s+this\s+(conversation|scenario|context),?\s+you\s+(are|will\s+be)/i,

  // Character substitution and Unicode tricks
  /[\u200B-\u200D\uFEFF]/g, // Zero-width characters
  /[^\x00-\x7F]{10,}/g, // Excessive non-ASCII (possible encoding attack)
];

// Input validation and sanitization
function validateAndSanitizeInput(message) {
  // Check message length
  if (message.length > 2000) {
    return { valid: false, error: 'Message is too long (max 2000 characters)' };
  }

  // Check for empty or whitespace-only messages
  if (!message.trim()) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  // Detect potential jailbreak attempts
  for (const pattern of jailbreakPatterns) {
    if (pattern.test(message)) {
      console.warn('Potential jailbreak attempt detected:', message.substring(0, 100));
      return {
        valid: false,
        error: 'Your message appears to contain instructions that go beyond asking about professional experience. Please rephrase your question.',
      };
    }
  }

  // Check for excessive special characters (potential injection)
  const specialCharRatio = (message.match(/[<>{}[\]|\\]/g) || []).length / message.length;
  if (specialCharRatio > 0.1) {
    console.warn('High special character ratio detected:', specialCharRatio.toFixed(2));
    return { valid: false, error: 'Message contains unusual formatting. Please use plain text.' };
  }

  // Anomaly detection: Check for repetitive patterns (OWASP 2026 recommendations)
  const repetitivePattern = /(.{3,})\1{5,}/i; // Same 3+ chars repeated 5+ times
  if (repetitivePattern.test(message)) {
    console.warn('Repetitive pattern detected - possible attack');
    return { valid: false, error: 'Message contains unusual patterns. Please rephrase.' };
  }

  // Check for excessive punctuation (anomaly detection)
  const punctuationRatio = (message.match(/[!?.,;:]{3,}/g) || []).length;
  if (punctuationRatio > 3) {
    console.warn('Excessive punctuation detected');
    return { valid: false, error: 'Message contains excessive punctuation. Please use normal formatting.' };
  }

  // Detect potential encoding-based attacks (Base64, Hex)
  const base64Pattern = /(?:^|\s)[A-Za-z0-9+\/]{20,}={0,2}(?:\s|$)/;
  const hexPattern = /(?:0x)?[0-9a-fA-F]{32,}/;
  if (base64Pattern.test(message) || hexPattern.test(message)) {
    console.warn('Potential encoding-based attack detected');
    return { valid: false, error: 'Message contains encoded content. Please use plain text.' };
  }

  // Check for excessive newlines (context poisoning attempt)
  const newlineCount = (message.match(/\n/g) || []).length;
  if (newlineCount > 10) {
    console.warn('Excessive newlines detected');
    return { valid: false, error: 'Message contains too many line breaks. Please use normal formatting.' };
  }

  return { valid: true, sanitized: message.trim() };
}

// Rate limiting check
function checkRateLimit(sessionId) {
  const now = Date.now();
  const sessionData = rateLimitMap.get(sessionId) || { count: 0, resetTime: now + 60000 };

  // Reset counter every minute
  if (now > sessionData.resetTime) {
    sessionData.count = 0;
    sessionData.resetTime = now + 60000;
  }

  sessionData.count++;
  rateLimitMap.set(sessionId, sessionData);

  // Allow max 20 requests per minute
  if (sessionData.count > 20) {
    return { allowed: false, error: 'Rate limit exceeded. Please wait before sending more messages.' };
  }

  return { allowed: true };
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, language = 'en' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Validate and sanitize input
    const validation = validateAndSanitizeInput(message);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check rate limiting
    const convKey = sessionId || 'default';
    const rateCheck = checkRateLimit(convKey);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.error });
    }

    // Get or create conversation history
    if (!conversations.has(convKey)) {
      conversations.set(convKey, []);
    }
    const history = conversations.get(convKey);

    // Add sanitized user message to history
    history.push({ role: 'user', content: validation.sanitized });

    // Keep only last 10 messages to manage context window
    const recentHistory = history.slice(-10);

    // Select system prompt based on language
    const systemPrompt = language === 'fr' ? systemPromptFR : systemPromptEN;

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: recentHistory,
    });

    const assistantMessage = response.content[0].text;

    // Add assistant response to history
    history.push({ role: 'assistant', content: assistantMessage });

    res.json({
      message: assistantMessage,
      sessionId: convKey,
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to get response',
      details: error.message,
    });
  }
});

// Fit assessment endpoint
app.post('/api/fit-assessment', async (req, res) => {
  try {
    const { jobDescription, language = 'en' } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description is required' });
    }

    const userPrompt = language === 'fr'
      ? `Analysez cette offre d'emploi et évaluez l'adéquation pour Christophe Verdier. Répondez en français.\n\nOffre d'emploi:\n${jobDescription}`
      : `Analyze this job posting and assess the fit for Christophe Verdier. Respond in English.\n\nJob posting:\n${jobDescription}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: fitAssessmentPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = response.content[0].text;

    // Try to parse JSON from response
    let assessment;
    try {
      // Extract JSON from response (Claude might wrap it in markdown)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        assessment = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      // If parsing fails, create a structured response from text
      assessment = {
        fit: 'unknown',
        title: '🔍 Analysis Complete',
        summary: responseText.slice(0, 200),
        alignments: [],
        gaps: [],
        recommendation: 'Please review the detailed analysis above.',
      };
    }

    res.json(assessment);

  } catch (error) {
    console.error('Fit assessment error:', error);
    res.status(500).json({
      error: 'Failed to analyze fit',
      details: error.message,
    });
  }
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    pageViews: pageViews,
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  // Determine the source of the API key for diagnostics
  let keySource = 'not configured';
  if (fs.existsSync('/run/secrets/anthropic_api_key')) {
    keySource = 'docker secret';
  } else if (process.env.ANTHROPIC_API_KEY) {
    keySource = 'environment variable';
  }

  res.json({
    status: 'ok',
    hasApiKey: !!apiKey,
    keySource: keySource,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  // Determine where the API key was loaded from
  let keyInfo = 'No';
  if (fs.existsSync('/run/secrets/anthropic_api_key')) {
    keyInfo = apiKey ? 'Yes (from Docker secret)' : 'No - Docker secret file exists but is empty';
  } else if (process.env.ANTHROPIC_API_KEY) {
    keyInfo = 'Yes (from .env file)';
  } else {
    keyInfo = 'No - please set ANTHROPIC_API_KEY in .env or Docker secret';
  }

  console.log(`📝 API Key configured: ${keyInfo}`);
});
