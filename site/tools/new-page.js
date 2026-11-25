// npm run new-page -- <name> [--path /<slug>] [--title "Page title"] [--builder <builder page id>] [--audiences visitors|members]
// Starts a locally designed page in site/pages/<name>/ (page.json, page.html, page.css, assets/).
// The page is NOT marked ready ("publish": false), so npm run push leaves it alone until you switch it on.
'use strict';
const fs = require('fs');
const path = require('path');
const { PAGES } = require('./lib');

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const name = args[0];
if (!name || name.startsWith('--') || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error('Usage: npm run new-page -- <name> [--path /<slug>] [--title "Title"] [--builder <id>] [--audiences visitors|members]\n  <name>: lowercase letters, digits and dashes, e.g. about-us');
  process.exit(1);
}
const dir = path.join(PAGES, name);
if (fs.existsSync(dir)) { console.error('site/pages/' + name + ' already exists.'); process.exit(1); }
const title = opt('title') || name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const config = { title, path: opt('path') || '/' + name, builderPage: opt('builder') || name, publish: false };
if (opt('audiences')) config.audiences = opt('audiences').split(',');

fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
fs.writeFileSync(path.join(dir, 'page.json'), JSON.stringify(config, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'page.html'), `<!-- ${title}: page sections only, no document wrapper. Shared styles: site/custom-code/style.css (.f2f-page). -->
<section class="p-hero">
  <div class="p-wrap">
    <h1>${title}</h1>
    <p>Write the page here.</p>
    <a class="p-btn" href="/courses">Browse courses</a>
  </div>
</section>
`);
fs.writeFileSync(path.join(dir, 'page.css'), `/* Styles for this page only. They are scoped under .f2f-page--${name}. */
.f2f-page--${name} .p-wrap { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.f2f-page--${name} .p-hero { padding: 72px 0; }
.f2f-page--${name} .p-hero h1 { font-size: 44px; line-height: 1.15; margin: 0 0 16px; }
.f2f-page--${name} .p-btn { display: inline-block; background: #1B5FA8; color: #fff; padding: 12px 20px; border-radius: 4px; text-decoration: none; }
`);
console.log('Created site/pages/' + name + '/ (' + config.path + ', builder page "' + config.builderPage + '", not ready to publish).');
console.log('Next:');
console.log('  1. In the LearnWorlds Site Builder, create the page: Pages > Create page > Blank, slug "' + config.path.replace(/^\//, '') + '".');
console.log('     If its id in the builder URL (?page=...) isn\'t "' + config.builderPage + '", put that id in page.json "builderPage".');
console.log('  2. npm run dev -- ' + name + '      design it (the window reloads on every save)');
console.log('  3. When it\'s approved: set "publish": true in page.json, then npm run push');
