# Christophe Verdier - AI Portfolio Site

## The Next Generation of Resumes

An interactive portfolio website powered by Claude AI that transforms how professionals showcase their experience. Move beyond static resumes to interactive, conversational exploration that's impossible to fake and demonstrates real depth.

**🌐 [Live Demo →](https://portfolio.sponge-theory.dev)** - See it in action!

**💡 Inspired by:** [Nate B. Jones](https://natebjones.com) - Pioneer of AI-powered professional portfolios

**📖 Read the full concept:** See `BLOG.md` for the philosophy, psychology, and technical implementation behind this approach.

**💼 Want your own?** Contact us at contact@sponge-theory.ai for professional implementation.

**📦 GitHub Repository:** [github.com/ezeeFlop/christophe-portfolio-ai](https://github.com/ezeeFlop/christophe-portfolio-ai/)

## 🚀 Features

- **AI Chat**: Real-time conversations about your experience powered by Claude
- **Fit Assessment Tool**: Paste a job description, get an honest AI analysis of fit
- **Bilingual Support**: English/French toggle
- **Expandable AI Context**: Deep-dive into each role with structured context
- **Skills Matrix**: Honest assessment of strong areas, moderate skills, and growth areas

## 📋 Prerequisites

- Node.js 18+
- An Anthropic API key (get one at https://console.anthropic.com/)

## 🛠️ Installation

1. **Clone or download this folder**

2. **Install dependencies**
   ```bash
   cd christophe-portfolio-ai
   npm install
   ```

3. **Configure your API key**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open in browser**
   Navigate to http://localhost:3000

## 🌐 Deployment Options

### Option 1: Portainer (Recommended for Production)
**Automated build, push, and deployment with Portainer integration**

1. Set up your registry and Portainer webhook:
   ```bash
   export REGISTRY="registry.sponge-theory.dev"
   export PORTAINER_WEBHOOK="https://portainer.example.com/api/stacks/webhooks/xxx"
   ```
2. Deploy with one command:
   ```bash
   ./deploy-portainer.sh
   ```

**Features:**
- Automated Docker build and registry push
- Webhook-triggered deployment
- Traefik integration for automatic SSL
- CI/CD ready (GitHub Actions, GitLab CI)
- Rolling updates with zero downtime
- Load balancing across 2+ replicas

📖 **See [PORTAINER.md](PORTAINER.md) for complete Portainer deployment guide**

### Option 2: Docker Swarm (Alternative Production)
**Full orchestration with load balancing, health checks, and zero-downtime updates**

1. Clone the repo and add your API key to `.env`
2. Run the deployment script:
   ```bash
   ./deploy.sh init    # Initialize Swarm and secrets
   ./deploy.sh deploy  # Build and deploy
   ```
3. Access at http://localhost:3000

**Features:**
- Automatic load balancing across 2+ replicas
- Rolling updates with zero downtime
- Health checks and auto-restart
- Secure secrets management
- Resource limits and scaling

📖 **See [DOCKER.md](DOCKER.md) for complete Docker deployment guide**

### Option 3: Railway (Free tier available)
1. Push to GitHub
2. Connect to Railway
3. Add `ANTHROPIC_API_KEY` as environment variable
4. Deploy!

### Option 4: Render
1. Push to GitHub
2. Create new Web Service on Render
3. Add environment variable
4. Deploy

### Option 5: Vercel (with serverless functions)
Requires restructuring to use Vercel's serverless functions format.

### Option 6: VPS (DigitalOcean, Linode, etc.)
1. SSH into your server
2. Clone the repo
3. Install Node.js
4. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start server.js --name portfolio
   ```

## 📁 Project Structure

```
christophe-portfolio-ai/
├── server.js           # Express backend with Claude API integration
├── system-prompt.js    # AI context with full resume details
├── package.json        # Dependencies
├── .env.example        # Environment variable template
├── public/
│   └── index.html      # React frontend (single-file)
└── README.md           # This file
```

## 🔧 Customization

### Updating Your Resume Content
Edit `system-prompt.js` to update:
- Professional experience details
- Technical skills
- Project descriptions
- Contact information

### Modifying the Frontend
Edit `public/index.html` to change:
- Visual design (Tailwind CSS classes)
- Experience cards
- Skills categories
- Translations

### Changing LLM Model
In `server.js`, modify the model parameter:
```javascript
model: 'claude-sonnet-4-20250514',  // or 'claude-opus-4-20250514' for more depth
```

## 💰 Cost Considerations

- Claude Sonnet: ~$3 per million input tokens, ~$15 per million output tokens
- Average conversation: ~1000 tokens = ~$0.003
- Fit assessment: ~2000 tokens = ~$0.006
- **Estimated monthly cost**: $5-20 for moderate traffic

## 🔒 Security Notes

- API key is kept server-side, never exposed to browsers
- CORS is enabled for same-origin requests
- Consider adding rate limiting for production:
  ```bash
  npm install express-rate-limit
  ```

## 📞 Support

For questions about this template, contact:
- Email: christophe.verdier@sponge-theory.ai
- LinkedIn: linkedin.com/in/cverdier
- Website: sponge-theory.ai
