# Laurel Shield — Design & Operations Guide

> **Version:** 1.0  
> **Last Updated:** April 5, 2026  
> **Author:** Lawrence Okonkwo  
> **Project:** Cybersec-by-Laurel (Laurel Shield Website)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [File Structure](#3-file-structure)
4. [Technology Stack](#4-technology-stack)
5. [Environment Setup & Local Development](#5-environment-setup--local-development)
6. [Server Configuration (server.js)](#6-server-configuration-serverjs)
7. [Security Headers & CSP](#7-security-headers--csp)
8. [Contact Form & Email (Resend)](#8-contact-form--email-resend)
9. [Frontend Architecture (index.html)](#9-frontend-architecture-indexhtml)
10. [Design System & CSS Variables](#10-design-system--css-variables)
11. [Hero Animation System](#11-hero-animation-system)
12. [Services WebGL Animation](#12-services-webgl-animation)
13. [Interactive UI Behaviors](#13-interactive-ui-behaviors)
14. [SEO & Structured Data](#14-seo--structured-data)
15. [Deployment on Render](#15-deployment-on-render)
16. [Resend Email Integration](#16-resend-email-integration)
17. [Domain & DNS Configuration](#17-domain--dns-configuration)
18. [Static Pages (404, Privacy, Terms, Disclosure)](#18-static-pages)
19. [Troubleshooting Guide](#19-troubleshooting-guide)
20. [Maintenance & Updates](#20-maintenance--updates)
21. [Security Operations Checklist](#21-security-operations-checklist)

---

## 1. Project Overview

**Laurel Shield** is a premium cybersecurity consulting website for a firm with offices in **Calgary, Alberta, Canada** and **Philadelphia, Pennsylvania, USA**. The site serves as the primary marketing and lead-generation tool.

**Services offered:**
- Penetration Testing (web, mobile, API, network, cloud)
- Compliance Auditing (SOC 2, HIPAA, ISO 27001, PCI DSS, CMMC 2.0, NIST CSF, GDPR)
- AI Security Consulting (LLM security, prompt injection defense, AI governance)
- Managed SOC (24/7 threat detection and incident response)
- Virtual CISO (vCISO) services
- Cloud Security Assessments (AWS, Azure, GCP)

**Contact info (configured in JSON-LD):**
- Phone: +1 (403) 966-8833, +1 (267) 882-2044
- Email: contact@laurelshield.com
- Form submissions sent to: lawrence44r@gmail.com

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│                   BROWSER                       │
│  index.html (single-page, all CSS/JS inline)    │
│  ├── Hero Canvas Animation (NYC night scene)    │
│  ├── WebGL Three.js particle network            │
│  ├── Contact Form (client-side validation)       │
│  └── Lucide Icons (CDN), Google Fonts (CDN)     │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────┐
│              Render.com (hosting)                 │
│  ┌──────────────────────────────────────────┐   │
│  │           Express.js v5 (server.js)       │   │
│  │  ├── Helmet (security headers + CSP)      │   │
│  │  ├── express.static → /public/            │   │
│  │  ├── POST /contact (rate-limited)         │   │
│  │  ├── GET /health                          │   │
│  │  └── 404 catch-all → 404.html             │   │
│  └──────────────────┬───────────────────────┘   │
└─────────────────────┼───────────────────────────┘
                      │ API call (non-blocking)
┌─────────────────────▼───────────────────────────┐
│              Resend (email service)               │
│  Sends HTML email to lawrence44r@gmail.com        │
│  From: Laurel Shield <onboarding@resend.dev>      │
└──────────────────────────────────────────────────┘
```

**Key design decisions:**
- **Single-page HTML** with all CSS and JavaScript inline — no build step, no bundler, no framework
- **Express v5** server for static file serving, contact form handling, and security headers
- **No database** — the contact form sends email via Resend API, no data is stored server-side
- **CDN dependencies** — Google Fonts (Inter, JetBrains Mono) and Lucide Icons loaded from CDN

---

## 3. File Structure

```
Cybersec-by-Laurel/
├── server.js                    # Express.js application server
├── package.json                 # Dependencies and npm scripts
├── package-lock.json            # Locked dependency versions
├── .gitignore                   # Ignores node_modules/ and .env
├── .env                         # Environment variables (NOT in git)
├── OPERATIONS-GUIDE.md          # This file
├── Pictures for Animation/      # Source images (not served)
│   └── NYC-Night-featured-2.jpg # Original NYC photo
├── node_modules/                # npm dependencies (not in git)
└── public/                      # Static files served by Express
    ├── index.html               # Main website (~137KB, single-page)
    ├── nyc-night.jpg            # NYC skyline photo for hero animation (~190KB)
    ├── 404.html                 # Custom 404 error page
    ├── privacy-policy.html      # Privacy policy page
    ├── terms.html               # Terms of service page
    ├── responsible-disclosure.html # Security vulnerability disclosure policy
    ├── robots.txt               # Search engine crawling rules
    └── sitemap.xml              # XML sitemap for SEO
```

---

## 4. Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 18+ recommended |
| Web Framework | Express.js | ^5.2.1 |
| Security Headers | Helmet | ^8.1.0 |
| Rate Limiting | express-rate-limit | ^8.3.2 |
| Email Service | Resend | ^6.10.0 |
| Input Validation | validator.js | ^13.15.35 |
| Fonts | Google Fonts (Inter, JetBrains Mono) | CDN |
| Icons | Lucide Icons | CDN (unpkg.com) |
| 3D Graphics | Three.js | CDN (unpkg.com) |
| Module System | CommonJS | `"type": "commonjs"` |

---

## 5. Environment Setup & Local Development

### Prerequisites
- **Node.js** v18 or later
- **npm** (comes with Node.js)
- A terminal (Git Bash, PowerShell, or WSL on Windows)

### First-Time Setup

```bash
# Clone or navigate to the project
cd "C:\Users\lawre\Documents\Claude Projects\Cybersec-by-Laurel"

# Install dependencies
npm install

# Create environment file (for email functionality)
echo "RESEND_API_KEY=re_your_api_key_here" > .env
```

### Running Locally

```bash
npm start
```

This runs `node server.js` and starts the server on **http://localhost:3000**.

Console output on successful start:
```
=== Laurel Shield Website ===
Server running at http://localhost:3000
Started: 2026-04-05T00:37:51.946Z
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `RESEND_API_KEY` | No* | Resend API key for email delivery |

*If `RESEND_API_KEY` is not set, the contact form still works (returns success to the user), but emails are **not sent**. The server logs: `Email skipped (no RESEND_API_KEY configured)`.

### Stopping the Server

Press `Ctrl+C` in the terminal, or kill the Node.js process.

---

## 6. Server Configuration (server.js)

The entire backend is a single 131-line Express.js application.

### Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/*` (static) | Serves files from `public/` directory |
| POST | `/contact` | Contact form submission (rate-limited) |
| GET | `/health` | Health check endpoint (returns `{ status: 'ok', uptime: N }`) |
| GET | `*` (404) | Catch-all serves `public/404.html` |

### Request Processing

1. **Body parsing**: JSON and URL-encoded, limited to **100KB** max
2. **Static serving**: `express.static` serves everything in `public/`
3. **Contact form** (`POST /contact`):
   - Rate-limited: **5 requests per IP per 15 minutes**
   - Validates: name (required), email (valid format), message (10+ chars)
   - Sanitizes all input with `validator.escape()` and `validator.trim()`
   - Truncates all fields to 1000 characters max
   - Returns JSON response immediately
   - Sends email notification asynchronously (non-blocking)

### Key Code Locations in server.js

| Line Range | Function |
|-----------|----------|
| 1-6 | Module imports |
| 9 | PORT configuration |
| 12-13 | Email configuration (recipient, Resend client) |
| 16-27 | Helmet security headers and CSP |
| 30-36 | Rate limiter configuration |
| 39-41 | Body parsers and static file serving |
| 44-47 | `sanitize()` function |
| 50-56 | `validateContact()` function |
| 59-81 | `POST /contact` route handler |
| 83-115 | `sendContactEmail()` async function |
| 118-120 | `/health` endpoint |
| 123-125 | 404 catch-all |
| 127-131 | Server startup |

---

## 7. Security Headers & CSP

Helmet is configured with a Content Security Policy (CSP) that allows specific CDN sources:

```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    connectSrc: ["'self'"],
  },
}
```

**Why `'unsafe-inline'`**: All CSS and JS are inline in the HTML file. Without `'unsafe-inline'`, the entire page would break. This is an acceptable trade-off for a site with no user-generated content.

**Additional Helmet headers** (enabled by default):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN` (via `frameguard`)
- `Strict-Transport-Security` (HSTS)
- `X-XSS-Protection` (legacy browsers)
- `Referrer-Policy: no-referrer`
- `X-DNS-Prefetch-Control: off`
- `X-Permitted-Cross-Domain-Policies: none`

---

## 8. Contact Form & Email (Resend)

### Form Fields (HTML)

| Field | Name | Required | Validation |
|-------|------|----------|------------|
| Full Name | `name` | Yes | Non-empty string |
| Email Address | `email` | Yes | Valid email format |
| Company | `company` | No | — |
| Phone | `phone` | No | — |
| Service Interest | `service` | No | Dropdown select |
| Urgency | `urgency` | No | Dropdown select |
| Message | `message` | Yes | Minimum 10 characters |

### Client-Side Behavior

- Fields are validated in real-time via `checkFormComplete()` JavaScript function
- When all required fields are filled, the submit button gets the `.form-valid` CSS class
- **Button states:**
  - Default: Purple background (`#A855F7`), white text
  - Hover (incomplete form): Purple with glow
  - Hover (complete form): Green background (`#22C55E`), black text
- On submit, JavaScript prevents default, sends `fetch('POST', '/contact')`, and displays success/error message inline

### Server-Side Processing

1. Rate limit check (5/15min per IP)
2. Validate required fields
3. Sanitize all inputs (HTML escape + trim + truncate)
4. Log to console: `Contact inquiry from: Name (email)`
5. Return success JSON immediately
6. Async: Send email via Resend (does not block response)

### Email Template

The email is sent as HTML with a formatted table containing all form fields. It's sent:
- **From:** `Laurel Shield <onboarding@resend.dev>`
- **To:** `lawrence44r@gmail.com`
- **Subject:** `New Inquiry: {name} — {service or 'General'}`

**Note on "from" address:** When using Resend's free tier or before verifying a custom domain, emails must be sent from `onboarding@resend.dev`. After verifying `laurelshield.com` in Resend, update the `from` field to use your domain (e.g., `noreply@laurelshield.com`).

---

## 9. Frontend Architecture (index.html)

The entire website is a single HTML file (~137KB) with all CSS and JavaScript inline. There is no build step.

### Page Sections (in order)

| Section | ID/Selector | Description |
|---------|-------------|-------------|
| Skip Link | `.skip-link` | Accessibility: skip to main content |
| Navigation | `<nav>` | Fixed top bar with logo, links, and CTA buttons |
| Trust Bar | `.trust-bar` | Scrolling certification badges (CISSP, SOC 2, MAESTRO AI, etc.) |
| Hero | `#hero` | Full-viewport hero with canvas animation background |
| Services | `#services` | Service cards with Three.js WebGL particle background |
| Industries | `#industries` | Industry vertical cards |
| Solutions | `#solutions` | Pricing tiers (Essentials, Growth, Comprehensive, HIPAA Shield) |
| AI Security | `#ai-security` | AI/LLM security services section |
| Compliance | `#compliance` | Framework mastery section |
| Why Us | `#why-us` | Differentiators with icon cards |
| Assessment | `#assessment` | Free assessment CTA |
| Testimonials | `#testimonials` | Client testimonials carousel |
| Resources | `#resources` | Blog post cards |
| Contact | `#contact` | Contact form |
| Footer | `<footer>` | Links, contact info, newsletter |

### Navigation Links

Services, Industries, Solutions, AI Security, Compliance, Why Us, Assessment, Resources

**Hover behavior:** Links change from black to bright white with a 3px solid `#FF4500` bottom border.

### Key CSS Line References in index.html

| Line Range | Purpose |
|-----------|---------|
| ~161-194 | CSS reset, `:root` custom properties |
| ~196-270 | Base styles, buttons, link styles |
| ~270-400 | Navigation, trust bar, responsive nav |
| ~400-520 | Hero section styles |
| ~520-700 | Service cards, solution cards, industry cards |
| ~700-800 | Contact form layout, form fields |
| ~800-870 | Footer, responsive breakpoints |
| ~877-889 | Navbar SVG logo |
| ~925-960 | Trust bar certification items |

---

## 10. Design System & CSS Variables

All design tokens are defined as CSS custom properties on `:root`:

### Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg-primary` | `#000000` | Page background |
| `--bg-secondary` | `#0A0A0A` | Section alternate background |
| `--bg-card` | `#111111` | Card background |
| `--bg-card-hover` | `#1A1A1A` | Card hover state |
| `--accent-orange` | `#FF4500` | Primary brand color |
| `--accent-orange-dim` | `rgba(255,69,0,0.15)` | Subtle orange tint |
| `--accent-blue` | `#FF6A33` | Secondary accent (actually lighter orange) |
| `--accent-purple` | `#A855F7` | AI/tech accent, buttons |
| `--accent-red` | `#FF4D6A` | Alert/emphasis |
| `--accent-yellow` | `#FBBF24` | Badges, stars |
| `--text-primary` | `#FFFFFF` | Headings, primary text |
| `--text-secondary` | `#B0B0B0` | Body text, descriptions |
| `--text-muted` | `#707070` | Subtle text |
| `--border-color` | `rgba(255,255,255,0.06)` | Card borders |
| `--border-glow` | `rgba(255,69,0,0.4)` | Hover glow borders |

### Typography

| Variable | Value | Usage |
|----------|-------|-------|
| `--font-sans` | `'Inter', system-ui, -apple-system, sans-serif` | All body text |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` | Code, technical elements |

### Layout

| Variable | Value | Usage |
|----------|-------|-------|
| `--max-width` | `1200px` | Container max width |
| `--nav-height` | `72px` | Fixed navbar height |

### Animation Timing

| Variable | Value |
|----------|-------|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--transition-fast` | `150ms` |
| `--transition-base` | `300ms` |
| `--transition-slow` | `500ms` |

### Title Styling Convention

- **Section titles** use gradient text: `linear-gradient(135deg, white, orange, pink)` with `-webkit-background-clip: text`
- Many titles have **inline style overrides** forcing `-webkit-text-fill-color: #FFFFFF` to make them solid bright white
- **Section subtitles** are typically `color: #FF4500` (set via inline styles)

---

## 11. Hero Animation System

The hero section has a full-viewport HTML5 Canvas animation located at the bottom of `index.html` (line ~2280+).

### Overview

- **Background:** NYC night skyline photo (`/nyc-night.jpg`)
- **Overlay effects:** Vehicle headlights (white) and taillights (red) with glow, window shimmer, cinematic vignette
- **Motion:** Slow cinematic pan drift, vehicle lights moving horizontally

### Technical Details

```
Canvas: #hero-canvas (positioned absolute behind hero content)
Resolution: Limited to 2x device pixel ratio for performance
Render loop: requestAnimationFrame
```

### Animation Components

1. **NYC Image** — Cover-fit scaling using natural dimensions, with slow sinusoidal pan:
   - Horizontal: `Math.sin(t * 0.00003) * width * 0.008`
   - Vertical: `Math.cos(t * 0.000025) * height * 0.005`

2. **Vehicle Lights** (90 objects):
   - 65% headlights (bright white radial gradients, horizontal beam streaks)
   - 35% taillights (red radial gradients)
   - Each has: position (x, y), velocity (vx), brightness, size, type
   - Movement wraps around screen edges

3. **Window Shimmer** (40 deterministic points):
   - Uses seed-based positioning for consistency
   - Subtle flickering via `sin(t * 0.0015 + offset)`

4. **Compositing**: `globalCompositeOperation: 'lighter'` for additive light bloom

5. **Vignette**: Radial gradient darkening edges for cinematic feel

### Hero Text Contrast

The hero text sits above the canvas with contrast achieved via:
- Dark gradient overlay: `rgba(0,0,0,0.45)` → `rgba(0,0,0,0.65)` → `rgba(0,0,0,0.85)`
- Text shadow on title: `0 0 20px rgba(255,69,0,0.4), 0 2px 4px rgba(0,0,0,0.5)`
- Text shadow on subtitle: `0 1px 6px rgba(0,0,0,0.6)`

### Image Asset

| File | Path | Size | Description |
|------|------|------|-------------|
| nyc-night.jpg | `public/nyc-night.jpg` | ~190KB | NYC nighttime skyline photo |
| Source | `Pictures for Animation/NYC-Night-featured-2.jpg` | — | Original source file |

---

## 12. Services WebGL Animation

The Services section (`#services`) has a Three.js WebGL particle network animation.

### How It Works

- Creates a Three.js scene with particles and connecting lines
- Particles are colored (orange-tinted palette matching the brand)
- Lines connect nearby particles with distance-based alpha falloff
- Camera orbits slowly and follows mouse position
- Uses `IntersectionObserver` to pause animation when not visible (performance optimization)

### Key Parameters

- Particle count, connection distance, and max lines defined at top of the IIFE
- Ambient geometry objects rotate slowly for depth
- Three.js loaded from CDN: `https://unpkg.com/three@latest/build/three.module.js`

---

## 13. Interactive UI Behaviors

### Scroll Reveal Animations

Elements with the `.reveal` class animate in when scrolled into view using `IntersectionObserver`:

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
    }
  });
}, { threshold: 0.1 });
```

### Solution Card Price Reveal

Pricing text (`.solution-price`) is hidden by default (`opacity: 0`) and fades in on card hover:

```css
.solution-price { opacity: 0; transition: opacity 0.3s ease; }
.solution-card:hover .solution-price { opacity: 1; }
```

### Navigation Hover Effects

```css
.nav-links a:hover, .nav-links a.active {
  color: #FFFFFF;
  background: transparent;
  border-bottom: 3px solid #FF4500;
  border-radius: 0;
  padding-bottom: 5px;
}
```

### Button Interactions

| Button | Default | Hover |
|--------|---------|-------|
| Get Protected | Orange bg, black text, sharp rectangle | Lighter orange, glow, lift |
| Book Meeting | Orange bg, sharp rectangle (border-radius: 0) | Same with glow |
| Talk to AI Experts | Orange bg | Purple bg (`#A855F7`), white text |
| Send Inquiry | Purple bg, white text | Purple with glow |
| Send Inquiry (form complete) | Purple bg, white text | Green bg (`#22C55E`), black text |

### Form Validation Indicator

```javascript
function checkFormComplete() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const message = document.getElementById('message').value.trim();
  const btn = document.querySelector('.btn-send-inquiry');
  if (name && email && message.length >= 10) {
    btn.classList.add('form-valid');
  } else {
    btn.classList.remove('form-valid');
  }
}
```

### Lucide Icons

Icons are loaded from CDN and initialized:
```html
<script src="https://unpkg.com/lucide@latest"></script>
<script>lucide.createIcons();</script>
```

Use `<i data-lucide="icon-name"></i>` in HTML to place icons.

---

## 14. SEO & Structured Data

### Meta Tags

- **Title:** `Laurel Shield | #1 Cybersecurity Consulting — Penetration Testing, Compliance Audits, AI Security`
- **Description:** 300+ character comprehensive description
- **Keywords:** 90+ keyword terms covering all service areas
- **Canonical:** `https://security.laurelshield.com`
- **Geo tags:** Calgary (CA-AB) and Philadelphia (US-PA)

### Open Graph (Facebook/LinkedIn)

Configured with title, description, type (website), URL, image, and locale.

### Twitter Card

Type: `summary_large_image` with title and description.

### JSON-LD Structured Data (3 schemas)

1. **ProfessionalService** — Organization details, addresses, geo coordinates, area served, service catalog, contact info
2. **WebSite** — For Google sitelinks search box
3. **FAQPage** — 4 Q&A pairs for FAQ rich results

### robots.txt

```
User-agent: *
Allow: /
Disallow: /health
Sitemap: https://security.laurelshield.com/sitemap.xml
```

The `/health` endpoint is excluded from crawling.

### sitemap.xml

Lists 4 pages with priorities:
- `/` — priority 1.0, weekly
- `/privacy-policy.html` — priority 0.3, yearly
- `/terms.html` — priority 0.3, yearly
- `/responsible-disclosure.html` — priority 0.4, yearly

---

## 15. Deployment on Render

### Render Service Configuration

| Setting | Value |
|---------|-------|
| **Service Type** | Web Service |
| **Environment** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` (runs `node server.js`) |
| **Region** | Choose closest to primary users (US East recommended) |
| **Plan** | Free tier works; Starter ($7/mo) for no cold starts |
| **Health Check Path** | `/health` |
| **Auto-Deploy** | Enabled (deploys on push to connected branch) |

### Setting Up on Render

1. **Create account** at [render.com](https://render.com)
2. **Connect GitHub/GitLab** repository
3. **Create New Web Service**
4. Select the repository and branch (e.g., `main`)
5. Configure:
   - **Name:** `laurel-shield` (or similar)
   - **Root Directory:** leave blank (project root)
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. **Add Environment Variables:**
   - `RESEND_API_KEY` = your Resend API key
   - `PORT` = leave unset (Render provides this automatically)
7. Click **Create Web Service**

### Render Environment Variables

| Variable | Where to Set | Notes |
|----------|-------------|-------|
| `RESEND_API_KEY` | Render Dashboard → Service → Environment | Required for email |
| `PORT` | Auto-set by Render | Do NOT set manually |
| `NODE_ENV` | Optional | Set to `production` for optimizations |

### Render Free Tier Limitations

- Service **spins down after 15 minutes of inactivity**
- First request after sleep takes **~30 seconds** (cold start)
- 750 free hours/month total across all services
- **Workaround for cold starts:** Upgrade to Starter plan ($7/mo) or use an external ping service to keep it warm

### Deploying Updates

1. Push changes to your connected Git branch
2. Render auto-deploys within 1-2 minutes
3. Check deploy logs in Render Dashboard → Service → Events
4. Verify at your live URL

### Manual Deploy

In Render Dashboard → Service → click **Manual Deploy** → **Deploy latest commit**

---

## 16. Resend Email Integration

### What is Resend?

[Resend](https://resend.com) is a developer-friendly email API service. It handles email delivery so you don't need to configure SMTP servers.

### Setup Steps

1. **Create account** at [resend.com](https://resend.com)
2. **Get API Key:**
   - Dashboard → API Keys → Create API Key
   - Name it (e.g., "Laurel Shield Production")
   - Copy the key (starts with `re_`)
   - **Store securely — you cannot view it again**
3. **Add to environment:**
   - Local: Add to `.env` file as `RESEND_API_KEY=re_xxxxx`
   - Render: Add as environment variable in service settings

### API Key Format

```
RESEND_API_KEY=re_123456789abcdef
```

### Free Tier Limits

- **100 emails/day**
- **3,000 emails/month**
- Sender limited to `onboarding@resend.dev`

### Custom Domain Setup (recommended for production)

1. In Resend Dashboard → Domains → Add Domain
2. Enter `laurelshield.com`
3. Add the DNS records Resend provides (MX, TXT for SPF/DKIM)
4. Verify domain
5. Update `server.js` line 106 — change `from` address:
   ```javascript
   from: 'Laurel Shield <noreply@laurelshield.com>',
   ```

### Testing Email Locally

```bash
# Set the API key
export RESEND_API_KEY=re_your_key_here

# Start server
npm start

# Test the contact form
curl -X POST http://localhost:3000/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","message":"This is a test submission from the operations guide."}'
```

Expected response:
```json
{"success": true, "message": "Thank you! We'll respond within 24 hours."}
```

Check your email (lawrence44r@gmail.com) for the notification.

---

## 17. Domain & DNS Configuration

### Expected Domain

The site is configured for: **`security.laurelshield.com`**

All canonical URLs, Open Graph tags, sitemap, and JSON-LD reference this domain.

### DNS Records Needed

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| CNAME | `security` | `your-service.onrender.com` | Points subdomain to Render |

### Adding Custom Domain on Render

1. Render Dashboard → Service → Settings → Custom Domains
2. Add `security.laurelshield.com`
3. Render provides a CNAME target (e.g., `laurel-shield.onrender.com`)
4. Add the CNAME record at your DNS provider
5. Wait for DNS propagation (up to 48 hours, usually minutes)
6. Render auto-provisions an SSL certificate via Let's Encrypt

### If Changing the Domain

Update these files:
- `public/index.html`: canonical URL (line ~29), Open Graph URL (line ~43), JSON-LD URLs
- `public/sitemap.xml`: All `<loc>` entries
- `public/robots.txt`: Sitemap URL

---

## 18. Static Pages

### 404.html

Custom error page with:
- Laurel Shield branding (gradient 404 text, shield icon)
- "Back to Home" and "Contact Us" buttons
- Served automatically by the Express catch-all route for any unmatched URL

### privacy-policy.html

Full privacy policy page (~12KB). Update when data handling practices change.

### terms.html

Terms of service page (~11KB). Update when service terms change.

### responsible-disclosure.html

Security vulnerability disclosure policy (~11KB). Standard for cybersecurity companies. Describes how researchers should report vulnerabilities.

---

## 19. Troubleshooting Guide

### Server Won't Start

**Symptom:** `npm start` fails or hangs

| Check | Command | Fix |
|-------|---------|-----|
| Node.js installed? | `node --version` | Install Node.js 18+ |
| Dependencies installed? | Check `node_modules/` exists | Run `npm install` |
| Port already in use? | Error: `EADDRINUSE` | Kill other process on port 3000, or set `PORT=3001` |
| Missing modules? | `MODULE_NOT_FOUND` error | Delete `node_modules/` and run `npm install` |

```bash
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Kill process on port 3000 (Linux/Mac)
lsof -i :3000
kill -9 <pid>
```

### Contact Form Not Sending Emails

**Symptom:** Form shows success, but no email received

1. **Check console logs** — look for `Email skipped (no RESEND_API_KEY configured)`
   - Fix: Set the `RESEND_API_KEY` environment variable
2. **Check for API errors** — look for `Failed to send email: <message>`
   - `Invalid API key`: Verify your key is correct and active
   - `Rate limit exceeded`: You've hit Resend's daily limit (100/day free)
   - `Sender not verified`: Need to verify domain or use `onboarding@resend.dev`
3. **Check spam folder** — emails from `onboarding@resend.dev` may be flagged
4. **Verify on Resend Dashboard** — Resend → Emails shows delivery status

### Rate Limiting Issues

**Symptom:** Contact form returns "Too many submissions" error

- The rate limiter allows **5 submissions per IP per 15-minute window**
- In development, all requests come from `127.0.0.1` so you'll hit this quickly
- **Fix during development:** Temporarily increase the `max` value in `server.js` line 32
- **Fix on production:** This is working as intended — protects against spam

### Page Not Loading / Blank Screen

1. **Check if server is running:** Visit `http://localhost:3000/health`
2. **Check browser console** for errors (F12 → Console)
3. **CDN issues:** If Lucide icons or fonts don't load, check internet connection
   - The page functions without CDN assets, but icons will be missing
4. **CSP blocking resources:** Check console for `Content-Security-Policy` violations
   - If you added a new external resource, update the CSP in `server.js`

### Animation Not Showing

**Hero animation (NYC night):**
1. Check that `public/nyc-night.jpg` exists (~190KB file)
2. Check browser console for image load errors
3. Canvas element `#hero-canvas` must be present in the HTML

**Services WebGL animation:**
1. Check that Three.js loads from CDN (requires internet)
2. Check browser console for WebGL errors
3. Some older GPUs/browsers don't support WebGL — animation gracefully degrades

### Render Deployment Issues

| Issue | Fix |
|-------|-----|
| Build fails | Check Render deploy logs; usually a dependency issue — ensure `package-lock.json` is committed |
| Cold start slow (~30s) | Normal on free tier; upgrade to Starter plan or use ping service |
| Custom domain not working | Verify DNS CNAME record; check Render domain settings; wait for propagation |
| SSL certificate error | Render auto-provisions Let's Encrypt; ensure domain DNS is pointed correctly |
| Environment variable not applied | Redeploy after adding/changing env vars in Render dashboard |
| 404 on all routes | Check that Build Command is `npm install` and Start Command is `npm start` |

### CSS/Styling Issues

- **Gradient text not working in Firefox:** The `-webkit-background-clip: text` property needs both the `-webkit-` prefix and the standard `background-clip: text`. Many section titles use inline style overrides with `-webkit-text-fill-color` — if these break, check the inline styles.
- **Trust bar not scrolling:** The trust bar uses CSS `@keyframes scrollTrust` — check that the animation property and keyframe definition both exist.
- **Buttons not changing color on hover:** Check CSS specificity — most button hover states use `!important` to override base styles.

---

## 20. Maintenance & Updates

### Updating Content

| What | Where | Notes |
|------|-------|-------|
| Service descriptions | `public/index.html` sections | Search for section ID |
| Pricing | `public/index.html` solution cards | Look for `.solution-card` elements |
| Testimonials | `public/index.html` `#testimonials` | Each card has client name and quote |
| Blog posts | `public/index.html` `#resources` | Search for "BLOG POSTS - EDIT HERE" |
| Contact info | `server.js` (EMAIL_TO), `index.html` (JSON-LD, footer) | Update in all locations |
| Phone numbers | `public/index.html` footer and JSON-LD | `+1 (403) 966-8833`, `+1 (267) 882-2044` |

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all to latest compatible versions
npm update

# For major version updates, update package.json manually then:
npm install
```

**Important:** After updating, test locally before deploying. Express v5 has breaking changes from v4.

### Updating the NYC Image

1. Place new image in `public/` folder (JPEG recommended, keep under 300KB)
2. Update the image path in the hero animation code (`cityImg.src = '/new-image.jpg'`)
3. The animation auto-scales to cover the canvas viewport

### Adding New Pages

1. Create the HTML file in `public/`
2. Express static middleware serves it automatically — no server changes needed
3. Add to `sitemap.xml` with appropriate priority and changefreq
4. Consider adding navigation links in `index.html`

---

## 21. Security Operations Checklist

### Pre-Deployment

- [ ] `.env` file is in `.gitignore` (never commit API keys)
- [ ] `RESEND_API_KEY` is set only in environment variables, not in code
- [ ] Rate limiting is active on `/contact` endpoint
- [ ] Input validation and sanitization are in place
- [ ] CSP headers configured via Helmet
- [ ] No sensitive data in HTML source (no API keys, tokens, or credentials)
- [ ] All external resources loaded over HTTPS

### Regular Checks

- [ ] Run `npm audit` monthly to check for dependency vulnerabilities
- [ ] Review Render deploy logs for errors
- [ ] Check Resend dashboard for email delivery issues
- [ ] Monitor `/health` endpoint uptime
- [ ] Review contact form submissions for spam patterns
- [ ] Keep Node.js runtime updated on Render

### Dependency Security

```bash
# Check for known vulnerabilities
npm audit

# Auto-fix what's possible
npm audit fix

# For breaking changes that can't auto-fix
npm audit fix --force  # Use with caution — may break things
```

### SSL/TLS

- Render handles SSL certificate provisioning and renewal automatically via Let's Encrypt
- All traffic is HTTPS when using a custom domain on Render
- HSTS header is set by Helmet

### Data Handling

- **No data is stored server-side** — form submissions are emailed and logged to stdout
- Render log retention depends on plan (free: 3 days, paid: 30+ days)
- Consider adding a privacy-compliant analytics solution if traffic data is needed

### Incident Response

If the site is compromised or defaced:
1. **Immediately:** Redeploy from last known good Git commit via Render dashboard
2. **Rotate** the Resend API key in Resend dashboard and update on Render
3. **Review** Render deploy logs for unauthorized deployments
4. **Check** Git history for unauthorized commits
5. **Update** all dependencies: `npm audit fix`

---

## Appendix A: Quick Reference Commands

```bash
# Start server locally
npm start

# Install dependencies
npm install

# Check for security vulnerabilities
npm audit

# Test contact form
curl -X POST http://localhost:3000/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","message":"Test message for operations guide"}'

# Check health endpoint
curl http://localhost:3000/health

# Check which process is using port 3000
netstat -ano | findstr :3000
```

## Appendix B: Key URLs

| Resource | URL |
|----------|-----|
| Production site | `https://security.laurelshield.com` |
| Render dashboard | `https://dashboard.render.com` |
| Resend dashboard | `https://resend.com/emails` |
| Resend API keys | `https://resend.com/api-keys` |
| Google Fonts | `https://fonts.googleapis.com` |
| Lucide Icons | `https://lucide.dev/icons/` |
| Three.js docs | `https://threejs.org/docs/` |

## Appendix C: Color Reference

| Color | Hex | Usage |
|-------|-----|-------|
| Brand Orange | `#FF4500` | Primary accent, links, CTAs |
| Dark Orange | `#CC3700` | Gradients, darker brand elements |
| Light Orange | `#FF6A33` | Hover states |
| Purple | `#A855F7` | AI section, special buttons |
| Green | `#22C55E` | Success states, form complete hover |
| Pink/Red | `#FF4D6A` | Gradient accent |
| Yellow | `#FBBF24` | Star ratings, badges |
| Pure Black | `#000000` | Page background |
| Near Black | `#0A0A0A` | Alternate section background |
| Card Dark | `#111111` | Card backgrounds |
| White | `#FFFFFF` | Primary text, headings |
| Light Grey | `#B0B0B0` | Secondary text |
| Dark Grey | `#707070` | Muted text |
