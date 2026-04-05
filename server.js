const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;

// Email configuration
const EMAIL_TO = 'lawrence44r@gmail.com';
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Security headers with CDN allowances
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));

// Rate limiting for contact form - 5 submissions per IP per 15 minutes
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many submissions. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsers
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// SEO: Cache static assets aggressively, HTML short-cache for freshness
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    // HTML files get short cache for SEO freshness
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    }
    // Images get long cache
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  }
}));

// SEO: Preload critical resources via Link header
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    res.setHeader('Link', [
      '<https://fonts.googleapis.com>; rel=preconnect',
      '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
      '<https://unpkg.com>; rel=preconnect',
      '</nyc-night.jpg>; rel=preload; as=image'
    ].join(', '));
  }
  next();
});

// Sanitize string input
function sanitize(val) {
  if (typeof val !== 'string') return '';
  return validator.escape(validator.trim(val)).substring(0, 1000);
}

// Validate contact form submission
function validateContact(data) {
  const errors = [];
  if (!data.name || !data.name.trim()) errors.push('Name is required');
  if (!data.email || !validator.isEmail(data.email)) errors.push('Valid email is required');
  if (!data.message || data.message.trim().length < 10) errors.push('Message must be at least 10 characters');
  return errors;
}

// Contact form endpoint
app.post('/contact', contactLimiter, async (req, res) => {
  try {
    const data = req.body;
    const errors = validateContact(data);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('. ') });
    }

    const clean = {};
    for (const key of Object.keys(data)) {
      clean[key] = sanitize(data[key]);
    }

    console.log(`[${new Date().toISOString()}] Contact inquiry from: ${clean.name} (${clean.email})`);
    res.json({ success: true, message: 'Thank you! We\'ll respond within 24 hours.' });

    // Send email notification (non-blocking)
    sendContactEmail(clean);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error processing contact:`, err.message);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

async function sendContactEmail(clean) {
  const html = `
    <h2 style="color:#0A1428;">New Website Inquiry — Laurel Shield</h2>
    <p>Received on <strong>${new Date().toLocaleString('en-CA')}</strong></p>
    <table style="border-collapse:collapse;width:100%;max-width:600px;">
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;width:140px;">Name</td><td style="padding:8px;border:1px solid #ddd;">${clean.name}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Email</td><td style="padding:8px;border:1px solid #ddd;">${clean.email}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Company</td><td style="padding:8px;border:1px solid #ddd;">${clean.company || 'N/A'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Phone</td><td style="padding:8px;border:1px solid #ddd;">${clean.phone || 'N/A'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Service Interest</td><td style="padding:8px;border:1px solid #ddd;">${clean.service || 'N/A'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Urgency</td><td style="padding:8px;border:1px solid #ddd;">${clean.urgency || 'N/A'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Message</td><td style="padding:8px;border:1px solid #ddd;">${clean.message}</td></tr>
    </table>
    <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;">
    <p style="color:#999;font-size:12px;">Laurel Shield website contact form</p>
  `;

  if (!resend) {
    console.log(`[${new Date().toISOString()}] Email skipped (no RESEND_API_KEY configured)`);
    return;
  }
  try {
    await resend.emails.send({
      from: 'Laurel Shield <onboarding@resend.dev>',
      to: EMAIL_TO,
      subject: `New Inquiry: ${clean.name} — ${clean.service || 'General'}`,
      html,
    });
    console.log(`[${new Date().toISOString()}] Email notification sent for: ${clean.name}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send email:`, err.message);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// 404 catch-all
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`=== Laurel Shield Website ===`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Started: ${new Date().toISOString()}`);
});
