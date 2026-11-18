/**
 * Renders the homepage content (Strapi-shaped JSON) into semantic HTML strings.
 *
 * Pure functions, no DOM access: this runs at dev/build time inside the Vite
 * plugin (vite.config.js) so all real copy ships in the HTML document itself
 * (view-source / crawler safe). The production frontend can reuse this logic in
 * its own SSR/SSG templates.
 */

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Media slot, in priority order: real image/video file (`media.url`), YouTube
 * preview (`video.id`: thumbnail in the HTML, muted preview swapped in by JS),
 * styled placeholder tile.
 */
export function renderMedia(media, title, palette = ['#2a0a5e', '#c32bff'], video = null) {
  const alt = esc(media?.alternativeText || title);
  if (media?.url && media.mime?.startsWith('video/')) {
    return `<video class="media" src="${esc(media.url)}" muted loop playsinline preload="metadata" aria-label="${alt}"></video>`;
  }
  if (media?.url) {
    return `<img class="media" src="${esc(media.url)}" alt="${alt}" loading="lazy" decoding="async">`;
  }
  if (video?.provider === 'youtube' && video.id) {
    const id = esc(video.id);
    return `<div class="media media--yt" data-yt="${id}" data-yt-start="${Number(video.start) || 0}"><img src="https://i.ytimg.com/vi/${id}/maxresdefault.jpg" alt="${alt}" loading="lazy" decoding="async" width="1280" height="720"><span class="media__play" aria-hidden="true">Preview</span></div>`;
  }
  return `<div class="media media--placeholder" role="img" aria-label="${alt}" style="--c1:${esc(palette[0])};--c2:${esc(palette[1])}"><span>${esc(title)}</span></div>`;
}

/** target/rel for links that leave the site (WhatsApp, socials, decks). */
const ext = (href = '') => (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '');
const link = (l, cls = '') => `<a ${cls ? `class="${cls}" ` : ''}href="${esc(l.href)}"${ext(l.href)}>${esc(l.label)}</a>`;

export function renderHead(c) {
  const seo = c.seo || c;
  return `
    <title>${esc(seo.metaTitle)}</title>
    <meta name="description" content="${esc(seo.metaDescription)}">
    <meta property="og:title" content="${esc(seo.metaTitle)}">
    <meta property="og:description" content="${esc(seo.metaDescription)}">
    ${seo.shareImage?.url ? `<meta property="og:image" content="${esc(seo.shareImage.url)}">` : ''}
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">`;
}

/** Shared site header + full-screen menu. `current` marks the active nav item (aria-current). */
export function renderHeader(c, current = '') {
  const { brand, navigation, contact, footer } = c;
  return `
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-nav" data-nav>
    <a class="site-nav__logo" href="/" aria-label="${esc(brand.name)} home">
      <img src="${esc(brand.logoNav.url)}" alt="${esc(brand.logoNav.alternativeText)}" width="${brand.logoNav.width}" height="${brand.logoNav.height}">
    </a>
    <div class="site-nav__actions">
      <button class="icon-btn menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Open menu" data-menu-toggle>
        <span class="menu-toggle__grid" aria-hidden="true">${'<i></i>'.repeat(9)}</span>
      </button>
    </div>
  </header>

  <div class="site-menu" id="site-menu" role="dialog" aria-modal="true" aria-label="Site menu" hidden data-menu>
    <div class="site-menu__slices" aria-hidden="true">${'<i></i>'.repeat(8)}</div>
    <nav class="site-menu__inner" aria-label="Primary">
      <ol class="site-menu__list">
        ${navigation
          .map(
            (n, i) =>
              `<li><a class="site-menu__link" href="${esc(n.href)}"${ext(n.href)} data-text="${esc(n.label)}"${current && n.href.replace(/\/$/, '').endsWith(current) ? ' aria-current="page"' : ''}><span class="mono">0${i + 1}</span>${esc(n.label)}</a></li>`
          )
          .join('')}
      </ol>
      <div class="site-menu__meta">
        <p class="mono">${contact.locations.map(esc).join(' · ')}</p>
        <ul class="site-menu__socials">${footer.socials.map((s) => `<li>${link(s)}</li>`).join('')}</ul>
      </div>
    </nav>
  </div>`;
}

export function renderBody(c) {
  const { brand, hero, work, services, brands, contact, footer } = c;
  const header = renderHeader(c);

  const heroHtml = `
    <section class="stop stop--hero" id="hero" data-stop="hero" aria-labelledby="hero-title">
      <img class="hero__logo-fallback" src="${esc(brand.logoFull.url)}" alt="${esc(brand.logoFull.alternativeText)}" width="${brand.logoFull.width}" height="${brand.logoFull.height}">
      <div class="hero__copy">
        <p class="eyebrow mono" data-reveal>${esc(hero.eyebrow)}</p>
        <h1 class="hero__title" id="hero-title">
          ${hero.headline.map((w) => `<span class="hero__word" data-glitch-text="${esc(w)}">${esc(w)}</span>`).join(' ')}
        </h1>
        <p class="hero__sub" data-reveal>${esc(hero.subline)}</p>
        <div class="hero__actions" data-reveal>
          <a class="btn btn--primary" href="${esc(hero.cta.href)}" data-showreel>
            <span class="btn__icon" aria-hidden="true"></span>${esc(hero.cta.label)}
          </a>
        </div>
      </div>
      <p class="scroll-hint mono" aria-hidden="true"><span></span>${esc(hero.scrollHint)}</p>
    </section>`;

  const workHtml = `
    <section class="work" id="work" aria-labelledby="work-title">
      <div class="work-intro">
        <p class="mono work-intro__idx" aria-hidden="true">01</p>
        <h2 class="work-intro__title" id="work-title" data-glitch-text="${esc(work.heading)}">${esc(work.heading)}</h2>
        <p class="mono work-intro__meta">${String(work.projects.length).padStart(2, '0')} projects · Scroll to fly through</p>
      </div>
      <div class="work-hud mono" aria-hidden="true">
        <span class="work-hud__label" data-hud-label>${esc(work.heading)}</span>
        <span class="work-hud__count"><b data-hud-num>01</b> / <span data-hud-total>${String(work.projects.length).padStart(2, '0')}</span></span>
        <span class="work-hud__bar">${work.projects.map(() => '<i></i>').join('')}</span>
      </div>
      ${work.projects
        .map(
          (p, i) => `
      <article class="stop stop--project" id="project-${esc(p.slug)}" data-stop="project" data-index="${i}" data-side="${i % 2 === 0 ? 'right' : 'left'}" aria-labelledby="p-${esc(p.slug)}">
        <figure class="project__media">${renderMedia(p.media, p.title, p.palette, p.video)}</figure>
        <div class="project__copy">
          <p class="eyebrow mono"><span class="project__num">${String(i + 1).padStart(2, '0')}</span> ${esc(work.label)}</p>
          <h3 class="project__title" id="p-${esc(p.slug)}" data-glitch-text="${esc(p.title)}">${esc(p.title)}</h3>
          <ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          <a class="btn btn--ghost" href="${esc(p.href)}">${esc(work.ctaLabel)}<span class="visually-hidden">: ${esc(p.title)}</span></a>
        </div>
      </article>`
        )
        .join('')}
      <div class="stop stop--explore" data-stop="explore">
        <a class="explore-link" href="${esc(work.exploreAll.href)}" data-text="${esc(work.exploreAll.label)}">${esc(work.exploreAll.label)} <span aria-hidden="true">→</span></a>
      </div>
    </section>`;

  const servicesHtml = `
    <section class="services" id="services" aria-labelledby="services-title">
      <div class="services-intro">
        <p class="mono services-intro__idx" aria-hidden="true">02</p>
        <h2 class="services-intro__title" id="services-title" data-glitch-text="${esc(services.heading)}">${esc(services.heading)}</h2>
        <p class="mono services-intro__meta">${String(services.items.length).padStart(2, '0')} disciplines · One studio</p>
      </div>
      ${services.items
        .map(
          (s, i) => `
      <article class="stop stop--service" id="service-${esc(s.slug)}" data-stop="service" data-index="${i}" data-side="${i % 2 === 0 ? 'right' : 'left'}" style="--zone:${esc(s.zoneColor)}" aria-labelledby="s-${esc(s.slug)}">
        <div class="service__copy">
          <p class="service__index mono"><span>${esc(s.index)}</span> Service</p>
          <h3 class="service__title" id="s-${esc(s.slug)}" data-glitch-text="${esc(s.title)}">${esc(s.title)}</h3>
          <p class="service__summary">${esc(s.summary)}</p>
          <ul class="service__caps">${s.capabilities.map((cap) => `<li>${esc(cap)}</li>`).join('')}</ul>
        </div>
      </article>`
        )
        .join('')}
    </section>`;

  const brandsHtml = `
    <section class="brands" id="brands" data-stop="brands" aria-labelledby="brands-title">
      <div class="brands__sticky">
        <canvas class="brands__reel" aria-hidden="true"></canvas>
        <div class="brands__head">
          <h2 class="brands__title mono" id="brands-title"><span class="brands__idx">05</span> ${esc(brands.heading)}</h2>
          <p class="brands__count mono" aria-hidden="true"><span>${String(brands.items.length).padStart(2, '0')}</span> partners</p>
        </div>
        <p class="brands__hint mono" aria-hidden="true">Move to distort</p>
      </div>
      <ul class="brands__list">${brands.items
        .map((b) =>
          b.logo?.url
            ? `<li><img src="${esc(b.logo.url)}" alt="${esc(b.name)}" loading="lazy"></li>`
            : `<li data-text="${esc(b.name)}">${esc(b.name)}</li>`
        )
        .join('')}</ul>
    </section>`;

  const contactHtml = `
    <section class="contact" id="contact" data-stop="contact" data-scroll-end aria-labelledby="contact-title">
      <div class="contact__inner">
        <img class="contact__logo-fallback" src="${esc(brand.logoFull.url)}" alt="" width="${brand.logoFull.width}" height="${brand.logoFull.height}" loading="lazy">
        <h2 class="contact__title" id="contact-title">
          <span class="contact__kicker">${esc(contact.heading)}</span>
          <span class="contact__line" data-glitch-text="${esc(contact.subheading)}">${esc(contact.subheading)}</span>
        </h2>
        <a class="btn btn--primary contact__cta" href="${esc(contact.cta.href)}"${ext(contact.cta.href)}><span class="btn__icon" aria-hidden="true"></span>${esc(contact.cta.label)}</a>
        ${contact.whatsapp ? `<p class="contact__wa mono">WhatsApp · <a href="${esc(contact.whatsapp.href)}"${ext(contact.whatsapp.href)}>${esc(contact.whatsapp.number)}</a></p>` : ''}
        <ul class="contact__locations mono" aria-label="Studios">${contact.locations.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      </div>
    </section>`;

  const footerHtml = renderFooter(c);
  const reel = hero.cta.video;
  const showreelHtml = renderVideoModal(reel);

  return `${header}
  <canvas class="gl" id="gl" aria-hidden="true"></canvas>
  <div class="fx-grain" aria-hidden="true"></div>
  <main id="main" class="journey">
    ${heroHtml}
    ${workHtml}
    ${servicesHtml}
    ${brandsHtml}
    ${contactHtml}
  </main>
  ${footerHtml}
  ${showreelHtml}`;
}

/** Shared footer. */
export function renderFooter(c) {
  const { brand, services, footer } = c;
  return `
  <footer class="site-footer">
    <div class="site-footer__top">
      <p class="site-footer__statement">${esc(footer.tagline)}</p>
      <a class="site-footer__totop mono" href="#main">Back to top <span aria-hidden="true">↑</span></a>
    </div>
    <div class="site-footer__grid">
      <div class="site-footer__brand">
        <img src="${esc(brand.logoNav.url)}" alt="${esc(brand.name)}" width="${brand.logoNav.width}" height="${brand.logoNav.height}" loading="lazy">
        <p>${esc(footer.blurb || '')}</p>
      </div>
      <nav aria-labelledby="f-links"><h2 id="f-links" class="site-footer__h">Quick Links</h2><ul>${footer.quickLinks.map((l) => `<li>${link(l)}</li>`).join('')}</ul></nav>
      <div><h2 class="site-footer__h">Services</h2><ul>${services.items.map((s) => `<li><a href="/#service-${esc(s.slug)}">${esc(s.title)}</a></li>`).join('')}</ul></div>
      <div><h2 class="site-footer__h">Studios</h2><ul>${footer.locations.map((l) => `<li>${esc(l.city)}, ${esc(l.country)}</li>`).join('')}</ul></div>
      <div><h2 class="site-footer__h">Follow</h2><ul>${footer.socials.map((s) => `<li><a href="${esc(s.href)}" rel="noopener" target="_blank">${esc(s.label)}</a></li>`).join('')}</ul></div>
    </div>
    <div class="site-footer__bottom">
      <p>${esc(footer.copyright)}</p>
      <ul>${footer.legal.map((l) => `<li>${link(l)}</li>`).join('')}</ul>
    </div>
  </footer>`;
}

/** Shared video overlay (showreel + any YouTube "Watch" button with data-showreel data-yt). */
export function renderVideoModal(video) {
  return `
  <div class="showreel" id="showreel" role="dialog" aria-modal="true" aria-label="${esc(video?.title || 'Video')}" hidden data-showreel-modal data-yt="${esc(video?.id || '')}">
    <div class="showreel__slices" aria-hidden="true">${'<i></i>'.repeat(8)}</div>
    <div class="showreel__frame"><div class="showreel__player" data-showreel-player></div></div>
    <button class="icon-btn showreel__close" type="button" aria-label="Close video" data-showreel-close><span aria-hidden="true">✕</span></button>
  </div>`;
}

/* =====================================================================
 * Sub-pages: Work, About, Blogs. Same chrome (header/menu/footer/video
 * overlay) as the homepage; content from work.json / about.json / blogs.json.
 * ===================================================================== */

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

function pageShell(home, current, mainHtml, pageClass) {
  return `${renderHeader(home, current)}
  <canvas class="bg-shards" aria-hidden="true"></canvas>
  <div class="fx-grain" aria-hidden="true"></div>
  <main id="main" class="page ${pageClass}">
${mainHtml}
  </main>
  ${renderFooter(home)}
  ${renderVideoModal(null)}`;
}

function pageHero({ eyebrow, title, intro }, extra = '') {
  return `
    <section class="phero">
      <p class="eyebrow mono" data-reveal>${esc(eyebrow)}</p>
      <h1 class="phero__title" data-glitch-text="${esc(title)}">${esc(title)}</h1>
      ${intro ? `<p class="phero__intro" data-reveal>${esc(intro)}</p>` : ''}
      ${extra}
    </section>`;
}

function stats(list) {
  return `<ul class="pstats" data-reveal>${list
    .map((s) => `<li><span class="pstats__value">${esc(s.value)}</span><span class="pstats__label">${esc(s.label)}</span></li>`)
    .join('')}</ul>`;
}

/** "Watch" control: YouTube opens the in-page video overlay; others open the source in a new tab. */
function watchControl(watch, title, cls = 'watch') {
  if (!watch) return '';
  if (watch.provider === 'youtube') {
    return `<button type="button" class="${cls}" data-showreel data-yt="${esc(watch.id)}" data-title="${esc(title)}"${watch.vertical ? ' data-vertical' : ''} aria-label="Watch ${esc(title)}"><span class="watch__icon" aria-hidden="true"></span>Watch</button>`;
  }
  const where = watch.provider === 'instagram' ? 'Instagram' : 'Google Drive';
  return `<a class="${cls}" href="${esc(watch.url)}" target="_blank" rel="noopener" aria-label="Watch ${esc(title)} on ${where} (opens in a new tab)"><span class="watch__icon" aria-hidden="true"></span>Watch <span class="watch__ext" aria-hidden="true">↗</span></a>`;
}

function pageCta(home) {
  const { contact } = home;
  return `
    <section class="page-cta" aria-labelledby="page-cta-title">
      <p class="contact__kicker">${esc(contact.heading)}</p>
      <h2 class="page-cta__title" id="page-cta-title">${esc(contact.subheading)}</h2>
      <a class="btn btn--primary" href="${esc(contact.cta.href)}"${ext(contact.cta.href)}><span class="btn__icon" aria-hidden="true"></span>${esc(contact.cta.label)}</a>
    </section>`;
}

/* ---------------- WORK ---------------- */
export function renderWorkPage(home, w) {
  const bySlug = Object.fromEntries(w.projects.map((p) => [p.slug, p]));
  const catLabel = Object.fromEntries(w.all.categories.map((c) => [c.key, c.label]));
  const meta = (p) => [p.location, p.year].filter(Boolean).join(' · ');

  const heroExtra = `
      <figure class="phero__media" data-reveal>
        <img src="${esc(w.hero.image.url)}" alt="${esc(w.hero.image.alternativeText)}" width="1600" height="900" fetchpriority="high">
        <figcaption class="mono">${esc(w.hero.imageCaption)}</figcaption>
      </figure>
      ${stats(w.stats)}`;

  const reels = `
    <section class="psec reels" aria-labelledby="reels-title">
      <h2 class="psec__title" id="reels-title">${esc(w.showreels.heading)}</h2>
      <div class="reels__grid">
        ${w.showreels.items
          .map(
            (r) => `
        <article class="reel-card" data-reveal>
          <div class="reel-card__media"><img src="${esc(r.thumbnail?.url || `https://i.ytimg.com/vi/${r.video.id}/hqdefault.jpg`)}" alt="" loading="lazy" width="1280" height="720"></div>
          <div class="reel-card__body">
            <h3>${esc(r.title)}</h3>
            <p>${esc(r.summary)}</p>
            ${watchControl({ provider: 'youtube', id: r.video.id }, r.title, 'btn btn--primary reel-card__play')}
          </div>
        </article>`
          )
          .join('')}
      </div>
      <div class="decks" data-reveal>
        <h3 class="decks__title mono">${esc(w.showreels.decksHeading)}</h3>
        <ul class="decks__list">${w.showreels.decks
          .map((d) => `<li><a href="${esc(d.href)}" target="_blank" rel="noopener"><span class="decks__name">${esc(d.title)}</span><span class="decks__fmt mono">${esc(d.format)} ↗</span></a></li>`)
          .join('')}</ul>
      </div>
    </section>`;

  const showcase = `
    <section class="psec showcase" aria-labelledby="showcase-title">
      <p class="eyebrow mono">${esc(w.featured.eyebrow)}</p>
      <h2 class="psec__title" id="showcase-title">${esc(w.featured.heading)}</h2>
      <p class="psec__intro">${esc(w.featured.intro)}</p>
      ${w.featured.groups
        .map(
          (g) => `
      <div class="showcase__group" id="cat-${esc(g.key)}">
        <div class="showcase__head"><h3>${esc(g.heading)}</h3><p>${esc(g.summary)}</p></div>
        <div class="wgrid">
          ${g.items
            .map(({ ref, displayTitle }) => {
              const p = bySlug[ref];
              return `
          <article class="wcard" id="${esc(p.slug)}" data-reveal>
            <div class="wcard__media"><img src="${esc(p.image.url)}" alt="${esc(p.image.alternativeText)}" loading="lazy" width="800" height="450"></div>
            <div class="wcard__body">
              <h4 class="wcard__title">${esc(displayTitle)}</h4>
              <p class="wcard__meta mono">${esc(meta(p))}</p>
              ${watchControl(p.watch, displayTitle, 'watch wcard__watch')}
            </div>
          </article>`;
            })
            .join('')}
        </div>
      </div>`
        )
        .join('')}
    </section>`;

  const index = `
    <section class="psec windex" id="all" aria-labelledby="all-title">
      <p class="eyebrow mono">${esc(w.all.eyebrow)}</p>
      <h2 class="psec__title" id="all-title">${esc(w.all.heading)}</h2>
      <div class="wtabs" role="group" aria-label="Filter projects" data-filter>
        <button type="button" class="wtab" data-cat="all" aria-pressed="true">All <span>${w.projects.length}</span></button>
        ${w.all.categories
          .map((c) => `<button type="button" class="wtab" data-cat="${esc(c.key)}" aria-pressed="false">${esc(c.label)} <span>${w.projects.filter((p) => p.category === c.key).length}</span></button>`)
          .join('')}
      </div>
      <ul class="wlist" data-filter-list>
        ${w.projects
          .map(
            (p) => `
        <li class="wrow" data-cat="${esc(p.category)}">
          <div class="wrow__text">
            <span class="wrow__title">${esc(p.title)}${p.year ? ` <span class="wrow__year">${p.year}</span>` : ''}</span>
            <span class="wrow__meta">${esc(catLabel[p.category])} · ${esc(p.location)}</span>
          </div>
          ${watchControl(p.watch, p.title, 'watch wrow__watch')}
        </li>`
          )
          .join('')}
      </ul>
      <p class="wlist__count mono" aria-live="polite" data-filter-count></p>
    </section>`;

  return pageShell(home, '/work', `${pageHero(w.hero, heroExtra)}${reels}${showcase}${index}${pageCta(home)}`, 'page--work');
}

/* ---------------- ABOUT ---------------- */
export function renderAboutPage(home, a) {
  const initials = (n) => n.split(/\s+/).map((x) => x[0]).slice(0, 2).join('');
  const body = `
    ${pageHero(a.hero)}
    <section class="psec vision" aria-labelledby="vision-title">
      <p class="eyebrow mono">${esc(a.vision.eyebrow)}</p>
      <h2 class="vision__statement" id="vision-title" data-reveal>${esc(a.vision.statement)}</h2>
      <p class="vision__body" data-reveal>${esc(a.vision.body)}</p>
    </section>
    <section class="psec values" aria-labelledby="values-title">
      <p class="eyebrow mono" id="values-title">${esc(a.values.eyebrow)}</p>
      <ul class="values__list">${a.values.items.map((v, i) => `<li data-reveal><span class="mono">0${i + 1}</span><span class="values__word" data-glitch-text="${esc(v)}">${esc(v)}</span></li>`).join('')}</ul>
      ${stats(a.stats)}
    </section>
    <section class="psec studios" aria-labelledby="studios-title">
      <p class="eyebrow mono" id="studios-title">${esc(a.studios.eyebrow)}</p>
      <ul class="studios__list">${a.studios.items
        .map((s) => `<li data-reveal><span class="studios__country">${esc(s.country)}</span>${s.cities.length ? `<span class="studios__cities mono">${s.cities.map(esc).join(' · ')}</span>` : ''}</li>`)
        .join('')}</ul>
    </section>
    <section class="psec team" aria-labelledby="team-title">
      <p class="eyebrow mono">${esc(a.team.eyebrow)}</p>
      <h2 class="psec__title" id="team-title">${esc(a.team.heading)}</h2>
      <ul class="team__grid">${a.team.members
        .map(
          (m) => `
        <li class="tcard" data-reveal>
          <div class="tcard__photo">${m.photo ? `<img src="${esc(m.photo.url)}" alt="${esc(m.photo.alternativeText)}" loading="lazy" width="400" height="400">` : `<span aria-hidden="true">${esc(initials(m.name))}</span>`}</div>
          <p class="tcard__name">${esc(m.name)}</p>
          <p class="tcard__role">${esc(m.role)}</p>
        </li>`
        )
        .join('')}</ul>
    </section>
    <section class="page-cta" aria-labelledby="about-cta">
      <h2 class="page-cta__title" id="about-cta">${esc(a.cta.heading)}</h2>
      <div class="page-cta__actions">
        <a class="btn btn--primary" href="${esc(a.cta.primary.href)}"><span class="btn__icon" aria-hidden="true"></span>${esc(a.cta.primary.label)}</a>
        <a class="btn btn--ghost" href="${esc(a.cta.secondary.href)}"${ext(a.cta.secondary.href)}>${esc(a.cta.secondary.label)}</a>
      </div>
    </section>`;
  return pageShell(home, '/about', body, 'page--about');
}

/* ---------------- BLOGS ---------------- */
export function renderBlogsPage(home, b) {
  const posts = b.posts.filter((p) => !p.hidden);
  const [lead, ...rest] = posts;
  const card = (p, big = false) => `
        <article class="bcard${big ? ' bcard--lead' : ''}" data-reveal>
          <a class="bcard__link" href="${esc(p.href)}">
            <div class="bcard__media">${p.cover ? `<img src="${esc(p.cover.url)}" alt="" loading="${big ? 'eager' : 'lazy'}" width="800" height="560">` : ''}</div>
            <div class="bcard__body">
              <time class="bcard__date mono" datetime="${esc(p.publishedAt)}">${esc(fmtDate(p.publishedAt))}</time>
              ${big ? `<h2 class="bcard__title">${esc(p.title)}</h2>` : `<h3 class="bcard__title">${esc(p.title)}</h3>`}
              <p class="bcard__excerpt">${esc(p.excerpt)}</p>
              <span class="bcard__more mono">${esc(b.readLabel)} <span aria-hidden="true">→</span></span>
            </div>
          </a>
        </article>`;
  const body = `
    ${pageHero(b.hero)}
    <section class="psec blog" aria-label="Articles">
      ${lead ? card(lead, true) : ''}
      <div class="bgrid">${rest.map((p) => card(p)).join('')}</div>
    </section>
    ${pageCta(home)}`;
  return pageShell(home, '/blogs', body, 'page--blogs');
}

/* ---------------- BLOG ARTICLE ---------------- */
/** SEO for an article page (title, description, cover as share image). */
export function postSeo(post) {
  return {
    metaTitle: `${post.title} | Zero Design Studio Blog`,
    metaDescription: post.excerpt,
    shareImage: post.cover || post.headerImage || null,
  };
}

export function renderPostPage(home, b, post) {
  const others = b.posts.filter((p) => p.slug !== post.slug).slice(0, 3);
  const hero = post.headerImage || post.cover;
  const more = others
    .map(
      (p) => `
        <article class="bcard" data-reveal>
          <a class="bcard__link" href="${esc(p.href)}">
            <div class="bcard__media">${p.cover ? `<img src="${esc(p.cover.url)}" alt="" loading="lazy" width="800" height="560">` : ''}</div>
            <div class="bcard__body">
              <time class="bcard__date mono" datetime="${esc(p.publishedAt)}">${esc(fmtDate(p.publishedAt))}</time>
              <h3 class="bcard__title">${esc(p.title)}</h3>
              <span class="bcard__more mono">${esc(b.readLabel)} <span aria-hidden="true">→</span></span>
            </div>
          </a>
        </article>`
    )
    .join('');

  // contentHtml is sanitized at import time (tag + attribute whitelist): see README.
  const body = `
    <article class="post" aria-labelledby="post-title">
      <header class="post__head">
        <nav class="post__crumbs mono" aria-label="Breadcrumb"><a href="/blogs/">${esc(b.hero.eyebrow)}</a> <span aria-hidden="true">/</span> <span>${esc(fmtDate(post.publishedAt))}</span></nav>
        <h1 class="phero__title post__title" id="post-title" data-glitch-text="${esc(post.title)}">${esc(post.title)}</h1>
        <p class="post__meta mono"><time datetime="${esc(post.publishedAt)}">${esc(fmtDate(post.publishedAt))}</time> · Zero Design Studio</p>
      </header>
      ${hero ? `<figure class="post__hero" data-reveal><img src="${esc(hero.url)}" alt="${esc(hero.alternativeText || '')}" width="1600" height="700" fetchpriority="high"></figure>` : ''}
      <div class="prose">
        ${post.contentHtml}
      </div>
      <footer class="post__foot">
        <a class="btn btn--ghost" href="/blogs/"><span aria-hidden="true">←</span> ${esc(b.backLabel)}</a>
      </footer>
    </article>
    ${others.length ? `
    <section class="psec post-more" aria-labelledby="more-title">
      <h2 class="psec__title" id="more-title">${esc(b.moreHeading)}</h2>
      <div class="bgrid">${more}</div>
    </section>` : ''}
    ${pageCta(home)}`;
  return pageShell(home, '/blogs', body, 'page--post');
}
