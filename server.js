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
      const nextSteps = safeScore <= 11
        ? { lead: 'Your evidence probably wouldn\'t survive underwriting scrutiny today.', items: '<li>Book an urgent Pilot Snapshot ($295) to find the most critical gaps this week</li><li>Prioritize MFA and backup evidence first -- these are what carriers check hardest</li><li>Get a dated incident-response plan in place before your next renewal</li>' }
        : safeScore <= 17
        ? { lead: 'You have some controls in place, but the evidence to prove them is incomplete.', items: '<li>Book a Pilot Snapshot ($295) for a same-day pass through your highest-impact controls</li><li>A Core Readiness Assessment can score all 40 controls and tell you exactly what to prioritize</li><li>Start assembling proof artifacts now, before your renewal is due</li>' }
        : safeScore <= 23
        ? { lead: 'Good foundation. The gaps left are specific evidence gaps, not missing controls.', items: '<li>A Core Readiness Assessment will score your Evidence Confidence Level across all 40 controls</li><li>An Evidence Package can get your proof artifacts broker-submission-ready</li><li>Move from "we probably have that" to a documented package</li>' }
        : { lead: 'Strong control posture. The remaining work is mostly keeping evidence current.', items: '<li>A Continuous Assurance Retainer keeps your evidence current between renewals</li><li>Avoid rebuilding your case from zero every year</li><li>Talk to us about what ongoing drift monitoring would look like for your business</li>' };
      await resend.emails.send({
        from: 'Laurelshield <onboarding@resend.dev>',
        to: safeEmail,
        subject: `Your Insurability Snapshot: ${safeCat} (${pct}%)`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#000000;color:#FFFFFF;padding:32px;border-radius:0;">
            <h1 style="color:#0078D4;margin-bottom:4px;">Laurelshield</h1>
            <p style="color:#A3A3A3;margin-bottom:24px;">Cyber Insurance Readiness -- Insurability Snapshot Results</p>
            <div style="background:#0D0D0D;border:1px solid rgba(255,255,255,0.18);padding:20px;border-radius:0;margin-bottom:20px;">
              <h2 style="color:#0078D4;margin:0 0 8px 0;">Your Score: ${safeCat}</h2>
              <p style="font-size:28px;font-weight:700;color:#FFFFFF;margin:0 0 8px 0;">${safeScore} / ${safeMax} (${pct}%)</p>
              <div style="background:#232323;border-radius:0;height:8px;overflow:hidden;">
                <div style="background:#0078D4;height:100%;width:${pct}%;"></div>
              </div>
            </div>
            <p style="color:#D6D6D6;">${nextSteps.lead}</p>
            <h3 style="color:#FFFFFF;">Recommended Next Steps:</h3>
            <ul style="color:#D6D6D6;line-height:1.8;">
              ${nextSteps.items}
            </ul>
            <div style="text-align:center;margin-top:24px;">
              <a href="https://calendly.com/lawrence44r/free-15-min-hipaa-gap-check" style="display:inline-block;background:#0078D4;color:#FFFFFF;padding:14px 32px;text-decoration:none;border-radius:0;font-weight:700;">Book a 15-Minute Call</a>
            </div>
            <p style="color:#A3A3A3;font-size:12px;margin-top:24px;text-align:center;">Laurelshield | Calgary, Alberta, Canada | security.laurelshield.com</p>
          </div>
        `
      });
    }

    // Notify the consultant about the new lead
    if (resend) {
      await resend.emails.send({
        from: 'Laurelshield <onboarding@resend.dev>',
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
        from: 'Laurelshield <onboarding@resend.dev>',
        to: safeEmail,
        subject: 'Your Baseline Controls Checklist -- Laurelshield',
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#000000;color:#FFFFFF;padding:32px;border-radius:0;">
            <h1 style="color:#0078D4;margin-bottom:4px;">Laurelshield</h1>
            <p style="color:#A3A3A3;margin-bottom:24px;">Your baseline controls checklist is ready.</p>
            <div style="background:#0D0D0D;border:1px solid rgba(255,255,255,0.18);padding:20px;border-radius:0;margin-bottom:20px;">
              <h2 style="color:#FFFFFF;margin:0 0 12px 0;">The 8 Controls Insurers Check First</h2>
              <p style="color:#D6D6D6;">Cyber-insurance underwriting has shifted from self-attestation to evidence-based validation. These are the baseline controls insurers now treat as effectively non-negotiable -- and expect proof of, not just a checkbox:</p>
              <table style="width:100%;border-collapse:collapse;margin-top:12px;">
                <tr style="border-bottom:1px solid #232323;"><td style="padding:10px 8px;color:#0078D4;font-weight:700;width:40%;">MFA Everywhere</td><td style="padding:10px 8px;color:#D6D6D6;">Phishing-resistant MFA preferred over SMS OTP, enforced on every account with remote or privileged access.</td></tr>
                <tr style="border-bottom:1px solid #232323;"><td style="padding:10px 8px;color:#0078D4;font-weight:700;">EDR on Every Endpoint</td><td style="padding:10px 8px;color:#D6D6D6;">Deployed and actively monitored, not just installed -- insurers increasingly ask for coverage reports, not a checkbox.</td></tr>
                <tr style="border-bottom:1px solid #232323;"><td style="padding:10px 8px;color:#0078D4;font-weight:700;">Tested Immutable Backups</td><td style="padding:10px 8px;color:#D6D6D6;">A documented restore test inside the last ~90 days, not just "we have backups."</td></tr>
                <tr style="border-bottom:1px solid #232323;"><td style="padding:10px 8px;color:#0078D4;font-weight:700;">Incident Response Plan</td><td style="padding:10px 8px;color:#D6D6D6;">Dated and exercised, with a documented tabletop -- not a template that's never been used.</td></tr>
                <tr style="border-bottom:1px solid #232323;"><td style="padding:10px 8px;color:#0078D4;font-weight:700;">Patch Management</td><td style="padding:10px 8px;color:#D6D6D6;">No end-of-life systems exposed to the internet, with a documented patch cadence.</td></tr>
                <tr style="border-bottom:1px solid #232323;"><td style="padding:10px 8px;color:#0078D4;font-weight:700;">Privileged Access Management</td><td style="padding:10px 8px;color:#D6D6D6;">Admin and privileged accounts controlled, logged, and reviewed -- not shared credentials.</td></tr>
                <tr style="border-bottom:1px solid #232323;"><td style="padding:10px 8px;color:#0078D4;font-weight:700;">Email Authentication</td><td style="padding:10px 8px;color:#D6D6D6;">SPF/DKIM/DMARC configured, paired with phishing-simulation training for staff.</td></tr>
                <tr><td style="padding:10px 8px;color:#0078D4;font-weight:700;">Network Segmentation</td><td style="padding:10px 8px;color:#D6D6D6;">Critical systems isolated from the general network, limiting how far an incident can spread.</td></tr>
              </table>
            </div>
            <p style="color:#D6D6D6;">Missing items on this list? Most businesses have gaps -- that's normal. The real problem isn't usually that you don't have the control. It's that you can't produce evidence of it on request.</p>
            <div style="text-align:center;margin-top:20px;">
              <a href="https://calendly.com/lawrence44r/free-15-min-hipaa-gap-check" style="display:inline-block;background:#0078D4;color:#FFFFFF;padding:14px 32px;text-decoration:none;border-radius:0;font-weight:700;">Book a 15-Minute Call</a>
            </div>
            <p style="color:#A3A3A3;font-size:12px;margin-top:24px;text-align:center;">Laurelshield | Calgary, Alberta, Canada | security.laurelshield.com</p>
          </div>
        `
      });
    }

    // Notify consultant
    if (resend) {
      await resend.emails.send({
        from: 'Laurelshield <onboarding@resend.dev>',
        to: EMAIL_TO,
        subject: `[New Subscriber] ${safeEmail}`,
        html: `<p>New email subscriber from exit-intent popup:</p><ul><li>Email: ${safeEmail}</li><li>Time: ${new Date().toISOString()}</li><li>Lead magnet: Baseline Controls Checklist</li></ul>`
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
