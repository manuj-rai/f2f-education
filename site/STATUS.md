# Page status (Figma → live site)

Figma file `hLl2NH7EWq53JM2QIiD5qU` (page "Design"). Updated 25 Nov 2026.
Rule for every page: content comes live from LearnWorlds; parts LearnWorlds has no data for are left out, not typed in.

| Page | Figma frame | Where | Status |
|---|---|---|---|
| Header and footer | Public navigation / Student header / Learning navigation / Public footer | Every site page (`site/custom-code/`) | **Done** |
| Home | 36:2 | `/` (`site/pages/home/`) | **Done** |
| Explore programmes, signed out | 199:2 | `/courses` (`site/pages/courses/`) | **Done** |
| Explore programs, signed in | 184:219 | `/courses` | **Done** |
| Public course details | 195:3 | Every `/course/<slug>` (site-wide code) | **Done** |
| Course details, signed in | 192:2 | Every `/course/<slug>`, for enrolled learners | **Done** |
| My learning | 184:2 | `/start` (`site/pages/my-learning/`), signed-in only | **Done** |
| Log in | 196:2 | LearnWorlds' sign-in window | **Skipped** (the user's decision, 25 Nov 2026): LearnWorlds' own window stays |
| Video lesson | 194:2 | LearnWorlds' course player | **Not possible with custom code** |
| Universities | (no Figma frame) | `/universities` (`site/pages/universities/`) | Done before this list |
| Profile and certificates | (no Figma frame; site look) | `/profile`, signed in | **Done**: "My courses" and "My certificates" are drawn like My learning; certificates list only earned ones (25 Nov 2026) |
| Account settings | (no Figma frame; site look) | `/account` (built-in page) | **Done** (25 Nov 2026): navy title band, sidebar card, one card per section, normal page scroll |
| Inbox, community, apps | (no Figma frame; site look) | `/inbox`, `/social`, apps (built-in pages) | **Done** (UX pass): same header, footer and look |
| 404 page | (no Figma frame; site look) | any unknown address | **Done** (UX pass) |
| Privacy, Terms | (no Figma frame; site look) | `/privacy`, `/terms` | **Layout done**; the text is still LearnWorlds' template (needs real policies). The footer links are disabled until then (25 Nov 2026) |
| About | (no Figma frame; site look) | `/about` | Invented sections **hidden**; a real page is **drafted** in `site/pages/about/`, waiting for approval |

## Details

**Header and footer.** Done on every site page, including LearnWorlds' built-in pages (`/account`, `/inbox`, `/social`, apps), which get the site styles through the 6th site slot:
- Strip, logo, menu, search, and Log in (opens LearnWorlds' sign-in). The menu is Online Courses (`/courses`), Residential Courses, University Partners (`/universities`) and Resources. Residential Courses and Resources are greyed out with no link: LearnWorlds has no residential courses yet, and there's no resources page yet.
- On narrow desktops (1180px and below), the menu gaps are tighter and a long signed-in name is shortened with "…" so the four menu items don't run into the account button. Checked from 991px to 1366px, signed out and signed in.

**1260px screens (demo laptop), fixed 25 Nov 2026.** Every page was checked at 1260px wide.
- Home: from 1280px down, the hero lost its top and bottom spacing and the "Find your next step" bar collapsed. The side-margin rule reset all padding; it now sets only the sides.
- University Partners (`/universities`): from 1280px down, its content now has the same 48px side margins as the header and footer.
- Course pages and Online Courses were already fine.
- Signed in: the account button shows the learner's name, and its menu has My learning, My certificates, Profile, Inbox, Account settings and Sign out.
- Phone menu, "Skip to content" for keyboard users, and the footer. In the footer, Privacy policy and Terms of use are shown greyed out and not clickable until the real policies exist.
- Height: 104px (32px strip plus 72px bar), shorter than Figma's 132px at the user's request; 88px on phones.
- The "My learning · My certificates · Account settings" bar was removed at the user's request (the links are in the account menu).
- Left out: "Saved programs" (LearnWorlds has no saved-programs feature).
- Not covered: the course player, which loads neither the site styles nor the built-in-pages slot.

**Home.** Hero changed at the user's request (25 Nov 2026):
- Title: "Practical industry-led courses for the textiles, apparel & fashion industry."
- Two buttons, the same as the menu: Online Courses (`/courses`) and Residential Courses. Residential Courses is greyed out until it has an address (see below).
- The hero search box is removed. The header search stays.
- No prices anywhere on the home page (cards, category headings, figures), at the user's request: visitors open the course page to see whether it's free or paid.
- Open: Residential Courses needs a destination, either a LearnWorlds page or residential courses. When it has one, put the address in `SITE.nav` (`body.html`) and turn the hero's greyed-out button into a link (`site/pages/home/page.html`).

**Explore programmes.** The header link to this page is now "Online Courses"; the page itself still says "Explore programs". Done for visitors (199:2): hero, search, Subject and Institution filters with counts, sort, 6 per page with pagination, address keeps filters, help band.
- Done for signed-in learners (184:219): hero with live program and institution counts and search, topic pills, Institution and Learning status (Not enrolled / Already enrolled) filters, 3 cards per row, and on enrolled cards "Enrolled · N% complete" with "Go to my learning".
- Left out: Duration filter (no structured duration, only the free-text Label), the "Recommended" label (no LearnWorlds data), "Save program" (no LearnWorlds feature), the "Learn from anywhere" note (static copy).

**Course details.** Done for visitors: hero, curriculum, price and LearnWorlds' enrol button, "Learn by doing", "Course at a glance", resources.
- Done for enrolled learners: progress card with "Resume learning" to the next lesson, module status (Completed / Up next / Not started), next lesson.
- Left out (no LearnWorlds data): What you'll learn, Level, Language, a separate About text, enquiry copy, certificate card, help band, assignment due dates ("Coming up next").

**My learning.** Done: active / completed / certificate counts, Continue learning (most recent course, resumes at the next lesson), My programs with Active / Completed / All tabs and search, achievements, recommended programs.
- Left out (no LearnWorlds data): weekly goal, assignment due dates, saved programs, support panel.

**Log in (skipped).** The user decided to keep LearnWorlds' own sign-in window. The header's "Log in" opens it.

**Profile.** "My certificates" lists only certificates the learner has earned (LearnWorlds' own certificate list decides). With none yet it says "No certificates yet" and links to My learning.

**Account settings (`/account`).** LearnWorlds' account app, restyled (builtin.css) with a title band (body.html):
- Navy "Account settings" band; LearnWorlds' "My Account" heading is hidden.
- Sidebar as a card that stays under the header. The section in view is marked by the site code, because LearnWorlds' own marker followed its old inner scroll box. Links scroll the page, and `#security` / `#payments` open at that section.
- Each section (Personal details, Account Security, Courses and programs, Payments) is a white card. Edit / Save / Cancel are outline buttons, an empty value shows "Not added", tables are framed, and the payment status is a tag.
- The page scrolls as one page (LearnWorlds scrolled the account inside a fixed-height box).

**Every page.**
- Search boxes show focus on the whole box (blue border and soft ring), not a partial outline around the text field.
- E-mail links (footer "Help center", "Talk to an adviser", "About Enterprise") also open a small "Email us" window with the address, Copy address, Gmail and Outlook, for computers with no e-mail app set up.

**Video lesson (not possible with custom code).** LearnWorlds' course player (`/path-player`) doesn't load the site styles, so its layout can't be changed. Only LearnWorlds' own player and theme settings (colours, fonts) apply there.
