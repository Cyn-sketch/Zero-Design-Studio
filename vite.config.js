import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CONTENT = resolve(__dirname, 'src/content');
const RENDER = resolve(CONTENT, 'render.js');
const json = (name) => JSON.parse(readFileSync(resolve(CONTENT, `${name}.json`), 'utf8')).data;

/** Which page an HTML entry is, from its URL path ("/", "/work/index.html", "/blogs/<slug>/index.html"). */
function pageOf(path = '/') {
  const post = path.match(/^\/blogs\/([^/]+)\//);
  if (post) return { page: 'post', slug: post[1] };
  return { page: (path.match(/^\/(work|about|blogs)\//) || [])[1] || 'home' };
}

/**
 * One HTML entry per blog article (blogs/<slug>/index.html), generated from
 * blogs.json so a new post gets its page automatically. They are identical
 * shells; the article itself is rendered into them by the plugin below.
 */
function ensurePostShells() {
  const shell = readFileSync(resolve(__dirname, 'blogs/index.html'), 'utf8');
  return json('blogs').posts.map((post) => {
    const dir = resolve(__dirname, 'blogs', post.slug);
    const file = resolve(dir, 'index.html');
    if (!existsSync(file) || readFileSync(file, 'utf8') !== shell) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, shell);
    }
    return [`post-${post.slug}`, file];
  });
}
const postEntries = Object.fromEntries(ensurePostShells());

/** /work → /work/ (also about, blogs and /blogs/<slug>), so both URL forms reach the page. */
function slashRedirect(req, res, next) {
  const [path, query = ''] = req.url.split('?');
  if (/^\/(work|about|blogs)$/.test(path) || /^\/blogs\/[^/.]+$/.test(path)) {
    res.writeHead(301, { Location: `${path}/${query ? `?${query}` : ''}` });
    return res.end();
  }
  next();
}

/**
 * Injects content into each page's HTML at dev/build time so every headline,
 * project, post and footer link is real HTML in the document (SEO-safe).
 * In production this is replaced by the framework's SSR/SSG fed from Strapi.
 *
 * The template module is re-imported on every request (cache-busted) so edits
 * to render.js or any content JSON show up on reload without a restart.
 */
function contentHtml() {
  return {
    name: 'zds-content-html',
    async transformIndexHtml(html, ctx) {
      const r = await import(`${pathToFileURL(RENDER).href}?t=${Date.now()}`);
      const home = json('home');
      const { page, slug } = pageOf(ctx.path);
      if (page === 'post') {
        const blogs = json('blogs');
        const post = blogs.posts.find((p) => p.slug === slug);
        if (!post) throw new Error(`Unknown blog post: ${slug}`);
        return html
          .replace('<!--head-outlet-->', r.renderHead(r.postSeo(post)))
          .replace('<!--body-outlet-->', r.renderPostPage(home, blogs, post));
      }
      const [data, body] =
        page === 'work' ? [json('work'), (d) => r.renderWorkPage(home, d)]
        : page === 'about' ? [json('about'), (d) => r.renderAboutPage(home, d)]
        : page === 'blogs' ? [json('blogs'), (d) => r.renderBlogsPage(home, d)]
        : [home, (d) => r.renderBody(d)];
      return html.replace('<!--head-outlet-->', r.renderHead(data)).replace('<!--body-outlet-->', body(data));
    },
    configurePreviewServer(server) {
      server.middlewares.use(slashRedirect);
    },
    configureServer(server) {
      server.middlewares.use(slashRedirect);
      server.watcher.add(CONTENT);
      server.watcher.on('change', (f) => {
        if (resolve(f).startsWith(CONTENT) && /\.(json|js)$/.test(f)) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  plugins: [contentHtml()],
  appType: 'mpa', // unknown URLs 404 instead of silently showing the homepage
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        work: resolve(__dirname, 'work/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        blogs: resolve(__dirname, 'blogs/index.html'),
        ...postEntries,
      },
    },
  },
  server: { port: Number(process.env.PORT) || 5173, strictPort: !!process.env.PORT, open: false },
});
