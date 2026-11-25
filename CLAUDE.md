# CLAUDE.md: handover for Claude Code

The F2F Education website on LearnWorlds (https://f2fedtech.learnworlds.com, admin `/author/dashboard`, trial plan). This repo holds the site's custom code and locally designed pages, plus the course-building studio. Read [README.md](README.md) for the workflow, [site/STATUS.md](site/STATUS.md) for what's done and open, and [site/REFERENCE.md](site/REFERENCE.md) for how each part works.

## Rules from the site owner (keep them)

1. **Admin edits win.** Edits made in the LearnWorlds admin (Site/Page custom code, Site Builder) must never be overwritten.
   - Run `npm run status` before changing code. If it says EDITED, run `npm run pull`.
   - `npm run push` stops on unknown live code (guard hashes in `site/state/<job>/versions.json`). Never work around that stop: copy the edit in, then `--accept <hash>`.
2. **No static or invented content.** Show only data LearnWorlds has. If a design element has no data behind it, leave it out and say so in STATUS.md.
3. **Unapproved pages never go live.** A page is pushed only with `"publish": true` in its `page.json`. `site/pages/about/` is a draft waiting for approval.
4. Decisions already made:
   - LearnWorlds' **sign-in window** stays unstyled.
   - The "My learning / My certificates / Account settings" bar under the header is **removed**.
   - **Resources** (header) and **Privacy policy / Terms of use** (footer) are shown but disabled. An empty address in `SITE` does that.
   - Header height is 104px.
   - Profile lists **only earned** certificates.
   - Each page has its own custom code.
   - The home page design is left as is unless asked.
5. Keep UI and UX consistent across pages (navy band, white cards on `#f7f9fc`, Inter, blue `#1b5fa8`), for visitors and signed-in learners, on desktop and phone (390px, no sideways scroll).
6. After a change, update `site/STATUS.md` (and REFERENCE.md if behaviour changed).

## Commands

```
npm run dev [-- <page>|/<address>] [--phone] [--signed-out]   live site with local code swapped in, reloads on save
npm run check      syntax check of every inline script (push runs it)
npm run status     local vs live (signed-out slots are readable in public HTML; no sign-in)
npm run pull       copy admin edits into local files
npm run push       publish what changed (own Chrome window, admin sign-in saved in %LOCALAPPDATA%\f2f-education\)
npm run push -- site --mcp   write site/dist/push.js instead; run it in the Playwright MCP browser (browser_run_code_unsafe, filename)
```

Test options for the dev tool: `F2F_DEV_HEADLESS=1`, `F2F_DEV_PROFILE=<dir>`, `F2F_DEV_DEBUG=1` (prints what it swapped per page), `--shot=<file.png>` (screenshot and exit).

Typical change, as Claude:
1. `npm run status`
2. Edit.
3. `npm run check`
4. Preview with `npm run dev -- <page> --shot=…`, or in the MCP browser by route-swapping the live HTML.
5. `npm run push -- site --mcp`, then run `site/dist/push.js` in the MCP browser.
6. `npm run status` should say live.
7. Verify on the live page.

## Where the code lands in LearnWorlds

| Local | LearnWorlds slot | Runs on |
|---|---|---|
| `site/custom-code/head.html` | Site custom code `<head>` logged in + out | every site page |
| `site/custom-code/body.html` (6 scripts) | `<body>` logged in + out | every site page and built-in pages (skipped in the course player) |
| `site/custom-code/style.css` | `<style> Dynamic (css)` | site pages only |
| `style.css` + `builtin.css` | `<style> (css) for built in pages (i.e social, profile, workpad, my account)` | `/account`, `/inbox`, `/social`, apps |
| `site/pages/<name>/` | that page's Page custom code (body + style, per audience) | one page |

**body.html scripts**, in order:
1. light mode
2. header and footer (`SITE` config, `window.F2FStats` = `/api/user_stats` promise, mailto "Email us" window)
3. course pages (`/course/<slug>`)
4. profile (`body.slug-profile`)
5. 404 page (`body.slug-error`) and account settings band and sidebar (`body.slug-account`)
6. search

`style.css` is in numbered sections.

## Gotchas learned the hard way

**What LearnWorlds does to our code**
- **LearnWorlds rewrites a literal `<body>` anywhere in body-slot code** (even in comments) into the page's real body tag. Never write it in `body.html`.
- `head.html` and `body.html` start with banner comments and end with `<!-- /F2F Education · Site custom code · HEAD|BODY -->`. `style.css` starts with the "F2F EDUCATION · SITE-WIDE STYLES" banner and `builtin.css` with "F2F EDUCATION · BUILT-IN PAGES". `dev.js` and `status` find the live code by these. Keep them.

**Where code runs and what it can touch**
- Built-in pages (`/account`, `/inbox`, `/social`) run body code but NOT the Dynamic CSS; they get the built-in slot only. The course player (`/path-player`) and its lesson frames (`/ebook`, `/videoplayer`, `/pdfplayer`, `/assessmentplayer`) DO load the site CSS now; the user wants the player in LearnWorlds' original style, so `head.html` switches the site stylesheets off there (also inside the frames) and `body.html` draws no header or footer there. The header script also draws only when the CSS var `--f2f-blue` is set.
- `/account` is a Vue app inside a fixed-height `#account-app` box. `builtin.css` makes it scroll with the page, so `body.html` marks the sidebar section itself (`is-current`).
- Body classes: `slug-error`, `slug-about`, `slug-privacy`, `slug-terms`, `slug-profile`, `slug-account`, `slug-inbox`, `slug-social`. Built-in pages lack `lw-page`.
- Page custom code lands at the end of `<body>`; the RUNTIME in `site/tools/lib.js` moves `#f2f-page` before `<main>`. LearnWorlds widgets (course cards) only start while their section sits untouched in `<main>`, so slots fill after `load`, and whole sections move (`data-lw-section`).

**Behaviour of LearnWorlds' own UI**
- LearnWorlds hides every checkbox and radio (`input[type=checkbox]{display:none}`). Use a more specific selector to show ours.
- LearnWorlds modals use z-index 199, so the custom header stays at 150.
- To open LearnWorlds' sign-in from custom code, click the hidden `section.lw-topbar [data-interactive-link-type="openformslink"][data-interactive-link-var1="signin"]` inside a `setTimeout` after stopping the original click. Otherwise its click-outside handler closes the window at once.
- Visitor or member: the hidden LearnWorlds topbar has that Sign in link only for visitors.

**Data sources**
- `POST /api/learner/products` (with the page's `meta[name=csrf-token]`): `type:'course'`, `fields`, `ids` (comma-separated slugs), `enrichLearningPath:'true'`, `search`.
  - Curriculum: `cohorts[0].content[].learningPath[]`.
  - Progress: `unitsCompleted`, `unitsTotal`, `progress`, `completed`, `latestTime`, `unitProgress`.
  - Images: `lwfiles.mycourse.app/<schoolId>-public/<settings.image>`. Prices are in paise.
- `GET /api/user_stats`: `userCourses`, `earnedCertificates`, `me`.
- A certificate unit counts as visited before the certificate is awarded. Earned certificates are read from LearnWorlds' hidden certificate list on `/profile`.

**Playwright MCP browser**
- **Shared** with other Claude sessions (one Chrome profile). Announce before using it, `browser_close` after, and say "done".
- Its zoom is **90%**: viewport screenshots after scrolling are offset by about 10% of scrollY, so a sticky header looks cut or missing. Check `getBoundingClientRect` or `elementFromPoint` instead.
- The site never reaches `networkidle`; use `waitUntil: 'commit'` plus a wait.
- Big snippet results overflow the tool output: read the saved file's "### Result" part.
- Builder: Site custom code slots each have their own **Update** button, enabled only after a real keystroke. The page's Save doesn't save custom code. `WRITE_SLOTS` in `lib.js` handles this.

**This machine**
- Chrome can take 30–90 s to exit. Don't await `browser.close()` in tools; race it with a timeout.

## Courses

`courses/<slug>/` is the source of the live courses (16 free courses as of 2026-11-25). `courses/_studio/` builds and uploads them ([its README](courses/_studio/README.md); Python: `pip install -r courses/_studio/requirements.txt`).
- The default is **readable courses** (Word lessons, no video): `reading.py`, then `lw_publish_js.py`, which writes three admin scripts to `.scratch/lw/`.
- Course videos and PDF guides are generated by `build.py` and kept out of git.
- `node courses/_studio/coursecheck.js [slug…]` checks the courses as a visitor.

## Open items (25 Nov 2026)

- About page draft (`site/pages/about/`) waits for the owner's approval before `"publish": true`.
- Privacy and Terms text is LearnWorlds' template. Real policies are needed, then re-enable the footer links (`'/privacy'`, `'/terms'` in `SITE.footerLinks`).
- Possible tidy-up, not started: split `style.css` and `body.html` into one file per part. If done, the build must produce the same slot code, and `pull` must map admin edits back to the right file.
