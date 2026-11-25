# F2F course studio

Setup: Python 3, then `pip install -r courses/_studio/requirements.txt`. Node.js and Chrome come from the site setup (`npm install` in the repo root). Course videos (`video/`) and PDF guides are generated here and not kept in git.

## Readable courses (text lessons, no video): the quick way

For most new courses, use text lessons instead of videos. One article becomes a course in minutes:

1. Save the article: in the Playwright browser (fibre2fashion.com blocks headless/curl fetches with an AWS WAF check), read
   `#divArticleFile` and save it as `articles/<id>-<slug>.json` with a `markdown` field. Don't fetch many in a row; the
   site shows a CAPTCHA after about nine pages.
2. Write `courses/<slug>/content.json` + `courses/<slug>/lessons/*.md` following [READING_SCHEMA.md](READING_SCHEMA.md).
3. `python courses/_studio/reading.py <slug>` (set `TEMP`/`TMP` to a folder on F: if C: is full). It writes
   `upload/Lesson N - <title>.docx`, `assessments/knowledge-check.xlsx`, `course-card.jpg` and `learnworlds-setup.md`.
4. Put it into LearnWorlds with scripts (about 6 minutes a course):
   `python courses/_studio/lw_publish_js.py <slug>` writes three Playwright scripts to
   `.scratch/lw/`. Run them in order in the signed-in admin browser (Playwright MCP `browser_run_code_unsafe` with `filename`):
   * `<slug>-1-create.js`: Create-course wizard (copies Staple Yarn's clean page), Upload & convert of the `.docx` lessons
     (each becomes an Ebook activity), activities renamed "Lesson N: Title", the "Lessons" section set to Public, and a second
     section with a blank exam. It ends in the exam editor.
   * `<slug>-2-quiz.js`: imports the questions, sets a 70% pass mark and adds the certificate. It must start in that exam editor.
   * `<slug>-3-settings.js`: card description, label, author and avatar, categories, SEO, card image, Free pricing and Public access,
     then reads the settings back. It is safe to run again if it stops partway (categories and pricing are skipped when already there).

   The manual route is "Putting a course into LearnWorlds" below; in its step 4, upload the `.docx` files instead of videos.
   The label is "N min · Reading". The author is the institution shown on University Partners (`/universities`; course settings →
   Author's name and avatar). The script's default is **Fibre2Fashion Education** with `courses/_universities/fibre2fashion-education.png`.
   For another institution pass its name and avatar after the slug: `"AMFI (Amsterdam Fashion Institute)" courses/_universities/amfi.png`
   or `"Sustainable Fashion School" courses/_universities/sustainable-fashion-school.png`. Categories: see
   READING_SCHEMA.md (Sourcing and Merchandising are usually a course's second category, after Apparel Manufacturing).

## Video courses

Turns one `content.json` per course into everything a free LearnWorlds mini-course needs:

| Output (in `courses/<slug>/`) | What it is | Where it goes in LearnWorlds |
|---|---|---|
| `video/NN-<lesson>.mp4` | one slide-based video per lesson (1080p, no voice-over) | a **Video** learning activity per lesson |
| `<slug>-visual-guide.pdf` | every finished slide + glossary | a **PDF** learning activity ("Download the visual guide") |
| `assessments/knowledge-check.xlsx` | the quiz in LearnWorlds' import format | Assessment builder → Add/Import → Import questions → From Excel |
| `course-card.jpg` | 1280 × 720 course image | Course settings → General → Course card image |
| `learnworlds-setup.md` | title, card description, label, categories, course-page text, transcripts | copy/paste into course settings and the video activities' descriptions |

## Make or change a course

1. Write or edit `courses/<slug>/content.json`; see [CONTENT_SCHEMA.md](CONTENT_SCHEMA.md) for the format and text limits.
2. Check it: `python courses/_studio/build.py <slug> --check`
3. Build everything: `python courses/_studio/build.py <slug>`. You can also build in parts: `--frames`, `--video`, `--pdf`, `--card`, `--copy`, and `--lessons 2,3` limits a build to those lessons.
4. Quiz file: `python courses/_studio/lw_quiz.py <slug>`

Needs **Google Chrome** (renders the slides headless through `render_cdp.mjs`, so Node.js too), Python with Pillow and PyMuPDF, and
**imageio-ffmpeg** (`pip install imageio-ffmpeg`, which ships its own ffmpeg and encodes the MP4s). If ffmpeg isn't available, the build
falls back to Microsoft PowerPoint (`make_video.ps1`), which is much slower. A full course takes about 15–25 minutes.

## Putting a course into LearnWorlds (about 15 minutes a course)

1. Courses → **Create course** → Build it yourself: title, card description, URL slug, keep **Draft**, and under
   *Pick a page template* choose **"Select a page layout used in another course" → Staple Yarn Spinning**. The new course page then
   copies the clean F2F layout and needs no clean-up.
2. Course settings → General: Label, Author "Fibre2Fashion Education" (avatar `courses/_universities/fibre2fashion-education.png`; AMFI courses: "AMFI (Amsterdam Fashion Institute)", `amfi.png`), categories, course image (`course-card.jpg`, crop to the
   full image). Turn **Automatically extract Course SEO** off and write an SEO description under 160 characters; the course page
   hero shows it.
3. Pricing → Add pricing option → **Free**, status **Public**.
4. Course outline → **Upload & convert**: upload the 6 MP4s and the PDF together. They arrive in one section. Rename the section
   "Video lessons" (access **Public**) and the items "Lesson N: …".
5. Add section "Knowledge check and certificate" (Public): Exams → Blank exam → *Add/Import → Import questions → From Excel*
   (`assessments/knowledge-check.xlsx`), then Settings → Grade & Attempts → pass 70 %. Then Certificates → Certificate of completion.
   Its default requirement is "Complete all exams".
6. Access → **Public** → Save.

## How it looks and why

* The design matches the site theme: navy `#0D1B3E`, brand blue `#1B5FA8`, yellow tag `#F6C744`, the Inter font, and the F2F Education logo. The woven pattern on title slides is the course-family motif.
* Each slide reveals its points one at a time with a soft fade. Time on screen is based on how much new text appears (about 3 words a second, plus a pause at the end).
* There is no narration track. The `say` lines are the voice-over script and are also used as the transcript in `learnworlds-setup.md`. A voice-over can be recorded later and added in PowerPoint or a video editor.
* Every course credits its source article and authors on each slide and on the course page.

## Files

* `slide.css` / `slide.js`: the slide template and layouts (opener, cards, list, focus, chips, compare, shift, statement, definition, stack, example, stats, table, formula, calc, reflect, recap, closing, cover, glossary)
* `build.py`: renders the frames and builds the videos, PDF, card and copy
* `make_video.ps1`: PowerPoint automation that turns the frames into an MP4
* `lw_quiz.py`: writes the quiz import file
* `lib/`: the Inter font and Lucide icons (both open licences), the logo, and the base Excel template LearnWorlds accepts
* `icons.txt`: the icon names you can use
