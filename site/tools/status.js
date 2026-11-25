// npm run status [-- <page|site> ...] [--diff]
// Compares the local files with the live site (as a signed-out visitor sees it). No sign-in, writes nothing to LearnWorlds.
//   live         the live site has exactly the local code
//   to push      local changes that aren't live yet (npm run push)
//   EDITED       someone edited the code in the LearnWorlds admin: npm run pull brings that edit into the files
//   not ready    a page without "publish": true in its page.json; push leaves it alone
// --diff shows the lines that differ.
'use strict';
const J = require('./jobs');

const args = process.argv.slice(2);
const names = args.filter(a => !a.startsWith('--'));
const showDiff = args.includes('--diff');

const LABEL = { live: 'live', pending: 'to push', edited: 'EDITED in admin', unpublished: 'not published yet', error: 'build error', 'members-only': 'signed-in only: push checks it in the Site Builder' };

(async () => {
  const jobs = J.selectJobs(names);
  let edited = 0, pending = 0, errors = 0;
  console.log('Local files vs the live site (signed-out view; signed-in slots are checked by push):\n');
  for (const job of jobs) {
    let cmp;
    try { cmp = await J.compareJob(job); } catch (e) { cmp = { job, error: e.message, slots: [] }; }
    const state = J.summary(cmp);
    const name = (job.kind === 'site' ? 'site (site-wide code)' : job.id + ' ' + job.path).padEnd(28);
    const ready = job.kind === 'site' ? '' : job.ready ? '' : '  [not ready: no "publish": true]';
    console.log('  ' + name + ' ' + LABEL[state] + ready);
    if (cmp.error) { console.log('      ' + cmp.error); if (job.ready) errors++; continue; }
    for (const s of cmp.slots) {
      if (s.state === 'same') continue;
      const what = { pending: 'local changes not live yet', edited: 'edited in the LearnWorlds admin (live hash ' + s.hash + ')', missing: 'not on the live page' }[s.state];
      console.log('      ' + s.label.padEnd(26) + ' ' + what);
      if (showDiff && s.live !== null) J.lineDiff(s.local, s.live).forEach(l => console.log('        ' + l.replace(/^- /, '- local ').replace(/^\+ /, '+ live  ')));
    }
    if (state === 'edited') edited++;
    if (state === 'pending' || (state === 'unpublished' && job.ready)) pending++;
  }
  console.log('');
  if (edited) console.log('Next: npm run pull   (copies the admin edits into the local files; nothing is published)');
  else if (pending) console.log('Next: npm run push');
  else if (!errors) console.log('Everything that is marked ready is live.');
  if (errors) process.exitCode = 1;
})().catch(e => { console.error(e.message); process.exit(1); });
