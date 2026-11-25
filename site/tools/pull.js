// npm run pull [-- <page|site> ...] [--take-live] [--dry-run]
// Copies edits made in the LearnWorlds admin (Page / Site custom code, signed-out slots) into the local files,
// exactly as made, so the next push keeps them. Nothing is published.
//
// When it's sure only the admin changed the code (the local file still matches the code last seen live), it
// applies the edit by itself. If it can't tell (no record of the last live code yet) or the local file has
// changes of its own too, it shows the edit and changes nothing:
//   --take-live   use the live code as is (when the diff shows the local file has nothing unpublished)
//   or copy the shown lines into the file by hand, then run: npm run push -- <page> --accept <hash>
// --dry-run shows what it would do.
// Every changed file is backed up to site/dist/<page>/backup/ first, and checked by rebuilding it: the rebuilt
// slot must equal the live code exactly, or the file is put back.
'use strict';
const fs = require('fs');
const path = require('path');
const J = require('./jobs');

const args = process.argv.slice(2);
const names = args.filter(a => !a.startsWith('--'));
const takeLive = args.includes('--take-live');
const dryRun = args.includes('--dry-run');

const rebuild = job => (job.kind === 'site' ? J.siteJob() : J.pageJob(job.id));

(async () => {
  const jobs = J.selectJobs(names);
  let applied = 0, waiting = 0;
  for (const job of jobs) {
    if (job.error) { if (job.ready) console.log(job.id + ': ' + job.error); continue; }
    const cmp = await J.compareJob(job);
    const edited = cmp.slots.filter(s => s.state === 'edited');
    if (!edited.length) continue;
    for (const s of edited) {
      const file = J.sourceFileFor(job, s.label);
      const relFile = J.rel(file);
      const base = J.readLastLive(job, s.label);
      const localSlot = cmp.slots.find(x => x.label === s.label).local;
      const onlyAdmin = base !== null && J.normCode(base) === localSlot;
      console.log('\n' + (job.kind === 'site' ? 'site' : job.id) + ' · ' + s.label + ' was edited in the LearnWorlds admin (hash ' + s.hash + ')');

      const src = J.toSource(job, s.label, s.live);
      const current = fs.readFileSync(file, 'utf8');
      const crlf = current.includes('\r\n');
      const currentText = current.replace(/\r\n/g, '\n').replace(/\s+$/, '');
      if (src === null) {
        // The edit is outside the part that comes from the page's files (in the generated header/footer).
        const out = path.join(J.DIST, job.id, 'live', J.SLOT_FILE[s.label]);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, s.live + '\n');
        console.log('  The edit is outside the code that comes from ' + relFile + ', so it can\'t be copied automatically.');
        console.log('  Live code saved to ' + J.rel(out) + '. Change:');
        J.lineDiff(localSlot, s.live).forEach(l => console.log('    ' + l));
        console.log('  Copy it into the project by hand, then: npm run push -- ' + (job.kind === 'site' ? 'site' : job.id) + ' --accept ' + s.hash);
        waiting++;
        continue;
      }
      const change = J.lineDiff(currentText, src.replace(/\s+$/, ''));
      if (!onlyAdmin && !takeLive) {
        console.log(base === null
          ? '  No record of the code that was live before this edit, so pull can\'t tell whether ' + relFile + ' also has unpublished changes.'
          : '  ' + relFile + ' has changes of its own since the code was last live, so the two must be combined by hand.');
        console.log('  ' + relFile + ' vs live (- local, + live):');
        change.forEach(l => console.log('    ' + l));
        console.log(base === null
          ? '  If every "-" line above is just the old version of the admin\'s edit, run: npm run pull -- ' + (job.kind === 'site' ? 'site' : job.id) + ' --take-live'
          : '  Copy the admin\'s lines (+) into the file, then: npm run push -- ' + (job.kind === 'site' ? 'site' : job.id) + ' --accept ' + s.hash);
        waiting++;
        continue;
      }
      if (src.replace(/\s+$/, '') === currentText) { console.log('  ' + relFile + ' already has it.'); continue; }
      console.log('  Copying into ' + relFile + ' (- old, + admin edit):');
      change.forEach(l => console.log('    ' + l));
      if (s.label === J.SLOT.bodyOut && job.kind === 'page') console.log('  Note: page.html feeds the signed-in version too. Wrap the change in data-show="visitors" if it is for visitors only.');
      if (dryRun) { console.log('  (dry run: not written)'); applied++; continue; }

      const backup = path.join(J.DIST, job.id, 'backup', path.basename(file) + '.' + new Date().toISOString().replace(/[:.]/g, '-'));
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.copyFileSync(file, backup);
      const text = src.replace(/\s+$/, '') + '\n';
      fs.writeFileSync(file, crlf ? text.replace(/\n/g, '\r\n') : text);
      const again = rebuild(job);
      const rebuilt = again.error ? null : J.normCode(J.slotValue(again, s.label));
      if (rebuilt !== s.live) {
        fs.copyFileSync(backup, file);
        console.log('  Rebuilt code would not match the live code exactly, so ' + relFile + ' was put back. Copy the change by hand.');
        waiting++;
        continue;
      }
      J.remember(again, [s.hash]);
      J.writeLastLive(job, s.label, s.live);
      console.log('  Done. ' + relFile + ' now builds exactly the live code (backup: ' + J.rel(backup) + ').');
      applied++;
    }
  }
  console.log('');
  if (!applied && !waiting) console.log('No admin edits to copy: the signed-out code on the live site matches what these tools published.');
  else if (applied && !waiting) console.log(dryRun ? 'Dry run: ' + applied + ' edit(s) would be copied.' : 'Admin edits are now in the local files. npm run push brings the signed-in slots in line too.');
  if (waiting) { console.log(waiting + ' edit(s) need a look (see above).'); process.exitCode = 1; }
})().catch(e => { console.error(e.message); process.exit(1); });
