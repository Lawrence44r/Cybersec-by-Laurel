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

// Quiz report email endpoint
const quizLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many requests' } });

app.post('/quiz-report', quizLimiter, async (req, res) => {
  try {
    const { email, category, score, maxScore } = req.body;
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const safeEmail = sanitize(email);
    const safeCat = sanitize(category || 'Unknown');
    const safeScore = parseInt(score) || 0;
    const safeMax = parseInt(maxScore) || 28;
    const pct = Math.round((safeScore / safeMax) * 100);

    // Send report to the lead's email
    if (resend) {
      await resend.emails.send({
        from: 'Laurel Shield <onboarding@resend.dev>',
        to: safeEmail,
        subject: `Your Cybersecurity Maturity Score: ${safeCat} (${pct}%)`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0A;color:#fff;padding:32px;border-radius:12px;">
            <h1 style="color:#FF4500;margin-bottom:4px;">Laurel Shield</h1>
            <p style="color:#707070;margin-bottom:24px;">Cybersecurity Maturity Assessment Results</p>
            <div style="background:#111;padding:20px;border-radius:8px;margin-bottom:20px;">
              <h2 style="color:#FF4500;margin:0 0 8px 0;">Your Score: ${safeCat}</h2>
              <p style="font-size:28px;font-weight:700;color:#fff;margin:0 0 8px 0;">${safeScore} / ${safeMax} (${pct}%)</p>
              <div style="background:#222;border-radius:4px;height:8px;overflow:hidden;">
                <div style="background:#FF4500;height:100%;width:${pct}%;"></div>
              </div>
            </div>
            <h3 style="color:#fff;">Recommended Next Steps:</h3>
            <ul style="color:#B0B0B0;line-height:1.8;">
              ${safeScore <= 11 ? '<li>Schedule an emergency security consultation immediately</li><li>Conduct a vulnerability assessment across all systems</li><li>Establish an incident response plan</li>' :
                safeScore <= 17 ? '<li>Perform a structured gap assessment to identify weak areas</li><li>Implement a vulnerability management program</li><li>Consider a vCISO engagement for strategic guidance</li>' :
                safeScore <= 23 ? '<li>Optimize existing security processes with automation</li><li>Expand penetration testing coverage</li><li>Pursue SOC 2 or ISO 27001 certification</li>' :
                '<li>Explore advanced threat hunting and red team exercises</li><li>Evaluate AI security posture for emerging threats</li><li>Consider continuous penetration testing (PTaaS)</li>'}
            </ul>
            <div style="text-align:center;margin-top:24px;">
              <a href="https://cybersec-by-laurel.onrender.com/#contact" style="display:inline-block;background:#FF4500;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;">Book a Free Consultation</a>
            </div>
            <p style="color:#707070;font-size:12px;margin-top:24px;text-align:center;">Laurel Shield | Calgary, AB & Philadelphia, PA | cybersec-by-laurel.onrender.com</p>
          </div>
        `
      });
    }

    // Notify the consultant about the new lead
    if (resend) {
      await resend.emails.send({
        from: 'Laurel Shield <onboarding@resend.dev>',
        to: EMAIL_TO,
        subject: `[Quiz Lead] ${safeEmail} scored ${safeCat} (${pct}%)`,
        html: `<p><strong>New quiz lead:</strong></p><ul><li>Email: ${safeEmail}</li><li>Score: ${safeScore}/${safeMax} (${pct}%)</li><li>Category: ${safeCat}</li><li>Time: ${new Date().toISOString()}</li></ul>`
      });
    }

    console.log(`[${new Date().toISOString()}] Quiz lead: ${safeEmail} - ${safeCat} (${pct}%)`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Quiz report error:`, err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Subscribe / lead magnet endpoint
const subscribeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: 'Too many requests' } });

app.post('/subscribe', subscribeLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const safeEmail = sanitize(email);

    // Send lead magnet email
    if (resend) {
      await resend.emails.send({
        from: 'Laurel Shield <onboarding@resend.dev>',
        to: safeEmail,
        subject: 'Your Free 2026 Cybersecurity Compliance Checklist',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0A;color:#fff;padding:32px;border-radius:12px;">
            <h1 style="color:#FF4500;margin-bottom:4px;">Laurel Shield</h1>
            <p style="color:#707070;margin-bottom:24px;">Your compliance checklist is ready.</p>
            <div style="background:#111;padding:20px;border-radius:8px;margin-bottom:20px;">
              <h2 style="color:#fff;margin:0 0 12px 0;">2026 Cybersecurity Compliance Quick-Check</h2>
              <p style="color:#B0B0B0;">Here's a quick overview of the key requirements across major frameworks:</p>
              <table style="width:100%;border-collapse:collapse;margin-top:12px;">
                <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#FF4500;font-weight:700;">SOC 2</td><td style="padding:8px;color:#B0B0B0;">Access controls, encryption, monitoring, incident response, vendor management</td></tr>
                <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#FF4500;font-weight:700;">HIPAA</td><td style="padding:8px;color:#B0B0B0;">PHI encryption, access audit trails, BAAs, workforce training, breach notification</td></tr>
                <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#FF4500;font-weight:700;">ISO 27001</td><td style="padding:8px;color:#B0B0B0;">Risk assessment, asset management, access control, cryptography, operations security</td></tr>
                <tr><td style="padding:8px;color:#FF4500;font-weight:700;">PCI DSS</td><td style="padding:8px;color:#B0B0B0;">Network segmentation, cardholder data protection, vulnerability management, monitoring</td></tr>
              </table>
            </div>
            <p style="color:#B0B0B0;">Need help getting compliant? We get organizations audit-ready in weeks, not months.</p>
            <div style="text-align:center;margin-top:20px;">
              <a href="https://cybersec-by-laurel.onrender.com/#contact" style="display:inline-block;background:#FF4500;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;">Book a Free Compliance Consultation</a>
            </div>
            <p style="color:#707070;font-size:12px;margin-top:24px;text-align:center;">Laurel Shield | Calgary, AB & Philadelphia, PA</p>
          </div>
        `
      });
    }

    // Notify consultant
    if (resend) {
      await resend.emails.send({
        from: 'Laurel Shield <onboarding@resend.dev>',
        to: EMAIL_TO,
        subject: `[New Subscriber] ${safeEmail}`,
        html: `<p>New email subscriber from exit-intent popup:</p><ul><li>Email: ${safeEmail}</li><li>Time: ${new Date().toISOString()}</li><li>Lead magnet: Compliance Checklist</li></ul>`
      });
    }

    console.log(`[${new Date().toISOString()}] New subscriber: ${safeEmail}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Subscribe error:`, err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

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
