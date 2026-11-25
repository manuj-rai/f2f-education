// Builds site/dist/<page>/body.html and style.css from site/pages/<page>/.
// Usage: npm run build -- <page>        (or no page name to build every page)
'use strict';
const { build, writeDist, listPages } = require('./lib');

const names = process.argv.slice(2).length ? process.argv.slice(2) : listPages();
if (!names.length) { console.log('No pages in site/pages/ yet.'); process.exit(0); }
for (const name of names) {
  const b = build(name);
  const out = writeDist(b);
  console.log(name + ': body ' + b.bodyVisitor.length + ' chars (visitors and members), style ' + b.style.length + ' chars -> ' + out);
}
