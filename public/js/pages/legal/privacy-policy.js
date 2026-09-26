/**
 * Plash Pilates — Legal: Privacy Policy
 * Aligned with India Digital Personal Data Protection Act (DPDPA 2023) and GDPR.
 * @module pages/legal/privacy-policy
 */

import { createElement } from '../../utils/dom.js';
import { CONFIG } from '../../core/config.js';

export async function render(container) {
  const page = createElement('div', { className: 'page-container' });

  const header = createElement('div', { className: 'page-header' });
  const title = createElement('h1', { className: 'page-title', text: 'Privacy Policy' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Information on how Plash Pilates collects, processes, protects, and respects your personal and health data.'
  });
  header.append(title, subtitle);
  page.appendChild(header);

  const article = createElement('article', { className: 'legal-content' });

  article.innerHTML = `
    <div style="background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-4); margin-bottom: var(--space-8); font-size: var(--text-xs); color: var(--ink-80);">
      <strong>Effective Date:</strong> April 11, 2026 | <strong>Version:</strong> 1.0 (DPDPA 2023 & ISO/IEC 27701 Aligned)
    </div>

    <h2>1. Data Fiduciary & Identity</h2>
    <p>
      This Privacy Policy applies to <strong>Plash Pilates</strong> ("Studio", "we", "us", or "our"), operating as a boutique Reformer Pilates, Barre Conditioning, and Sculpt Yoga studio in Sadashiva Nagar / Vyalikaval, Bengaluru 560003, Karnataka, India.
    </p>
    <p>
      Under the Digital Personal Data Protection Act (DPDPA) 2023, Plash Pilates acts as the <strong>Data Fiduciary</strong> responsible for determining the purpose and means of processing personal data collected via our website and studio portal.
    </p>

    <h2>2. Categories of Personal Data Collected</h2>
    <p>We collect and process the following categories of data directly from you:</p>
    <ul style="padding-left: var(--space-6); font-size: var(--text-sm); line-height: 1.8; color: var(--ink-80); margin-bottom: var(--space-4);">
      <li><strong>Identity & Contact Data:</strong> Full name, telephone number, email address, emergency contact name and phone.</li>
      <li><strong>Sensitive Health & Physical Data:</strong> Movement experience levels, previous injuries, spinal or disc conditions, cardiovascular concerns, pregnancy/postnatal status, and physician clearance status.</li>
      <li><strong>Transaction & Pass Records:</strong> Purchased membership tiers, payment reference IDs, session credits remaining, and expiry dates (note: raw card numbers are processed directly by certified payment gateways and never stored on our servers).</li>
      <li><strong>Studio Attendance & Booking History:</strong> Timestamps of reserved sessions, class check-ins, cancellations, no-shows, and coach feedback notes.</li>
      <li><strong>Technical & Consent Logs:</strong> Cookie preferences, waiver acceptance timestamps, and authenticated session audit trails.</li>
    </ul>

    <h2>3. Lawful Purpose & Ground for Processing</h2>
    <p>
      We process personal data solely for specified, lawful purposes:
    </p>
    <ul style="padding-left: var(--space-6); font-size: var(--text-sm); line-height: 1.8; color: var(--ink-80); margin-bottom: var(--space-4);">
      <li><strong>Contractual Performance:</strong> To provision your membership pass, manage class bookings, enforce 1:6 coaching ratios, and process pass freeze requests.</li>
      <li><strong>Explicit Consent (Sensitive Health Data):</strong> Physical health disclosures are processed exclusively to permit instructors to customize apparatus spring tension, adjust alignment, and prevent bodily injury during high-intensity movements.</li>
      <li><strong>Safety & Emergency Redressal:</strong> In the unlikely event of physical distress during class, emergency contact data is accessed immediately.</li>
    </ul>

    <h2>4. Data Sharing & Third-Party Processors</h2>
    <p>
      We do not sell, rent, or trade your personal information. Data is shared strictly under confidential processing agreements with:
    </p>
    <ul style="padding-left: var(--space-6); font-size: var(--text-sm); line-height: 1.8; color: var(--ink-80); margin-bottom: var(--space-4);">
      <li><strong>Physicq 57 Partner Coaches:</strong> When you request a Barre Conditioning session, your name, contact, and health/injury disclosures are shared strictly with certified Physicq 57 coaches to ensure instructor readiness and safety approvals. Non-Barre members' health records are isolated and completely inaccessible to partner coaches.</li>
      <li><strong>Payment Gateways (e.g. Razorpay):</strong> For secure, PCI-DSS compliant processing of package transactions.</li>
    </ul>

    <h2>5. Data Principal Rights (DPDPA 2023 / GDPR)</h2>
    <p>As a Data Principal, you are entitled to exercise the following statutory rights:</p>
    <ul style="padding-left: var(--space-6); font-size: var(--text-sm); line-height: 1.8; color: var(--ink-80); margin-bottom: var(--space-4);">
      <li><strong>Right to Access & Summary:</strong> You may request a complete summary of all personal data held about you or download an instant JSON copy from your Member Security page.</li>
      <li><strong>Right to Correction & Updating:</strong> You may update contact details and physical health assessments at any time through your Profile page.</li>
      <li><strong>Right to Erasure ("Right to be Forgotten"):</strong> You may submit a formal request for complete erasure of your profile, bookings, and health records, subject to statutory tax and financial record retention requirements.</li>
      <li><strong>Right to Grievance Redressal:</strong> You may file a complaint with our designated Data Protection Officer.</li>
      <li><strong>Right to Nominate:</strong> You have the right to nominate an individual to exercise your rights in the event of incapacity or death.</li>
    </ul>

    <h2>6. Data Retention & Safeguards</h2>
    <p>
      Personal and booking data is retained for a maximum of <strong>${CONFIG.DATA_RETENTION_MONTHS} months</strong> following your last active session, after which records are anonymized or securely deleted.
    </p>
    <p>
      All data transmissions are encrypted via modern TLS protocols. Access to sensitive health assessments is role-gated on a strict need-to-know basis.
    </p>

    <h2>7. Data Protection Grievance Officer</h2>
    <p>For inquiries, rights requests, or grievance redressal, contact our Grievance Officer:</p>
    <div style="background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-4); font-size: var(--text-sm); color: var(--ink); line-height: 1.7;">
      <strong>Data Protection Grievance Officer:</strong> Studio Grievance Officer<br>
      Plash Pilates Studio LLP, Sadashiva Nagar, Bengaluru 560080<br>
      <strong>Address:</strong> ${CONFIG.STUDIO.address}<br>
      <strong>Email:</strong> privacy@plashpilates.com<br>
      <strong>Response Time:</strong> Statutory resolution within 72 business hours
    </div>
  `;

  page.appendChild(article);
  container.appendChild(page);
}
