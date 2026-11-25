# F2F Education website

The F2F Education site runs on LearnWorlds: **https://f2fedtech.learnworlds.com** (admin: `/author/dashboard`).

Courses, prices, the catalogue and learner data all live in LearnWorlds. This repo holds the code that gives the site its own look and pages: you change it here, see it on the real site at once, then publish it with one command.

| You are… | Read |
|---|---|
| Changing the site's look or a page | this README |
| Wondering how a part of the site works | [site/REFERENCE.md](site/REFERENCE.md) |
| Checking what's done and what's still open | [site/STATUS.md](site/STATUS.md) |
| Making or updating a course | [courses/_studio/README.md](courses/_studio/README.md) |
| Handing the work to Claude | open this folder in Claude Code; it reads [CLAUDE.md](CLAUDE.md) by itself |

## Set up (once per computer)

You need Windows with **Google Chrome** and **Node.js** 18 or newer.

```
npm install
```

For the course studio only: Python 3 and `pip install -r courses/_studio/requirements.txt`.

## Change something

| Step | Command | What happens |
|---|---|---|
| 1. See it | `npm run dev` | Chrome opens the live site with **your local files swapped in on every page**. Nothing is published. |
| 2. Edit | (your editor) | Save a file and the window reloads with the change. |
| 3. Check | `npm run status` | Lists what differs from the live site. |
| 4. Publish | `npm run push` | Puts every change live in one run. |

**`npm run dev`** opens the home page by default:

* `npm run dev -- courses` opens a page by name.
* `npm run dev -- /account` or `npm run dev -- course/staple-yarn-spinning` opens an address.
* `--phone` gives a phone-sized window.
* `--signed-out` opens a fresh window as a visitor.

To see learner pages (My learning, Profile, Account), click **Log in** in that window with a learner account. The window remembers the sign-in. A label in the bottom-left corner, **LOCAL PREVIEW · not published**, shows you're looking at your own files.

It needs internet. The site is hosted by LearnWorlds, so "local" means the real site with your code laid over it: real courses and logins, and nobody else sees your changes until you push.

**`npm run push`** opens its own Chrome window. The first time, sign in to the LearnWorlds **admin** there; it's remembered in `%LOCALAPPDATA%\f2f-education\` (a login: don't share it or put it in the repo). Then it writes the custom code into LearnWorlds by itself. Leave the window alone until it closes. It runs `npm run check` first and won't publish a script with a syntax error.

## What to edit

| To change | Edit |
|---|---|
| Header and footer links, menu, wording | `SITE` at the top of [site/custom-code/body.html](site/custom-code/body.html). An empty address shows the item greyed out and not clickable (Resources, Privacy policy and Terms of use are like that for now). |
| Colours, spacing, any style on any page | [site/custom-code/style.css](site/custom-code/style.css), in numbered sections: header and footer, course pages, profile, 404 … |
| Account, Inbox, Community pages | [site/custom-code/builtin.css](site/custom-code/builtin.css) |
| Course pages, Profile, 404, search (all pages) | the matching script in [site/custom-code/body.html](site/custom-code/body.html) |
| Home, Explore programs, My learning, Universities, About | [site/pages/&lt;name&gt;/](site/pages/): `page.html` and `page.css` |
| A course, its price, category or picture | the LearnWorlds admin, not this repo |

## Rules

1. **Edits made in the LearnWorlds admin are kept.** If `npm run status` says **EDITED**, run `npm run pull` first; it copies that edit into your files. `push` refuses to overwrite an admin edit.
2. **A page goes live only once it's approved.** Mark it with `"publish": true` in its `page.json`; `site/pages/about/` is a draft without it.
3. **No made-up content.** The pages show LearnWorlds data. Anything LearnWorlds has no data for is left out, not typed in.
4. Keep the banner comments at the start and end of the files in `site/custom-code/`; the tools find the code by them. Don't write the body tag's name in angle brackets in `body.html` (LearnWorlds rewrites it).

## All commands

| Command | What it does |
|---|---|
| `npm run dev` | Local preview on the live site; reloads on save (`npm run preview` does the same) |
| `npm run check` | Finds JavaScript syntax errors in the site code |
| `npm run status` | Local files compared with the live site; no sign-in |
| `npm run pull` | Copies admin edits into the local files |
| `npm run push` | Publishes what changed. `-- site` publishes only the site-wide code; `-- courses` only that page. `--check` only reads |
| `npm run new-page -- <name> --path /<address>` | Starts a new page in `site/pages/` |
| `npm run build` | Writes the generated page code to `site/dist/` to look at |

## Folder

| Path | What it is |
|---|---|
| `site/custom-code/` | Code on every page: `head.html`, `body.html`, `style.css`, `builtin.css` |
| `site/pages/` | Pages designed here: `home`, `courses` (Explore programs), `my-learning` (`/start`), `universities`, `about` (draft) |
| `site/tools/` | The commands above |
| `site/state/` | What the tools remember about the live site (how they spot admin edits). **Commit it**; don't edit it |
| `site/brand/` | Logo and hero illustration |
| `courses/` | Source of each live course (lessons, quiz imports, card images) and `_studio/`, the tools that build and upload courses |
| `articles/` | Fibre2Fashion articles saved to turn into courses |
| `CLAUDE.md` | Handover notes for Claude Code: rules, how the code lands in LearnWorlds, pitfalls |

Not in the repo (see `.gitignore`): `node_modules/` (run `npm install`), `site/dist/` (generated), and the course videos and PDF guides. Those are rebuilt by `courses/_studio/build.py` and are already uploaded to LearnWorlds; local copies stay on the original computer.
