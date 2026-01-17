# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered portfolio website that allows potential employers/clients to explore professional experience through Claude AI-powered conversations and job fit assessments. It's a single-page application with a Node.js backend serving a React frontend.

**The Next Generation of Resumes**: This portfolio represents a paradigm shift from static resumes to interactive, conversational professional presentation. Instead of keyword matching and 6-second scans, it enables deep exploration through AI-powered conversations.

**For the full concept and philosophy**, see `BLOG.md` which explains why this approach works, the psychology behind it, and how it changes the hiring dynamic.

## Development Commands

```bash
# Install dependencies
npm install

# Start the development server (also used for production)
npm start
# or
npm run dev

# Server runs on http://localhost:3000
```

## Environment Setup

The application requires an Anthropic API key. Create a `.env` file with:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3000  # Optional, defaults to 3000
```

## Architecture

### Three-Tier Structure

1. **Backend (server.js)**: Express server with two main API endpoints
   - `/api/chat` - Conversational AI interface with session history (last 10 messages)
   - `/api/fit-assessment` - Job description analysis with structured JSON output
   - Both use Claude Sonnet 4 (`claude-sonnet-4-20250514`) as the LLM

2. **System Prompts (system-prompt.js)**: Contains the AI's knowledge base
   - `systemPromptEN` / `systemPromptFR` - Full professional context in both languages
   - `fitAssessmentPrompt` - Structured prompt for job fit evaluation
   - This is where the resume content, project details, and response guidelines live

3. **Frontend (public/index.html)**: Single-file React app (no build step)
   - Uses CDN-loaded React, Tailwind CSS, and Babel for in-browser JSX compilation
   - Contains all UI components, translations, experience data with expandable "AI context", and skills matrices
   - Communicates with backend via fetch API

### Key Design Decisions

- **In-memory conversation storage**: Uses a Map in server.js (line 23). In production, this should be replaced with Redis or similar for persistence and scalability.
- **Context window management**: Keeps only last 10 messages per session (line 45) to manage token costs and stay within model limits.
- **Bilingual by design**: All content exists in EN/FR variants. The frontend switches translations client-side; the backend receives language preference and selects appropriate system prompt.
- **No build process**: Frontend uses CDN dependencies and in-browser JSX transformation for maximum simplicity and portability.

## Customization Guide

### Updating Resume Content
Edit `system-prompt.js`:
- Lines 4-96: English system prompt with profile, experience, skills, response guidelines
- Lines 98-181: French system prompt (parallel structure)
- Lines 184-214: Fit assessment prompt with strong/moderate/weak fit criteria

### Modifying Frontend Content
Edit `public/index.html`:
- Lines 53-110: Translations object for UI text
- Lines 113-292: Experience data with expandable AI context sections
- Lines 295-338: Skills categorized as strong/moderate/gaps

### Changing the LLM Model
In `server.js`, modify lines 52 and 91:
```javascript
model: 'claude-sonnet-4-20250514',  // Can use 'claude-opus-4-20250514' for more depth
```
Note: Opus provides higher quality but costs ~5x more.

## API Endpoints

### POST /api/chat
Request:
```json
{
  "message": "string",
  "sessionId": "string (optional)",
  "language": "en | fr (default: en)"
}
```
Response:
```json
{
  "message": "string (AI response)",
  "sessionId": "string"
}
```

### POST /api/fit-assessment
Request:
```json
{
  "jobDescription": "string",
  "language": "en | fr (default: en)"
}
```
Response:
```json
{
  "fit": "strong | moderate | weak",
  "title": "string",
  "summary": "string",
  "alignments": ["string array"],
  "gaps": ["string array"],
  "recommendation": "string"
}
```

### GET /api/health
Health check endpoint. Returns:
```json
{
  "status": "ok",
  "hasApiKey": boolean
}
```

## Important Patterns

### JSON Extraction for Fit Assessment
The fit assessment endpoint (server.js:100-108) uses regex to extract JSON from Claude's response, which may be wrapped in markdown code blocks. This is a common pattern when working with LLMs that sometimes add formatting around structured output.

### Session Management
Sessions are identified by a client-generated ID. The frontend generates a random session ID on mount and includes it in all chat requests. This enables conversation continuity within a browser session.

### Error Handling
Both API endpoints catch errors and return structured error responses. The frontend displays connection errors gracefully and prompts users to check if the server is running.

### Markdown Rendering in Chat
AI responses are rendered using the marked.js library to properly display markdown formatting (lists, code blocks, links, etc.). User messages remain plain text. The `MarkdownContent` component handles safe HTML rendering with GitHub Flavored Markdown support.

### Chat Modal UX
The chat modal can be closed via:
- Clicking the X button in the header
- Clicking outside the modal (backdrop click)
- Pressing the Escape key
The modal stops event propagation on the content area to prevent accidental closure when clicking inside.

### Security and Jailbreak Protection
The application implements multiple layers of security to prevent unauthorized usage and jailbreak attempts:

**Backend Protection (server.js)**:
- **Input Validation**: Maximum 2000 characters, sanitization of special characters
- **Jailbreak Pattern Detection**: Regex patterns detect common jailbreak attempts like "ignore previous instructions", "new role", "pretend to be", "DAN mode", etc.
- **Rate Limiting**: Maximum 20 requests per minute per session to prevent abuse
- **Sanitized History**: Only validated and sanitized messages are stored in conversation history

**Frontend Protection (index.html)**:
- **Client-side Validation**: Immediate feedback before API calls
- **Pattern Detection**: Checks for suspicious patterns and provides user-friendly error messages
- **Character Limit**: Enforced before sending to backend

**System Prompt Hardening (system-prompt.js)**:
- **Explicit Boundaries**: Clear instructions that cannot be overridden
- **Role Enforcement**: System prompt explicitly states it will not accept new instructions or role changes
- **Redirect Instructions**: Provides specific response when users attempt jailbreaks
- **Bilingual Protection**: Both EN and FR prompts include security boundaries

If a jailbreak attempt is detected, the system returns a polite error message asking the user to rephrase their question about professional experience.

## SEO and Accessibility Features

The site implements comprehensive SEO best practices:

### Meta Tags
- Complete Open Graph tags for social media sharing (Facebook, LinkedIn)
- Twitter Card tags for rich Twitter previews
- Proper meta description, keywords, and author tags
- Theme color and language indicators
- Canonical URL to prevent duplicate content issues

### Structured Data
- JSON-LD Person schema for Christophe Verdier with complete professional info
- JSON-LD ProfessionalService schema for Sponge Theory
- Enhances search engine understanding and enables rich snippets

### SEO Files
- **robots.txt** (`public/robots.txt`) - Allows all crawlers, references sitemap
- **sitemap.xml** (`public/sitemap.xml`) - XML sitemap with hreflang alternatives
- **site.webmanifest** (`public/site.webmanifest`) - PWA manifest for mobile

### Semantic HTML & Accessibility
- Proper semantic tags: `<header>`, `<main>`, `<nav>`, `<footer>`, `<section>`
- ARIA labels and roles throughout (especially in chat modal)
- `rel="noopener noreferrer"` on external links for security
- Alternative language tags (hreflang) for bilingual support
- `<noscript>` fallback for users without JavaScript
- Accessible form with proper labels and autocomplete

### Performance
- Preconnect tags to CDNs for faster resource loading
- Optimized font loading with `display=swap`

**Note:** Update the canonical URL, Open Graph URLs, and sitemap URLs from `https://christophe-verdier.com/` to your actual domain before deployment. Also add actual favicon files (favicon-32x32.png, favicon-16x16.png, apple-touch-icon.png, android-chrome icons) to the `public/` directory.

## Deployment Notes

The application is deployment-ready for multiple platforms:

### Portainer (Recommended for Production)
Complete Portainer integration with automated build and deployment:
- **See PORTAINER.md** for comprehensive Portainer deployment guide
- Automated build script (`deploy-portainer.sh`) with registry push
- Webhook-based deployment for CI/CD integration
- Traefik integration for automatic SSL
- Features: rolling updates, health checks, load balancing, secrets management
- Quick start: `./deploy-portainer.sh`

### Docker Swarm (Alternative Production Option)
Complete Docker setup with orchestration is available:
- **See DOCKER.md** for comprehensive deployment guide
- Includes Dockerfile, docker-compose.yml for Swarm mode
- Automated deployment script (`deploy.sh`) for easy management
- Features: rolling updates, health checks, load balancing, secrets management
- Quick start: `./deploy.sh init && ./deploy.sh deploy`

### Traditional Platforms (Railway, Render, VPS)
- Set `ANTHROPIC_API_KEY` as an environment variable
- The `PORT` environment variable is respected (common for PaaS platforms)
- No build step required - just `npm install && npm start`

### Production Recommendations
- Use Redis for session storage instead of in-memory Map
- Consider adding express-rate-limit middleware (rate limiting is built-in but can be enhanced)
- Enable HTTPS with reverse proxy or platform SSL
- **Update SEO URLs**: Replace placeholder domain in meta tags, sitemap, and structured data with your actual domain
