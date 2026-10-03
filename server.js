require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const { Resend } = require('resend');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;

// Email configuration
const EMAIL_TO = 'lawrence44r@gmail.com';
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Billing configuration (Agentic Automation Architecture, Part V). Inert
// until configured -- /billing/checkout and /billing/webhook check for this
// and return a clean 503 rather than crashing when Stripe isn't set up yet.
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const RETAINER_PRICES = {
  standard: process.env.STRIPE_PRICE_STANDARD,   // $299/mo
  growth: process.env.STRIPE_PRICE_GROWTH,       // $599/mo
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE, // $999/mo
};
const PASSPORT_PLATFORM_INTERNAL_URL = process.env.PASSPORT_PLATFORM_INTERNAL_URL;
const PROVISION_WEBHOOK_SECRET = process.env.PROVISION_WEBHOOK_SECRET;
if (!stripe) {
  console.log('Stripe not configured (no STRIPE_SECRET_KEY) -- /billing routes will return billing_not_configured.');
}

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

// Stripe webhook needs the raw request body for signature verification, so
// it must be registered -- with its own raw-body middleware -- BEFORE the
// general JSON body parser below, or the signature check will always fail.
app.post('/billing/webhook', express.raw({ type: 'application/json' }), handleBillingWebhook);

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
    <h2 style="color:#0A1428;">New Website Inquiry — Congruent Shield</h2>
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
    <p style="color:#999;font-size:12px;">Congruent Shield website contact form</p>
  `;

  if (!resend) {
    console.log(`[${new Date().toISOString()}] Email skipped (no RESEND_API_KEY configured)`);
    return;
  }
  try {
    await resend.emails.send({
      from: 'Congruent Shield <onboarding@resend.dev>',
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
        from: 'Congruentshield <onboarding@resend.dev>',
        to: safeEmail,
        subject: `Your Insurability Snapshot: ${safeCat} (${pct}%)`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#000000;color:#FFFFFF;padding:32px;border-radius:0;">
            <h1 style="color:#0078D4;margin-bottom:4px;">Congruentshield</h1>
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
            <p style="color:#A3A3A3;font-size:12px;margin-top:24px;text-align:center;">Congruentshield | Calgary, Alberta, Canada | security.laurelshield.com</p>
          </div>
        `
      });
    }

    // Notify the consultant about the new lead
    if (resend) {
      await resend.emails.send({
        from: 'Congruentshield <onboarding@resend.dev>',
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
        from: 'Congruentshield <onboarding@resend.dev>',
        to: safeEmail,
        subject: 'Your Baseline Controls Checklist -- Congruentshield',
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#000000;color:#FFFFFF;padding:32px;border-radius:0;">
            <h1 style="color:#0078D4;margin-bottom:4px;">Congruentshield</h1>
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
            <p style="color:#A3A3A3;font-size:12px;margin-top:24px;text-align:center;">Congruentshield | Calgary, Alberta, Canada | security.laurelshield.com</p>
          </div>
        `
      });
    }

    // Notify consultant
    if (resend) {
      await resend.emails.send({
        from: 'Congruentshield <onboarding@resend.dev>',
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

// Concierge Intake Agent endpoint -- Stage 1 of the Agentic Automation
// Architecture. Deliberately a scripted decision-tree (see public/js/concierge.js),
// not an LLM, per the architecture doc's own MVP-discipline argument. Has no
// access to the Passport Platform at all -- it only ever reaches this
// endpoint, which mirrors /contact's pattern exactly. Every qualifying run
// emails the full transcript to Lawrence regardless of outcome, implementing
// the "every self-serve-originated lead gets a 48-hour personal follow-up"
// rule (Part 0 of the architecture doc) even before billing exists.
const conciergeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many requests' } });

app.post('/concierge', conciergeLimiter, async (req, res) => {
  try {
    const { name, email, company, phone, outcome, answers } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!email || !validator.isEmail(email)) return res.status(400).json({ error: 'Valid email is required' });
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'No qualifying answers received' });
    }

    const safe = {
      name: sanitize(name),
      email: sanitize(email),
      company: sanitize(company || ''),
      phone: sanitize(phone || ''),
      outcome: sanitize(outcome || 'unspecified'),
    };
    const safeAnswers = answers
      .filter((a) => a && typeof a.question === 'string' && typeof a.answer === 'string')
      .slice(0, 20)
      .map((a) => ({ question: sanitize(a.question), answer: sanitize(a.answer) }));

    console.log(`[${new Date().toISOString()}] Concierge lead: ${safe.name} (${safe.email}) -> ${safe.outcome}`);
    res.json({ success: true });

    sendConciergeEmail(safe, safeAnswers);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Concierge error:`, err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

async function sendConciergeEmail(safe, safeAnswers) {
  const transcriptRows = safeAnswers.map((a) =>
    `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;vertical-align:top;">${a.question}</td><td style="padding:8px;border:1px solid #ddd;">${a.answer}</td></tr>`
  ).join('');
  const html = `
    <h2 style="color:#0078D4;">New Concierge Lead -- Congruentshield</h2>
    <p>Received on <strong>${new Date().toLocaleString('en-CA')}</strong>. Outcome: <strong>${safe.outcome}</strong>.</p>
    <table style="border-collapse:collapse;width:100%;max-width:600px;">
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;width:140px;">Name</td><td style="padding:8px;border:1px solid #ddd;">${safe.name}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Email</td><td style="padding:8px;border:1px solid #ddd;">${safe.email}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Company</td><td style="padding:8px;border:1px solid #ddd;">${safe.company || 'N/A'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Phone</td><td style="padding:8px;border:1px solid #ddd;">${safe.phone || 'N/A'}</td></tr>
    </table>
    <h3 style="color:#0A1428;margin-top:20px;">Qualifying Conversation</h3>
    <table style="border-collapse:collapse;width:100%;max-width:600px;">${transcriptRows}</table>
    <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;">
    <p style="color:#999;font-size:12px;">Follow up within 48 hours per the Concierge Agent's handoff rule -- this lead has not been contacted by a human yet.</p>
  `;

  if (!resend) {
    console.log(`[${new Date().toISOString()}] Email skipped (no RESEND_API_KEY configured)`);
    return;
  }
  try {
    await resend.emails.send({
      from: 'Congruentshield <onboarding@resend.dev>',
      to: EMAIL_TO,
      subject: `[Concierge Lead] ${safe.name} -- ${safe.outcome}`,
      html,
    });
    console.log(`[${new Date().toISOString()}] Concierge email sent for: ${safe.name}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send concierge email:`, err.message);
  }
}

// ======================================================================
// Billing (Stripe) -- Continuous Assurance Retainer self-serve subscription.
// Agentic Automation Architecture, Part V: this is deliberately the ONLY
// tier offered self-serve -- Pilot Snapshot and Core Readiness Assessment
// stay human-delivered per the Playbook's Part III. Code-complete but
// inert (clean 503, never a crash) until STRIPE_SECRET_KEY etc. are set.
// ======================================================================
const billingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many requests' } });

app.post('/billing/checkout', billingLimiter, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'billing_not_configured' });
  const tier = (req.body && req.body.tier) || 'standard';
  const priceId = RETAINER_PRICES[tier];
  if (!priceId) return res.status(400).json({ error: 'invalid_tier' });

  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // Collected inline in Stripe's own hosted Checkout -- no separate
      // signup form on this site before payment (matches the architecture
      // doc's Figure 2: click the CTA, land directly in Checkout).
      custom_fields: [{
        key: 'company_name',
        label: { type: 'custom', custom: 'Company Name' },
        type: 'text',
        optional: false,
      }],
      metadata: { tier },
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancelled#subscribe-cta`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Checkout session error:`, err.message);
    res.status(500).json({ error: 'checkout_session_failed' });
  }
});

async function handleBillingWebhook(req, res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'billing_not_configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Webhook signature verification failed:`, err.message);
    return res.status(400).json({ error: 'invalid_signature' });
  }

  res.json({ received: true }); // acknowledge immediately; provisioning below is best-effort/non-blocking

  if (event.type !== 'checkout.session.completed') return;
  const session = event.data.object;
  const email = session.customer_details && session.customer_details.email;
  const companyField = (session.custom_fields || []).find((f) => f.key === 'company_name');
  const companyName = companyField && companyField.text && companyField.text.value;

  if (!email || !companyName) {
    console.error(`[${new Date().toISOString()}] Webhook missing email or company name -- cannot provision. session=${session.id}`);
    return;
  }

  await provisionFromCheckout({ email, companyName, tier: (session.metadata && session.metadata.tier) || 'standard' });
}

async function provisionFromCheckout({ email, companyName, tier }) {
  if (!PASSPORT_PLATFORM_INTERNAL_URL || !PROVISION_WEBHOOK_SECRET) {
    console.error(`[${new Date().toISOString()}] PASSPORT_PLATFORM_INTERNAL_URL/PROVISION_WEBHOOK_SECRET not configured -- cannot auto-provision ${email}. Provision manually.`);
    return;
  }

  // Temporary password -- the Passport Platform has no password-setup-link
  // flow yet (a real build would email a one-time setup link instead of a
  // password directly; this is the honest, documented simplification for
  // this scaffold). Sent once, over the email Stripe itself just verified
  // via a successful payment, with an explicit instruction to change it.
  const tempPassword = crypto.randomBytes(18).toString('base64url');

  let result;
  try {
    const resp = await fetch(`${PASSPORT_PLATFORM_INTERNAL_URL}/internal/provision-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-provision-secret': PROVISION_WEBHOOK_SECRET },
      body: JSON.stringify({ companyName, email, password: tempPassword, source: `stripe_checkout_${tier}` }),
    });
    result = await resp.json();
    if (!resp.ok) {
      console.error(`[${new Date().toISOString()}] provision-org failed (${resp.status}) for ${email}:`, result);
      // Already has an account (e.g. re-subscribing) -- notify them to log in normally, not with a new password.
      if (result && result.error === 'email_already_registered') {
        await sendAlreadyRegisteredEmail(email);
      }
      return;
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] provision-org request failed for ${email}:`, err.message);
    return;
  }

  await sendWelcomeEmail({ email, companyName, tempPassword });
  await sendNewSubscriberNotification({ email, companyName, tier, orgId: result.orgId });
}

async function sendWelcomeEmail({ email, companyName, tempPassword }) {
  if (!resend) {
    console.log(`[${new Date().toISOString()}] Welcome email skipped (no RESEND_API_KEY configured) for ${email}`);
    return;
  }
  try {
    await resend.emails.send({
      from: 'Congruentshield <onboarding@resend.dev>',
      to: email,
      subject: 'Your Congruentshield Passport Platform account is ready',
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#000000;color:#FFFFFF;padding:32px;">
          <h1 style="color:#0078D4;margin-bottom:4px;">Congruentshield</h1>
          <p style="color:#A3A3A3;margin-bottom:24px;">Your Continuous Assurance subscription for ${companyName} is active.</p>
          <div style="background:#0D0D0D;border:1px solid rgba(255,255,255,0.18);padding:20px;margin-bottom:20px;">
            <p style="color:#D6D6D6;">A temporary password has been set so you can log in right away. Please change it after your first login.</p>
            <p style="color:#FFFFFF;font-family:monospace;font-size:1.1em;">${tempPassword}</p>
          </div>
          <p style="color:#D6D6D6;">Your first issued passport will be reviewed by a Congruentshield assessor before it's shared with any broker or carrier -- this applies to every new account, regardless of how you signed up.</p>
          <p style="color:#A3A3A3;font-size:12px;margin-top:24px;text-align:center;">Congruentshield | Calgary, Alberta, Canada | security.laurelshield.com</p>
        </div>
      `,
    });
    console.log(`[${new Date().toISOString()}] Welcome email sent to: ${email}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send welcome email:`, err.message);
  }
}

async function sendAlreadyRegisteredEmail(email) {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: 'Congruentshield <onboarding@resend.dev>',
      to: email,
      subject: 'Your Congruentshield subscription is active',
      html: `<p>Thanks for subscribing -- your payment was received. It looks like you already have a Congruentshield account under this email, so log in as usual rather than using a new password.</p>`,
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send already-registered email:`, err.message);
  }
}

async function sendNewSubscriberNotification({ email, companyName, tier, orgId }) {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: 'Congruentshield <onboarding@resend.dev>',
      to: EMAIL_TO,
      subject: `[New Subscriber] ${companyName} -- ${tier} retainer`,
      html: `<p>New Continuous Assurance subscriber, provisioned automatically:</p><ul><li>Company: ${companyName}</li><li>Email: ${email}</li><li>Tier: ${tier}</li><li>Org ID: ${orgId}</li><li>Time: ${new Date().toISOString()}</li></ul><p>Their first passport is flagged pending human verification -- review it within 48 hours.</p>`,
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send new-subscriber notification:`, err.message);
  }
}

// Product inquiry endpoint
const productInquiryLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many requests' } });

app.post('/product-inquiry', productInquiryLimiter, async (req, res) => {
  try {
    const { email, product, tier } = req.body;
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const safeEmail = sanitize(email);
    const safeProduct = sanitize(product || 'Unknown');
    const safeTier = sanitize(tier || 'Unknown');

    // Notify consultant about product interest
    if (resend) {
      await resend.emails.send({
        from: 'Congruent Shield <onboarding@resend.dev>',
        to: EMAIL_TO,
        subject: `[Product Interest] ${safeProduct} — ${safeTier} tier`,
        html: `
          <h2 style="color:#FF4500;">New Product Interest</h2>
          <table style="border-collapse:collapse;width:100%;max-width:500px;">
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Email</td><td style="padding:8px;border:1px solid #ddd;">${safeEmail}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Product</td><td style="padding:8px;border:1px solid #ddd;">${safeProduct}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Tier</td><td style="padding:8px;border:1px solid #ddd;">${safeTier}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Time</td><td style="padding:8px;border:1px solid #ddd;">${new Date().toISOString()}</td></tr>
          </table>
        `
      });

      // Send confirmation to buyer
      await resend.emails.send({
        from: 'Congruent Shield <onboarding@resend.dev>',
        to: safeEmail,
        subject: `Thanks for your interest in ${safeProduct} — Congruent Shield`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0A;color:#fff;padding:32px;border-radius:12px;">
            <h1 style="color:#FF4500;margin-bottom:4px;">Congruent Shield</h1>
            <p style="color:#B0B0B0;margin-bottom:20px;">Thanks for your interest in <strong style="color:#fff;">${safeProduct}</strong>.</p>
            <p style="color:#B0B0B0;">We've received your inquiry for the <strong style="color:#FF4500;">${safeTier}</strong> tier. A member of our team will reach out within 24 hours with next steps and payment details.</p>
            <p style="color:#B0B0B0;margin-top:16px;">In the meantime, feel free to explore our free interactive tools on the product page, or book a call to discuss your needs:</p>
            <div style="text-align:center;margin-top:20px;">
              <a href="https://calendly.com/lawrence44r/free-15-min-hipaa-gap-check" style="display:inline-block;background:#FF4500;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;">Book a Free Call</a>
            </div>
            <p style="color:#707070;font-size:12px;margin-top:24px;text-align:center;">Congruent Shield | security.laurelshield.com</p>
          </div>
        `
      });
    }

    console.log(`[${new Date().toISOString()}] Product inquiry: ${safeEmail} - ${safeProduct} (${safeTier})`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Product inquiry error:`, err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Product lead magnet endpoint (free tool results via email)
app.post('/product-lead', productInquiryLimiter, async (req, res) => {
  try {
    const { email, product, toolName, results } = req.body;
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const safeEmail = sanitize(email);
    const safeProduct = sanitize(product || 'Unknown');
    const safeTool = sanitize(toolName || 'Assessment');
    const safeResults = sanitize(results || 'No results provided');

    if (resend) {
      // Send results to user
      await resend.emails.send({
        from: 'Congruent Shield <onboarding@resend.dev>',
        to: safeEmail,
        subject: `Your ${safeTool} Results — Congruent Shield`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0A;color:#fff;padding:32px;border-radius:12px;">
            <h1 style="color:#FF4500;">Congruent Shield</h1>
            <h2 style="color:#fff;margin-bottom:16px;">${safeTool} Results</h2>
            <div style="background:#111;padding:20px;border-radius:8px;color:#B0B0B0;white-space:pre-wrap;">${safeResults}</div>
            <p style="color:#B0B0B0;margin-top:20px;">Want the full toolkit? Check out <strong style="color:#fff;">${safeProduct}</strong> for comprehensive templates, questionnaires, and implementation guides.</p>
            <div style="text-align:center;margin-top:20px;">
              <a href="https://security.laurelshield.com/products/" style="display:inline-block;background:#FF4500;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;">View All Products</a>
            </div>
            <p style="color:#707070;font-size:12px;margin-top:24px;text-align:center;">Congruent Shield | security.laurelshield.com</p>
          </div>
        `
      });

      // Notify consultant
      await resend.emails.send({
        from: 'Congruent Shield <onboarding@resend.dev>',
        to: EMAIL_TO,
        subject: `[Product Lead] ${safeEmail} used ${safeTool}`,
        html: `<p><strong>New product lead:</strong></p><ul><li>Email: ${safeEmail}</li><li>Product: ${safeProduct}</li><li>Tool: ${safeTool}</li><li>Time: ${new Date().toISOString()}</li></ul>`
      });
    }

    console.log(`[${new Date().toISOString()}] Product lead: ${safeEmail} - ${safeTool}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Product lead error:`, err.message);
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
  console.log(`=== Congruent Shield Website ===`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Started: ${new Date().toISOString()}`);
});
