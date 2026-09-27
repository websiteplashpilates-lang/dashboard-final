/**
 * Plash Pilates — Member Portal: Packages & Memberships
 * Brand-aligned box-wise catalog layout with Plash's native studio palette
 * and full Outfit typography.
 * Selecting a plan connects seamlessly to the Cart without altering Razorpay logic.
 * @module pages/portal/packages
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import * as store from '../../core/store.js';
import * as cart from '../../core/cart.js';
import { showToast } from '../../components/toast.js';

// Scoped CSS styles using Plash's original warm studio palette and Outfit typography
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

.plash-packages-wrapper,
.plash-packages-wrapper * {
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  box-sizing: border-box;
}

.plash-packages-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1rem 4rem;
  color: var(--ink, #2B282F);
}

.plash-header-section {
  text-align: center;
  margin-bottom: 2.5rem;
  padding: 0.5rem 0;
}

.plash-header-eyebrow {
  display: inline-block;
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--rust, #BE603C);
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.plash-header-title {
  font-size: 2.85rem;
  font-weight: 700;
  color: var(--ink, #2B282F);
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin: 0 0 0.75rem;
}

.plash-header-sublink {
  font-size: 0.95rem;
  color: #6E6A5F;
  margin: 0 0 2rem;
}

.plash-header-sublink a {
  color: var(--rust, #BE603C);
  text-decoration: underline;
  text-underline-offset: 4px;
  font-weight: 600;
  transition: opacity 0.2s ease;
  cursor: pointer;
}

.plash-header-sublink a:hover {
  opacity: 0.8;
}

/* Category Filter Tabs */
.plash-filter-tabs {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 2.5rem;
}

.plash-filter-btn {
  background: #FFFFFF;
  border: 1px solid rgba(43, 40, 47, 0.14);
  color: #565243;
  padding: 0.55rem 1.35rem;
  border-radius: 9999px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(43, 40, 47, 0.04);
}

.plash-filter-btn:hover {
  background: #FDFBF7;
  color: var(--ink, #2B282F);
  border-color: rgba(43, 40, 47, 0.3);
}

.plash-filter-btn.active {
  background: var(--rust, #BE603C);
  color: #FFFFFF;
  border-color: var(--rust, #BE603C);
  box-shadow: 0 2px 8px rgba(190, 96, 60, 0.25);
}

/* Luxury Category Container Box - Studio Palette */
.plash-category-box {
  background: #FFFFFF;
  border: 1px solid rgba(43, 40, 47, 0.12);
  border-radius: 14px;
  margin-bottom: 2.75rem;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(43, 40, 47, 0.06);
  display: grid;
  grid-template-columns: 360px 1fr;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

@media (max-width: 980px) {
  .plash-category-box {
    grid-template-columns: 1fr;
  }
}

/* Left Column: Editorial & Description */
.plash-cat-left {
  background: #FAF7F2;
  padding: 2.75rem 2.25rem;
  border-right: 1px solid rgba(43, 40, 47, 0.09);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

@media (max-width: 980px) {
  .plash-cat-left {
    border-right: none;
    border-bottom: 1px solid rgba(43, 40, 47, 0.09);
    padding: 2.25rem 1.75rem;
  }
}

.plash-cat-title {
  font-size: 2.1rem;
  font-weight: 700;
  color: var(--ink, #2B282F);
  line-height: 1.2;
  margin: 0 0 0.5rem;
  letter-spacing: -0.02em;
}

.plash-cat-subtitle {
  color: var(--rust, #BE603C);
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 1.15rem;
}

.plash-cat-desc {
  color: #565243;
  font-size: 0.92rem;
  line-height: 1.65;
  margin-bottom: 2rem;
}

.plash-cat-checklist {
  list-style: none;
  padding: 0;
  margin: 0 0 2rem;
}

.plash-cat-check-item {
  display: flex;
  align-items: flex-start;
  color: var(--ink, #2B282F);
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.45;
  margin-bottom: 0.85rem;
}

.plash-check-icon {
  color: var(--rust, #BE603C);
  font-weight: 800;
  margin-right: 0.75rem;
  flex-shrink: 0;
  font-size: 1rem;
}

.plash-cat-footnote {
  margin-top: auto;
  font-size: 0.8rem;
  color: #8D877B;
  line-height: 1.5;
  padding-top: 1rem;
}

/* Right Column: Packages Strip List */
.plash-cat-right {
  background: #FFFFFF;
  padding: 1rem 2.25rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

@media (max-width: 980px) {
  .plash-cat-right {
    padding: 1rem 1.5rem;
  }
}

.plash-pkg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.65rem 0;
  border-bottom: 1px solid rgba(43, 40, 47, 0.08);
  transition: background-color 0.2s ease;
}

.plash-pkg-row:last-child {
  border-bottom: none;
}

@media (max-width: 680px) {
  .plash-pkg-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.4rem 0;
  }
}

.plash-pkg-info {
  flex: 1;
  min-width: 0;
}

.plash-pkg-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 0.35rem;
}

.plash-pkg-name {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--ink, #2B282F);
  letter-spacing: -0.01em;
}

.plash-badge-pill {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 0.15rem 0.65rem;
  border-radius: 9999px;
  text-transform: capitalize;
}

.plash-badge-pill.popular {
  background: rgba(190, 96, 60, 0.12);
  color: var(--rust, #BE603C);
  border: 1px solid rgba(190, 96, 60, 0.3);
}

.plash-badge-pill.best-value {
  background: rgba(110, 110, 54, 0.12);
  color: #5D5D2E;
  border: 1px solid rgba(110, 110, 54, 0.3);
}

.plash-badge-pill.daily-ritual {
  background: rgba(141, 82, 80, 0.12);
  color: #8D5250;
  border: 1px solid rgba(141, 82, 80, 0.3);
}

.plash-pkg-meta {
  color: #6E6A5F;
  font-size: 0.86rem;
  font-weight: 500;
  margin-bottom: 0.2rem;
}

.plash-pkg-subnote {
  color: #8D877B;
  font-size: 0.8rem;
}

/* Right Side: Price & Pill Button */
.plash-pkg-action-group {
  display: flex;
  align-items: center;
  gap: 1.75rem;
  flex-shrink: 0;
}

@media (max-width: 680px) {
  .plash-pkg-action-group {
    width: 100%;
    justify-content: space-between;
  }
}

.plash-pkg-price-col {
  text-align: right;
}

.plash-pkg-price {
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--ink, #2B282F);
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.plash-pkg-unit-rate {
  font-size: 0.8rem;
  color: #8D877B;
  font-weight: 500;
  margin-top: 0.15rem;
  white-space: nowrap;
}

.plash-buy-pill {
  background: transparent;
  color: var(--ink, #2B282F);
  border: 1.5px solid rgba(43, 40, 47, 0.25);
  border-radius: 9999px;
  padding: 0.6rem 1.65rem;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.plash-buy-pill:hover {
  background: var(--ink, #2B282F);
  border-color: var(--ink, #2B282F);
  color: #FFFFFF;
  transform: translateY(-1px);
}

.plash-buy-pill.featured {
  background: var(--rust, #BE603C);
  color: #FFFFFF;
  border-color: var(--rust, #BE603C);
  box-shadow: 0 2px 8px rgba(190, 96, 60, 0.25);
}

.plash-buy-pill.featured:hover {
  background: #A34E2E;
  border-color: #A34E2E;
}

/* Studio Policies & Guidelines Grid */
.plash-policies-card {
  background: #FFFFFF;
  border: 1px solid rgba(43, 40, 47, 0.12);
  border-radius: 14px;
  padding: 2.25rem;
  margin-top: 2rem;
  box-shadow: 0 4px 16px rgba(43, 40, 47, 0.04);
}

.plash-policies-header {
  margin-bottom: 1.5rem;
}

.plash-policies-title {
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--ink, #2B282F);
  margin: 0 0 0.35rem;
}

.plash-policies-sub {
  color: #6E6A5F;
  font-size: 0.9rem;
  margin: 0;
}

.plash-policies-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

@media (max-width: 860px) {
  .plash-policies-grid {
    grid-template-columns: 1fr;
  }
}

.plash-policy-item {
  background: #FAF7F2;
  border: 1px solid rgba(43, 40, 47, 0.08);
  border-radius: 10px;
  padding: 1.35rem;
}

.plash-policy-item h4 {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--rust, #BE603C);
  margin: 0 0 0.5rem;
}

.plash-policy-item p {
  color: #565243;
  font-size: 0.86rem;
  line-height: 1.55;
  margin: 0;
}
`;

function injectStylesOnce() {
  const styleId = 'plash-packages-box-styles';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = STYLES;
}

// Category Configuration & Editorial Text
const CATEGORIES = [
  {
    key: 'studio-pass',
    tabLabel: 'The Studio Pass',
    title: 'Intro offers & Studio Pass',
    subtitle: 'New to Plash? Begin here.',
    description: 'Experience the complete Plash ritual with the freedom to move across Pilates, Barre & Yoga all under one roof. Choose one discipline, explore two, or experience all three. Your pass lets you discover what your body enjoys and build a practice that feels uniquely yours.',
    checklist: [
      '1 Credit = 1 Session across disciplines',
      'Freedom to move between Pilates, Barre & Yoga',
      'Access to Indiranagar Flagship Studio apparatus',
      'Valid for all experience & fitness levels'
    ],
    footnote: 'Multi-month passes include extended validity for flexible scheduling.',
    actionLabel: 'GET',
    packageIds: [
      'pkg-class-4',
      'pkg-class-8',
      'pkg-class-12',
      'pkg-studio-combo-8-4',
      'pkg-studio-combo-12-4',
      'pkg-studio-combo-16-8',
      'pkg-studio-combo-24-8',
      'pkg-studio-combo-24-12',
      'pkg-studio-combo-36-12'
    ],
    metadata: {
      'pkg-class-4': { meta: '1 month · Shareable', sub: '4 Flexible Credits across all disciplines', rate: '₹1,050 / class' },
      'pkg-class-8': { meta: '1 month · Shareable', sub: '8 Flexible Credits across all disciplines', rate: '₹1,050 / class' },
      'pkg-class-12': { meta: '45 days · Shareable', sub: '12 Flexible Credits across all disciplines', rate: '₹1,050 / class' },
      'pkg-studio-combo-8-4': { meta: '35 days · Shareable', sub: '8 Reformer Pilates + 4 Physique 57 Barre', rate: '₹1,017 / class' },
      'pkg-studio-combo-12-4': { meta: '45 days · Shareable', sub: '12 Reformer Pilates + 4 Physique 57 Barre', rate: '₹1,028 / class', badge: 'Popular', badgeType: 'popular' },
      'pkg-studio-combo-16-8': { meta: '75 days · 2-Month Pass', sub: '16 Reformer Pilates + 8 Physique 57 Barre', rate: '₹983 / class' },
      'pkg-studio-combo-24-8': { meta: '75 days · 2-Month Pass', sub: '24 Reformer Pilates + 8 Physique 57 Barre', rate: '₹975 / class' },
      'pkg-studio-combo-24-12': { meta: '110 days · 3-Month Pass', sub: '24 Reformer Pilates + 12 Physique 57 Barre', rate: '₹983 / class' },
      'pkg-studio-combo-36-12': { meta: '110 days · 3-Month Pass', sub: '36 Reformer Pilates + 12 Physique 57 Barre', rate: '₹950 / class', badge: 'Best value', badgeType: 'best-value' }
    }
  },
  {
    key: 'pilates',
    tabLabel: 'Reformer Pilates',
    title: 'Sessions at Plash',
    subtitle: 'Reformer Pilates Apparatus Training',
    description: 'Master the classic and athletic Reformer repertoire with certified instructors. Precision spring-loaded resistance engineered for spinal alignment, deep core strength, and muscular lengthening.',
    checklist: [
      'Peak Pilates & Merrithew reformer apparatus',
      'Max 6 per class for dedicated instructor attention',
      'Includes +10 days bonus grace period on all multi-month packs',
      'Personal form corrections & progressive difficulty levels'
    ],
    footnote: 'Grip socks mandatory for all Reformer sessions. Valid at Indiranagar Studio.',
    actionLabel: 'BUY',
    packageIds: [
      'pkg-pilates-single',
      'pkg-pilates-12',
      'pkg-pilates-24',
      'pkg-pilates-36',
      'pkg-pilates-72'
    ],
    metadata: {
      'pkg-pilates-single': { meta: '1 credit · 2 days', sub: 'Single session drop-in, no commitment', rate: '₹1,200 / class' },
      'pkg-pilates-12': { meta: '40 days · 12 Sessions', sub: 'Includes +10 days bonus grace period', rate: '₹1,000 / class' },
      'pkg-pilates-24': { meta: '70 days · 24 Sessions', sub: 'Includes +10 days bonus grace period', rate: '₹900 / class' },
      'pkg-pilates-36': { meta: '100 days · 36 Sessions', sub: 'Includes +10 days bonus grace period', rate: '₹750 / class', badge: 'Popular', badgeType: 'popular' },
      'pkg-pilates-72': { meta: '190 days · 72 Sessions', sub: 'Includes +10 days bonus grace period', rate: '₹694 / class', badge: 'Best value', badgeType: 'best-value' }
    }
  },
  {
    key: 'barre',
    tabLabel: 'Physique 57 Barre',
    title: 'Physique 57 Barre',
    subtitle: 'Signature Full-Body Sculpt & Tone',
    description: 'The world-renowned, high-intensity, low-impact barre workout combining isometric strength training, cardio intervals, and restorative stretching for lean, sculpted muscles.',
    checklist: [
      'Certified Physique 57 master coaches',
      'Isometric hold & pulse burnout sets',
      'Low impact, high metabolic burn',
      'Suitable for all fitness and mobility levels'
    ],
    footnote: 'Barre classes are held on weekends and selected weekday slots.',
    actionLabel: 'BUY',
    packageIds: [
      'pkg-barre-4',
      'pkg-barre-8',
      'pkg-barre-16',
      'pkg-barre-24'
    ],
    metadata: {
      'pkg-barre-4': { meta: '1 month · 4 Classes', sub: 'Certified Physique 57 barre coaching', rate: '₹1,050 / class' },
      'pkg-barre-8': { meta: '40 days · 8 Classes', sub: '2 days/week training frequency', rate: '₹1,050 / class' },
      'pkg-barre-16': { meta: '70 days · 16 Classes', sub: '2 days/week training frequency', rate: '₹1,050 / class' },
      'pkg-barre-24': { meta: '100 days · 24 Classes', sub: 'Complete quarterly transformation', rate: '₹1,050 / class', badge: 'Best value', badgeType: 'best-value' }
    }
  },
  {
    key: 'yoga',
    tabLabel: 'Yoga at Plash',
    title: 'Yoga at Plash',
    subtitle: 'A slower, more intentional way to move',
    description: 'Step into a practice that brings together mindful movement, conscious breath and deep mobility. Our yoga sessions are designed to strengthen, lengthen and restore — leaving you feeling grounded, balanced and renewed.',
    checklist: [
      'Mindful movement, conscious breath & deep mobility',
      'Complement your Pilates practice or restore body & mind',
      'Warm ambient studio environment',
      'Premium mats & yoga props provided at studio'
    ],
    footnote: 'Your daily ritual of movement.',
    actionLabel: 'BUY',
    packageIds: [
      'pkg-yoga-dropin',
      'pkg-yoga-monthly'
    ],
    metadata: {
      'pkg-yoga-dropin': { meta: '2 days · 1 Session', sub: 'Single class drop-in booking', rate: 'Single class' },
      'pkg-yoga-monthly': { meta: '35 days · 20 Sessions', sub: 'Your daily ritual of movement', rate: '₹450 / class', badge: 'Daily ritual', badgeType: 'daily-ritual' }
    }
  }
];

let pkgRenderSeq = 0;

export async function render(container) {
  const currentSeq = ++pkgRenderSeq;
  clearChildren(container);
  injectStylesOnce();
  await store.fetchPackages();

  if (currentSeq !== pkgRenderSeq) return;

  // Reset any custom background so original studio theme shines through
  if (container) {
    container.style.backgroundColor = '';
    const mc = container.closest('.main-content') || document.querySelector('.main-content');
    if (mc) mc.style.backgroundColor = '';
  }

  const allPackages = store.getPackageCatalog();
  const pkgMap = new Map(allPackages.map(p => [p.id, p]));

  const wrapper = createElement('div', { className: 'plash-packages-wrapper' });

  // 1. Header Section
  const header = createElement('div', { className: 'plash-header-section' });
  const eyebrow = createElement('span', { className: 'plash-header-eyebrow', text: 'MEMBERSHIP PLANS' });
  const title = createElement('h1', { className: 'plash-header-title', text: 'Choose your journey' });
  
  const sublink = createElement('p', { className: 'plash-header-sublink' });
  sublink.innerHTML = 'Practising at our flagship studio? <a id="plash-jump-pilates">See our Reformer Pilates packs &rarr;</a>';
  header.append(eyebrow, title, sublink);
  wrapper.appendChild(header);

  // 2. Filter Tabs
  const filterNav = createElement('div', { className: 'plash-filter-tabs' });
  const allBtn = createElement('button', {
    className: 'plash-filter-btn active',
    text: 'All Plans',
    attributes: { 'data-filter': 'all' }
  });
  filterNav.appendChild(allBtn);

  CATEGORIES.forEach(cat => {
    const btn = createElement('button', {
      className: 'plash-filter-btn',
      text: cat.tabLabel,
      attributes: { 'data-filter': cat.key }
    });
    filterNav.appendChild(btn);
  });
  wrapper.appendChild(filterNav);

  // Container for all category boxes
  const boxesContainer = createElement('div', { className: 'plash-boxes-container' });

  // 3. Render Each Category Box
  CATEGORIES.forEach(cat => {
    const box = createElement('div', {
      className: 'plash-category-box',
      attributes: { 'data-category': cat.key, id: `cat-section-${cat.key}` }
    });

    // Left Column
    const leftCol = createElement('div', { className: 'plash-cat-left' });
    const catTitle = createElement('h2', { className: 'plash-cat-title', text: cat.title });
    const catSub = createElement('div', { className: 'plash-cat-subtitle', text: cat.subtitle });
    const catDesc = createElement('p', { className: 'plash-cat-desc', text: cat.description });

    const checklistUl = createElement('ul', { className: 'plash-cat-checklist' });
    cat.checklist.forEach(itemText => {
      const li = createElement('li', { className: 'plash-cat-check-item' });
      const checkSpan = createElement('span', { className: 'plash-check-icon', text: '✓' });
      const textSpan = createElement('span', { text: itemText });
      li.append(checkSpan, textSpan);
      checklistUl.appendChild(li);
    });

    const footnote = createElement('div', { className: 'plash-cat-footnote', text: cat.footnote });

    leftCol.append(catTitle, catSub, catDesc, checklistUl, footnote);
    box.appendChild(leftCol);

    // Right Column
    const rightCol = createElement('div', { className: 'plash-cat-right' });

    // Filter packages that belong to this category:
    // 1. Explicitly designated packages in cat.packageIds
    // 2. Dynamically added packages matching this discipline
    const explicitCategoryPkgs = cat.packageIds
      .map(id => pkgMap.get(id))
      .filter(Boolean);

    const otherCategoryExplicitIds = new Set(
      CATEGORIES.filter(c => c.key !== cat.key).flatMap(c => c.packageIds)
    );

    const dynamicCategoryPkgs = allPackages.filter(pkg => {
      if (cat.packageIds.includes(pkg.id)) return false;
      if (otherCategoryExplicitIds.has(pkg.id)) return false;

      if (cat.key === 'studio-pass') {
        return !pkg.disciplineId || (pkg.sessionAllocations && pkg.sessionAllocations.length > 1);
      }
      if (cat.key === 'pilates') {
        return pkg.disciplineId === 'disc-pilates' || (pkg.name && (pkg.name.toLowerCase().includes('pilates') || pkg.name.toLowerCase().includes('reformer')));
      }
      if (cat.key === 'barre') {
        return pkg.disciplineId === 'disc-barre' || (pkg.name && pkg.name.toLowerCase().includes('barre'));
      }
      if (cat.key === 'yoga') {
        return pkg.disciplineId === 'disc-sculpt-yoga' || (pkg.name && pkg.name.toLowerCase().includes('yoga'));
      }
      return false;
    });

    const categoryPkgs = [...explicitCategoryPkgs, ...dynamicCategoryPkgs];

    if (categoryPkgs.length === 0) {
      const emptyNotice = createElement('div', {
        className: 'plash-pkg-meta',
        text: 'Syncing latest rates from studio catalog...'
      });
      rightCol.appendChild(emptyNotice);
    } else {
      categoryPkgs.forEach(pkg => {
        const sessionsCount = (pkg.sessionAllocations || []).reduce((sum, a) => sum + (a.sessionCount || 0), 0);
        const metaInfo = cat.metadata[pkg.id] || {
          meta: `${pkg.durationMonths * 30} Days · ${sessionsCount || (pkg.durationMonths * 12)} Sessions`,
          sub: pkg.disciplineId ? 'Access to scheduled studio classes' : 'Multi-discipline access pass',
          rate: (sessionsCount && pkg.priceInr) ? `₹${Math.round(pkg.priceInr / sessionsCount).toLocaleString('en-IN')} / class` : ''
        };
        const isFeatured = metaInfo.badge || pkg.isPopular;
        const badgeType = metaInfo.badgeType || (pkg.isPopular ? 'popular' : 'best-value');

        const row = createElement('div', { className: 'plash-pkg-row' });

        // Left info
        const infoDiv = createElement('div', { className: 'plash-pkg-info' });
        const nameHeader = createElement('div', { className: 'plash-pkg-header' });
        const nameEl = createElement('span', { className: 'plash-pkg-name', text: pkg.name });
        nameHeader.appendChild(nameEl);

        if (metaInfo.badge) {
          const badgeEl = createElement('span', {
            className: `plash-badge-pill ${badgeType}`,
            text: metaInfo.badge
          });
          nameHeader.appendChild(badgeEl);
        } else if (pkg.isPopular) {
          const badgeEl = createElement('span', {
            className: 'plash-badge-pill popular',
            text: 'Popular'
          });
          nameHeader.appendChild(badgeEl);
        }

        const metaEl = createElement('div', {
          className: 'plash-pkg-meta',
          text: metaInfo.meta || `${pkg.durationMonths * 30} Days`
        });
        const subnoteEl = createElement('div', {
          className: 'plash-pkg-subnote',
          text: metaInfo.sub || 'Access to scheduled studio classes'
        });

        infoDiv.append(nameHeader, metaEl, subnoteEl);

        // Right action & price
        const actionGroup = createElement('div', { className: 'plash-pkg-action-group' });
        const priceCol = createElement('div', { className: 'plash-pkg-price-col' });
        const priceVal = createElement('div', {
          className: 'plash-pkg-price',
          text: `₹${Number(pkg.priceInr).toLocaleString('en-IN')}`
        });
        priceCol.appendChild(priceVal);

        if (metaInfo.rate) {
          const rateEl = createElement('div', { className: 'plash-pkg-unit-rate', text: metaInfo.rate });
          priceCol.appendChild(rateEl);
        }

        const buyBtn = createElement('button', {
          className: `plash-buy-pill ${isFeatured ? 'featured' : ''}`,
          text: cat.actionLabel || 'BUY',
          attributes: { 'aria-label': `Select ${pkg.name}` }
        });

        // Safe cart selection preserving untouched Razorpay pipeline
        buyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          cart.setCartPackage(pkg);
          showToast(`${pkg.name} added to cart.`, 'success');
          window.location.hash = '#/portal/cart';
        });

        actionGroup.append(priceCol, buyBtn);
        row.append(infoDiv, actionGroup);
        rightCol.appendChild(row);
      });
    }

    box.appendChild(rightCol);
    boxesContainer.appendChild(box);
  });

  wrapper.appendChild(boxesContainer);

  // 4. Studio Policies & Guidelines Section
  const policiesCard = createElement('div', { className: 'plash-policies-card' });
  const polHeader = createElement('div', { className: 'plash-policies-header' });
  const polTitle = createElement('h3', { className: 'plash-policies-title', text: 'Studio Guidelines & Booking Rules' });
  const polSub = createElement('p', {
    className: 'plash-policies-sub',
    text: 'Every booking operates under transparent studio rules designed for member safety and fair access.'
  });
  polHeader.append(polTitle, polSub);

  const polGrid = createElement('div', { className: 'plash-policies-grid' });

  const pol1 = createElement('div', { className: 'plash-policy-item' });
  pol1.innerHTML = '<h4>Grip Socks Mandatory</h4><p>Non-slip grip socks are strictly required for all Reformer Pilates and Barre apparatus classes for member safety and studio hygiene.</p>';

  const pol2 = createElement('div', { className: 'plash-policy-item' });
  pol2.innerHTML = '<h4>Cancellation Policy</h4><p>Morning classes (< 12:00 PM) require 12 hours advance cancellation. Evening classes require 6 hours. Early cancellations fully refund class credits.</p>';

  const pol3 = createElement('div', { className: 'plash-policy-item' });
  pol3.innerHTML = '<h4>+10 Days Grace Period</h4><p>All multi-month passes automatically include +10 additional grace days built in, ensuring uninterrupted practice if you travel or take a break.</p>';

  polGrid.append(pol1, pol2, pol3);
  policiesCard.append(polHeader, polGrid);
  wrapper.appendChild(policiesCard);

  // 5. Interactivity: Filter Tabs & Jump Links
  const filterBtns = wrapper.querySelectorAll('.plash-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterVal = btn.getAttribute('data-filter');
      const allBoxes = wrapper.querySelectorAll('.plash-category-box');

      if (filterVal === 'all') {
        allBoxes.forEach(b => {
          b.style.display = 'grid';
        });
      } else {
        allBoxes.forEach(b => {
          if (b.getAttribute('data-category') === filterVal) {
            b.style.display = 'grid';
            b.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            b.style.display = 'none';
          }
        });
      }
    });
  });

  const jumpLink = wrapper.querySelector('#plash-jump-pilates');
  if (jumpLink) {
    jumpLink.addEventListener('click', (e) => {
      e.preventDefault();
      const pilatesBtn = wrapper.querySelector('[data-filter="pilates"]');
      if (pilatesBtn) pilatesBtn.click();
    });
  }

  clearChildren(container);
  container.appendChild(wrapper);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
