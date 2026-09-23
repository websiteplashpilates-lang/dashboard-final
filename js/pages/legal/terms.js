/**
 * Plash Pilates — Legal: Terms & Conditions
 * Studio terms of service, class cancellation rules, liability release, and payment conditions.
 * @module pages/legal/terms
 */

import { createElement } from '../../utils/dom.js';
import { CONFIG } from '../../core/config.js';

export async function render(container) {
  const page = createElement('div', { className: 'page-container' });

  const header = createElement('div', { className: 'page-header' });
  const title = createElement('h1', { className: 'page-title', text: 'Terms & Conditions' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Studio membership rules, booking and cancellation policies, and liability conditions.'
  });
  header.append(title, subtitle);
  page.appendChild(header);

  const article = createElement('article', { className: 'legal-content' });

  article.innerHTML = `
    <div style="background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-4); margin-bottom: var(--space-8); font-size: var(--text-xs); color: var(--ink-80);">
      <strong>Effective Date:</strong> April 11, 2026 | <strong>Studio Rules Version:</strong> 1.0
    </div>

    <h2>1. Studio Operations & 1:6 Coaching Ratio</h2>
    <p>
      Plash Pilates operates a dedicated boutique movement studio offering Reformer Pilates, Sculpt Yoga, and Barre Conditioning. To guarantee individualized posture corrections and alignment safety, all group classes are capped at a strict <strong>1:6 instructor-to-member ratio (maximum 6 participants per class)</strong>.
    </p>

    <h2>2. Booking & Cancellation Policy (4-Hour Window)</h2>
    <p>
      Due to intimate class sizes and equipment reservation commitments, the following cancellation policy is strictly enforced:
    </p>
    <ul style="padding-left: var(--space-6); font-size: var(--text-sm); line-height: 1.8; color: var(--ink-80); margin-bottom: var(--space-4);">
      <li><strong>Standard Cancellation:</strong> You may cancel any scheduled morning class (< 12:00 PM) up to <strong>${CONFIG.CANCELLATION_WINDOW_MORNING_HOURS} hours prior</strong> and any evening class (>= 12:00 PM) up to <strong>${CONFIG.CANCELLATION_WINDOW_EVENING_HOURS} hours prior</strong> to published class start time without penalty. Your session credit is automatically restored to your pass.</li>
      <li><strong>Late Cancellation:</strong> Cancellations made within the notice window (12 hours for morning classes, 6 hours for evening classes) of class start time will result in forfeiture of that session credit.</li>
      <li><strong>No-Shows:</strong> Failure to attend a reserved class without cancelling will result in automatic session forfeiture. Members with frequent no-shows may have advance booking privileges suspended.</li>
    </ul>

    <h2>3. Physicq 57 Barre Conditioning Reservations</h2>
    <p>
      Barre Conditioning classes are delivered in strategic partnership with <strong>Physicq 57</strong>. All Barre booking submissions are placed in <em>Pending Partner Review</em> status for certified coaches to review physical assessments and verify safety before confirmation. If a spot cannot be accommodated, the session credit is promptly restored to your membership pass.
    </p>

    <h2>4. Membership Passes & Expiry</h2>
    <ul style="padding-left: var(--space-6); font-size: var(--text-sm); line-height: 1.8; color: var(--ink-80); margin-bottom: var(--space-4);">
      <li><strong>Pass Validity:</strong> All membership packages possess fixed validity windows (1 Month = 30 Days, 3 Months = 90 Days, 6 Months = 180 Days) calculated from date of purchase or pass activation.</li>
      <li><strong>Unused Sessions:</strong> Session credits remaining on pass expiry are non-refundable and subject to forfeiture. One-week courtesy extensions are available upon management discretion.</li>
    </ul>

    <h2>5. Health Declarations & Liability Release</h2>
    <p>
      Reformer apparatus, spring resistance, and athletic barre exercises involve rigorous physical exertion. Prior to purchasing any pass, every member must execute our mandatory <strong>Liability Waiver & Health Declaration (v${CONFIG.WAIVER_VERSION})</strong>. You agree to disclose all spinal injuries, joint surgeries, and cardiovascular conditions and immediately advise instructors of any discomfort during class.
    </p>

    <h2>6. Governing Law & Dispute Resolution</h2>
    <p>
      These Terms and all studio relationships shall be governed by and construed in accordance with the laws of the Republic of India. Any disputes arising hereunder shall be subject to the exclusive jurisdiction of the competent courts in <strong>Bengaluru, Karnataka</strong>.
    </p>
  `;

  page.appendChild(article);
  container.appendChild(page);
}
