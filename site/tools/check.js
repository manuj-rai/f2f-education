// npm run check: finds JavaScript syntax errors in the site code before it goes live. Nothing is published.
// Checks every <script> in site/custom-code/head.html and body.html and in each site/pages/<name>/page.html.
// npm run push runs it first and stops if anything fails.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT, listPages } = require('./lib');

// Walks the HTML like a browser would: comments are skipped (so "<script>" written in a comment isn't a script),
// JSON data blocks must be valid JSON, and other scripts are compiled (never run) to find syntax errors.
function checkFile(rel) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
  const errors = [];
  const lineAt = i => html.slice(0, i).split('\n').length;
  let n = 0, i = 0;
  for (;;) {
    const re = /<script\b/ig; re.lastIndex = i;
    const found = re.exec(html), s = found ? found.index : -1, c = html.indexOf('<!--', i);
    if (s < 0) break;
    if (c >= 0 && c < s) { const e = html.indexOf('-->', c + 4); if (e < 0) break; i = e + 3; continue; }
    const open = html.indexOf('>', s), close = html.indexOf('</script>', open);
    if (open < 0 || close < 0) { errors.push(rel + ' (line ' + lineAt(s) + '): <script> without </script>'); break; }
    const tag = html.slice(s, open + 1), code = html.slice(open + 1, close);
    i = close + 9;
    if (/\bsrc=/i.test(tag)) continue; // external script: nothing inline to check
    n++;
    const type = (tag.match(/\btype=["']?([^"'\s>]+)/i) || [])[1] || '';
    try {
      if (/json/i.test(type)) JSON.parse(code);
      else if (!type || /javascript|module/i.test(type)) new vm.Script(code, { filename: rel }); // compiles only
    } catch (e) { errors.push(rel + ', script ' + n + ' (line ' + lineAt(s) + '): ' + e.message); }
  }
  return { n, errors };
}

function check() {
  const files = ['site/custom-code/head.html', 'site/custom-code/body.html', ...listPages().map(p => 'site/pages/' + p + '/page.html')];
  let scripts = 0; const errors = [];
  for (const f of files) { const r = checkFile(f); scripts += r.n; errors.push(...r.errors); }
  return { files: files.length, scripts, errors };
}

module.exports = { check };

if (require.main === module) {
  const r = check();
  if (r.errors.length) { console.log('Syntax errors (fix before pushing):'); r.errors.forEach(e => console.log('  ' + e)); process.exit(1); }
  console.log('OK: ' + r.scripts + ' scripts in ' + r.files + ' files parse.');
}
