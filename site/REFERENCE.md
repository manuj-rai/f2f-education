# How the site works

Reference for each part of https://f2fedtech.learnworlds.com. The everyday workflow is in the [README](../README.md); what's done and what's left is in [STATUS.md](STATUS.md).

Rule for every page: content comes **live from LearnWorlds**. Anything LearnWorlds has no data for is left out, not typed in.

## Contents

* [Look and feel](#look-and-feel)
* [Site-wide code](#site-wide-code-sitecustom-code)
* [Header and footer](#header-and-footer)
* [Search](#search-every-page)
* [Course pages](#course-pages-coursesslug)
* [Signed-in pages](#signed-in-pages)
* [Locally designed pages](#locally-designed-pages-sitepages)
* [Home, Explore courses, Universities](#home-explore-courses-universities)
* [Edits made in the LearnWorlds admin are kept](#edits-made-in-the-learnworlds-admin-are-kept)
* [Courses in LearnWorlds](#courses-in-learnworlds)
* [Known limits](#known-limits)

## Look and feel

* **Always light mode.** `head.html` sets it before the page paints; `body.html` clears any mode saved by the old header toggle (removed 2026-11-24). Dark-mode styles are still in `style.css`, unused.
* Design system (Figma file `hLl2NH7EWq53JM2QIiD5qU`):

  | Token | Value |
  |---|---|
  | Navy | `#0d1b3e` |
  | Blue | `#1b5fa8`, hover `#154d89` |
  | Muted text | `#5b687c` |
  | Borders | `#dce3ed` |
  | Soft backgrounds | `#f7f9fc` and `#f0f4fa` |
  | Green | `#307852` |
  | Type and corners | **Inter**, 4px button corners, 8px cards |

* **Theme Explorer** (Website → Theme explorer) holds the matching LearnWorlds colours:
  * Brand primary and Accent 1 `#1B5FA8`, Accent 2 `#111111`.
  * *Dark background* `#FFFFFF` with dark text. The template's sections use the "dark" scheme, so this makes every page white.
  * Light background `#F5F7FA`.
  * Inter for headings and text.

  Course pages, the catalogue, checkout and the blog pick these up. No per-course styling is needed.

## Site-wide code (`site/custom-code/`)

| File | LearnWorlds slot (Site Builder → Site → Site custom code) | What it does |
|---|---|---|
| `head.html` | `<head>` logged in + logged out | Light mode; hides LearnWorlds' own header and footer before paint, and brings them back if ours can't be drawn |
| `body.html` | `<body>` logged in + logged out | Scripts: light mode, header and footer, course pages, profile, 404 page and account band, search |
| `style.css` | `<style> Dynamic (css)` | All site styles, numbered sections |
| `style.css` + `builtin.css` | `<style> (css) for built in pages` | LearnWorlds' built-in pages (`/account`, `/inbox`, `/social`, apps) load only this slot, so they get the site styles plus `builtin.css` |

* `npm run push` writes all six slots and clicks each slot's **Update** (the page's Save button doesn't save custom code).
* Rollback by hand: paste the previous file into the slot.
* Don't write the body tag's name in angle brackets anywhere in `body.html`. LearnWorlds replaces that text with the page's own body tag, so the live code would no longer match the file.
* Each file starts with a banner comment, and head and body end with an end marker (`<!-- /F2F Education · Site custom code · … -->`). `npm run dev` finds the live code by these, so keep them.

## Images and anchors (every page)

* Course pictures are 1280 × 720 (16:9). Every box that shows one uses `aspect-ratio: 16 / 9` with `object-fit: cover`, so nothing is cropped. Don't give these boxes a fixed height.
* `style.css` gives every element with an `id` `scroll-margin-top` = the sticky header bar (72px; 56px from 990px down) through `:where()`, so a page's own `scroll-margin-top` still wins.

## Header and footer

Drawn by `body.html` ("Header and footer" script) on every site page and styled by `style.css` section 6. They follow the Figma "Public navigation", "Student header" and "Public footer" designs. LearnWorlds' own top bar and footer stay in the page, hidden.

* **Change links and wording in `SITE`** at the top of that script: strip text, logo, menu, account menu and footer links. An item with an empty address is shown greyed out and not clickable ("Coming soon"). That's how **Residential Courses** and **Resources** (menu) and **Privacy policy** / **Terms of use** (footer) are shown for now. To enable one, give it its address (`/privacy`, `/terms`).
* Signed out: strip, logo, Online Courses (`/courses`) / Residential Courses / University Partners (`/universities`) / Resources, search, **Log in**. Log in clicks LearnWorlds' own hidden Sign in link, so keep that item in the Site Builder's Topbar navigation.
* Signed in: the same with an account button showing the learner's name (from `/api/user_stats`). Its menu has My learning, Profile, Inbox, Account settings and Sign out.
* Who is signed in: LearnWorlds' hidden header has a Sign in link only for visitors.
* Size: 104px (a 32px strip that scrolls away, then a sticky 72px bar), 88px on phones. Phones and tablets (990px and narrower) get a menu button. From 991px to 1180px the menu gaps are tighter, and the signed-in name is cut with "…" (at 160px, and at 120px from 1100px down). The full name is in its tooltip.
* Page side margins: 80px, then 48px from 1280px down (header, footer and every page), then 20px on phones. In page CSS, set only `padding-left` / `padding-right` in those media rules: some wrappers also carry their own top and bottom padding, and a `padding: 0 48px` shorthand wipes it. The bar sits below LearnWorlds' own windows (z-index 199).
* Footer: "F2F EDUCATION", © year Fibre2Fashion, Help center (e-mail), Privacy policy and Terms of use (both disabled for now). LearnWorlds adds "Created with LearnWorlds" below it; only the Learning Center plan removes it.
* **E-mail links:** every `mailto:` link also opens a small "Email us" window with the address, Copy address, Gmail and Outlook. On a computer with no e-mail app set up, the link alone does nothing visible.
* "Skip to content" is the first keyboard stop.

## Search (every page)

* The header's search button, `/`, or Ctrl+K / Cmd+K opens a course search.
* Results come **live** from LearnWorlds' catalogue endpoint (`POST /api/learner/products` with `search`, using the page's `csrf-token`): picture, label, price, with the matching words highlighted. New courses appear automatically. A course's SEO description and keywords help it be found.
* The list is fetched quietly after each page loads, so the panel usually opens instantly. After 12 s with no answer it says so and links to /courses.
* The endpoint isn't a documented API. If LearnWorlds changes it, the panel says "Search isn't available right now" and the rest of the site is unaffected.
* Search inside lessons isn't covered: the course player doesn't run site code.

## Course pages (`/course/<slug>`)

One layout for every course, current and future, drawn by `body.html` ("Course pages") and styled by `style.css` section 7. It follows the Figma "Public course details" (195:3) and "Course details" (192:2) designs. Everything is read from the course itself (`POST /api/learner/products` with `ids=<slug>`, `enrichLearningPath`).

**Visitors see:**
* **Hero:** breadcrumb (first Category), author (institution), title, SEO description, module and lesson counts, Label, course card image.
* **Course content:**
  * Each section is a module: title, description, lesson count, and "Free preview" when the section is free.
  * Each unit is a lesson: its type and its time or number of questions.
* **Sidebar:**
  * Price and **LearnWorlds' own enrol button**, so its label and action are LearnWorlds'.
  * "Learn by doing" (the assignment or last graded activity).
  * "Course at a glance": each item shows only when the course has it.
* **Resources:** shown only when units have attachments.

**Enrolled learners also see:**
* A progress card with "Resume learning" to the next unfinished lesson (`/path-player?courseid=<slug>&unit=<id>Unit`).
* Each module's status: Completed / Up next / In progress / Not started.

**Left out (no LearnWorlds data):** What you'll learn, Level, Language, enquiry copy, certificate card, help band, due dates.

A course with no lessons yet (Coming soon) shows "Coming soon" instead of the module and lesson counts, and a short note in Course content.

If the course can't be read within 15 s, LearnWorlds' own (hidden) sections come back.

## Signed-in pages

* **My learning** (`/start`, [pages/my-learning/](pages/my-learning/), members only):
  * Shows: counts, Continue learning, courses with tabs and search, achievements, recommendations.
  * Data: `/api/user_stats` (`userCourses`, `earnedCertificates`, `me`) and `/api/learner/products` (progress fields and `unitProgress`).
* **Profile** (`/profile`, `body.html` "Profile" script, `style.css` sections 10 and 14):
  * **My courses:** All / In progress / Not started / Completed tabs with counts, search, and progress cards.
  * **My certificates:** **only certificates the learner has earned.** LearnWorlds' own hidden certificate list decides, because a certificate unit counts as visited before the certificate is awarded. With none yet, the section says "No certificates yet" and links to My learning.
* **Account settings** (`/account`, a built-in page; `builtin.css` and the "Account settings" part of `body.html`):
  * Layout: a navy title band, a sticky sidebar card, and one white card per section.
  * Buttons and values: outline Edit / Save / Cancel, "Not added" for empty values, framed tables, and the payment status as a tag.
  * Scrolling: the account scrolls as one page; LearnWorlds scrolled it inside a fixed-height box. So the page marks the sidebar item in view itself (`is-current`). `#security` / `#payments` open at that section; `#personal-details` opens at the top.
* **Inbox, Community, apps** (`/inbox`, `/social` …): the site header, footer and fields via `builtin.css`.
* **404 page:** `body.html` draws it on `body.slug-error`: a message, a course search, and links back in.
* **Privacy and Terms** (`/privacy`, `/terms`): the title band and a readable column (`style.css` section 11). The text is still LearnWorlds' template, so the footer links are disabled until real policies exist.
* **About** (`/about`): LearnWorlds' invented instructors, figures and testimonials are hidden (`style.css` section 12). A real page is drafted in [pages/about/](pages/about/), not published.

## Locally designed pages (`site/pages/`)

A page lives in `site/pages/<name>/`:

| File | What it is |
|---|---|
| `page.json` | `title`; `path` (e.g. `/courses`); `builderPage` (the Site Builder page id); `"publish": true` once approved; optional `"audiences": ["visitors"]` or `["members"]` to publish for one audience only |
| `page.html` | HTML sections only (no `<html>` / `<body>`) |
| `page.css` | Styles for that page only. Base styles are in `style.css` under `.f2f-page` |
| `assets/` | Pictures, referenced as `assets/<file>`. SVGs are embedded. Photos must be uploaded to LearnWorlds and listed in `assets.json` as `{ "<file>": "<lwfiles URL>" }` before a push |

Pages: `home` (`/`), `courses` (`/courses`), `my-learning` (`/start`, members), `universities` (`/universities`), `about` (`/about`, draft).

How a page works on the live site:
* **Placement:** LearnWorlds puts page custom code at the end of `<body>`. A small script moves the design to just before `<main>`, and the page's style hides LearnWorlds' own sections there. The Site Builder canvas doesn't run custom code, so those sections stay editable.
* **Rollback:** empty the page's four Page custom code slots and the old sections come back.
* **Slots for live LearnWorlds parts:**
  * `<div data-lw-section="#component_…">` moves the whole native section holding that element (e.g. the live course list).
  * Slots fill once the page has loaded, because LearnWorlds starts its widgets only in their original place.
* **Attributes:**
  * `data-f2f-open="signup"` or `"signin"` opens LearnWorlds' own window.
  * `data-show="visitors"` or `"members"` shows content to one audience. The build makes one body per audience.
* **New page:** `npm run new-page -- about-us --path /about-us`, then create the page in the Site Builder (Pages → Create page → Blank, same slug).

## Home, Explore courses, Universities

* **Home hero:** title, plus two buttons that match the menu: Online Courses (`/courses`), and Residential Courses, which is greyed out until it has an address. There's no search box in the hero; the header search covers it. The button wording and addresses are typed in `pages/home/page.html`. Keep them the same as `SITE.nav`.
* **Home** (`/`, Figma 36:2) reads everything about courses live:
  * Category sections, the category bar, Trending filters and "Explore by topic" come from each course's **Categories**. Each course appears once, under its first category, in catalogue order; then sections are filled to at least two courses each (first one each, then two), taking a course that carries the category from the biggest other section, which keeps at least as many. A section's "View all courses" opens `/courses?subject=<category>`. Categories listed in `categoryFirst` (top of `pages/home/page.html`, now sourcing and merchandising) come first everywhere on home.
  * Partner strip: the institutions set as course authors, as logos only (no names; the name is the alt text), on one line that scrolls sideways. The logo is the author's avatar (upload wide logos uncropped; LearnWorlds keeps their shape), unless `partnerLogos` at the top of `pages/home/page.html` names another picture for that institution (empty now). Shown from one institution.
  * Course order everywhere: courses in `SITE.featured` (`body.html`, read by the pages as `window.F2FSite.featured`) come first, then LearnWorlds' order, which is A–Z by title (LearnWorlds has no course-order setting).
  * Figures: counted from the courses.
  * No prices on home (no "Free" on cards or headings); the course page shows free or paid.
  * Blog: the JSON feed in the blog section's `data-feed`, hidden while empty.
  * Photos are hosted on LearnWorlds and listed in `pages/home/assets.json`.
* **Explore courses** (`/courses`, "Online Courses" in the header): the visitor design (199:2) and the signed-in design (184:219).
  * Filters: search, Subject and Institution filters with live counts, and Learning status (signed in).
  * Results: sort, 6 courses per page.
  * The address keeps the filters (e.g. `/courses?subject=fibre-fundamentals&page=2`).
* **Universities** (`/universities`, "University Partners" in the header): every institution live (a course's author name and avatar), one row each: logo with the name below and "View all N courses" (opens `/courses?institution=<author name>`) on the left, its first 3 courses (`TOP` in `pages/universities/page.html`, one row) as picture cards on the right (no prices; "Coming soon" for a course with that access). Institutions now: Fibre2Fashion Education (15 courses), AMFI (Amsterdam Fashion Institute) (1) and Sustainable Fashion School (1, the Coming-soon "Fashion Policy Masterclass Series"). To add a partner, set it as Author's name and avatar in that course's settings; it then appears here, on home and in the Online Courses filter.
* **Categories** are LearnWorlds course Categories. Rename or add one in Courses → Manage categories (`/author/categories-manager`), which also picks its courses. On home a course appears under its first category, unless another of its categories would otherwise have no section.
* Contact details (fibre2fashion.com/aboutus/contact): +91-2717-429555, inquiry@fibre2fashion.com, B-3 Abhishree Corporate Park, Iskcon-Ambli Road, Bopal, Ahmedabad 380058, India.

## Edits made in the LearnWorlds admin are kept

Custom code is also edited directly in LearnWorlds, and a publish must never wipe that out.

* Every version of slot code the tools generate is remembered by hash in `site/state/<page>/versions.json` (`site/state/_site/` for the site-wide code). Live code that isn't one of those was edited in the admin.
* `npm run status` spots edits in the signed-out slots, which are readable in the public pages.
* `npm run pull` copies those edits into the project files, but only when the local file still matches what was live before the edit (`site/state/<page>/last-live/`). Otherwise it shows the edit and changes nothing. Then either:
  * run `npm run pull -- <page> --take-live`, or
  * copy the lines in by hand.

  Old files are backed up to `site/dist/<page>/backup/`.
* `npm run push` reads every slot in the Site Builder before writing, including the signed-in slots. If one holds an admin edit, it **stops without changing anything**, saves the live code to `site/dist/<page>/live/` and prints the edit. Copy it into the project, then run `npm run push -- <page> --accept <hash>`.
* `site/state/` is how the tools recognise admin edits: keep it, and don't edit it by hand.

## Courses in LearnWorlds

* A course shows on Home and in the catalogue once it is **Public** and has a **public pricing option** (Free is fine).
* Fill in each course's SEO description, Label (e.g. `1 week · Online`), Category, Author (name and avatar) and Course card image: the site uses them.
* Categories: `fibre-fundamentals`, `technical-textiles`, `sustainable-textiles`, `apparel-production`, `fashion-design`. A new category adds a home-page section.
* Making courses: [courses/_studio/README.md](../courses/_studio/README.md). Question import: Assessment builder → Import questions → From Excel. LearnWorlds rejects an Excel file re-saved by openpyxl.

## Known limits

* The **course player** (`/path-player`) keeps LearnWorlds' original look (the user's request, 25 Nov 2026). LearnWorlds loads the site stylesheet there and in the lesson frames (`/ebook`, `/videoplayer`, `/pdfplayer`, `/assessmentplayer`), so `head.html` switches it off (also inside the frames, from the player page) and `body.html` draws no header or footer there.
* LearnWorlds' **sign-in window** keeps its own look (the user's decision).
* "Created with LearnWorlds" goes away only on the Learning Center plan.
* The school is on the LearnWorlds **trial**.
