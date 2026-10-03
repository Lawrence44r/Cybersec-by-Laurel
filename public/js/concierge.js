// Concierge Intake Agent -- Stage 1 of the Agentic Automation Architecture.
// A scripted decision tree, deliberately not an LLM (see the architecture
// doc's own MVP-discipline argument): zero new API dependency, zero
// marginal cost, fully working today, with a clean seam to swap in a real
// model call later if self-serve demand actually proves out. It never talks
// to the Passport Platform -- only to this site's own /concierge endpoint.
(function () {
  'use strict';

  // Mom-Test-style qualifying questions, verbatim from the GTM Playbook's
  // Part IV "banned vs. correct question" script -- not generic
  // "would you be interested" phrasing.
  var BRANCHES = {
    renewal: {
      label: 'A cyber-insurance renewal or application is coming up',
      question: 'Tell me about the last time your broker or insurer asked you something about your IT security you weren’t sure how to answer.',
      outcome: 'pilot_snapshot',
    },
    ongoing: {
      label: 'I want our evidence to stay current between renewals',
      question: 'Walk me through what happened the last time you renewed or applied for business insurance — what did that conversation with your broker look like?',
      outcome: 'subscription_interest',
    },
    exploring: {
      label: 'Just exploring for now',
      question: 'Has your business ever had a security incident, even a small one — what happened, and what did you do afterward?',
      outcome: 'exploring',
    },
  };

  var state = { branchKey: null, answers: [], step: 'intro' };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'style') node.style.cssText = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function render() {
    var root = document.getElementById('concierge-root');
    if (!root) return;
    root.innerHTML = '';
    if (state.step === 'intro') root.appendChild(renderIntro());
    else if (state.step === 'question') root.appendChild(renderQuestion());
    else if (state.step === 'followup') root.appendChild(renderFollowup());
    else if (state.step === 'contact') root.appendChild(renderContact());
    else if (state.step === 'done') root.appendChild(renderDone());
  }

  function card(children) {
    return el('div', {
      style: 'background:var(--bg-card);border:1px solid var(--border-color);padding:28px;max-width:560px;margin:0 auto;',
    }, children);
  }

  function heading(text) {
    return el('h3', { text: text, style: 'color:var(--text-primary);margin:0 0 16px 0;font-size:1.15em;' });
  }

  function optionButton(text, onClick) {
    var btn = el('button', {
      type: 'button', text: text,
      style: 'display:block;width:100%;text-align:left;background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);padding:14px 16px;margin-bottom:10px;cursor:pointer;font-size:0.95em;',
    });
    btn.addEventListener('click', onClick);
    btn.addEventListener('mouseenter', function () { btn.style.borderColor = '#0078D4'; });
    btn.addEventListener('mouseleave', function () { btn.style.borderColor = ''; });
    return btn;
  }

  function renderIntro() {
    var box = card([heading('What brings you here today?')]);
    Object.keys(BRANCHES).forEach(function (key) {
      box.appendChild(optionButton(BRANCHES[key].label, function () {
        state.branchKey = key;
        state.step = 'question';
        render();
      }));
    });
    return box;
  }

  function renderQuestion() {
    var branch = BRANCHES[state.branchKey];
    var textarea = el('textarea', {
      rows: '3', placeholder: 'A sentence or two is plenty.',
      style: 'width:100%;box-sizing:border-box;background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);padding:10px;font-size:0.95em;margin-bottom:12px;',
    });
    var submit = el('button', {
      type: 'button', text: 'Continue',
      class: 'btn btn-primary btn-sm',
    });
    submit.addEventListener('click', function () {
      state.answers.push({ question: branch.question, answer: textarea.value.trim() || '(skipped)' });
      state.step = 'followup';
      render();
    });
    return card([heading(branch.question), textarea, submit]);
  }

  function renderFollowup() {
    var question = 'Who currently fills out your cyber-insurance application — you, your IT person, your broker?';
    var input = el('input', {
      type: 'text', placeholder: 'e.g. “me, with help from our IT contractor”',
      style: 'width:100%;box-sizing:border-box;background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);padding:10px;font-size:0.95em;margin-bottom:12px;',
    });
    var submit = el('button', { type: 'button', text: 'Continue', class: 'btn btn-primary btn-sm' });
    submit.addEventListener('click', function () {
      state.answers.push({ question: question, answer: input.value.trim() || '(skipped)' });
      state.step = 'contact';
      render();
    });
    return card([heading(question), input, submit]);
  }

  function renderContact() {
    var name = el('input', { type: 'text', placeholder: 'Your name', style: fieldStyle() });
    var email = el('input', { type: 'email', placeholder: 'Work email', style: fieldStyle() });
    var company = el('input', { type: 'text', placeholder: 'Company (optional)', style: fieldStyle() });
    var submit = el('button', { type: 'button', text: 'Get My Next Step', class: 'btn btn-primary btn-sm', style: 'width:100%;justify-content:center;margin-top:8px;' });
    var error = el('p', { style: 'color:#D13438;font-size:0.85em;margin-top:8px;display:none;' });

    submit.addEventListener('click', function () {
      if (!name.value.trim() || !email.value.trim()) {
        error.textContent = 'Name and email are required.';
        error.style.display = 'block';
        return;
      }
      submitTranscript({
        name: name.value.trim(), email: email.value.trim(), company: company.value.trim(),
        outcome: BRANCHES[state.branchKey].outcome, answers: state.answers,
      });
    });

    return card([
      heading('Last step — where should we send this?'),
      name, email, company, submit, error,
    ]);
  }

  function fieldStyle() {
    return 'width:100%;box-sizing:border-box;background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);padding:10px;font-size:0.95em;margin-bottom:10px;';
  }

  function renderDone() {
    var outcome = BRANCHES[state.branchKey].outcome;
    var message, ctaHref, ctaText;
    if (outcome === 'pilot_snapshot') {
      message = 'That sounds like a same-day Pilot Snapshot. We’ve sent your details ahead — pick a time below.';
      ctaHref = '#contact'; ctaText = 'Book a Pilot Snapshot';
    } else if (outcome === 'subscription_interest') {
      message = 'That’s exactly what the Continuous Assurance Retainer is for. Take a look below.';
      ctaHref = '#subscribe-cta'; ctaText = 'See Continuous Assurance';
    } else {
      message = 'No problem — take the free Insurability Snapshot quiz below to see where you’d stand today.';
      ctaHref = '#quiz'; ctaText = 'Take the Free Snapshot Quiz';
    }
    var link = el('a', { href: ctaHref, text: ctaText, class: 'btn btn-primary btn-sm', style: 'margin-top:14px;display:inline-block;' });
    link.addEventListener('click', function () {
      if (ctaHref === '#contact' && typeof window.prefillService === 'function') {
        window.prefillService('Pilot Snapshot');
      }
    });
    return card([heading(message), link]);
  }

  function submitTranscript(payload) {
    fetch('/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(function () { /* non-blocking -- still advance the UI either way */ });
    state.step = 'done';
    render();
  }

  document.addEventListener('DOMContentLoaded', render);
})();
