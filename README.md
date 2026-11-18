# Zero Design Studio: Homepage Concept Prototype

A working design reference for the redesigned ZDS website: the homepage plus **Work**, **About** and **Blogs** pages. The homepage is one continuous dark 3D space you fly through (hero → selected work → services → brands → contact), with all real content as semantic HTML. **This is a prototype for the Director and the dev team, not the production site.**

---

## Run it

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # production build → dist/
npm run preview    # serve the build locally
```

Useful URL switches (prototype only):

| URL | What it does |
|---|---|
| `?stats` | Small fps / pixel-ratio / bloom / quality-level meter, bottom-left |
| `?reduced` | Forces the reduced-motion experience (same as the OS setting) |

Pages: `/` (homepage), `/work/`, `/about/`, `/blogs/`. `/work` without the slash redirects; unknown URLs return 404 instead of silently showing the homepage.

On phones (< 768px), and whenever the visitor's system has reduced motion turned on, the page switches to the **lite** layout automatically: no camera flight, with stacked cards in the same look.

---

## Where things are

```
index.html                 Homepage shell: fonts, meta outlet, body outlet
work/ about/ blogs/        Inner page shells (same outlets, load src/page.js)
blogs/<slug>/              One shell per article, generated from blogs.json by vite.config.js
vite.config.js             Renders the content JSON into index.html (dev + build)
public/
  fonts/                   Barlow ExtraBold + Lato (self-hosted, OFL licences included)
  assets/logo/             zds-logo-full.webp (hero/contact particles), zds-logo-white.webp (nav/footer)
  assets/projects/         Drop real project images / MP4s here
src/
  content/home.json        Homepage copy + shared nav/footer (Strapi-shaped). Start here.
  content/work.json        Work page: stats, showreels, decks, 24 featured + 72 listed projects
  content/about.json       About page: intro, vision, values, studios, team (35)
  content/blogs.json       Blog: 25 posts with full article content (listing + one page each)
  content/adapter.js       getHomeContent(): local JSON today, Strapi fetch later
  content/render.js        Pure functions: content → semantic HTML for every page (used at build time)
  page.js                  Inner pages: menu, video overlay, reveals, Work filter, 2D shard backdrop
  main.js                  Mode detection, smooth scroll, menu, links, brand reel, mobile cards;
                           lazy-loads the 3D bundle
  scene/experience.js      Boots the WebGL experience (dynamic import → separate chunk)
  scene/World.js           Renderer, bloom + chromatic/glitch post pass, render loop,
                           pause rules, adaptive quality
  scene/LogoAssembly.js    Logo bitmap → ~22k instanced shards (assemble / scatter / repel)
  scene/ShardField.js      Ambient glitch shards filling the journey (one instanced draw)
  scene/Journey.js         Waypoints + scroll→camera mapping, project objects, service zones,
                           zone colour/lighting blend, contact pull-back
  scene/ProjectObject.js   Project tiles that resolve into the visual as the camera approaches
  scene/YouTubeLayer.js    Muted YouTube previews placed *on* the 3D planes (CSS3DRenderer)
  scene/ServiceZone.js     The four service zone visuals (frames / portal / cubes / ledwall)
  scene/CameraRig.js       Catmull-Rom camera + look-at path, damping, mouse parallax
  scene/shaders/final.js   Chromatic aberration, block glitch, scanlines, vignette
  ui/brandReel.js          Kinetic-type brand reel (2D canvas)
  ui/menu.js               Full-screen glitch menu (focus trap, Esc)
  ui/showreel.js           "Watch Showreel" overlay (YouTube, sound on)
  ui/youtube.js            YouTube embed URL + "is it actually playing?" helper
  ui/links.js              Same-page links scroll smoothly (also from inside the menu); hash on arrival
  ui/bgShards.js           Lightweight 2D shard backdrop for inner pages (no three.js)
  ui/glitch.js             Text scramble, RGB-split glitch, nav-logo glitch
  styles/tokens.css        Brand tokens (colours, fonts, @font-face)
```

---

## Content (home.json)

Everything a visitor reads lives in **`src/content/home.json`**, shaped like a Strapi 5 REST response (`{ data: { … }, meta: {} }`). Edit it and the page reloads.

| Key | Drives |
|---|---|
| `seo` | `<title>`, meta description, Open Graph |
| `brand` | Logos (full logo is also the particle source) |
| `navigation` | Menu links |
| `hero` | Eyebrow line, headline words, sub-line, showreel button + `video` |
| `work.projects[]` | Title, tags, link, `media`, `video`, `palette` (placeholder tint) |
| `services.items[]` | Title, summary, capabilities, `zoneColor`, `visual` (`frames` / `portal` / `cubes` / `ledwall`) |
| `brands.items[]` | Brand names (`logo` optional, see below) |
| `contact` | Close copy, button, city list |
| `footer` | Statement, blurb, quick links, studios, socials, legal, copyright |

### Swapping in real assets (one-line changes)

**Project visual.** Priority is real file → YouTube → placeholder:

```jsonc
// Image
"media": { "url": "/assets/projects/abg-awards.jpg", "mime": "image/jpeg", "alternativeText": "…" }
// MP4 (plays as a video texture in 3D while the camera is near)
"media": { "url": "/assets/projects/abg-awards.mp4", "mime": "video/mp4", "alternativeText": "…" }
// YouTube preview (current setup): id is the part after v= in the YouTube link
"video": { "provider": "youtube", "id": "gyf2Ls0ZzBY", "start": 12 }
```

With `media.url` empty and a `video` set, the 3D tiles resolve into the YouTube thumbnail and the muted, looping preview is laid on top. `start` (seconds) skips a slow intro.

> **YouTube IDs.** *Elie Saab × M3M*, *ABG Awards 2025* and *SBI Life Sangam 2025* are confirmed against portfolio.zerodesignstudios.com. *Anamorphic 3D* still uses a stand-in (the 2025 anamorphic showreel; `"confirmed": false`) because the NSE bull film isn't in the portfolio. Replace its `id` when available.

**Showreel.** `hero.cta.video.id` (currently the "ZDS Showreel 2025" video).

**Brand logos.** Set `"logo": { "url": "/assets/brands/airtel.svg" }` on a brand. The HTML list then uses the image (with the name as alt text). The animated reel always uses the brand **name** as type; that is the design.

**Logo particles.** Replace `public/assets/logo/zds-logo-full.webp`. Any image with a transparent or white background works. Pixels that are white or transparent are ignored, and the colours of the remaining pixels are kept.

---

## Inner pages

| Page | Content file | Source of the content |
|---|---|---|
| `/work/` | `work.json` | portfolio.zerodesignstudios.com: stats, showreels, capability decks, 24 featured projects (with the portfolio's thumbnails), and the full list of 72 with a category filter |
| `/about/` | `about.json` | zerodesignstudios.com/about (intro + team with photos); vision, values and numbers from the portfolio |
| `/blogs/` | `blogs.json` | zerodesignstudios.com/blogs: every post in the sitemap (title, description, date, cover) |
| `/blogs/<slug>/` | `blogs.json` → `posts[].contentHtml` | The full article text and header image from each live post |

- **Watch buttons.** YouTube projects open in the same on-page video overlay as the showreel (Shorts play in a vertical frame). Instagram and Google Drive links open in a new tab.
- **Images are referenced, not copied.** Project thumbnails point at portfolio.zerodesignstudios.com/images/…, team photos and blog covers at cdn.zerodesignstudios.com (your Strapi CDN), YouTube covers at i.ytimg.com. In production, move them into Strapi media.
- **Every blog post has its own page** in the site UI (`/blogs/<slug>/`): breadcrumb, title, header image, the full article in a reading column, "All articles" and three more posts. Article bodies are stored as sanitized HTML (`contentHtml`: only p, h2–h4, strong/em, links, lists, images, blockquote; links open in a new tab), the shape Strapi rich text produces. Add a post to `blogs.json` and its page is generated automatically.
- **Source typos fixed on import:** the live articles have words fused with "and"/"or" ("contentand") and missing spaces between sentences ("today.As"). ~50 of these were corrected; the wording is otherwise unchanged.
- **Brand rule exception:** blog posts may use the word "events" (agreed); all 25 posts are published with their original wording.
- **Live-site metadata bug (worth fixing):** the live blog posts' Open Graph tags are placeholders ("We are a creative studio based in New York City…", image on a misspelled domain), so shared links preview incorrectly.

### Links

- Menu: Work → `/work/`, About → `/about/`, Blogs → `/blogs/`, Contact → WhatsApp (`https://wa.me/919977098856`, opens in a new tab). Every Contact button on every page uses the same link (`home.json → contact.cta.href`).
- Same-page links scroll smoothly instead of jumping, including from inside the open menu (`ui/links.js`). Arriving on `/#contact` from another page lands on the finished contact shot once the 3D layout is ready.
- Homepage "View Case Study" → the project's card on `/work/`. Footer services → their zone on the homepage. Legal links → the live site's pages.

## Connecting to Strapi

The prototype is built so the CMS swap is mechanical:

1. **Model.** Create Single Types `homepage`, `work-page`, `about-page` and `blogs-page` (or Collection Types for projects, team members and posts). For `homepage`, use fields that mirror `home.json`, with components for `seo`, `hero`, `contact` and `footer`, repeatable components (or relations) for `work.projects`, `services.items` and `brands.items`, and Media fields wherever the JSON has `{ url, mime, alternativeText }`. `services.items[].visual` is an Enumeration (`frames`, `portal`, `cubes`, `ledwall`). `video` is a small component (`provider`, `id`, `start`).
2. **Fetch.** Replace the body of `getHomeContent()` in `src/content/adapter.js` (a commented example is in the file). Use `populate` for nested media and components. Relative upload URLs need the API origin prefixed; `mediaUrl()` handles that.
3. **Render on the server.** Keep the SEO guarantee: all copy must be in the HTML response. Today `vite.config.js` calls `render.js` at build time. In production, call the same `renderHead` / `renderBody` (or port them to your templates) inside your SSR/SSG (Next, Astro, Nuxt, or a Node template). The 3D layer only *reads* content and the DOM; it never creates copy.
4. **Revalidate.** Rebuild or revalidate the page on Strapi publish (webhook → ISR / build hook).

Nothing in `src/scene/` depends on where the data comes from.

---

## How it works (for the dev team)

- **One scroll, many stops.** The page is real `<section>`s. `Journey.measure()` turns their positions into scroll anchors. Each project and service `<article>` is ~180vh with a sticky copy panel; the camera *parks* while the copy is pinned and flies between stops in the gaps. The spline is Catmull-Rom; stop *k* is waypoint *k*.
- **Hidden jump.** While the brand reel fully covers the screen, rendering is paused and the camera snaps from the last service zone back to the logo. The contact close then pulls back as the logo reassembles.
- **Text is HTML.** Headlines, project names, services, brands and the footer are semantic HTML (`h1`, `h2`, `h3`, lists, links). The canvas is `aria-hidden` and purely decorative. Check view-source: all copy is there.
- **Glitch budget.** Glitch is used on transitions (arrivals, zone changes, menu, video reveal), the nav logo, and text reveals. It's kept subtle at idle and switched off in reduced motion.

### Performance

- **Instancing.** Every particle system is a single instanced draw call: logo shards (22k desktop / 10k mobile), field shards (4.4k / 700), project tiles and orbit shards, and the zone visuals.
- **Bloom** renders at half resolution; device pixel ratio is capped at 1.5.
- **Rendering pauses** when the tab is hidden, when the brand reel or footer covers the 3D, and while the menu or showreel overlay is open.
- **Distance culling** skips far-away projects and zones, and the logo while you're deep in the journey.
- **Adaptive quality.** If real frames average below ~45fps for 2 seconds, it steps down once at a time: pixel ratio 1.25 → 1.0 → bloom off. It never steps back up, so it can't oscillate.
- **Code-split.** The page script is ~57 KB gzipped; the 3D chunk (~145 KB gzipped, mostly three.js) is loaded with a dynamic import, so the HTML, nav and headline never wait for it.
- **Measured** on a laptop with integrated AMD Radeon graphics at 1440×900: GPU+CPU cost per frame was 0.9–1.8 ms (median) at pixel ratio 1.5, against a 16.7 ms budget, and real frame intervals averaged 16.7 ms (vsync-locked 60fps). Expect higher numbers on low-end phones; that's what the lite layout and adaptive quality are for.
- **Watch item: YouTube.** All four project previews start on load and keep playing (by design request), so four muted players decode at once. On weaker machines this is the first thing to reconsider (for example, pause players more than one stop away). Previews follow the player's live state (`ui/youtube.js → watchYouTube`): whenever a video isn't actually playing (buffering, ended, paused by the browser) the thumbnail shows instead, the player is nudged to resume, and the video reappears ~1.2s after playback restarts, after YouTube's own controls flash has faded. Visitors never see YouTube's UI on the planes.

### Accessibility

- Skip link, logical tab order, visible focus styles on every control.
- Menu and showreel are modal dialogs: focus trapped, Esc closes, focus is restored.
- Copy that is visually hidden between stops becomes visible when it receives keyboard focus.
- `prefers-reduced-motion`: no camera flight, no glitch or scramble, logo shown assembled, no smooth-scroll hijack, no autoplaying video cards.
- Mobile tap targets are ≥ 44px.

### Brand rules baked in

- Purple + black only. The chrome/silver from the logo is the single subtle secondary. Red and blue appear only inside RGB-split glitch effects.
- Copy never uses the word "events"; ZDS is described as a *multidisciplinary experience design company*.
- Fonts: Barlow ExtraBold (700) for headings, Lato for everything else. Unbounded is kept only for the "Selected Work" title and the brand reel.

---

## Known limitations / to do before production

- Replace the Anamorphic 3D stand-in YouTube ID; add real brand logos if wanted.
- The contact section and menu list Mumbai · New Delhi · Dubai; the hero uses IND · UAE · KSA and the footer includes Saudi, KSA. Align these as the business prefers.
- Muted autoplay of the mobile card previews depends on the phone's browser policy. If a player doesn't start, the thumbnail simply stays (never a black box). Not yet verified on physical devices.
- `window.__zds` / `window.__lenis` are debug handles for the prototype; remove them for production.
- Case-study, About, Blogs, Contact and service links point to the live site's URL patterns; those pages are out of scope here.
